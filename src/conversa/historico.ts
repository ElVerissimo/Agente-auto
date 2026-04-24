import { Conversas, MensagemConversa } from '../banco/repositorios/conversas';
import { Resumos } from '../banco/repositorios/resumos';

export interface ContextoConversa {
  resumo: string | null;
  historicoRecente: MensagemConversa[];
}

export function obterContexto(contatoJid: string): ContextoConversa {
  const resumo = Resumos.buscar(contatoJid);
  const historicoRecente = Conversas.buscarHistorico(contatoJid, 15);
  return {
    resumo: resumo?.resumo ?? null,
    historicoRecente,
  };
}

export function salvarMensagem(contatoJid: string, papel: 'usuario' | 'assistente', conteudo: string): void {
  Conversas.salvar(contatoJid, papel, conteudo);
}
