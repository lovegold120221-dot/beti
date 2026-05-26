import { FunctionCall } from '../state';
import { FunctionResponseScheduling } from '@google/genai';

export const whatsappTools: FunctionCall[] = [
  {
    name: 'send_whatsapp_message',
    description: 'Sends an official WhatsApp message to a specific phone number using Eburon\'s Meta for Developers WhatsApp Cloud API. Use this tool for WhatsApp actions only; do not invoke unrelated tools for WhatsApp queries. Ensure you have confirmed the user\'s intent and the phone number before sending.',
    parameters: {
      type: 'OBJECT',
      properties: {
        phone: {
          type: 'STRING',
          description: 'The phone number of the recipient in international format (e.g., "15550199999").',
        },
        text: {
          type: 'STRING',
          description: 'The content of the message to send.',
        },
      },
      required: ['phone', 'text'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'connect_whatsapp',
    description: 'Launches the WhatsApp linkage and configuration interface on screen, guiding the user through connecting their WhatsApp Business portfolio or scanning the QR code pairing process. Only use for WhatsApp connection workflows.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'search_whatsapp_contacts',
    description: 'Retrieves the list of contacts synced from the user\'s connected WhatsApp account. Use this to lookup the phone number of a friend or contact by name. Use this tool for WhatsApp contact lookup only.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Optional query string to search for a contact by name or number.'
        }
      },
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'read_whatsapp_chats',
    description: 'Retrieves the recent chats and their latest messages from the user\'s connected WhatsApp account. If a specific chat "jid" is provided, it retrieves the recent message history for that chat. Use this tool only for WhatsApp chat history and review.',
    parameters: {
      type: 'OBJECT',
      properties: {
        jid: {
          type: 'STRING',
          description: 'Optional. The WhatsApp JID (e.g. 15551234567@s.whatsapp.net) to get the message history for a specific chat.'
        }
      },
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'learn_boss_style_from_chat_file',
    description: 'Uploads a WhatsApp chat export file (txt format) and learns the boss\'s chat style - how boss talks, greeting patterns, sign-offs, emoji usage, vulgar language, abbreviations, slang. This teaches Beatrice to respond in the boss\'s authentic voice. Boss uploads file, Beatrice analyzes it.',
    parameters: {
      type: 'OBJECT',
      properties: {
        filePath: {
          type: 'STRING',
          description: 'Path to the chat export file (e.g., /Users/eburon/737733/boses/_chat.txt)',
        },
      },
      required: ['filePath'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'read_uploaded_file',
    description: 'Reads and extracts text content from an uploaded file (txt, csv, json, md, pdf). Returns the file content and metadata. Use this when boss attaches a file and wants Beatrice to read/analyze it.',
    parameters: {
      type: 'OBJECT',
      properties: {
        filePath: {
          type: 'STRING',
          description: 'Path to the file to read.',
        },
      },
      required: ['filePath'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'parse_file_content',
    description: 'Parses structured content from files like JSON and CSV. Returns structured data (arrays, objects) that can be analyzed. Use for data files, exports, structured documents.',
    parameters: {
      type: 'OBJECT',
      properties: {
        filePath: {
          type: 'STRING',
          description: 'Path to the file to parse.',
        },
        filename: {
          type: 'STRING',
          description: 'Name of the file (for extension detection).',
        },
      },
      required: ['filePath', 'filename'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'get_boss_style_profile',
    description: 'Retrieves the learned boss chat style profile - shows how boss talks including greeting patterns, sign-offs, emoji fingerprint, abbreviations, vulgar language usage, sentence style, and sample messages.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
];

