import { callAI } from '../ai/claude';
import { config } from '../config';
import {
  getConversationHistory,
  getConversationMessageCount,
  getConversationSummary,
  saveConversationSummary,
  ConversationRow,
} from './memory';

const SUMMARY_SYSTEM = `Você é um assistente especializado em criar resumos de conversas de atendimento ao cliente.

Crie um resumo conciso em português que capture:
- Quem é o cliente (nome se mencionado, perfil)
- O que foi discutido (produtos, problemas, dúvidas, pedidos)
- O que foi resolvido ou decidido
- Pendências ou compromissos assumidos
- Informações relevantes do cliente (preferências, histórico, reclamações)

O resumo deve ser útil para o agente continuar o atendimento sem perder contexto.
Máximo 150 palavras. Seja objetivo e direto.`;

export interface ContactContext {
  summary: string | null;
  recentHistory: ConversationRow[];
}

export function getContactContext(contactJid: string): ContactContext {
  const summaryRow = getConversationSummary(contactJid);
  // Always include the last N messages verbatim for precision
  const recentHistory = getConversationHistory(contactJid, 15);

  return {
    summary: summaryRow?.summary ?? null,
    recentHistory,
  };
}

// Called in background after each response — does not block the main flow
export async function maybeSummarize(contactJid: string): Promise<void> {
  const totalCount = getConversationMessageCount(contactJid);
  const existing = getConversationSummary(contactJid);
  const alreadySummarized = existing?.messages_summarized ?? 0;
  const newSinceLastSummary = totalCount - alreadySummarized;

  if (newSinceLastSummary < config.agent.summarizeAfterMessages) return;

  // Fetch enough history to produce a good summary
  const history = getConversationHistory(contactJid, 60);
  if (history.length === 0) return;

  const transcript = history
    .map((m) => `${m.role === 'user' ? 'Cliente' : 'Agente'}: ${m.content}`)
    .join('\n');

  try {
    const newSummary = await callAI({
      system: SUMMARY_SYSTEM,
      userMessage: `Conversa:\n${transcript}`,
      maxTokens: 400,
    });

    if (newSummary.trim()) {
      saveConversationSummary(contactJid, newSummary.trim(), totalCount);
    }
  } catch (err) {
    console.error(`[memory] Erro ao sumarizar conversa de ${contactJid}:`, err);
  }
}
