import { proto } from '@whiskeysockets/baileys';
import { config } from '../config';
import { processClientMessage, recordEscalationGroupMessage } from '../agent/agent';
import { processManagerAnswer } from '../agent/escalation';
import { sendText } from './client';

function extractText(msg: proto.IWebMessageInfo): string | null {
  const m = msg.message;
  if (!m) return null;
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    null
  );
}

function extractQuotedId(msg: proto.IWebMessageInfo): string | null {
  return msg.message?.extendedTextMessage?.contextInfo?.stanzaId ?? null;
}

function formatPhone(jid: string): string {
  return jid.replace(/@[sg]\.whatsapp\.net|@g\.us/, '');
}

export async function handleMessage(msg: proto.IWebMessageInfo): Promise<void> {
  const jid = msg.key.remoteJid;
  if (!jid) return;

  const text = extractText(msg)?.trim();
  if (!text) return;

  const isManagersGroup = config.whatsapp.managersGroupId
    ? jid === config.whatsapp.managersGroupId
    : false;

  // ── Managers group: route answers back to clients ──────────────────────
  if (isManagersGroup) {
    const quotedId = extractQuotedId(msg);
    if (!quotedId) return; // Only care about replies

    const result = processManagerAnswer(quotedId, text);
    if (!result.found) return;

    console.log(`✅ Gestor respondeu escalação ${result.escalationId}`);
    await sendText(result.clientJid, result.replyToClient);
    console.log(`📨 Resposta encaminhada para ${formatPhone(result.clientJid)}`);
    return;
  }

  // ── Client message ─────────────────────────────────────────────────────
  const phone = formatPhone(jid);
  console.log(`📩 [${phone}] ${text.substring(0, 80)}${text.length > 80 ? '...' : ''}`);

  try {
    const result = await processClientMessage({
      contactJid: jid,
      contactPhone: phone,
      message: text,
    });

    await sendText(jid, result.responseToClient);
    console.log(`📤 Resposta enviada para ${phone}`);

    if (result.escalation) {
      if (!config.whatsapp.managersGroupId) {
        console.warn('⚠️  Escalação gerada mas MANAGERS_GROUP_ID não configurado — ignorando envio ao grupo.');
        return;
      }

      const groupMsg = await sendText(
        config.whatsapp.managersGroupId,
        result.escalation.groupMessage
      );

      if (groupMsg?.key?.id) {
        recordEscalationGroupMessage(result.escalation.id, groupMsg.key.id);
        console.log(`🚨 Escalação ${result.escalation.id} enviada ao grupo de gestores`);
      }
    }
  } catch (err) {
    console.error(`Erro ao processar mensagem de ${phone}:`, err);
    await sendText(
      jid,
      '⚠️ Tive um problema técnico momentâneo. Por favor, tente novamente em alguns instantes.'
    ).catch(() => {});
  }
}
