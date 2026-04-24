import 'dotenv/config';

function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variável de ambiente obrigatória não definida: ${key}`);
  }
  return value;
}

export const config = {
  anthropic: {
    apiKey: env('ANTHROPIC_API_KEY'),
    model: env('CLAUDE_MODEL', 'claude-sonnet-4-6'),
  },
  whatsapp: {
    managersGroupId: env('MANAGERS_GROUP_ID', ''),
    trainingGroupId: env('TRAINING_GROUP_ID', ''),
    agentName: env('AGENT_NAME', 'Assistente Virtual'),
    authDir: 'auth_info_baileys',
  },
  agent: {
    confidenceThreshold: parseFloat(env('CONFIDENCE_THRESHOLD', '0.7')),
    maxHistoryLength: parseInt(env('MAX_HISTORY_LENGTH', '20')),
    escalationTimeoutMs: parseInt(env('ESCALATION_TIMEOUT_MS', '3600000')),
    summarizeAfterMessages: parseInt(env('SUMMARIZE_AFTER_MESSAGES', '15')),
  },
  paths: {
    companyContext: 'data/company-context',
    database: 'data/memory.db',
  },
} as const;
