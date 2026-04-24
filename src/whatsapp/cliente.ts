import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  proto,
  WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { config } from '../config';

type HandlerMensagem = (msg: proto.IWebMessageInfo) => Promise<void>;

let socket: WASocket | null = null;
let handlerMensagem: HandlerMensagem | null = null;

export function definirHandlerMensagem(fn: HandlerMensagem): void {
  handlerMensagem = fn;
}

export async function conectarWhatsApp(): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(config.whatsapp.diretorioAuth);
  const logger = pino({ level: 'silent' });

  async function conectar(): Promise<WASocket> {
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger,
      browser: ['Agente Virtual', 'Chrome', '120.0.0'],
      generateHighQualityLinkPreview: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) console.log('\n📱 Escaneie o QR Code acima com o WhatsApp para autenticar o agente\n');

      if (connection === 'close') {
        const codigo = (lastDisconnect?.error as Boom)?.output?.statusCode;
        if (codigo !== DisconnectReason.loggedOut) {
          console.log(`🔄 Reconectando (código ${codigo})...`);
          socket = await conectar();
        } else {
          console.error('❌ Sessão encerrada. Delete auth_info_baileys/ e reconecte.');
          process.exit(1);
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp conectado!\n');
        if (!config.whatsapp.idGrupoGestores) {
          console.warn('⚠️  ID_GRUPO_GESTORES não configurado. Escalações sem grupo configurado serão ignoradas.');
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (msg.key.fromMe || !handlerMensagem) continue;
        try {
          await handlerMensagem(msg);
        } catch (err) {
          console.error('[handler] Erro ao processar mensagem:', err);
        }
      }
    });

    socket = sock;
    return sock;
  }

  return conectar();
}

export async function enviarMensagem(
  jid: string,
  texto: string,
  opcoes?: { mensagemCitada?: proto.IWebMessageInfo; mencoes?: string[] }
): Promise<proto.IWebMessageInfo | undefined> {
  if (!socket) throw new Error('WhatsApp não conectado');
  return socket.sendMessage(
    jid,
    { text: texto, mentions: opcoes?.mencoes },
    opcoes?.mensagemCitada ? { quoted: opcoes.mensagemCitada } : undefined
  );
}

export function obterJidDoAgente(): string {
  if (!socket?.user?.id) return '';
  return `${socket.user.id.split(':')[0].split('@')[0]}@s.whatsapp.net`;
}

export async function obterNomeGrupo(idGrupo: string): Promise<string> {
  if (!socket) return idGrupo;
  try {
    const metadata = await socket.groupMetadata(idGrupo);
    return metadata.subject || idGrupo;
  } catch {
    return idGrupo;
  }
}
