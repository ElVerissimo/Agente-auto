import { chat, parseJson, MensagemHistorico } from '../ai/provedor';
import { PROMPT_CONFIGURACAO_GRUPO, promptOperacaoGrupo } from '../ai/prompts/configuracao-grupo';
import { Grupos } from '../banco/repositorios/grupos';
import { Conversas } from '../banco/repositorios/conversas';
import { TipoGrupo } from './tipos';
import { config } from '../config';

interface RespostaConfiguracao {
  configurado: boolean;
  tipo: TipoGrupo;
  resposta: string;
  instrucoes: string;
}

interface RespostaOperacao {
  mensagem: string;
  precisa_escalar: boolean;
  resumo_escalacao: string | null;
  confianca: number;
}

// Histórico de configuração em memória (por grupo)
const historicoConfig = new Map<string, MensagemHistorico[]>();

export async function processarMencaoGrupo(params: {
  idGrupo: string;
  nomeGrupo: string;
  telefoneRemetente: string;
  mensagem: string;
}): Promise<string> {
  const grupo = Grupos.buscar(params.idGrupo);

  // Primeiro contato — registrar e iniciar configuração
  if (!grupo) {
    Grupos.salvar({ idGrupo: params.idGrupo, nome: params.nomeGrupo, descricao: '', tipo: 'geral', status: 'configurando' });
    historicoConfig.set(params.idGrupo, []);
    return (
      `Olá! 👋 Fui adicionado a *${params.nomeGrupo}*.\n\n` +
      `Sou um agente autônomo e preciso entender meu papel aqui antes de começar.\n\n` +
      `Me explique: *para que serve este grupo e o que você quer que eu faça aqui?*\n\n` +
      `_Quanto mais detalhes, melhor — vou perguntar até entender tudo direito._`
    );
  }

  // Em configuração — diálogo até entender completamente
  if (grupo.status === 'configurando') {
    const historico = historicoConfig.get(params.idGrupo) ?? [];
    historico.push({ papel: 'usuario', conteudo: params.mensagem });

    const respostaRaw = await chat({
      sistema: PROMPT_CONFIGURACAO_GRUPO,
      historico: historico.slice(0, -1),
      mensagem: params.mensagem,
      maxTokens: 768,
      formatoJson: true,
    });

    const resultado = parseJson<RespostaConfiguracao>(respostaRaw);
    const resposta = resultado?.resposta ?? 'Pode me explicar melhor?';

    historico.push({ papel: 'assistente', conteudo: resposta });
    historicoConfig.set(params.idGrupo, historico);

    if (resultado?.configurado && resultado.instrucoes) {
      Grupos.salvar({
        idGrupo: params.idGrupo,
        nome: params.nomeGrupo,
        descricao: resultado.instrucoes,
        tipo: resultado.tipo ?? 'geral',
        status: 'ativo',
      });
      historicoConfig.delete(params.idGrupo);
    }

    return resposta;
  }

  // Ativo — operar conforme papel configurado
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
