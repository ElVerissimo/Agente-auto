import { proto } from '@whiskeysockets/baileys';
import { config } from '../config';
import { handleChatParticular } from './handlers/particular';
import { handleMencaoGrupo, handleRespostaGestor, agenteFoiMencionado } from './handlers/grupo';
import { handleTreinamento } from './handlers/treinamento';
import { enviarMensagem, obterJidDoAgente } from './cliente';
import { atualizarEnv } from '../utils/env-writer';
import { Escalacoes } from '../banco/repositorios/escalacoes';
import { processarRespostaGestor } from '../conhecimento/aprendizado';

function extrairTexto(msg: proto.IWebMessageInfo): string | null {
  const m = msg.message;
  if (!m) return null;
  return m.conversation ?? m.extendedTextMessage?.text ?? m.imageMessage?.caption ?? m.videoMessage?.caption ?? null;
}

function extrairIdCitado(msg: proto.IWebMessageInfo): string | null {
  return msg.message?.extendedTextMessage?.contextInfo?.stanzaId ?? null;
}

function ehGrupo(jid: string): boolean {
  return jid.endsWith('@g.us');
}

function removerMencao(texto: string, jidAgente: string): string {
  const numero = jidAgente.split(':')[0].split('@')[0];
  return texto.replace(new RegExp(`@${numero}\\s*`, 'g'), '').trim();
}

function formatarTelefone(jid: string): string {
  return jid.split(':')[0].split('@')[0];
}

export async function roteadorMensagens(msg: proto.IWebMessageInfo): Promise<void> {
  const jid = msg.key.remoteJid;
  if (!jid) return;

  const textoRaw = extrairTexto(msg)?.trim();

  // ── Comandos de setup: sem @menção, sem texto obrigatório ───────────────
  if (ehGrupo(jid) && textoRaw) {
    if (textoRaw === '!id') {
      await enviarMensagem(jid, `🆔 *ID deste grupo:*\n\`${jid}\`\n\nUse \`!configurar treinamento\` ou \`!configurar gestores\` para configurar direto.`);
      return;
    }
    if (textoRaw === '!configurar treinamento') {
      atualizarEnv('ID_GRUPO_TREINAMENTO', jid);
      config.whatsapp.idGrupoTreinamento = jid;
      await enviarMensagem(jid,
        `✅ *Grupo de Treinamento configurado!*\n\n` +
        `Me @mencione aqui para me ensinar qualquer coisa em linguagem natural.\n\n` +
        `Exemplos:\n• _"@agente nosso prazo de entrega é 5 dias úteis"_\n• _"@agente quando pedirem desconto, máximo 10% no Pix"_\n\n` +
        `Use \`!ajuda\` para todos os comandos.`
      );
      return;
    }
    if (textoRaw === '!configurar gestores') {
      atualizarEnv('ID_GRUPO_GESTORES', jid);
      config.whatsapp.idGrupoGestores = jid;
      await enviarMensagem(jid,
        `✅ *Grupo de Gestores configurado!*\n\n` +
        `Quando não souber responder um cliente, vou enviar a dúvida aqui.\n\n` +
        `Para responder: me @mencione com a resposta (pode ou não responder a mensagem):\n` +
        `_"@agente diga ao cliente que o prazo é 5 dias úteis"_`
      );
      return;
    }
  }

  // ── Chat particular: sempre responde ────────────────────────────────────
  if (!ehGrupo(jid)) {
    if (textoRaw) await handleChatParticular(msg);
    return;
  }

  // ── Grupos: TODOS exigem @menção ────────────────────────────────────────
  const jidAgente = obterJidDoAgente();
  if (!jidAgente) {
    console.warn('[roteador] JID do agente não disponível ainda');
    return;
  }

  if (!agenteFoiMencionado(msg, jidAgente)) return;

  // Texto sem a @menção (pode ser vazio — ex: só mandou "@agente")
  const texto = textoRaw ? removerMencao(textoRaw, jidAgente) : '';

  // ── Grupo de treinamento ────────────────────────────────────────────────
  if (config.whatsapp.idGrupoTreinamento && jid === config.whatsapp.idGrupoTreinamento) {
    console.log(`🎓 [treinamento] @mencionado: "${texto.substring(0, 60)}"`);
    // Documento mesmo sem texto de acompanhamento
    if (!texto && !msg.message?.documentMessage) {
      await enviarMensagem(jid, `👋 Olá! Me ensine algo ou use \`!ajuda\` para ver os comandos disponíveis.`);
      return;
    }
    await handleTreinamento(msg, texto);
    return;
  }

  // ── Grupo de gestores: responde escalação ───────────────────────────────
  if (config.whatsapp.idGrupoGestores && jid === config.whatsapp.idGrupoGestores) {
    if (!texto) {
      // Listou pendentes
      const pendentes = Escalacoes.listarPendentes();
      if (pendentes.length === 0) {
        await enviarMensagem(jid, '✅ Não há escalações pendentes no momento.');
      } else {
        const lista = pendentes.map((e, i) =>
          `${i + 1}. 📞 *${formatarTelefone(e.contato_jid)}*\n   _"${e.mensagem_cliente.substring(0, 80)}"_`
        ).join('\n\n');
        await enviarMensagem(jid,
          `📋 *${pendentes.length} escalação(ões) pendente(s):*\n\n${lista}\n\n` +
          `Me @mencione com a resposta para atender a mais recente, ou responda a mensagem específica e me @mencione.`
        );
      }
      return;
    }

    // Tenta pelo quote (mensagem específica)
    const idCitado = extrairIdCitado(msg);
    if (idCitado) {
      const resultado = processarRespostaGestor(idCitado, texto);
      if (resultado.encontrou) {
        await enviarMensagem(resultado.contatoJid!, resultado.respostaParaCliente!);
        await enviarMensagem(jid, `✅ Resposta enviada ao cliente e conhecimento salvo.`);
        console.log(`✅ Escalação ${resultado.idEscalacao} resolvida via quote`);
        return;
      }
    }

    // Fallback: usa a escalação pendente mais recente
    const escalacao = Escalacoes.buscarMaisRecentePendente();
    if (!escalacao) {
      await enviarMensagem(jid, '✅ Não há escalações pendentes para responder.');
      return;
    }
    processarRespostaGestor(escalacao.id, texto);
    Escalacoes.resolver(escalacao.id, texto);
    const { Conhecimentos } = await import('../banco/repositorios/conhecimentos');
    Conhecimentos.salvar(`esc-${escalacao.id}`, escalacao.mensagem_cliente, texto, 'gestor');
    await enviarMensagem(escalacao.contato_jid, texto);
    await enviarMensagem(jid,
      `✅ Resposta enviada ao cliente *${formatarTelefone(escalacao.contato_jid)}*.\n` +
      `📚 Conhecimento salvo — nunca mais precisarei perguntar isso.`
    );
    console.log(`✅ Escalação ${escalacao.id} resolvida via @menção direta`);
    return;
  }

  // ── Qualquer outro grupo ────────────────────────────────────────────────
  if (!texto) return;
  await handleMencaoGrupo(msg);
}
