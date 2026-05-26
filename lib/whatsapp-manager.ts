import os from 'os';
import path from 'path';
import fs from 'fs';
import fsExtra from 'fs-extra';
import QRCode from 'qrcode';
import { GoogleGenAI } from "@google/genai";
import Pino from 'pino';
import { getFirestoreDb } from './firebase-admin';
import { getAuthPath } from './firebase-admin';

const IS_VERCEL = !!process.env.VERCEL;

let WhatsApp: any = null;
let expressWebhookHandler: any = null;

export async function getMetaCloudAPI() {
  if (!WhatsApp || !expressWebhookHandler) {
    const mod = await import('meta-cloud-api');
    WhatsApp = mod.WhatsApp;
    expressWebhookHandler = mod.expressWebhookHandler;
  }
  return { WhatsApp, expressWebhookHandler };
}

export const waAttachments = new Map<string, Buffer>();

export async function downloadAttachment(userId: string, messageId: string): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
  const userMessages = waMessages.get(userId);
  if (!userMessages) return null;

  for (const [chatId, messages] of userMessages) {
    const msg = messages.find((m: any) => m.key.id === messageId);
    if (!msg?.message) continue;

    const sock = waSessions.get(userId);
    if (!sock) return null;

    try {
      const mediaKey = msg.message?.imageMessage?.mediaKey ||
        msg.message?.videoMessage?.mediaKey ||
        msg.message?.audioMessage?.mediaKey ||
        msg.message?.documentMessage?.mediaKey;

      const mimeType = msg.message?.imageMessage?.mimetype ||
        msg.message?.videoMessage?.mimetype ||
        msg.message?.audioMessage?.mimetype ||
        msg.message?.documentMessage?.mimetype ||
        msg.message?.stickerMessage?.mimetype ||
        'application/octet-stream';

      const filename = msg.message?.imageMessage?.fileName ||
        msg.message?.videoMessage?.fileName ||
        msg.message?.audioMessage?.fileName ||
        msg.message?.documentMessage?.fileName ||
        msg.message?.stickerMessage?.fileName ||
        `attachment_${messageId}`;

      let downloadPath: string;

      if (msg.message?.imageMessage) {
        const buffer = await sock.downloadMediaMessage(msg, { flag: 'download' });
        waAttachments.set(messageId, buffer);
        return { buffer, mimeType, filename };
      }

      if (msg.message?.documentMessage) {
        const buffer = await sock.downloadMediaMessage(msg, { flag: 'download' });
        waAttachments.set(messageId, buffer);
        return { buffer, mimeType, filename };
      }

      if (msg.message?.videoMessage) {
        const buffer = await sock.downloadMediaMessage(msg, { flag: 'download' });
        waAttachments.set(messageId, buffer);
        return { buffer, mimeType, filename };
      }

      if (msg.message?.audioMessage) {
        const buffer = await sock.downloadMediaMessage(msg, { flag: 'download' });
        waAttachments.set(messageId, buffer);
        return { buffer, mimeType, filename };
      }

      return null;
    } catch (err) {
      console.warn('Failed to download attachment:', err);
      return null;
    }
  }

  return null;
}

export async function uploadAttachment(userId: string, filename: string, buffer: Buffer, mimeType: string): Promise<string> {
  const userDir = path.join(os.tmpdir(), `wa_attachments_${userId}`);
  fsExtra.ensureDirSync(userDir);

  const filePath = path.join(userDir, `${Date.now()}_${filename}`);
  await fs.promises.writeFile(filePath, buffer);

  return filePath;
}

export function readAttachmentFile(filePath: string): { content: string; metadata: { size: number; type: string; name: string } } {
  const stats = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath);

  const textExtensions = ['.txt', '.csv', '.json', '.md', '.log', '.xml', '.html', '.css', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.sql', '.yaml', '.yml', '.ini', '.cfg', '.conf', '.env'];
  const docExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff'];

  const fileType = textExtensions.includes(ext) ? 'text' :
    docExtensions.includes(ext) ? 'document' :
      imageExtensions.includes(ext) ? 'image' :
        'binary';

  if (fileType === 'text') {
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      content: content.slice(0, 50000),
      metadata: { size: stats.size, type: mimeType, name: basename }
    };
  }

  if (fileType === 'document' && ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    const textContent = extractPdfText(buffer);
    return {
      content: textContent.slice(0, 50000),
      metadata: { size: stats.size, type: mimeType, name: basename }
    };
  }

  return {
    content: `[Binary file: ${basename} (${stats.size} bytes, type: ${mimeType}) - content not displayed]`,
    metadata: { size: stats.size, type: mimeType, name: basename }
  };
}

