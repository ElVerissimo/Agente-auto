import { proto } from '@whiskeysockets/baileys';
import { processTrainingMessage } from '../agent/skills';
import { sendText } from './client';

function extractText(msg: proto.IWebMessageInfo): string | null {
  const m = msg.message;
  if (!m) return null;
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    null
  );
}

export async function handleTrainingMessage(msg: proto.IWebMessageInfo): Promise<void> {
  const jid = msg.key.remoteJid;
  if (!jid) return;

  const text = extractText(msg)?.trim();
  if (!text) return;

  console.log(`🎓 [treinamento] ${text.substring(0, 80)}`);

  try {
    const confirmation = await processTrainingMessage(text);
    await sendText(jid, confirmation);
  } catch (err) {
    console.error('[treinamento] Erro ao processar:', err);
    await sendText(jid, '⚠️ Ocorreu um erro ao processar o treinamento. Tente novamente.');
  }
}
