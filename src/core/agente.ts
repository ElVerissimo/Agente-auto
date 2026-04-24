import { chat, parseJson } from '../ai/provedor';
import { promptAgente } from '../ai/prompts/agente';
import { carregarContextoEmpresa } from '../conhecimento/contexto';
import { Habilidades } from '../banco/repositorios/habilidades';
import { Conhecimentos } from '../banco/repositorios/conhecimentos';
import { Documentos } from '../banco/repositorios/documentos';
import { Regras } from '../banco/repositorios/regras';
import { obterContexto, salvarMensagem } from '../conversa/historico';
import { resumirSeNecessario } from '../conversa/resumidor';
import { classificarMensagem } from './classificador';
import { processarReclamacao } from './reclamacao';
import { encontrarGrupoEscalacao, montarMensagemEscalacao } from './roteador-grupos';
import { registrarEscalacao, vincularMensagemGrupo } from '../conhecimento/aprendizado';
import { config } from '../config';

export interface RespostaAgente {
  mensagemCliente: string;
  escalacao?: {
    idEscalacao: string;
    idGrupoDestino: string;
    mensagemGrupo: string;
  };
}

interface RespostaIA {
  mensagem: string;
  precisa_escalar: boolean;
  resumo_escalacao: string | null;
  confianca: number;
}

export async function processarMensagemCliente(params: {
  contatoJid: string;
  telefoneContato: string;
  mensagem: string;
}): Promise<RespostaAgente> {
  const { contatoJid, telefoneContato, mensagem } = params;

  // Verificar se há reclamação em andamento antes de classificar
  const { Reclamacoes } = await import('../banco/repositorios/reclamacoes');
  const reclamacaoAtiva = Reclamacoes.buscarAtiva(contatoJid);

  const { resumo, historicoRecente } = obterContexto(contatoJid);

  // Se há coleta de reclamação em andamento, continua ela
  if (reclamacaoAtiva) {
    const resultado = await processarReclamacao({
      contatoJid, telefoneContato, mensagem,
      historico: historicoRecente,
    });
    salvarMensagem(contatoJid, 'usuario', mensagem);
    salvarMensagem(contatoJid, 'assistente', resultado.resposta);
    void resumirSeNecessario(contatoJid).catch(console.error);

    return {
      mensagemCliente: resultado.resposta,
      ...(resultado.encaminhadaParaGrupo && {
        escalacao: {
          idEscalacao: reclamacaoAtiva.id,
          idGrupoDestino: resultado.encaminhadaParaGrupo,
          mensagemGrupo: resultado.mensagemParaGrupo!,
        },
      }),
    };
  }

  // Classificar a mensagem
  const tipo = await classificarMensagem(mensagem);

  if (tipo === 'reclamacao') {
    const resultado = await processarReclamacao({
      contatoJid, telefoneContato, mensagem,
      historico: historicoRecente,
    });
    salvarMensagem(contatoJid, 'usuario', mensagem);
    salvarMensagem(contatoJid, 'assistente', resultado.resposta);
    void resumirSeNecessario(contatoJid).catch(console.error);

    return {
      mensagemCliente: resultado.resposta,
      ...(resultado.encaminhadaParaGrupo && {
        escalacao: {
          idEscalacao: resultado.encaminhadaParaGrupo,
          idGrupoDestino: resultado.encaminhadaParaGrupo,
          mensagemGrupo: resultado.mensagemParaGrupo!,
        },
      }),
    };
  }

  // Mensagem normal ou dúvida → tentar responder com contexto completo
  const sistemaPrompt = promptAgente({
    nomeAgente: config.whatsapp.nomeAgente,
    contextoEmpresa: carregarContextoEmpresa(),
    habilidades: Habilidades.listarFormatado(),
    conhecimentos: Conhecimentos.listarFormatado(),
    documentos: Documentos.contextoFormatado(),
    resumoConversa: resumo,
    regras: Regras.listarFormatado(),
  });

  const respostaRaw = await chat({
    sistema: sistemaPrompt,
    historico: historicoRecente,
    mensagem,
    formatoJson: true,
  });

  const ia = parseJson<RespostaIA>(respostaRaw);
  const mensagemIA = ia?.mensagem ?? respostaRaw.trim() ?? 'Desculpe, não consegui processar sua mensagem.';
  const confianca = ia?.confianca ?? 0.5;
  const precisaEscalar = ia?.precisa_escalar ?? false;

  salvarMensagem(contatoJid, 'usuario', mensagem);
  salvarMensagem(contatoJid, 'assistente', mensagemIA);
  void resumirSeNecessario(contatoJid).catch(console.error);

  if (precisaEscalar || confianca < config.agente.limiarConfianca) {
    const idGrupoDestino = await encontrarGrupoEscalacao(mensagem);
    if (!idGrupoDestino) {
      return { mensagemCliente: mensagemIA };
    }

    const idEscalacao = registrarEscalacao({
      contatoJid,
      mensagemCliente: mensagem,
      tentativaAgente: mensagemIA,
    });

    const mensagemGrupo = montarMensagemEscalacao({
      telefoneCliente: telefoneContato,
      mensagemCliente: mensagem,
      tentativaAgente: mensagemIA,
      resumoEscalacao: ia?.resumo_escalacao ?? 'Preciso de orientação para responder.',
      idEscalacao,
    });

    const avisoCliente = idGrupoDestino
      ? '⏳ Sua dúvida foi registrada e estou consultando nossa equipe. Retorno em breve!'
      : mensagemIA;

    return {
      mensagemCliente: avisoCliente,
      escalacao: { idEscalacao, idGrupoDestino, mensagemGrupo },
    };
  }

  return { mensagemCliente: mensagemIA };
}

export { vincularMensagemGrupo };
