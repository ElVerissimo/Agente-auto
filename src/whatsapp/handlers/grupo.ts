import { proto } from '@whiskeysockets/baileys';
import { processarMencaoGrupo } from '../../grupos/gerenciador';
import { enviarMensagem, obterJidDoAgente, obterLidDoAgente, definirLidAgente, obterNomeGrupo } from '../cliente';

function extrairTexto(msg: proto.IWebMessageInfo): string | null {
  const m = msg.message;
  if (!m) return null;
  return m.conversation ?? m.extendedTextMessage?.text ?? m.imageMessage?.caption ?? null;
}

function extrairIdCitado(msg: proto.IWebMessageInfo): string | null {
  return msg.message?.extendedTextMessage?.contextInfo?.stanzaId ?? null;
}

function listarMencionados(msg: proto.IWebMessageInfo): string[] {
  return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
}

function formatarTelefone(jid: string): string {
  return jid.split(':')[0].split('@')[0];
}

function removerMencaoDoTexto(texto: string, numeroAgente: string): string {
  return texto.replace(new RegExp(`@${numeroAgente}\\s*`, 'g'), '').trim();
}

export function agenteFoiMencionado(msg: proto.IWebMessageInfo, jidAgente: string): boolean {
  if (!jidAgente) return false;
  const numero = formatarTelefone(jidAgente);
  const lid = obterLidDoAgente();
  const mencionados = listarMencionados(msg);
  const texto = extrairTexto(msg) ?? '';

  // Verifica por número de telefone (formato antigo)
  if (mencionados.some((jid) => formatarTelefone(jid) === numero)) return true;

  // Verifica por LID já conhecido
  if (lid && mencionados.some((jid) => formatarTelefone(jid) === lid)) return true;

  // Verifica no texto
  if (texto.includes(`@${numero}`)) return true;
  if (lid && texto.includes(`@${lid}`)) return true;

  // Auto-descoberta: se todos os mencionados são @lid e ainda não temos o LID,
  // assume que a única menção @lid é para o agente e aprende o LID
  const todosLid = mencionados.length > 0 && mencionados.every((jid) => jid.endsWith('@lid'));
  if (todosLid && mencionados.length === 1 && !lid) {
    definirLidAgente(formatarTelefone(mencionados[0]));
    return true;
  }

  return false;
}

export async function handleMencaoGrupo(msg: proto.IWebMessageInfo): Promise<void> {
  const idGrupo = msg.key.remoteJid;
  if (!idGrupo) return;

  const textoRaw = extrairTexto(msg)?.trim();
  if (!textoRaw) return;

  const jidAgente = obterJidDoAgente();
  const texto = removerMencaoDoTexto(textoRaw, formatarTelefone(jidAgente));
  if (!texto) return;

  const telefoneRemetente = formatarTelefone(msg.key.participant ?? idGrupo);
  const nomeGrupo = await obterNomeGrupo(idGrupo);

  console.log(`💬 [grupo:${nomeGrupo}] @mencionado por ${telefoneRemetente}: ${texto.substring(0, 60)}`);

  try {
    const resposta = await processarMencaoGrupo({
      idGrupo,
      nomeGrupo,
      telefoneRemetente,
      mensagem: texto,
    });
    await enviarMensagem(idGrupo, resposta, { mencoes: [msg.key.participant ?? ''] });
  } catch (err) {
    console.error('[grupo] Erro:', err);
    await enviarMensagem(idGrupo, '⚠️ Tive um problema. Tente novamente.').catch(() => {});
  }
}

export async function handleRespostaGestor(
  msg: proto.IWebMessageInfo,
  texto: string
): Promise<void> {
  const idCitado = extrairIdCitado(msg);
  if (!idCitado) return;

  const { processarRespostaGestor } = await import('../../conhecimento/aprendizado');
  const resultado = processarRespostaGestor(idCitado, texto);
  if (!resultado.encontrou) return;

  console.log(`✅ Gestor respondeu escalação ${resultado.idEscalacao}`);
  await enviarMensagem(resultado.contatoJid!, resultado.respostaParaCliente!);
  console.log(`📨 Resposta encaminhada para ${formatarTelefone(resultado.contatoJid!)}`);
}