function extractPdfText(buffer: Buffer): string {
  try {
    const str = buffer.toString('latin1');
    const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
    let text = '';
    let match;

    while ((match = streamRegex.exec(str)) !== null) {
      const stream = match[1];
      const textObjects = stream.match(/\(([^)]+)\)/g) || [];
      for (const obj of textObjects) {
        const cleaned = obj.replace(/[()]/g, '');
        if (cleaned.match(/[A-Za-z0-9\s]/)) {
          text += cleaned + ' ';
        }
      }
    }

    return text.trim() || '[PDF text extraction limited - content may be image-based]';
  } catch {
    return '[PDF content could not be extracted]';
  }
}

export function parseFileContent(content: string, filename: string): any {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.json') {
    try {
      return JSON.parse(content);
    } catch {
      return { raw: content, parseError: 'Invalid JSON' };
    }
  }

  if (ext === '.csv') {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length === 0) return { rows: [], headers: [] };

    const delimiter = content.includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/["']/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });
      return obj;
    });

    return { headers, rows, rowCount: rows.length };
  }

  if (ext === '.xml') {
    return { format: 'xml', content };
  }

  return { format: 'text', content };
}

let _whatsAppClient: any | null = null;

export function learnBossStyleFromChatFile(filePath: string): { bossStyle: any; contacts: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const bossMessages: string[] = [];
  const contactMessages: Map<string, string[]> = new Map();
  let currentContact = '';
  let currentMessage = '';
  let messageDirection: 'boss' | 'contact' | null = null;

  for (const line of lines) {
    const senderMatch = line.match(/^\[.*?\]\s+([^:]+):/);
    const attachedMatch = line.match(/<attached:\s+[^>]+>/);
    const cleanLine = line.replace(/^\[.*?\]\s+/, '').replace(/<attached:\s+[^>]+>/, '').trim();

    if (senderMatch) {
      const sender = senderMatch[1].trim();
      if (sender === 'Jo Lernout') {
        if (currentMessage.trim() && messageDirection === 'contact' && currentContact) {
          const arr = contactMessages.get(currentContact) || [];
          arr.push(currentMessage.trim());
          contactMessages.set(currentContact, arr);
        }
        if (cleanLine && !attachedMatch) {
          bossMessages.push(cleanLine);
        }
        currentMessage = '';
        messageDirection = 'boss';
      } else {
        if (currentMessage.trim() && messageDirection === 'boss') {
          bossMessages.push(currentMessage.trim());
        }
        currentContact = sender;
        currentMessage = cleanLine && !attachedMatch ? cleanLine : '';
        messageDirection = 'contact';
      }
    } else if (line.trim() && messageDirection === 'boss') {
      currentMessage += ' ' + line.trim();
    }
  }

  if (currentMessage.trim()) {
    if (messageDirection === 'boss') {
      bossMessages.push(currentMessage.trim());
    } else if (currentContact) {
      const arr = contactMessages.get(currentContact) || [];
      arr.push(currentMessage.trim());
      contactMessages.set(currentContact, arr);
    }
  }

  const allBossText = bossMessages.join(' ');
  const emojiSet = new Set<string>();
  const emojiRegex = /\p{Emoji}/gu;
  let match;
  while ((match = emojiRegex.exec(allBossText)) !== null) {
    emojiSet.add(match[0]);
  }

  const vulgarWords = ['fuck', 'shit', 'bitch', 'ass', 'damn', 'hell', 'crap'];
  const hasVulgar = vulgarWords.some(w => allBossText.toLowerCase().includes(w));

  const abbreviations = ['u', 'r', 'ur', 'wanna', 'gonna', 'gotta', 'kinda', 'sorta', 'lol', 'lmao', 'ngl', 'fr', 'frfr', 'lowkey', 'highkey', 'idk', 'tbh', 'imo', 'aka', 'btw', 'omg', 'wtf'];
  const foundAbbreviations: string[] = [];
  for (const abbr of abbreviations) {
    if (allBossText.toLowerCase().includes(abbr)) {
      foundAbbreviations.push(abbr);
    }
  }

  const greetingPatterns: string[] = [];
  const greetings = ['hey', 'hi', 'hello', 'what\'s up', 'yo', 'sup', 'good morning', 'good afternoon', 'good evening', 'wassup', 'ing'];
  for (const g of greetings) {
    if (allBossText.toLowerCase().includes(g)) {
      greetingPatterns.push(g);
    }
  }

  const signoffPatterns: string[] = [];
  const signoffs = ['thanks', 'thank you', 'cheers', 'brb', 'later', 'talk later', 'gotta go', 'bye', 'see ya', 'take care', 'peace', 'ingat', 'salamat', 'maraming salamat'];
  for (const s of signoffs) {
    if (allBossText.toLowerCase().includes(s)) {
      signoffPatterns.push(s);
    }
  }

  const validMessages = bossMessages.filter(m => m.length > 0);
  const avgLength = validMessages.length > 0
    ? validMessages.reduce((sum, m) => sum + m.length, 0) / validMessages.length
    : 0;

  const bossStyle = {
    analyzedAt: new Date(),
    messageCount: bossMessages.length,
    confidence: Math.min(bossMessages.length / 30, 1.0),
    relationshipType: 'boss',
    patterns: {
      greeting: greetingPatterns,
      signoff: signoffPatterns,
      avgMessageLength: Math.round(avgLength),
      emojiFrequency: emojiSet.size / Math.max(bossMessages.length, 1),
      emojiFingerprint: Array.from(emojiSet),
      capitalizationStyle: 'mixed' as const,
      questionRatio: bossMessages.filter(m => m.includes('?')).length / Math.max(bossMessages.length, 1),
      abbreviationUsage: foundAbbreviations,
      slangUsage: foundAbbreviations,
      commonPhrases: extractCommonPhrases(bossMessages),
      sentenceStyle: avgLength < 30 ? 'short' as const : avgLength > 80 ? 'long' as const : 'medium' as const,
      toneStyle: 'casual' as const,
      typingRhythm: 'mixed' as const,
      ellipsisUsage: allBossText.includes('...') ? 'sometimes' as const : 'never' as const,
      punctuationStyle: 'normal' as const,
      vulgarLanguageUsage: hasVulgar ? 'frequently' as const : 'never' as const,
      vulgarLanguageFingerprint: hasVulgar ? vulgarWords.filter(w => allBossText.toLowerCase().includes(w)) : [],
    },
    dealBreakers: [],
    responseTemplates: [],
    sampleMessages: bossMessages.slice(0, 20),
  };

  return { bossStyle, contacts: Array.from(contactMessages.keys()) };
}

