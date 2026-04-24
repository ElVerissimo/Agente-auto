import { proto } from '@whiskeysockets/baileys';
import { processGroupMention } from '../agent/group-manager';
import { sendText, getGroupName } from './client';

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

function getMentionedJids(msg: proto.IWebMessageInfo): string[] {
  return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
}

function normalizeBotJid(botJid: string): string {
  // Baileys returns "number:device@s.whatsapp.net" — normalize to "number@s.whatsapp.net"
  return botJid.split(':')[0].split('@')[0];
}

function formatPhone(jid: string): string {
  return jid.split(':')[0].split('@')[0];
}

function stripMention(text: string, botNumber: string): string {
  // Remove @botNumber from message text so agent doesn't see it as part of the question
  return text.replace(new RegExp(`@${botNumber}\\s*`, 'g'), '').trim();
}

export function isBotMentioned(msg: proto.IWebMessageInfo, botJid: string): boolean {
  if (!botJid) return false;
  const botNumber = normalizeBotJid(botJid);
  const mentioned = getMentionedJids(msg);
  const text = extractText(msg) ?? '';

  return (
    mentioned.some((jid) => formatPhone(jid) === botNumber) ||
    text.includes(`@${botNumber}`)
  );
}

export async function handleGroupMention(
  msg: proto.IWebMessageInfo,
  botJid: string
): Promise<void> {
  const groupJid = msg.key.remoteJid;
  if (!groupJid) return;

  const rawText = extractText(msg)?.trim();
  if (!rawText) return;

  const senderJid = msg.key.participant ?? msg.key.remoteJid ?? '';
  const senderPhone = formatPhone(senderJid);
  const botNumber = normalizeBotJid(botJid);
  const cleanMessage = stripMention(rawText, botNumber);

  if (!cleanMessage) return;

  const groupName = await getGroupName(groupJid);

  console.log(`💬 [grupo:${groupName}] @mencionado por ${senderPhone}: ${cleanMessage.substring(0, 60)}`);

  try {
    const reply = await processGroupMention({
      groupJid,
      groupName,
      senderPhone,
      senderJid,
      message: cleanMessage,
    });

    await sendText(groupJid, reply, undefined, [senderJid]);
  } catch (err) {
    console.error(`[group-handler] Erro:`, err);
    await sendText(groupJid, '⚠️ Tive um problema técnico. Tente novamente.').catch(() => {});
  }
}
