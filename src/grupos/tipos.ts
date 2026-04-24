export type TipoGrupo = 'reclamacao' | 'escalacao' | 'treinamento' | 'geral';
export type StatusGrupo = 'configurando' | 'ativo';

export const DESCRICAO_TIPO: Record<TipoGrupo, string> = {
  reclamacao: 'Recebe resumos de reclamações coletadas no chat particular',
  escalacao:  'Recebe dúvidas que o agente não souber responder — equipe responde e agente aprende',
  treinamento:'Treinamento do agente via skills e documentos',
  geral:      'Grupo de uso geral configurado manualmente',
};
