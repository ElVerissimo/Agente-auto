import 'dotenv/config';

function env(chave: string, padrao?: string): string {
  const valor = process.env[chave] ?? padrao;
  if (valor === undefined) {
    throw new Error(`Variável de ambiente obrigatória não definida: ${chave}`);
  }
  return valor;
}

export const config = {
  ia: {
    chaveApi: env('OPENAI_API_KEY'),
    modelo: env('MODELO_IA', 'gpt-4o'),
  },
  whatsapp: {
    idGrupoGestores: env('ID_GRUPO_GESTORES', ''),
    idGrupoTreinamento: env('ID_GRUPO_TREINAMENTO', ''),
    nomeAgente: env('NOME_AGENTE', 'Assistente Virtual'),
    diretorioAuth: 'auth_info_baileys',
  },
  agente: {
    limiarConfianca: parseFloat(env('LIMIAR_CONFIANCA', '0.7')),
    maxHistoricoMensagens: parseInt(env('MAX_HISTORICO_MENSAGENS', '20')),
    resumirAposMensagens: parseInt(env('RESUMIR_APOS_MENSAGENS', '15')),
    timeoutEscalacaoMs: parseInt(env('TIMEOUT_ESCALACAO_MS', '3600000')),
  },
  caminhos: {
    contextoEmpresa: 'data/contexto-empresa',
    baseConhecimento: 'data/base-conhecimento',
    bancoDados: 'data/memoria.db',
  },
};
