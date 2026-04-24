import { getBanco } from '../index';

export interface ResumoConversa {
  resumo: string;
  mensagens_resumidas: number;
}

export const Resumos = {
  buscar(contatoJid: string): ResumoConversa | undefined {
    return getBanco()
      .prepare('SELECT resumo, mensagens_resumidas FROM resumos_conversas WHERE contato_jid = ?')
      .get(contatoJid) as ResumoConversa | undefined;
  },

  salvar(contatoJid: string, resumo: string, mensagensResumidas: number): void {
    getBanco()
      .prepare(
        `INSERT INTO resumos_conversas (contato_jid, resumo, mensagens_resumidas, atualizado_em)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(contato_jid) DO UPDATE SET
           resumo = excluded.resumo,
           mensagens_resumidas = excluded.mensagens_resumidas,
           atualizado_em = excluded.atualizado_em`
      )
      .run(contatoJid, resumo, mensagensResumidas, Date.now());
  },
};
