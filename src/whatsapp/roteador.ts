import { proto } from '@whiskeysockets/baileys';
import { config } from '../config';
import { handleChatParticular } from './handlers/particular';
import { handleMencaoGrupo, handleRespostaGestor, agenteFoiMencionado } from './handlers/grupo';
import { handleTreinamento } from './handlers/treinamento';
import { enviarMensagem, obterJidDoAgente } from './cliente';
import { atualizarEnv } from '../utils/env-writer';

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

export async function roteadorMensagens(msg: proto.IWebMessageInfo): Promise<void> {
  const jid = msg.key.remoteJid;
  if (!jid) return;

  const texto = extrairTexto(msg)?.trim();
  if (!texto) return;

  // ── Comandos de setup (funcionam em QUALQUER grupo) ──────────────────────
  if (ehGrupo(jid)) {
    if (texto === '!id') {
      await enviarMensagem(jid, `🆔 *ID deste grupo:*\n\`${jid}\`\n\nCopie este ID e cole no arquivo \`.env\`.`);
      return;
    }

    if (texto === '!configurar treinamento') {
      atualizarEnv('ID_GRUPO_TREINAMENTO', jid);
      config.whatsapp.idGrupoTreinamento = jid;
      await enviarMensagem(
        jid,
        `✅ *Grupo de Treinamento configurado!*\n\n` +
        `A partir de agora eu aprendo tudo que você me ensinar aqui.\n\n` +
        `📋 *Comandos disponíveis neste grupo:*\n` +
        `• !ajuda — ver todos os comandos\n` +
        `• !empresa [texto] — definir informações da empresa\n` +
        `• !faq [texto] — definir perguntas frequentes\n` +
        `• !produtos [texto] — definir produtos e serviços\n` +
        `• !politicas [texto] — definir políticas\n` +
        `• !ver empresa/faq/produtos/politicas — ver conteúdo atual\n` +
        `• Envie um documento PDF ou XLSX para eu aprender com ele`
      );
      return;
    }

    if (texto === '!configurar gestores') {
      atualizarEnv('ID_GRUPO_GESTORES', jid);
      config.whatsapp.idGrupoGestores = jid;
      await enviarMensagem(
        jid,
        `✅ *Grupo de Gestores configurado!*\n\n` +
        `Vou enviar aqui os alertas e escalações de atendimento que precisam de atenção humana.\n\n` +
        `Quando um cliente precisar de um gestor, vocês verão a notificação neste grupo e poderão responder diretamente aqui.`
      );
      return;
    }
  }

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
