import { proto } from '@whiskeysockets/baileys';
import { config } from '../config';
import { processClientMessage, recordEscalationGroupMessage } from '../agent/agent';
import { processManagerAnswer } from '../agent/escalation';
import { handleTrainingMessage } from './training-handler';
import { handleGroupMention, isBotMentioned } from './group-handler';
import { sendText, getBotJid } from './client';

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

function isGroup(jid: string): boolean {
  return jid.endsWith('@g.us');
}

function formatPhone(jid: string): string {
  return jid.replace(/@[sg]\.whatsapp\.net|@g\.us/, '').split(':')[0];
}

export async function handleMessage(msg: proto.IWebMessageInfo): Promise<void> {
  const jid = msg.key.remoteJid;
  if (!jid) return;

  const text = extractText(msg)?.trim();
  if (!text) return;

  // ── Training group ─────────────────────────────────────────────────────
  if (config.whatsapp.trainingGroupId && jid === config.whatsapp.trainingGroupId) {
    await handleTrainingMessage(msg);
    return;
  }

  // ── Managers group: route escalation answers back to clients ───────────
  if (config.whatsapp.managersGroupId && jid === config.whatsapp.managersGroupId) {
    const quotedId = extractQuotedId(msg);
    if (!quotedId) return;

    const result = processManagerAnswer(quotedId, text);
    if (!result.found) return;

    console.log(`✅ Gestor respondeu escalação ${result.escalationId}`);
    await sendText(result.clientJid, result.replyToClient);
    console.log(`📨 Resposta encaminhada para ${formatPhone(result.clientJid)}`);
    return;
  }

  // ── Any other group: respond only when @mentioned ──────────────────────
  if (isGroup(jid)) {
    const botJid = getBotJid();
    if (botJid && isBotMentioned(msg, botJid)) {
      await handleGroupMention(msg, botJid);
    }
    // Silently ignore group messages without @mention
    return;
  }

  // ── Private/client message ─────────────────────────────────────────────
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
        console.warn('⚠️  Escalação gerada mas MANAGERS_GROUP_ID não configurado.');
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
