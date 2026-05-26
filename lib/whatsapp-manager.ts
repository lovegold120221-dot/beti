import os from 'os';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { GoogleGenAI } from "@google/genai";
import Pino from 'pino';
import { getFirestoreDb } from './firebase-admin';

const IS_VERCEL = !!process.env.VERCEL;

let WhatsApp: any = null;
let expressWebhookHandler: any = null;

async function getMetaCloudAPI() {
  if (!WhatsApp || !expressWebhookHandler) {
    const mod = await import('meta-cloud-api');
    WhatsApp = mod.WhatsApp;
    expressWebhookHandler = mod.expressWebhookHandler;
  }
  return { WhatsApp, expressWebhookHandler };
}

let _whatsAppClient: any | null = null;

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

export async function getMetaCloudAPI() {
  if (!WhatsApp || !expressWebhookHandler) {
    const mod = await import('meta-cloud-api');
    WhatsApp = mod.WhatsApp;
    expressWebhookHandler = mod.expressWebhookHandler;
  }
  return { WhatsApp, expressWebhookHandler };
}

export { getMetaCloudAPI };

