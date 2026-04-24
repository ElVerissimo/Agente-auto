import { v4 as uuid } from 'uuid';
import { getBanco } from '../index';

export interface Regra {
  id: string;
  descricao: string;
  instrucao: string;
  ativa: number;
  criado_em: number;
}

export const Regras = {
  salvar(instrucao: string, descricao: string): string {
    const id = uuid();
    const agora = Date.now();
    getBanco()
      .prepare(
        `INSERT INTO regras_comportamento (id, descricao, instrucao, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, descricao, instrucao, agora, agora);
    return id;
  },

  listar(): Regra[] {
    return getBanco()
      .prepare(`SELECT * FROM regras_comportamento WHERE ativa = 1 ORDER BY criado_em ASC`)
      .all() as Regra[];
  },

  listarFormatado(): string {
    const regras = Regras.listar();
    if (regras.length === 0) return '';
    return regras.map((r, i) => `${i + 1}. ${r.instrucao}`).join('\n');
  },

  remover(id: string): boolean {
    const result = getBanco()
      .prepare(`UPDATE regras_comportamento SET ativa = 0, atualizado_em = ? WHERE id = ?`)
      .run(Date.now(), id);
    return result.changes > 0;
  },
};
