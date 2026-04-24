import OpenAI from 'openai';
import { config } from '../config';

const cliente = new OpenAI({ apiKey: config.ia.chaveApi });

export interface MensagemHistorico {
  papel: 'usuario' | 'assistente';
  conteudo: string;
}

export async function chat(params: {
  sistema: string;
  historico?: MensagemHistorico[];
  mensagem: string;
  maxTokens?: number;
  formatoJson?: boolean;
}): Promise<string> {
  const mensagens: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: params.sistema },
    ...(params.historico ?? []).map((m) => ({
      role: m.papel === 'usuario' ? ('user' as const) : ('assistant' as const),
      content: m.conteudo,
    })),
    { role: 'user', content: params.mensagem },
  ];

  const opcoes: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: config.ia.modelo,
    max_tokens: params.maxTokens ?? 1024,
    messages: mensagens,
  };

  if (params.formatoJson) {
    opcoes.response_format = { type: 'json_object' };
  }

  const resposta = await cliente.chat.completions.create(opcoes);
  return resposta.choices[0].message.content ?? '';
}

// Convenience: parses JSON from AI response safely
export function parseJson<T>(texto: string): T | null {
  try {
    const match = texto.match(/\{[\s\S]*\}/);
    return match ? (JSON.parse(match[0]) as T) : null;
  } catch {
    return null;
  }
}