export async function saveBossStyleToFirestore(userId: string, style: any): Promise<void> {
  const db = getFirestoreDb();
  await db
    .collection('users')
    .doc(userId)
    .collection('whatsapp_style')
    .doc('boss')
    .set(style);
}

export async function getBossStyleFromFirestore(userId: string): Promise<any | null> {
  const db = getFirestoreDb();
  const doc = await db
    .collection('users')
    .doc(userId)
    .collection('whatsapp_style')
    .doc('boss')
    .get();
  return doc.exists ? doc.data() : null;
}

export async function uploadChatFileAndLearnStyle(userId: string, filePath: string): Promise<{ bossStyle: any; contactCount: number }> {
  const { bossStyle, contacts } = learnBossStyleFromChatFile(filePath);
  await saveBossStyleToFirestore(userId, bossStyle);
  return { bossStyle, contactCount: contacts.length };
}

function extractCommonPhrases(messages: string[]): string[] {
  const phraseCounts = new Map<string, number>();
  for (const text of messages) {
    const words = text.toLowerCase().split(/\s+/);
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = words.slice(i, i + 3).join(' ');
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
    }
  }
  return Array.from(phraseCounts.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([phrase]) => phrase)
    .slice(0, 15);
}

export async function getWhatsAppClient() {
  if (!_whatsAppClient) {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (accessToken && phoneNumberId) {
      const { WhatsApp } = await getMetaCloudAPI();
      _whatsAppClient = new WhatsApp({ accessToken, phoneNumberId: parseInt(phoneNumberId, 10) });
    }
  }
  return _whatsAppClient;
}

