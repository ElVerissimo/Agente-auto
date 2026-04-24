import { chat, parseJson } from '../ai/provedor';
import { PROMPT_CLASSIFICADOR } from '../ai/prompts/classificador';

export type TipoMensagem = 'reclamacao' | 'duvida' | 'normal';

interface ResultadoClassificacao {
  tipo: TipoMensagem;
  confianca: number;
}

export async function classificarMensagem(mensagem: string): Promise<TipoMensagem> {
  try {
    const resposta = await chat({
      sistema: PROMPT_CLASSIFICADOR,
      mensagem,
      maxTokens: 100,
      formatoJson: true,
    });

    const resultado = parseJson<ResultadoClassificacao>(resposta);
    if (resultado?.tipo && ['reclamacao', 'duvida', 'normal'].includes(resultado.tipo)) {
      return resultado.tipo;
    }
  } catch (err) {
    console.error('[classificador] Erro:', err);
  }
  return 'duvida'; // fallback seguro
}
