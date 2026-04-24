import { getBanco } from '../index';

export const Conhecimentos = {
  salvar(id: string, pergunta: string, resposta: string, origem = 'gestor'): void {
    const agora = Date.now();
    getBanco()
      .prepare(
        `INSERT INTO conhecimentos (id, pergunta, resposta, origem, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           resposta = excluded.resposta,
           atualizado_em = excluded.atualizado_em`
      )
      .run(id, pergunta, resposta, origem, agora, agora);
  },

  listarFormatado(): string {
    const rows = getBanco()
      .prepare(
        `SELECT pergunta, resposta FROM conhecimentos
         ORDER BY vezes_usado DESC, atualizado_em DESC LIMIT 50`
      )
      .all() as Array<{ pergunta: string; resposta: string }>;

    if (rows.length === 0) return '';
    return rows.map((r, i) => `${i + 1}. P: ${r.pergunta}\n   R: ${r.resposta}`).join('\n\n');
  },
};
