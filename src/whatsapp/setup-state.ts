export type EtapaSetup = 'empresa' | 'contato' | 'produtos' | 'faq' | 'politicas' | 'concluido';

export interface SessaoSetup {
  etapa: EtapaSetup;
  dados: Map<EtapaSetup, string>;
}

const sessoes = new Map<string, SessaoSetup>();

export const ETAPAS: EtapaSetup[] = ['empresa', 'contato', 'produtos', 'faq', 'politicas', 'concluido'];

export const PERGUNTAS: Record<EtapaSetup, string> = {
  empresa:
    `Ótimo! Vamos configurar tudo junto. 🚀\n\n` +
    `*1/5 — Sobre a empresa*\n` +
    `Me conta: qual o *nome da empresa*, o que ela *faz/vende* e qual o diferencial de vocês?`,
  contato:
    `✅ Anotado!\n\n` +
    `*2/5 — Funcionamento e contato*\n` +
    `Qual o *horário de funcionamento*? Tem *endereço* físico? E os canais de contato (telefone, e-mail, site, Instagram)?`,
  produtos:
    `✅ Anotado!\n\n` +
    `*3/5 — Produtos e serviços*\n` +
    `Me lista o que você vende, com *preços* se possível. Pode mandar tudo de uma vez, um por linha.`,
  faq:
    `✅ Anotado!\n\n` +
    `*4/5 — Perguntas frequentes*\n` +
    `Quais são as dúvidas que os seus clientes mais fazem? Me conta as perguntas e as respostas certas.`,
  politicas:
    `✅ Anotado!\n\n` +
    `*5/5 — Políticas*\n` +
    `Me fala sobre as regras: prazo de entrega, política de troca/devolução, cancelamento e desconto máximo que o agente pode oferecer sozinho.`,
  concluido: '',
};

export function iniciarSessao(jid: string): void {
  sessoes.set(jid, { etapa: 'empresa', dados: new Map() });
}

export function obterSessao(jid: string): SessaoSetup | undefined {
  return sessoes.get(jid);
}

export function salvarEtapa(jid: string, conteudo: string): EtapaSetup {
  const sessao = sessoes.get(jid);
  if (!sessao) throw new Error('Sessão não encontrada');

  sessao.dados.set(sessao.etapa, conteudo);

  const idx = ETAPAS.indexOf(sessao.etapa);
  sessao.etapa = ETAPAS[idx + 1] ?? 'concluido';
  return sessao.etapa;
}

export function encerrarSessao(jid: string): Map<EtapaSetup, string> {
  const sessao = sessoes.get(jid);
  sessoes.delete(jid);
  return sessao?.dados ?? new Map();
}

export function temSessao(jid: string): boolean {
  return sessoes.has(jid);
}
