import { proto, downloadMediaMessage } from '@whiskeysockets/baileys';
import { processarComandoTreinamento } from '../../conhecimento/habilidades';
import { processarDocumento } from '../../conhecimento/documentos';
import { enviarMensagem } from '../cliente';

function extrairTexto(msg: proto.IWebMessageInfo): string | null {
  const m = msg.message;
  if (!m) return null;
  return m.conversation ?? m.extendedTextMessage?.text ?? null;
}

function extrairDocumento(msg: proto.IWebMessageInfo): { nome: string; mime: string; tamanho: number } | null {
  const doc = msg.message?.documentMessage ?? msg.message?.documentWithCaptionMessage?.message?.documentMessage;
  if (!doc) return null;
  return {
    nome: doc.fileName ?? 'documento',
    mime: doc.mimetype ?? 'application/octet-stream',
    tamanho: Number(doc.fileLength ?? 0),
  };
}

export async function handleTreinamento(msg: proto.IWebMessageInfo): Promise<void> {
  const jid = msg.key.remoteJid;
  if (!jid) return;

  // Documento enviado → processar como base de conhecimento
  const infoDoc = extrairDocumento(msg);
  if (infoDoc) {
    await enviarMensagem(jid, `⏳ Processando *${infoDoc.nome}*…`);
    try {
      const buffer = await downloadMediaMessage(msg, 'buffer', {}) as Buffer;
      const resultado = await processarDocumento({
        buffer,
        nomeArquivo: infoDoc.nome,
        mimeType: infoDoc.mime,
        tamanhoBytes: infoDoc.tamanho,
      });
      await enviarMensagem(jid, resultado.mensagem);
    } catch (err) {
      console.error('[treinamento] Erro ao processar documento:', err);
      await enviarMensagem(jid, '⚠️ Erro ao processar o documento. Tente novamente.');
    }
    return;
  }

  // Texto → processar como comando de habilidade
  const texto = extrairTexto(msg)?.trim();
  if (!texto) return;

  console.log(`🎓 [treinamento] ${texto.substring(0, 80)}`);
  try {
    const confirmacao = await processarComandoTreinamento(texto);
    await enviarMensagem(jid, confirmacao);
  } catch (err) {
    console.error('[treinamento] Erro:', err);
    await enviarMensagem(jid, '⚠️ Ocorreu um erro. Tente novamente.');
  }
}
