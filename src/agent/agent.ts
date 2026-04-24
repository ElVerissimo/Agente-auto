import { askClaude } from '../ai/claude';
import { buildSystemPrompt } from '../ai/prompts';
import { loadCompanyContext } from './context-loader';
import { getConversationHistory, saveMessage, getLearnedKnowledge } from './memory';
import { startEscalation, linkEscalationToGroupMessage } from './escalation';
import { config } from '../config';

export interface ProcessResult {
  responseToClient: string;
  escalation?: {
    id: string;
    groupMessage: string;
  };
}

export async function processClientMessage(params: {
  contactJid: string;
  contactPhone: string;
  message: string;
}): Promise<ProcessResult> {
  const { contactJid, contactPhone, message } = params;

  const companyContext = loadCompanyContext();
  const learnedKnowledge = getLearnedKnowledge();
  const history = getConversationHistory(contactJid);

  const systemPrompt = buildSystemPrompt({
    agentName: config.whatsapp.agentName,
    companyContext,
    learnedKnowledge,
  });

  const aiResponse = await askClaude({
    systemPrompt,
    conversationHistory: history,
    userMessage: message,
  });

  saveMessage(contactJid, 'user', message);

  const needsEscalation =
    aiResponse.precisa_escalar || aiResponse.confianca < config.agent.confidenceThreshold;

  if (needsEscalation) {
    saveMessage(contactJid, 'assistant', aiResponse.mensagem);

    const esc = startEscalation({
      clientJid: contactJid,
      clientPhone: contactPhone,
      clientMessage: message,
      agentAttempt: aiResponse.mensagem,
      escalationSummary:
        aiResponse.resumo_escalacao || 'Preciso de orientação para responder esta pergunta.',
    });

    const clientReply = config.whatsapp.managersGroupId
      ? '⏳ Sua dúvida foi registrada e estou consultando nossa equipe. Retornarei em breve!'
      : `${aiResponse.mensagem}\n\n_Verificarei mais detalhes e retorno em breve._`;

    return {
      responseToClient: clientReply,
      escalation: { id: esc.id, groupMessage: esc.groupMessage },
    };
  }

  saveMessage(contactJid, 'assistant', aiResponse.mensagem);
  return { responseToClient: aiResponse.mensagem };
}

export function recordEscalationGroupMessage(escalationId: string, groupMsgId: string): void {
  linkEscalationToGroupMessage(escalationId, groupMsgId);
}
