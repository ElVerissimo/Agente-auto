import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { saveSkill, getAllSkills, deleteSkill, SkillRow } from './memory';

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

const TRAINING_SYSTEM = `Você é um assistente de treinamento de um agente virtual de atendimento ao cliente.
Sua função é extrair conhecimento das mensagens do treinador e estruturá-lo como uma "Skill".

Uma Skill é um pedaço de conhecimento específico que o agente vai usar para atender clientes.

Analise a mensagem do treinador e retorne JSON válido com exatamente este formato:
{
  "action": "create" | "list" | "delete" | "help",
  "skill": {
    "name": "Nome curto e descritivo (máx 40 chars)",
    "description": "Quando o agente deve usar esta skill",
    "content": "Conhecimento completo que o agente usará ao responder",
    "examples": ["exemplo de pergunta 1", "exemplo 2", "exemplo 3"]
  },
  "delete_target": "texto que identifica a skill a deletar (apenas action=delete)",
  "confirmation": "Mensagem confirmando o que foi feito, em português"
}

Regras:
- action "create": treinador está ensinando algo novo (política, preço, procedimento, resposta padrão)
- action "list": treinador quer ver as skills existentes
- action "delete": treinador quer remover uma skill
- action "help": treinador quer ajuda com comandos

Para "create", "skill" é obrigatório.
Para "delete", "delete_target" é obrigatório.
Para "list" e "help", apenas "confirmation" é necessário.`;

type TrainingAction =
  | { action: 'create'; skill: { name: string; description: string; content: string; examples: string[] }; confirmation: string }
  | { action: 'list'; confirmation: string }
  | { action: 'delete'; delete_target: string; confirmation: string }
  | { action: 'help'; confirmation: string };

export async function processTrainingMessage(message: string): Promise<string> {
  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 1024,
    system: TRAINING_SYSTEM,
    messages: [{ role: 'user', content: message }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  let parsed: TrainingAction;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no json');
    parsed = JSON.parse(jsonMatch[0]) as TrainingAction;
  } catch {
    return '⚠️ Não entendi. Diga "ajuda" para ver os comandos disponíveis.';
  }

  if (parsed.action === 'create' && 'skill' in parsed && parsed.skill) {
    const id = uuidv4();
    saveSkill({
      id,
      name: parsed.skill.name,
      description: parsed.skill.description,
      content: parsed.skill.content,
      examples: parsed.skill.examples ?? [],
    });
    return `✅ *Skill aprendida!*\n\n📌 *${parsed.skill.name}*\n_${parsed.skill.description}_\n\n${parsed.confirmation}\n\n🆔 \`${id.substring(0, 8)}\``;
  }

  if (parsed.action === 'list') {
    return formatSkillList();
  }

  if (parsed.action === 'delete' && 'delete_target' in parsed && parsed.delete_target) {
    const deleted = deleteSkill(parsed.delete_target);
    if (deleted) return `🗑️ ${parsed.confirmation}`;
    return `❌ Nenhuma skill encontrada com o nome/ID: "${parsed.delete_target}"\n\nUse "listar skills" para ver as disponíveis.`;
  }

  if (parsed.action === 'help') {
    return HELP_TEXT;
  }

  return parsed.confirmation || '✅ Entendido!';
}

function formatSkillList(): string {
  const skills = getAllSkills();
  if (skills.length === 0) {
    return '📭 Nenhuma skill cadastrada ainda.\n\nDiga "ajuda" para aprender como adicionar skills.';
  }
  const lines = skills.map(
    (s, i) =>
      `${i + 1}. *${s.name}*\n   _${s.description}_\n   🆔 \`${s.id.substring(0, 8)}\``
  );
  return `📚 *Skills cadastradas (${skills.length}):*\n\n${lines.join('\n\n')}`;
}

export function getFormattedSkills(): string {
  const skills = getAllSkills();
  if (skills.length === 0) return '';

  const lines = skills.map((s: SkillRow, i: number) => {
    const examples = (() => {
      try {
        return (JSON.parse(s.examples) as string[]).slice(0, 2).join(' / ');
      } catch {
        return '';
      }
    })();
    return `${i + 1}. [${s.name}]\n   Quando usar: ${s.description}\n   Resposta: ${s.content}${examples ? `\n   Exemplos: "${examples}"` : ''}`;
  });

  return lines.join('\n\n');
}

const HELP_TEXT = `🎓 *Como treinar o agente:*

*➕ Criar skill:*
• "Aprenda que [informação]"
• "Quando [situação], [como responder]"
• "Nossa política de [tema]: [detalhes]"
• "Responda sobre [assunto]: [resposta padrão]"

*📋 Gerenciar:*
• "listar skills" — ver todas as skills
• "deletar skill [nome]" — remover uma skill

*💡 Exemplos práticos:*
• "Aprenda: nosso frete é grátis para compras acima de R$ 200"
• "Quando cliente pedir desconto, ofereça no máximo 10% para Pix"
• "Horário de entrega: segunda a sexta, das 8h às 18h"
• "Prazo de troca: 30 dias com nota fiscal, sem uso"`;
