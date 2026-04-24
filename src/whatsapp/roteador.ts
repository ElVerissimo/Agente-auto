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
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    null
  );
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

  const textoRaw = extrairTexto(msg)?.trim() ?? '';
  const tipoMensagem = Object.keys(msg.message ?? {}).join(',');

  // ── LOG PRINCIPAL: toda mensagem que chega ──────────────────────────────
  console.log(`\n📨 MENSAGEM RECEBIDA`);
  console.log(`   JID: ${jid}`);
  console.log(`   Tipo: ${tipoMensagem}`);
  console.log(`   Texto: "${textoRaw.substring(0, 100)}"`);
  console.log(`   É grupo: ${ehGrupo(jid)}`);

  // ── Comandos de setup sem @menção ───────────────────────────────────────
  if (ehGrupo(jid) && textoRaw) {
    if (textoRaw === '!id') {
      await enviarMensagem(jid, `🆔 *ID deste grupo:*\n\`${jid}\`\n\nUse \`!configurar treinamento\` ou \`!configurar gestores\`.`);
      return;
    }
    if (textoRaw === '!configurar treinamento') {
      atualizarEnv('ID_GRUPO_TREINAMENTO', jid);
      config.whatsapp.idGrupoTreinamento = jid;
      await enviarMensagem(jid,
        `✅ *Grupo de Treinamento configurado!*\n\n` +
        `Me @mencione aqui para me ensinar qualquer coisa em linguagem natural.\n` +
        `Use \`!ajuda\` para todos os comandos.`
      );
      return;
    }
    if (textoRaw === '!configurar gestores') {
      atualizarEnv('ID_GRUPO_GESTORES', jid);
      config.whatsapp.idGrupoGestores = jid;
      await enviarMensagem(jid,
        `✅ *Grupo de Gestores configurado!*\n\n` +
        `Quando não souber responder um cliente, vou enviar a dúvida aqui.\n` +
        `Me @mencione com a resposta para atender.`
      );
      return;
    }
  }

  // ── Chat particular ─────────────────────────────────────────────────────
  if (!ehGrupo(jid)) {
    console.log(`   → Chat particular`);
    if (textoRaw) await handleChatParticular(msg);
    return;
  }

  // ── Grupos: verifica @menção ────────────────────────────────────────────
  const jidAgente = obterJidDoAgente();
  console.log(`   JID do agente: "${jidAgente}"`);

  if (!jidAgente) {
    console.warn(`   ⚠️  JID do agente ainda não disponível — ignorando`);
    return;
  }

  const mencionados = (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? []);
  const numerosmencionados = mencionados.map(formatarTelefone);
  const numeroAgente = formatarTelefone(jidAgente);
  const foiMencionado = agenteFoiMencionado(msg, jidAgente);

  console.log(`   Número do agente: ${numeroAgente}`);
  console.log(`   JIDs mencionados: ${mencionados.join(', ') || '(nenhum)'}`);
  console.log(`   Números mencionados: ${numerosmencionados.join(', ') || '(nenhum)'}`);
  console.log(`   Texto contém @${numeroAgente}: ${textoRaw.includes(`@${numeroAgente}`)}`);
  console.log(`   Agente foi mencionado: ${foiMencionado}`);

  if (!foiMencionado) {
    console.log(`   → Ignorado (agente não mencionado)`);
    return;
  }

  const texto = textoRaw ? removerMencao(textoRaw, jidAgente) : '';
  console.log(`   Texto sem @menção: "${texto.substring(0, 80)}"`);

  // ── Grupo de treinamento ────────────────────────────────────────────────
  if (config.whatsapp.idGrupoTreinamento && jid === config.whatsapp.idGrupoTreinamento) {
    console.log(`   → Grupo de TREINAMENTO`);
    if (!texto && !msg.message?.documentMessage) {
      await enviarMensagem(jid, `👋 Olá! Me ensine algo ou use \`!ajuda\` para ver os comandos.`);
      return;
    }
    await handleTreinamento(msg, texto);
    return;
  }

  // ── Grupo de gestores ───────────────────────────────────────────────────
  if (config.whatsapp.idGrupoGestores && jid === config.whatsapp.idGrupoGestores) {
    console.log(`   → Grupo de GESTORES`);
    if (!texto) {
      const pendentes = Escalacoes.listarPendentes();
      if (pendentes.length === 0) {
        await enviarMensagem(jid, '✅ Não há escalações pendentes no momento.');
      } else {
        const lista = pendentes.map((e, i) =>
          `${i + 1}. 📞 *${formatarTelefone(e.contato_jid)}*\n   _"${e.mensagem_cliente.substring(0, 80)}"_`
        ).join('\n\n');
        await enviarMensagem(jid,
          `📋 *${pendentes.length} escalação(ões) pendente(s):*\n\n${lista}\n\n` +
          `Me @mencione com a resposta para atender a mais recente.`
        );
      }
      return;
    }

    const idCitado = extrairIdCitado(msg);
    if (idCitado) {
      const resultado = processarRespostaGestor(idCitado, texto);
      if (resultado.encontrou) {
        await enviarMensagem(resultado.contatoJid!, resultado.respostaParaCliente!);
        await enviarMensagem(jid, `✅ Resposta enviada ao cliente e conhecimento salvo.`);
        console.log(`   ✅ Escalação ${resultado.idEscalacao} resolvida via quote`);
        return;
      }
    }

    const escalacao = Escalacoes.buscarMaisRecentePendente();
    if (!escalacao) {
      await enviarMensagem(jid, '✅ Não há escalações pendentes para responder.');
      return;
    }
    Escalacoes.resolver(escalacao.id, texto);
    const { Conhecimentos } = await import('../banco/repositorios/conhecimentos');
    Conhecimentos.salvar(`esc-${escalacao.id}`, escalacao.mensagem_cliente, texto, 'gestor');
    await enviarMensagem(escalacao.contato_jid, texto);
    await enviarMensagem(jid,
      `✅ Resposta enviada ao cliente *${formatarTelefone(escalacao.contato_jid)}*.\n📚 Salvo — não precisarei perguntar isso novamente.`
    );
    console.log(`   ✅ Escalação ${escalacao.id} resolvida via @menção direta`);
    return;
  }

  // ── Qualquer outro grupo ────────────────────────────────────────────────
  console.log(`   → Grupo PERSONALIZADO`);
  if (!texto) return;
  await handleMencaoGrupo(msg);
}
