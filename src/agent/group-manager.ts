import { askClaude } from '../ai/claude';
import { callAI } from '../ai/claude';
import {
  getGroupConfig,
  saveGroupConfig,
  saveMessage,
  getConversationHistory,
} from './memory';
import { config } from '../config';

const SETUP_SYSTEM = `Você é um assistente virtual sendo configurado para operar em um grupo de WhatsApp.
O usuário vai te explicar qual é o seu papel e as regras do grupo.

Analise as instruções recebidas e responda em JSON:
{
  "confirmation": "Mensagem confirmando que entendeu. Liste claramente o que você fará neste grupo.",
  "structured_instructions": "As instruções reescritas de forma clara, estruturada e completa para você seguir"
}`;

function buildGroupSystemPrompt(instructions: string): string {
  return `Você é ${config.whatsapp.agentName}, assistente virtual atuando em um grupo de WhatsApp.

## SEU PAPEL NESTE GRUPO
${instructions}

## REGRAS DE COMPORTAMENTO
1. Siga as instruções acima rigorosamente — elas definem seu papel aqui
2. Responda sempre em português brasileiro
3. Ao coletar informações, faça UMA pergunta por vez de forma clara
4. Quando completar uma tarefa, confirme de forma objetiva
5. Você está em um grupo — seja direto e profissional

## FORMATO DE RESPOSTA
Responda SOMENTE em JSON:
{
  "mensagem": "Sua resposta para o grupo",
  "precisa_escalar": false,
  "resumo_escalacao": null,
  "confianca": 0.9
}`;
}

export async function processGroupMention(params: {
  groupJid: string;
  groupName: string;
  senderPhone: string;
  senderJid: string;
  message: string;
}): Promise<string> {
  const existing = getGroupConfig(params.groupJid);

  // ── Primeira menção: criar entrada e pedir instruções ──────────────────
  if (!existing) {
    saveGroupConfig({
      groupJid: params.groupJid,
      groupName: params.groupName,
      instructions: '',
      status: 'setup',
    });

    return (
      `Olá! 👋 Estou aqui e pronto para trabalhar neste grupo.\n\n` +
      `Para começar, me explique:\n` +
      `_Qual é o meu papel aqui? O que devo fazer e como devo fazer?_\n\n` +
      `Quanto mais detalhes você der, melhor vou conseguir te ajudar.`
    );
  }

  // ── Modo setup: receber instruções ────────────────────────────────────
  if (existing.status === 'setup') {
    const raw = await callAI({ system: SETUP_SYSTEM, userMessage: params.message });

    let confirmation = '';
    let structuredInstructions = params.message;

    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as {
          confirmation: string;
          structured_instructions: string;
        };
        confirmation = parsed.confirmation ?? '';
        structuredInstructions = parsed.structured_instructions || params.message;
      }
    } catch { /* keep originals */ }

    saveGroupConfig({
      groupJid: params.groupJid,
      groupName: params.groupName,
      instructions: structuredInstructions,
      status: 'active',
    });

    return confirmation || `✅ Entendido! Estou configurado e pronto para operar neste grupo.`;
  }

  // ── Modo ativo: operar conforme as instruções ─────────────────────────
  const history = getConversationHistory(params.groupJid, 10);
  const systemPrompt = buildGroupSystemPrompt(existing.instructions);

  const aiResponse = await askClaude({
    systemPrompt,
    conversationHistory: history,
    userMessage: `[${params.senderPhone}]: ${params.message}`,
  });

  saveMessage(params.groupJid, 'user', `[${params.senderPhone}]: ${params.message}`);
  saveMessage(params.groupJid, 'assistant', aiResponse.mensagem);

  return aiResponse.mensagem;
}

export async function resetGroupConfig(groupJid: string): Promise<void> {
  saveGroupConfig({
    groupJid,
    groupName: '',
    instructions: '',
    status: 'setup',
  });
}
