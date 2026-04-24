import { proto } from '@whiskeysockets/baileys';
import { processarMensagemCliente, vincularMensagemGrupo } from '../../core/agente';
import { enviarMensagem } from '../cliente';

function extrairTexto(msg: proto.IWebMessageInfo): string | null {
  const m = msg.message;
  if (!m) return null;
  return m.conversation ?? m.extendedTextMessage?.text ?? m.imageMessage?.caption ?? m.videoMessage?.caption ?? null;
}

function formatarTelefone(jid: string): string {
  return jid.split(':')[0].split('@')[0];
}

export async function handleChatParticular(msg: proto.IWebMessageInfo): Promise<void> {
  const jid = msg.key.remoteJid;
  if (!jid) return;

  const texto = extrairTexto(msg)?.trim();
  if (!texto) return;

  const telefone = formatarTelefone(jid);
  console.log(`📩 [${telefone}] ${texto.substring(0, 80)}${texto.length > 80 ? '…' : ''}`);

  try {
    const resultado = await processarMensagemCliente({
      contatoJid: jid,
      telefoneContato: telefone,
      mensagem: texto,
    });

    await enviarMensagem(jid, resultado.mensagemCliente);
    console.log(`📤 Resposta enviada para ${telefone}`);

    if (resultado.escalacao) {
      const { idEscalacao, idGrupoDestino, mensagemGrupo } = resultado.escalacao;
      const msgGrupo = await enviarMensagem(idGrupoDestino, mensagemGrupo);
      if (msgGrupo?.key?.id) {
        vincularMensagemGrupo(idEscalacao, msgGrupo.key.id);
        console.log(`🚨 Escalação ${idEscalacao} enviada para grupo ${idGrupoDestino}`);
      }
    }
  } catch (err) {
    console.error(`[particular] Erro ao processar ${telefone}:`, err);
    await enviarMensagem(jid, '⚠️ Tive um problema técnico. Tente novamente em instantes.').catch(() => {});
  }
}
