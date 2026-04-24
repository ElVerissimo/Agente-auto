import { askClaude } from '../ai/claude';
import { buildSystemPrompt } from '../ai/prompts';
import { loadCompanyContext } from './context-loader';
import { saveMessage, getLearnedKnowledge } from './memory';
import { startEscalation, linkEscalationToGroupMessage } from './escalation';
import { getFormattedSkills } from './skills';
import { getContactContext, maybeSummarize } from './conversation-memory';
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
  const skills = getFormattedSkills();
  const { summary, recentHistory } = getContactContext(contactJid);

  const systemPrompt = buildSystemPrompt({
    agentName: config.whatsapp.agentName,
    companyContext,
    learnedKnowledge,
    skills,
    conversationSummary: summary,
  });

  const aiResponse = await askClaude({
    systemPrompt,
    conversationHistory: recentHistory,
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
      ? '⏳ Registrei sua dúvida e estou consultando nossa equipe. Retornarei em breve!'
      : `${aiResponse.mensagem}\n\n_Verificarei mais detalhes e retorno em breve._`;

    void maybeSummarize(contactJid).catch(console.error);

    return {
      responseToClient: clientReply,
      escalation: { id: esc.id, groupMessage: esc.groupMessage },
    };
  }

  saveMessage(contactJid, 'assistant', aiResponse.mensagem);

  // Fire and forget — does not delay the response to the client
  void maybeSummarize(contactJid).catch(console.error);

  return { responseToClient: aiResponse.mensagem };
}

export function recordEscalationGroupMessage(escalationId: string, groupMsgId: string): void {
  linkEscalationToGroupMessage(escalationId, groupMsgId);
}
