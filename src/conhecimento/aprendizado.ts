import { v4 as uuid } from 'uuid';
import { Conhecimentos } from '../banco/repositorios/conhecimentos';
import { Escalacoes } from '../banco/repositorios/escalacoes';
import { Conversas } from '../banco/repositorios/conversas';

export function processarRespostaGestor(
  idMensagemGrupo: string,
  respostaGestor: string
): { encontrou: boolean; contatoJid?: string; respostaParaCliente?: string; idEscalacao?: string } {
  const escalacao = Escalacoes.buscarPendentePorMensagem(idMensagemGrupo);
  if (!escalacao) return { encontrou: false };

  Escalacoes.resolver(escalacao.id, respostaGestor);

  // Aprende para o futuro
  Conhecimentos.salvar(
    `esc-${escalacao.id}`,
    escalacao.mensagem_cliente,
    respostaGestor,
    'gestor'
  );

  return {
    encontrou: true,
    idEscalacao: escalacao.id,
    contatoJid: escalacao.contato_jid,
    respostaParaCliente: respostaGestor,
  };
}

export function registrarEscalacao(params: {
  contatoJid: string;
  mensagemCliente: string;
  tentativaAgente: string;
}): string {
  const id = uuid();
  Escalacoes.criar({ id, ...params });
  return id;
}

export function vincularMensagemGrupo(idEscalacao: string, idMensagem: string): void {
  Escalacoes.vincularMensagemGrupo(idEscalacao, idMensagem);
}
