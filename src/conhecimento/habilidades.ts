import { v4 as uuid } from 'uuid';
import { chat, parseJson } from '../ai/provedor';
import { PROMPT_TREINAMENTO, AJUDA_TREINAMENTO } from '../ai/prompts/treinamento';
import { Habilidades } from '../banco/repositorios/habilidades';

interface RespostatreinamentoCrud {
  acao: 'criar' | 'listar' | 'remover' | 'ajuda';
  habilidade?: { nome: string; descricao: string; conteudo: string; exemplos: string[] };
  alvo_remocao?: string;
  confirmacao: string;
}

export async function processarComandoTreinamento(mensagem: string): Promise<string> {
  const resposta = await chat({
    sistema: PROMPT_TREINAMENTO,
    mensagem,
    formatoJson: true,
  });

  const parsed = parseJson<RespostatreinamentoCrud>(resposta);
  if (!parsed) return '⚠️ Não entendi. Diga "ajuda" para ver os comandos.';

  if (parsed.acao === 'criar' && parsed.habilidade) {
    const id = uuid();
    Habilidades.salvar({ id, ...parsed.habilidade });
    return `✅ *Habilidade aprendida!*\n\n📌 *${parsed.habilidade.nome}*\n_${parsed.habilidade.descricao}_\n\n${parsed.confirmacao}\n\n🆔 \`${id.substring(0, 8)}\``;
  }

  if (parsed.acao === 'listar') {
    const lista = Habilidades.listar();
    if (lista.length === 0) return '📭 Nenhuma habilidade cadastrada ainda. Diga "ajuda" para aprender como adicionar.';
    const itens = lista.map((h, i) => `${i + 1}. *${h.nome}*\n   _${h.descricao}_\n   🆔 \`${h.id.substring(0, 8)}\``);
    return `📚 *Habilidades cadastradas (${lista.length}):*\n\n${itens.join('\n\n')}`;
  }

  if (parsed.acao === 'remover' && parsed.alvo_remocao) {
    const removeu = Habilidades.remover(parsed.alvo_remocao);
    return removeu ? `🗑️ ${parsed.confirmacao}` : `❌ Habilidade não encontrada: "${parsed.alvo_remocao}"`;
  }

  if (parsed.acao === 'ajuda') return AJUDA_TREINAMENTO;

  return parsed.confirmacao || '✅ Entendido!';
}
