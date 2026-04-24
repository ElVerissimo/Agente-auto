import OpenAI from 'openai';
import { config } from '../config';

const cliente = new OpenAI({ apiKey: config.ia.chaveApi });

export interface MensagemHistorico {
  papel: 'usuario' | 'assistente';
  conteudo: string;
}

const ESPERAS_RETRY = [2000, 5000, 10000];

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  let ultimoErro: unknown;

  for (let tentativa = 0; tentativa <= ESPERAS_RETRY.length; tentativa++) {
    try {
      const resposta = await cliente.chat.completions.create(opcoes);
      return resposta.choices[0].message.content ?? '';
    } catch (err) {
      ultimoErro = err;

      if (err instanceof OpenAI.APIError) {
        // Sem retry para erros permanentes
        if (err.status === 401) {
          console.error('❌ [IA] Chave de API inválida. Verifique OPENAI_API_KEY no .env');
          throw new Error('Chave de API inválida');
        }
        if (err.status === 400) {
          console.error('❌ [IA] Requisição inválida:', err.message);
          throw err;
        }
        if (err.status === 429) {
          // Rate limit ou cota esgotada
          const motivo = err.message.includes('quota') ? 'Cota da API esgotada' : 'Limite de requisições atingido';
          console.warn(`⚠️  [IA] ${motivo}. Tentativa ${tentativa + 1}/${ESPERAS_RETRY.length + 1}`);
        } else if (err.status && err.status >= 500) {
          console.warn(`⚠️  [IA] Erro no servidor OpenAI (${err.status}). Tentativa ${tentativa + 1}/${ESPERAS_RETRY.length + 1}`);
        } else {
          console.error(`❌ [IA] Erro ${err.status}: ${err.message}`);
          throw err;
        }
      } else {
        // Erro de rede
        console.warn(`⚠️  [IA] Erro de rede. Tentativa ${tentativa + 1}/${ESPERAS_RETRY.length + 1}:`, (err as Error).message);
      }

      if (tentativa < ESPERAS_RETRY.length) {
        await sleep(ESPERAS_RETRY[tentativa]);
      }
    }
  }

  console.error('❌ [IA] Todas as tentativas falharam.');
  throw ultimoErro;
}

export function parseJson<T>(texto: string): T | null {
  try {
    const match = texto.match(/\{[\s\S]*\}/);
    return match ? (JSON.parse(match[0]) as T) : null;
  } catch {
    return null;
  }
}
