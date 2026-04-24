import { proto } from '@whiskeysockets/baileys';
import { config } from '../config';
import { handleChatParticular } from './handlers/particular';
import { handleMencaoGrupo, handleRespostaGestor, agenteFoiMencionado } from './handlers/grupo';
import { handleTreinamento } from './handlers/treinamento';
import { obterJidDoAgente } from './cliente';

function extrairTexto(msg: proto.IWebMessageInfo): string | null {
  const m = msg.message;
  if (!m) return null;
  return m.conversation ?? m.extendedTextMessage?.text ?? m.imageMessage?.caption ?? m.videoMessage?.caption ?? null;
}

function extrairIdCitado(msg: proto.IWebMessageInfo): string | null {
  return msg.message?.extendedTextMessage?.contextInfo?.stanzaId ?? null;
}

function ehGrupo(jid: string): boolean {
  return jid.endsWith('@g.us');
}

function formatarTelefone(jid: string): string {
  return jid.split(':')[0].split('@')[0];
}

export async function roteadorMensagens(msg: proto.IWebMessageInfo): Promise<void> {
  const jid = msg.key.remoteJid;
  if (!jid) return;

  const texto = extrairTexto(msg)?.trim();
  if (!texto) return;

  // ── Grupo de treinamento ────────────────────────────────────────────────
  if (config.whatsapp.idGrupoTreinamento && jid === config.whatsapp.idGrupoTreinamento) {
    await handleTreinamento(msg);
    return;
  }

  if (ehGrupo(jid)) {
    // ── Grupo de gestores: roteador de respostas às escalações ──────────
    if (config.whatsapp.idGrupoGestores && jid === config.whatsapp.idGrupoGestores) {
      const idCitado = extrairIdCitado(msg);
      if (idCitado) {
        await handleRespostaGestor(msg, texto);
      }
      return;
    }

    // ── Qualquer outro grupo: só responde quando @mencionado ─────────────
    const jidAgente = obterJidDoAgente();
    if (jidAgente && agenteFoiMencionado(msg, jidAgente)) {
      await handleMencaoGrupo(msg);
    }
    return;
  }

  // ── Chat particular ─────────────────────────────────────────────────────
  await handleChatParticular(msg);
}
