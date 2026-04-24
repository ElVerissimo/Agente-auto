import OpenAI from 'openai';
import { config } from '../config';

const client = new OpenAI({ apiKey: config.openai.apiKey });

export interface AgentResponse {
  mensagem: string;
  precisa_escalar: boolean;
  resumo_escalacao: string | null;
  confianca: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Shared single-turn helper used by skills and conversation-memory
export async function callAI(params: {
  system: string;
  userMessage: string;
  maxTokens?: number;
}): Promise<string> {
  const response = await client.chat.completions.create({
    model: config.openai.model,
    max_tokens: params.maxTokens ?? 1024,
    messages: [
      { role: 'system', content: params.system },
      { role: 'user', content: params.userMessage },
    ],
  });
  return response.choices[0].message.content ?? '';
}

export async function askClaude(params: {
  systemPrompt: string;
  conversationHistory: ConversationMessage[];
  userMessage: string;
}): Promise<AgentResponse> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: params.systemPrompt },
    ...params.conversationHistory.map((h) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user', content: params.userMessage },
  ];

  const response = await client.chat.completions.create({
    model: config.openai.model,
    max_tokens: 1024,
    messages,
  });

  const text = response.choices[0].message.content ?? '';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Sem JSON na resposta');

    const parsed = JSON.parse(jsonMatch[0]) as Partial<AgentResponse>;
    return {
      mensagem: parsed.mensagem || 'Desculpe, não consegui processar sua mensagem.',
      precisa_escalar: parsed.precisa_escalar ?? false,
      resumo_escalacao: parsed.resumo_escalacao ?? null,
      confianca: typeof parsed.confianca === 'number' ? parsed.confianca : 0.5,
    };
  } catch {
    return {
      mensagem: text.trim() || 'Desculpe, tive um problema técnico. Por favor, tente novamente.',
      precisa_escalar: false,
      resumo_escalacao: null,
      confianca: 0.5,
    };
  }
}
