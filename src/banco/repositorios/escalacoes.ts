import { getBanco } from '../index';

export interface Escalacao {
  id: string;
  contato_jid: string;
  mensagem_cliente: string;
  tentativa_agente: string;
}

export const Escalacoes = {
  criar(params: { id: string; contatoJid: string; mensagemCliente: string; tentativaAgente: string }): void {
    getBanco()
      .prepare(`INSERT INTO escalacoes (id, contato_jid, mensagem_cliente, tentativa_agente, criado_em)
                VALUES (?, ?, ?, ?, ?)`)
      .run(params.id, params.contatoJid, params.mensagemCliente, params.tentativaAgente, Date.now());
  },

  vincularMensagemGrupo(idEscalacao: string, idMensagem: string): void {
    getBanco()
      .prepare('UPDATE escalacoes SET id_mensagem_grupo = ? WHERE id = ?')
      .run(idMensagem, idEscalacao);
  },

  buscarPendentePorMensagem(idMensagemGrupo: string): Escalacao | undefined {
    return getBanco()
      .prepare(`SELECT id, contato_jid, mensagem_cliente, tentativa_agente
                FROM escalacoes WHERE id_mensagem_grupo = ? AND status = 'pendente'`)
      .get(idMensagemGrupo) as Escalacao | undefined;
  },

  buscarMaisRecentePendente(): Escalacao | undefined {
    return getBanco()
      .prepare(`SELECT id, contato_jid, mensagem_cliente, tentativa_agente
                FROM escalacoes WHERE status = 'pendente'
                ORDER BY criado_em DESC LIMIT 1`)
      .get() as Escalacao | undefined;
  },

  listarPendentes(): Escalacao[] {
    return getBanco()
      .prepare(`SELECT id, contato_jid, mensagem_cliente, tentativa_agente
                FROM escalacoes WHERE status = 'pendente'
                ORDER BY criado_em ASC`)
      .all() as Escalacao[];
  },

  resolver(id: string, respostaGestor: string): void {
    getBanco()
      .prepare(`UPDATE escalacoes SET status = 'resolvida', resposta_gestor = ?, resolvido_em = ? WHERE id = ?`)
      .run(respostaGestor, Date.now(), id);
  },
};
