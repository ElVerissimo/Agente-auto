import { chat, parseJson, MensagemHistorico } from '../ai/provedor';
import { PROMPT_CONFIGURACAO_GRUPO, promptOperacaoGrupo } from '../ai/prompts/configuracao-grupo';
import { Grupos } from '../banco/repositorios/grupos';
import { Conversas } from '../banco/repositorios/conversas';
import { TipoGrupo } from './tipos';
import { config } from '../config';

interface RespostaConfiguracao {
  tipo: TipoGrupo;
  confirmacao: string;
  instrucoes: string;
}

interface RespostaOperacao {
  mensagem: string;
  precisa_escalar: boolean;
  resumo_escalacao: string | null;
  confianca: number;
}

export async function processarMencaoGrupo(params: {
  idGrupo: string;
  nomeGrupo: string;
  telefoneRemetente: string;
  mensagem: string;
}): Promise<string> {
  const grupo = Grupos.buscar(params.idGrupo);

  // Primeira menção — criar e perguntar o papel
  if (!grupo) {
    Grupos.salvar({
      idGrupo: params.idGrupo,
      nome: params.nomeGrupo,
      descricao: '',
      tipo: 'geral',
      status: 'configurando',
    });
    return (
      `Olá! 👋 Estou aqui e pronto para trabalhar neste grupo.\n\n` +
      `Para começar, me explique qual é o meu papel aqui — o que devo fazer e como?\n\n` +
      `_Quanto mais detalhes você der, melhor vou conseguir ajudar._`
    );
  }

  // Em configuração — receber instruções
  if (grupo.status === 'configurando') {
    const respostaRaw = await chat({
      sistema: PROMPT_CONFIGURACAO_GRUPO,
      mensagem: params.mensagem,
      maxTokens: 512,
      formatoJson: true,
    });

    const resultado = parseJson<RespostaConfiguracao>(respostaRaw);
    const tipo: TipoGrupo = resultado?.tipo ?? 'geral';
    const instrucoes = resultado?.instrucoes ?? params.mensagem;
    const confirmacao = resultado?.confirmacao ?? '✅ Configuração salva! Estou pronto para operar neste grupo.';

    Grupos.salvar({
      idGrupo: params.idGrupo,
      nome: params.nomeGrupo,
      descricao: instrucoes,
      tipo,
      status: 'ativo',
    });

    return confirmacao;
  }

  // Ativo — operar conforme papel
  const historico = Conversas.buscarHistorico(params.idGrupo, 10);
  const sistemaPrompt = promptOperacaoGrupo(grupo.descricao, config.whatsapp.nomeAgente);

  Conversas.salvar(params.idGrupo, 'usuario', `[${params.telefoneRemetente}]: ${params.mensagem}`);

  const respostaRaw = await chat({
    sistema: sistemaPrompt,
    historico,
    mensagem: `[${params.telefoneRemetente}]: ${params.mensagem}`,
    formatoJson: true,
  });

  const resultado = parseJson<RespostaOperacao>(respostaRaw);
  const mensagem = resultado?.mensagem ?? respostaRaw.trim();

  Conversas.salvar(params.idGrupo, 'assistente', mensagem);
  return mensagem;
}
