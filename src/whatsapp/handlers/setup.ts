import { writeFileSync } from 'fs';
import { join } from 'path';
import { chat } from '../../ai/provedor';
import { PROMPTS_POR_ETAPA } from '../../ai/prompts/setup';
import { recarregarContexto } from '../../conhecimento/contexto';
import { enviarMensagem } from '../cliente';
import {
  iniciarSessao,
  obterSessao,
  salvarEtapa,
  encerrarSessao,
  temSessao,
  PERGUNTAS,
  EtapaSetup,
} from '../setup-state';

const DIR_CONTEXTO = 'data/contexto-empresa';

const ARQUIVO_POR_ETAPA: Record<string, string> = {
  empresa: 'company.md',
  contato: 'company.md',
  produtos: 'products.md',
  faq: 'faq.md',
  politicas: 'policies.md',
};

// Acumula empresa + contato no mesmo arquivo
const dadosEmpresaTemp = new Map<string, string>();

export function setupAtivo(jid: string): boolean {
  return temSessao(jid);
}

export async function iniciarSetup(jid: string): Promise<void> {
  iniciarSessao(jid);
  await enviarMensagem(jid, PERGUNTAS['empresa']);
}

export async function processarRespostaSetup(jid: string, resposta: string): Promise<void> {
  const sessao = obterSessao(jid);
  if (!sessao) return;

  const etapaAtual = sessao.etapa;

  await enviarMensagem(jid, '⏳ Processando e salvando…');

  try {
    const promptSistema = PROMPTS_POR_ETAPA[etapaAtual as keyof typeof PROMPTS_POR_ETAPA];
    const conteudoFormatado = await chat({
      sistema: promptSistema,
      mensagem: resposta,
      maxTokens: 1024,
    });

    // Empresa e contato vão para o mesmo arquivo (company.md), acumulados
    if (etapaAtual === 'empresa') {
      dadosEmpresaTemp.set(jid, `# Informações da Empresa\n\n${conteudoFormatado.trim()}`);
    } else if (etapaAtual === 'contato') {
      const empresa = dadosEmpresaTemp.get(jid) ?? '';
      const conteudoFinal = `${empresa}\n\n---\n\n## Funcionamento e Contato\n\n${conteudoFormatado.trim()}`;
      writeFileSync(join(DIR_CONTEXTO, 'company.md'), conteudoFinal, 'utf-8');
      dadosEmpresaTemp.delete(jid);
    } else {
      const arquivo = ARQUIVO_POR_ETAPA[etapaAtual];
      if (arquivo) {
        writeFileSync(join(DIR_CONTEXTO, arquivo), conteudoFormatado.trim(), 'utf-8');
      }
    }

    const proximaEtapa = salvarEtapa(jid, conteudoFormatado);

    if (proximaEtapa === 'concluido') {
      encerrarSessao(jid);
      recarregarContexto();
      await enviarMensagem(
        jid,
        `✅ *Configuração concluída!*\n\n` +
        `O agente já está usando tudo que você ensinou.\n\n` +
        `📋 *O que foi salvo:*\n` +
        `• Informações e contato da empresa\n` +
        `• Produtos e serviços\n` +
        `• Perguntas frequentes\n` +
        `• Políticas\n\n` +
        `A partir de agora você pode:\n` +
        `• Usar \`!ver empresa\`, \`!ver produtos\`, etc. para conferir\n` +
        `• Usar \`!empresa [texto]\` para atualizar qualquer seção\n` +
        `• Usar \`!setup\` de novo para refazer tudo\n` +
        `• Ensinar habilidades específicas escrevendo normalmente aqui`
      );
      return;
    }

    await enviarMensagem(jid, PERGUNTAS[proximaEtapa as EtapaSetup]);
  } catch (err) {
    console.error('[setup] Erro ao processar etapa:', err);
    await enviarMensagem(jid, '⚠️ Ocorreu um erro. Tente responder novamente.');
  }
}