export const waSessions = new Map<string, any>();
export const waQRs = new Map<string, string>();
export const waStates = new Map<string, any>(); 
export const waContacts = new Map<string, Map<string, any>>();
export const waMessages = new Map<string, Map<string, any[]>>();

export const getAuthPath = (userId: string) => path.join(os.tmpdir(), `baileys_auth_${userId}`);

export async function startBaileysSession(userId: string) {
  if (IS_VERCEL) {
    throw new Error('Baileys pairing/sessions are not supported on Vercel serverless.');
  }

  const baileys = await import('@whiskeysockets/baileys');
  const baileysLib = (baileys as any).default ?? baileys;
  const baileysAny = baileysLib as any;
  const makeWASocket = baileysLib.makeWASocket || baileysAny.default?.makeWASocket || baileysAny.default || baileysLib;
  const useMultiFileAuthState = baileysLib.useMultiFileAuthState || baileysAny.default?.useMultiFileAuthState;
  const DisconnectReason = baileysLib.DisconnectReason || baileysAny.default?.DisconnectReason;
  const fetchLatestBaileysVersion = baileysLib.fetchLatestBaileysVersion || baileysAny.default?.fetchLatestBaileysVersion;

  const authPath = getAuthPath(userId);
  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const { version } = await fetchLatestBaileysVersion();
  
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: Pino({ level: 'silent' }) as any
  });

  waSessions.set(userId, sock);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('contacts.upsert', (contacts: any[]) => {
    let userContacts = waContacts.get(userId);
    if (!userContacts) {
      userContacts = new Map();
      waContacts.set(userId, userContacts);
    }
    for (const contact of contacts) {
      userContacts.set(contact.id, contact);
    }
  });

  sock.ev.on('messages.upsert', async (m: any) => {
    let userMessages = waMessages.get(userId);
    if (!userMessages) {
      userMessages = new Map();
      waMessages.set(userId, userMessages);
    }
    for (const msg of m.messages) {
      const chatId = msg.key.remoteJid;
      if (chatId) {
        let chatMsgs = userMessages.get(chatId);
        if (!chatMsgs) {
          chatMsgs = [];
          userMessages.set(chatId, chatMsgs);
        }
        chatMsgs.push(msg);
        if (chatMsgs.length > 50) userMessages.set(chatId, chatMsgs.slice(-50));
      }
    }

    const { messages, type } = m;
    try {
      if (type !== 'notify') return;

      for (const message of messages) {
        if (!message.message) continue;
        if (message.key.fromMe) continue;

        const remoteJid = message.key.remoteJid;
        const messageText = 
          message.message.conversation || 
          message.message.extendedTextMessage?.text || 
          message.message.imageMessage?.caption || 
          message.message.videoMessage?.caption || 
          '';

        if (!remoteJid || !messageText.trim()) continue;

        try {
          const firestore = getFirestoreDb();
          await firestore
            .collection('users')
            .doc(userId)
            .collection('whatsapp_messages')
            .add({
              phone: remoteJid,
              text: messageText,
              direction: 'incoming',
              status: 'received',
              provider: 'baileys',
              timestamp: new Date().toISOString(),
              rawMessageId: message.key.id || null
            });
        } catch (logErr) {
          console.warn('Failed to log incoming WhatsApp message:', logErr);
        }
      }
    } catch (error) {
      console.error('WhatsApp incoming message handler error:', error);
    }
  });

  sock.ev.on('connection.update', (update: any) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      QRCode.toDataURL(qr).then((url: string) => {
        waQRs.set(userId, url);
      });
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        startBaileysSession(userId);
      } else {
        waSessions.delete(userId);
        waQRs.delete(userId);
        waStates.delete(userId);
        const authPath = getAuthPath(userId);
        if (fs.existsSync(authPath)) {
          fs.rmSync(authPath, { recursive: true, force: true });
        }
      }
    } else if (connection === 'open') {
      waQRs.delete(userId);
      waStates.set(userId, {
        phone: sock.user?.id?.split(':')[0] || 'Unknown Phone',
        name: sock.user?.name || 'WhatsApp User'
      });
    }
  });

  return sock;
}

