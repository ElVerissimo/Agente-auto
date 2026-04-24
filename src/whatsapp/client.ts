import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  proto,
  WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { config } from '../config';

type MessageHandler = (msg: proto.IWebMessageInfo) => Promise<void>;

let sock: WASocket | null = null;
let handler: MessageHandler | null = null;

export function setMessageHandler(fn: MessageHandler): void {
  handler = fn;
}

export async function connectWhatsApp(): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(config.whatsapp.authDir);
  const logger = pino({ level: 'silent' });

  async function connect(): Promise<WASocket> {
    const socket = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger,
      browser: ['Agente Virtual', 'Chrome', '120.0.0'],
      generateHighQualityLinkPreview: false,
    });

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n📱 Escaneie o QR Code acima com o WhatsApp para autenticar o agente\n');
      }

      if (connection === 'close') {
        const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = code !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          console.log(`🔄 Conexão encerrada (código ${code}). Reconectando...`);
          sock = await connect();
        } else {
          console.error('❌ Sessão encerrada. Delete a pasta auth_info_baileys/ e reconecte.');
          process.exit(1);
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp conectado com sucesso!');
        if (!config.whatsapp.managersGroupId) {
          console.warn(
            '⚠️  MANAGERS_GROUP_ID não configurado. ' +
            'Escalações não serão enviadas ao grupo de gestores.\n' +
            '   Envie uma mensagem em um grupo e verifique o log para obter o ID.'
          );
        }
      }
    });

    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (msg.key.fromMe || !handler) continue;
        try {
          await handler(msg);
        } catch (err) {
          console.error('Erro ao processar mensagem:', err);
        }
      }
    });

    sock = socket;
    return socket;
  }

  return connect();
}

export async function sendText(
  jid: string,
  text: string,
  quotedMsg?: proto.IWebMessageInfo,
  mentions?: string[]
): Promise<proto.IWebMessageInfo | undefined> {
  if (!sock) throw new Error('WhatsApp não conectado');
  const opts = quotedMsg ? { quoted: quotedMsg } : undefined;
  return sock.sendMessage(jid, { text, mentions }, opts);
}

export function getBotJid(): string {
  if (!sock?.user?.id) return '';
  // Normalize: "5511999999999:0@s.whatsapp.net" → "5511999999999@s.whatsapp.net"
  const number = sock.user.id.split(':')[0].split('@')[0];
  return `${number}@s.whatsapp.net`;
}

export async function getGroupName(groupJid: string): Promise<string> {
  if (!sock) return groupJid;
  try {
    const metadata = await sock.groupMetadata(groupJid);
    return metadata.subject || groupJid;
  } catch {
    return groupJid;
  }
}

export function getSocket(): WASocket | null {
  return sock;
}
