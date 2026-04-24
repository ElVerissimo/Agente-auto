import { v4 as uuidv4 } from 'uuid';
import {
  createEscalation,
  setEscalationManagerMessageId,
  findPendingEscalationByManagerMsgId,
  resolveEscalation,
  saveKnowledge,
} from './memory';
import { buildEscalationMessage } from '../ai/prompts';

export interface NewEscalationResult {
  id: string;
  groupMessage: string;
}

export function startEscalation(params: {
  clientJid: string;
  clientPhone: string;
  clientMessage: string;
  agentAttempt: string;
  escalationSummary: string;
}): NewEscalationResult {
  const id = uuidv4();

  createEscalation({
    id,
    clientJid: params.clientJid,
    clientMessage: params.clientMessage,
    agentAttempt: params.agentAttempt,
  });

  const groupMessage = buildEscalationMessage({
    clientPhone: params.clientPhone,
    clientMessage: params.clientMessage,
    agentAttempt: params.agentAttempt,
    escalationSummary: params.escalationSummary,
    escalationId: id,
  });

  return { id, groupMessage };
}

export function linkEscalationToGroupMessage(escalationId: string, msgId: string): void {
  setEscalationManagerMessageId(escalationId, msgId);
}

export type ManagerAnswerResult =
  | { found: false }
  | {
      found: true;
      escalationId: string;
      clientJid: string;
      clientMessage: string;
      replyToClient: string;
    };

export function processManagerAnswer(
  quotedMsgId: string,
  managerText: string
): ManagerAnswerResult {
  const esc = findPendingEscalationByManagerMsgId(quotedMsgId);
  if (!esc) return { found: false };

  resolveEscalation(esc.id, managerText);

  // Persist so the agent learns for future similar questions
  saveKnowledge(`esc-${esc.id}`, esc.client_message, managerText, 'manager');

  return {
    found: true,
    escalationId: esc.id,
    clientJid: esc.client_jid,
    clientMessage: esc.client_message,
    replyToClient: managerText,
  };
}
