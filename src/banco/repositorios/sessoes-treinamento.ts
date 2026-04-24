import { MensagemHistorico } from '../../ai/provedor';

interface PendenteConfirmacao {
  tipo: 'habilidade' | 'regra' | 'correcao';
  nome: string;
  descricao: string;
  conteudo: string;
}

interface SessaoTreinamento {
  historico: MensagemHistorico[];
  pendente?: PendenteConfirmacao;
}

const sessoes = new Map<string, SessaoTreinamento>();

export const SessoesTreinamento = {
  obter(jid: string): SessaoTreinamento {
    if (!sessoes.has(jid)) sessoes.set(jid, { historico: [] });
    return sessoes.get(jid)!;
  },

  adicionar(jid: string, papel: 'usuario' | 'assistente', conteudo: string): void {
    const s = SessoesTreinamento.obter(jid);
    s.historico.push({ papel, conteudo });
    if (s.historico.length > 20) s.historico = s.historico.slice(-20);
  },

  definirPendente(jid: string, pendente: { tipo: 'habilidade' | 'regra' | 'correcao'; nome: string; descricao: string; conteudo: string }): void {
    SessoesTreinamento.obter(jid).pendente = pendente;
  },

  obterPendente(jid: string): PendenteConfirmacao | undefined {
    return SessoesTreinamento.obter(jid).pendente;
  },

  limparPendente(jid: string): void {
    const s = sessoes.get(jid);
    if (s) s.pendente = undefined;
  },
};
