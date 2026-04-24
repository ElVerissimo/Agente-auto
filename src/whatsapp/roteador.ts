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

function removerMencao(texto: string, jidAgente: string): string {
  const numero = jidAgente.split(':')[0].split('@')[0];
  return texto.replace(new RegExp(`@${numero}\\s*`, 'g'), '').trim();
}

export async function roteadorMensagens(msg: proto.IWebMessageInfo): Promise<void> {
  const jid = msg.key.remoteJid;
  if (!jid) return;

  const textoRaw = extrairTexto(msg)?.trim();
  if (!textoRaw) return;

  // ── Comandos de setup (qualquer grupo, sem precisar de @menção) ──────────
  if (ehGrupo(jid)) {
    if (textoRaw === '!id') {
      await enviarMensagem(jid, `🆔 *ID deste grupo:*\n\`${jid}\`\n\nCopie e cole no .env ou use \`!configurar treinamento\` / \`!configurar gestores\`.`);
      return;
    }
    if (textoRaw === '!configurar treinamento') {
      atualizarEnv('ID_GRUPO_TREINAMENTO', jid);
      config.whatsapp.idGrupoTreinamento = jid;
      await enviarMensagem(jid,
        `✅ *Grupo de Treinamento configurado!*\n\n` +
        `Me @mencione aqui para me ensinar qualquer coisa.\n\n` +
        `Exemplos:\n• _"@agente nosso prazo de entrega é 5 dias úteis"_\n• _"@agente quando pedirem desconto, máximo 10% no Pix"_\n\n` +
        `Use \`!ajuda\` para ver todos os comandos.`
      );
      return;
    }
    if (textoRaw === '!configurar gestores') {
      atualizarEnv('ID_GRUPO_GESTORES', jid);
      config.whatsapp.idGrupoGestores = jid;
      await enviarMensagem(jid,
        `✅ *Grupo de Gestores configurado!*\n\n` +
        `Quando eu não souber responder um cliente, vou enviar a dúvida aqui.\n\n` +
        `Para responder: *responda* a mensagem da dúvida e me @mencione com a resposta.\n` +
        `Exemplo: _"@agente Diga ao cliente que o prazo é 5 dias úteis"_\n\n` +
        `Eu encaminho ao cliente e aprendo para nunca mais precisar perguntar.`
      );
      return;
    }
  }

  if (!ehGrupo(jid)) {
    // ── Chat particular: sempre responde ────────────────────────────────────
    await handleChatParticular(msg);
    return;
  }

  // ── A partir daqui: apenas grupos — TODOS exigem @menção ────────────────
  const jidAgente = obterJidDoAgente();
  if (!jidAgente || !agenteFoiMencionado(msg, jidAgente)) return;

  const texto = removerMencao(textoRaw, jidAgente);
  if (!texto && !msg.message?.documentMessage) return;

  // ── Grupo de treinamento ────────────────────────────────────────────────
  if (config.whatsapp.idGrupoTreinamento && jid === config.whatsapp.idGrupoTreinamento) {
    await handleTreinamento(msg, texto);
    return;
  }

  // ── Grupo de gestores: @menção com resposta a escalação ─────────────────
  if (config.whatsapp.idGrupoGestores && jid === config.whatsapp.idGrupoGestores) {
    const idCitado = extrairIdCitado(msg);
    if (idCitado && texto) {
      await handleRespostaGestor(msg, texto);
    } else {
      await enviarMensagem(jid,
        `👋 Para responder uma dúvida de cliente:\n` +
        `1. *Responda* a mensagem da escalação\n` +
        `2. Me @mencione com a resposta\n\n` +
        `Exemplo: _"@agente Diga ao cliente que o prazo é 5 dias úteis"_`
      );
    }
    return;
  }

  // ── Qualquer outro grupo: @menção → agente opera conforme papel ──────────
  await handleMencaoGrupo(msg);
}
