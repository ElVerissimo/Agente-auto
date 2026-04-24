import { getBanco } from '../index';
import { config } from '../../config';

export interface MensagemConversa {
  papel: 'usuario' | 'assistente';
  conteudo: string;
}

export const Conversas = {
  salvar(contatoJid: string, papel: 'usuario' | 'assistente', conteudo: string): void {
    getBanco()
      .prepare('INSERT INTO conversas (contato_jid, papel, conteudo, criado_em) VALUES (?, ?, ?, ?)')
      .run(contatoJid, papel, conteudo, Date.now());
  },

  buscarHistorico(contatoJid: string, limite?: number): MensagemConversa[] {
    const rows = getBanco()
      .prepare(
        `SELECT papel, conteudo FROM conversas
         WHERE contato_jid = ?
         ORDER BY criado_em DESC LIMIT ?`
      )
      .all(contatoJid, limite ?? config.agente.maxHistoricoMensagens) as MensagemConversa[];
    return rows.reverse();
  },

  contarMensagens(contatoJid: string): number {
    const row = getBanco()
      .prepare('SELECT COUNT(*) AS total FROM conversas WHERE contato_jid = ?')
      .get(contatoJid) as { total: number };
    return row.total;
  },
};
