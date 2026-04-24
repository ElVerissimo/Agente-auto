import { chat, parseJson } from '../ai/provedor';
import { Grupos, GrupoConfig } from '../banco/repositorios/grupos';
import { config } from '../config';

interface ResultadoRoteamento {
  id_grupo: string;
  justificativa: string;
}

export async function encontrarGrupoEscalacao(mensagem: string): Promise<string | null> {
  const grupos = Grupos.listarPorTipo('escalacao');

  // Sem grupos configurados → usa grupo de gestores do .env como fallback
  if (grupos.length === 0) {
    return config.whatsapp.idGrupoGestores || null;
  }

  // Apenas um grupo → não precisa de roteamento
  if (grupos.length === 1) {
    return grupos[0].id_grupo;
  }

  // Múltiplos grupos → IA decide o melhor
  const listaGrupos = grupos
    .map((g, i) => `${i + 1}. ID: ${g.id_grupo}\n   Nome: ${g.nome}\n   Propósito: ${g.descricao}`)
    .join('\n\n');

  const sistema = `Você é um roteador de mensagens. Dado uma pergunta de cliente e uma lista de grupos de suporte,
escolha o grupo mais adequado para responder.

Grupos disponíveis:
${listaGrupos}

Retorne JSON: { "id_grupo": "...", "justificativa": "..." }`;

  try {
    const resposta = await chat({
      sistema,
      mensagem: `Pergunta do cliente: "${mensagem}"`,
      maxTokens: 200,
      formatoJson: true,
    });

    const resultado = parseJson<ResultadoRoteamento>(resposta);
    const grupoEscolhido = grupos.find((g) => g.id_grupo === resultado?.id_grupo);
    return grupoEscolhido?.id_grupo ?? grupos[0].id_grupo;
  } catch (err) {
    console.error('[roteador] Erro ao rotear:', err);
    return grupos[0].id_grupo;
  }
}

export function montarMensagemEscalacao(params: {
  telefoneCliente: string;
  mensagemCliente: string;
  tentativaAgente: string;
  resumoEscalacao: string;
  idEscalacao: string;
}): string {
  const horario = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return `❓ *DÚVIDA SEM RESPOSTA*
━━━━━━━━━━━━━━━━━━━━
📞 *Cliente:* ${params.telefoneCliente}
⏰ *Horário:* ${horario}

💬 *Pergunta:*
_"${params.mensagemCliente}"_

🤖 *O que tentei responder:*
_"${params.tentativaAgente}"_

❓ *Por que preciso de ajuda:*
${params.resumoEscalacao}

━━━━━━━━━━━━━━━━━━━━
_Responda esta mensagem e encaminharei automaticamente ao cliente._
🆔 \`${params.idEscalacao}\``;
}
