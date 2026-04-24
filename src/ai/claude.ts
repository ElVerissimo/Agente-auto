import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

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

export async function askClaude(params: {
  systemPrompt: string;
  conversationHistory: ConversationMessage[];
  userMessage: string;
}): Promise<AgentResponse> {
  const messages: Anthropic.MessageParam[] = [
    ...params.conversationHistory.map((h) => ({
      role: h.role,
      content: h.content,
    })),
    { role: 'user', content: params.userMessage },
  ];

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 1024,
    system: params.systemPrompt,
    messages,
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

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
