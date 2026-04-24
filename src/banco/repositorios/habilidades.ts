import { getBanco } from '../index';

export interface Habilidade {
  id: string;
  nome: string;
  descricao: string;
  conteudo: string;
  exemplos: string;
  vezes_usado: number;
}

export const Habilidades = {
  salvar(habilidade: { id: string; nome: string; descricao: string; conteudo: string; exemplos: string[] }): void {
    const agora = Date.now();
    getBanco()
      .prepare(
        `INSERT INTO habilidades (id, nome, descricao, conteudo, exemplos, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           nome = excluded.nome,
           descricao = excluded.descricao,
           conteudo = excluded.conteudo,
           exemplos = excluded.exemplos,
           atualizado_em = excluded.atualizado_em`
      )
      .run(habilidade.id, habilidade.nome, habilidade.descricao, habilidade.conteudo, JSON.stringify(habilidade.exemplos), agora, agora);
  },

  listar(): Habilidade[] {
    return getBanco()
      .prepare(`SELECT id, nome, descricao, conteudo, exemplos, vezes_usado
                FROM habilidades WHERE ativo = 1
                ORDER BY vezes_usado DESC, atualizado_em DESC`)
      .all() as Habilidade[];
  },

  remover(nomeOuId: string): boolean {
    const resultado = getBanco()
      .prepare(`UPDATE habilidades SET ativo = 0 WHERE ativo = 1 AND (id = ? OR nome LIKE ?)`)
      .run(nomeOuId, `%${nomeOuId}%`);
    return resultado.changes > 0;
  },

  listarFormatado(): string {
    const lista = this.listar();
    if (lista.length === 0) return '';
    return lista.map((h, i) => {
      const exemplos = (() => { try { return (JSON.parse(h.exemplos) as string[]).slice(0, 2).join(' / '); } catch { return ''; } })();
      return `${i + 1}. [${h.nome}]\n   Quando usar: ${h.descricao}\n   Resposta: ${h.conteudo}${exemplos ? `\n   Exemplos: "${exemplos}"` : ''}`;
    }).join('\n\n');
  },
};
