import { getBanco } from '../index';

export interface Documento {
  id: string;
  nome_arquivo: string;
  tipo: 'pdf' | 'excel' | 'txt' | 'csv';
  conteudo_texto: string;
  tamanho_bytes: number;
}

const LIMITE_CHARS_CONTEXTO = 4000;

export const Documentos = {
  salvar(doc: { id: string; nomeArquivo: string; tipo: 'pdf' | 'excel' | 'txt' | 'csv'; conteudoTexto: string; tamanhoBytes: number }): void {
    getBanco()
      .prepare(`INSERT INTO documentos (id, nome_arquivo, tipo, conteudo_texto, tamanho_bytes, criado_em)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  conteudo_texto = excluded.conteudo_texto,
                  atualizado_em  = excluded.criado_em`)
      .run(doc.id, doc.nomeArquivo, doc.tipo, doc.conteudoTexto, doc.tamanhoBytes, Date.now());
  },

  listar(): Documento[] {
    return getBanco()
      .prepare(`SELECT id, nome_arquivo, tipo, conteudo_texto, tamanho_bytes
                FROM documentos WHERE ativo = 1 ORDER BY criado_em DESC`)
      .all() as Documento[];
  },

  remover(id: string): void {
    getBanco().prepare('UPDATE documentos SET ativo = 0 WHERE id = ?').run(id);
  },

  // Returns formatted text to include in agent context, respecting token limits
  contextoFormatado(): string {
    const docs = this.listar();
    if (docs.length === 0) return '';

    const secoes: string[] = [];
    let totalChars = 0;

    for (const doc of docs) {
      const conteudo = doc.conteudo_texto.substring(0, LIMITE_CHARS_CONTEXTO);
      const secao = `[${doc.nome_arquivo}]\n${conteudo}${doc.conteudo_texto.length > LIMITE_CHARS_CONTEXTO ? '\n...(documento truncado)' : ''}`;
      totalChars += secao.length;
      if (totalChars > 12000) break;
      secoes.push(secao);
    }

    return secoes.join('\n\n---\n\n');
  },
};
