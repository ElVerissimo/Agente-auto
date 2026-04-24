import { getBanco } from '../index';

export interface DadosReclamacao {
  nome: string | null;
  telefone: string | null;
  numeroPedido: string | null;
  descricao: string | null;
}

export interface Reclamacao {
  id: string;
  contato_jid: string;
  telefone_contato: string;
  nome_cliente: string | null;
  telefone_cliente: string | null;
  numero_pedido: string | null;
  descricao: string | null;
  status: 'coletando' | 'enviada';
}

export const Reclamacoes = {
  iniciar(params: { id: string; contatoJid: string; telefoneContato: string }): void {
    const agora = Date.now();
    getBanco()
      .prepare(`INSERT INTO reclamacoes (id, contato_jid, telefone_contato, criado_em, atualizado_em)
                VALUES (?, ?, ?, ?, ?)`)
      .run(params.id, params.contatoJid, params.telefoneContato, agora, agora);
  },

  buscarAtiva(contatoJid: string): Reclamacao | undefined {
    return getBanco()
      .prepare(`SELECT * FROM reclamacoes WHERE contato_jid = ? AND status = 'coletando' ORDER BY criado_em DESC LIMIT 1`)
      .get(contatoJid) as Reclamacao | undefined;
  },

  atualizarDados(id: string, dados: Partial<DadosReclamacao>): void {
    getBanco()
      .prepare(
        `UPDATE reclamacoes SET
           nome_cliente    = COALESCE(?, nome_cliente),
           telefone_cliente = COALESCE(?, telefone_cliente),
           numero_pedido   = COALESCE(?, numero_pedido),
           descricao       = COALESCE(?, descricao),
           atualizado_em   = ?
         WHERE id = ?`
      )
      .run(dados.nome ?? null, dados.telefone ?? null, dados.numeroPedido ?? null, dados.descricao ?? null, Date.now(), id);
  },

  marcarEnviada(id: string, idGrupoDestino: string): void {
    getBanco()
      .prepare(`UPDATE reclamacoes SET status = 'enviada', id_grupo_destino = ?, atualizado_em = ? WHERE id = ?`)
      .run(idGrupoDestino, Date.now(), id);
  },
};
