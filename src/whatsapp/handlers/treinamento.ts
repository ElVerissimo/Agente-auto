import { proto, downloadMediaMessage } from '@whiskeysockets/baileys';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { processarComandoTreinamento } from '../../conhecimento/habilidades';
import { processarDocumento } from '../../conhecimento/documentos';
import { recarregarContexto } from '../../conhecimento/contexto';
import { enviarMensagem } from '../cliente';

const DIR_CONTEXTO = 'data/contexto-empresa';

const ARQUIVOS_CONTEXTO: Record<string, string> = {
  '!empresa': 'company.md',
  '!faq': 'faq.md',
  '!produtos': 'products.md',
  '!politicas': 'policies.md',
};

const AJUDA = `🎓 *Comandos do Grupo de Treinamento:*

*Configurar informações da empresa:*
• \`!empresa [texto]\` — define as informações da empresa
• \`!faq [texto]\` — define as perguntas frequentes
• \`!produtos [texto]\` — define os produtos e serviços
• \`!politicas [texto]\` — define as políticas

*Ver conteúdo atual:*
• \`!ver empresa\`
• \`!ver faq\`
• \`!ver produtos\`
• \`!ver politicas\`

*Ensinar habilidades:*
• Escreva em linguagem natural o que quero que o agente aprenda
• Ex: "Quando alguém perguntar sobre prazo de entrega, responder que é de 3 dias úteis"

*Enviar documentos:*
• Envie um arquivo PDF, XLSX ou TXT e o agente aprende o conteúdo

*Listar habilidades:*
• \`listar habilidades\`

💡 _Dica: para atualizar um arquivo, envie \`!empresa\` seguido do novo texto completo._`;

function extrairTexto(msg: proto.IWebMessageInfo): string | null {
  const m = msg.message;
  if (!m) return null;
  return m.conversation ?? m.extendedTextMessage?.text ?? null;
}

function extrairDocumento(msg: proto.IWebMessageInfo): { nome: string; mime: string; tamanho: number } | null {
  const doc = msg.message?.documentMessage ?? msg.message?.documentWithCaptionMessage?.message?.documentMessage;
  if (!doc) return null;
  return {
    nome: doc.fileName ?? 'documento',
    mime: doc.mimetype ?? 'application/octet-stream',
    tamanho: Number(doc.fileLength ?? 0),
  };
}

export async function handleTreinamento(msg: proto.IWebMessageInfo): Promise<void> {
  const jid = msg.key.remoteJid;
  if (!jid) return;

  // Documento enviado → processar como base de conhecimento
  const infoDoc = extrairDocumento(msg);
  if (infoDoc) {
    await enviarMensagem(jid, `⏳ Processando *${infoDoc.nome}*…`);
    try {
      const buffer = await downloadMediaMessage(msg, 'buffer', {}) as Buffer;
      const resultado = await processarDocumento({
        buffer,
        nomeArquivo: infoDoc.nome,
        mimeType: infoDoc.mime,
        tamanhoBytes: infoDoc.tamanho,
      });
      await enviarMensagem(jid, resultado.mensagem);
    } catch (err) {
      console.error('[treinamento] Erro ao processar documento:', err);
      await enviarMensagem(jid, '⚠️ Erro ao processar o documento. Tente novamente.');
    }
    return;
  }

  const texto = extrairTexto(msg)?.trim();
  if (!texto) return;

  console.log(`🎓 [treinamento] ${texto.substring(0, 80)}`);

  // !ajuda
  if (texto === '!ajuda') {
    await enviarMensagem(jid, AJUDA);
    return;
  }

  // !ver empresa/faq/produtos/politicas
  if (texto.startsWith('!ver ')) {
    const alvo = texto.slice(5).trim().toLowerCase();
    const mapaVer: Record<string, string> = {
      empresa: 'company.md',
      faq: 'faq.md',
      produtos: 'products.md',
      politicas: 'policies.md',
    };
    const arquivo = mapaVer[alvo];
    if (!arquivo) {
      await enviarMensagem(jid, `❓ Opção inválida. Use: \`!ver empresa\`, \`!ver faq\`, \`!ver produtos\` ou \`!ver politicas\``);
      return;
    }
    const caminho = join(DIR_CONTEXTO, arquivo);
    const conteudo = existsSync(caminho) ? readFileSync(caminho, 'utf-8').trim() : '(vazio)';
    const preview = conteudo.length > 3000 ? conteudo.substring(0, 3000) + '\n…(truncado)' : conteudo;
    await enviarMensagem(jid, `📄 *Conteúdo de !${alvo}:*\n\n${preview}`);
    return;
  }

  // !empresa / !faq / !produtos / !politicas
  for (const [cmd, arquivo] of Object.entries(ARQUIVOS_CONTEXTO)) {
    if (texto.startsWith(cmd)) {
      const conteudo = texto.slice(cmd.length).trim();
      if (!conteudo) {
        // Sem conteúdo → mostra o atual e instrui
        const caminho = join(DIR_CONTEXTO, arquivo);
        const atual = existsSync(caminho) ? readFileSync(caminho, 'utf-8').trim() : '(vazio)';
        const preview = atual.length > 3000 ? atual.substring(0, 3000) + '\n…(truncado)' : atual;
        await enviarMensagem(
          jid,
          `📄 *Conteúdo atual de ${cmd}:*\n\n${preview}\n\n` +
          `_Para atualizar, envie \`${cmd}\` seguido do novo texto. Ex:_\n${cmd} Minha empresa é...`
        );
        return;
      }
      // Com conteúdo → salva o arquivo
      const caminho = join(DIR_CONTEXTO, arquivo);
      writeFileSync(caminho, conteudo, 'utf-8');
      recarregarContexto();
      await enviarMensagem(
        jid,
        `✅ *${cmd.slice(1)} atualizado com sucesso!*\n\nO agente já está usando as novas informações.`
      );
      return;
    }
  }

  // Texto livre → processar como habilidade
  try {
    const confirmacao = await processarComandoTreinamento(texto);
    await enviarMensagem(jid, confirmacao);
  } catch (err) {
    console.error('[treinamento] Erro:', err);
    await enviarMensagem(jid, '⚠️ Ocorreu um erro. Tente novamente.');
  }
}
