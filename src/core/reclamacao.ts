import { v4 as uuid } from 'uuid';
import { chat, parseJson } from '../ai/provedor';
import { promptColetaReclamacao, formatarReclamacaoParaGrupo } from '../ai/prompts/reclamacao';
import { Reclamacoes, DadosReclamacao } from '../banco/repositorios/reclamacoes';
import { Grupos } from '../banco/repositorios/grupos';
import { MensagemHistorico } from '../ai/provedor';

interface RespostaColeta {
  mensagem: string;
  dados: Partial<DadosReclamacao>;
  completo: boolean;
}

export interface ResultadoReclamacao {
  resposta: string;
  encaminhadaParaGrupo?: string; // id do grupo destino
  mensagemParaGrupo?: string;
}

export async function processarReclamacao(params: {
  contatoJid: string;
  telefoneContato: string;
  mensagem: string;
  historico: MensagemHistorico[];
}): Promise<ResultadoReclamacao> {
  // Busca ou cria sessão ativa de reclamação
  let sessao = Reclamacoes.buscarAtiva(params.contatoJid);
  if (!sessao) {
    const id = uuid();
    Reclamacoes.iniciar({ id, contatoJid: params.contatoJid, telefoneContato: params.telefoneContato });
    sessao = Reclamacoes.buscarAtiva(params.contatoJid)!;
  }

  const dadosAtuais: DadosReclamacao = {
    nome:         sessao.nome_cliente ?? null,
    telefone:     sessao.telefone_cliente ?? null,
    numeroPedido: sessao.numero_pedido ?? null,
    descricao:    sessao.descricao ?? null,
  };

  const sistemaPrompt = promptColetaReclamacao(dadosAtuais);
  const resposta = await chat({
    sistema: sistemaPrompt,
    historico: params.historico,
    mensagem: params.mensagem,
    maxTokens: 512,
    formatoJson: true,
  });

  const resultado = parseJson<RespostaColeta>(resposta);
  if (!resultado) {
    return { resposta: 'Desculpe, tive um problema. Pode repetir?' };
  }

  // Merge novos dados com os já coletados
  const dadosAtualizados: DadosReclamacao = {
    nome:         resultado.dados.nome         ?? dadosAtuais.nome,
    telefone:     resultado.dados.telefone     ?? dadosAtuais.telefone,
    numeroPedido: resultado.dados.numeroPedido ?? dadosAtuais.numeroPedido,
    descricao:    resultado.dados.descricao    ?? dadosAtuais.descricao,
  };

  Reclamacoes.atualizarDados(sessao.id, dadosAtualizados);

  if (!resultado.completo) {
    return { resposta: resultado.mensagem };
  }

  // Coleta completa — encontrar grupo de reclamação
  const gruposReclamacao = Grupos.listarPorTipo('reclamacao');
  const grupoDestino = gruposReclamacao[0] ?? null;

  if (!grupoDestino) {
    Reclamacoes.marcarEnviada(sessao.id, 'sem-grupo');
    return {
      resposta: resultado.mensagem,
    };
  }

  const mensagemGrupo = formatarReclamacaoParaGrupo({
    nomeCliente:     dadosAtualizados.nome        ?? 'Não informado',
    telefoneCliente: dadosAtualizados.telefone    ?? 'Não informado',
    numeroPedido:    dadosAtualizados.numeroPedido ?? 'Não informado',
    descricao:       dadosAtualizados.descricao   ?? 'Não informado',
    telefoneContato: params.telefoneContato,
  });

  Reclamacoes.marcarEnviada(sessao.id, grupoDestino.id_grupo);

  return {
    resposta: resultado.mensagem,
    encaminhadaParaGrupo: grupoDestino.id_grupo,
    mensagemParaGrupo: mensagemGrupo,
  };
}
