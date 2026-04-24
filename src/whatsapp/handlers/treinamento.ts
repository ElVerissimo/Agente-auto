import { proto, downloadMediaMessage } from '@whiskeysockets/baileys';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { v4 as uuid } from 'uuid';
import { chat, parseJson } from '../../ai/provedor';
import { PROMPT_APRENDIZADO } from '../../ai/prompts/treinamento';
import { processarDocumento } from '../../conhecimento/documentos';
import { recarregarContexto } from '../../conhecimento/contexto';
import { Habilidades } from '../../banco/repositorios/habilidades';
import { Regras } from '../../banco/repositorios/regras';
import { SessoesTreinamento } from '../../banco/repositorios/sessoes-treinamento';
import { enviarMensagem } from '../cliente';
import { setupAtivo, iniciarSetup, processarRespostaSetup } from './setup';

const DIR_CONTEXTO = 'data/contexto-empresa';

interface RespostaAprendizado {
  resposta: string;
  acao: 'pergunta' | 'confirmar' | 'salvar' | 'cancelado' | 'listar' | 'remover';
  tipo: 'habilidade' | 'regra' | 'correcao' | null;
  para_salvar: { nome: string; descricao: string; conteudo: string } | null;
}

const ARQUIVOS_CONTEXTO: Record<string, string> = {
  '!empresa': 'company.md',
  '!faq': 'faq.md',
  '!produtos': 'products.md',
  '!politicas': 'policies.md',
};

const AJUDA = `🎓 *Grupo de Treinamento — o que posso fazer aqui:*

*Modo conversacional (recomendado):*
Me @mencione e ensine em linguagem natural. Exemplos:
• _"@agente quando alguém pedir desconto, máximo 10% no Pix"_
• _"@agente corrija: o prazo de entrega é 5 dias, não 3"_
• _"@agente nossa política de troca é 30 dias com nota fiscal"_

Eu vou perguntar se precisar de mais detalhes, confirmar o que entendi, e só salvar após sua aprovação.

*Configuração guiada:*
• \`!setup\` — configura tudo passo a passo em conversa

*Editar arquivos diretamente:*
• \`!empresa [texto]\`, \`!faq [texto]\`, \`!produtos [texto]\`, \`!politicas [texto]\`
• \`!ver empresa\`, \`!ver faq\`, \`!ver produtos\`, \`!ver politicas\`

*Gerenciar conhecimento:*
• \`!listar\` — ver tudo que foi ensinado
• \`!regras\` — ver regras de comportamento

*Documentos:*
Envie um PDF, XLSX ou TXT — eu aprendo o conteúdo automaticamente`;

function extrairDocumento(msg: proto.IWebMessageInfo): { nome: string; mime: string; tamanho: number } | null {
  const doc = msg.message?.documentMessage ?? msg.message?.documentWithCaptionMessage?.message?.documentMessage;
  if (!doc) return null;
  return { nome: doc.fileName ?? 'documento', mime: doc.mimetype ?? 'application/octet-stream', tamanho: Number(doc.fileLength ?? 0) };
}

async function processarAprendizado(jid: string, texto: string): Promise<void> {
  const sessao = SessoesTreinamento.obter(jid);
  const pendente = SessoesTreinamento.obterPendente(jid);

  // Gestor confirmou algo pendente
  if (pendente) {
    const confirmou = /^(sim|ok|s|confirma|confirmar|correto|certo|pode|salva|salvar|isso|exato|perfeito)$/i.test(texto.trim());
    const cancelou = /^(n[aã]o|nao|cancel|cancela|cancelar|errado|errei|não quero)$/i.test(texto.trim());

    if (confirmou) {
      if (pendente.tipo === 'regra' || pendente.tipo === 'correcao') {
        const id = Regras.salvar(pendente.conteudo, pendente.descricao);
        SessoesTreinamento.limparPendente(jid);
        SessoesTreinamento.adicionar(jid, 'assistente', `✅ Regra salva (${id.substring(0, 8)})`);
        await enviarMensagem(jid, `✅ *Regra salva!*\n\n_"${pendente.conteudo}"_\n\nVou seguir isso em todos os atendimentos.`);
      } else {
        const id = uuid();
        Habilidades.salvar({ id, nome: pendente.nome, descricao: pendente.descricao, conteudo: pendente.conteudo, exemplos: [] });
        SessoesTreinamento.limparPendente(jid);
        SessoesTreinamento.adicionar(jid, 'assistente', `✅ Habilidade "${pendente.nome}" salva`);
        await enviarMensagem(jid, `✅ *Aprendi!*\n\n📌 *${pendente.nome}*\n_${pendente.descricao}_\n\nVou usar esse conhecimento nos atendimentos.`);
      }
      return;
    }

    if (cancelou) {
      SessoesTreinamento.limparPendente(jid);
      await enviarMensagem(jid, '↩️ Cancelado. Me ensine de novo se quiser, com mais detalhes.');
      return;
    }
    // Não foi confirmação nem cancelamento — trata como nova mensagem de ajuste
    SessoesTreinamento.limparPendente(jid);
  }

  SessoesTreinamento.adicionar(jid, 'usuario', texto);

  const historico = sessao.historico.slice(0, -1);
  const respostaRaw = await chat({
    sistema: PROMPT_APRENDIZADO,
    historico,
    mensagem: texto,
    formatoJson: true,
  });

  const resultado = parseJson<RespostaAprendizado>(respostaRaw);
  if (!resultado) {
    await enviarMensagem(jid, '⚠️ Não entendi. Pode explicar de outra forma?');
    return;
  }

  SessoesTreinamento.adicionar(jid, 'assistente', resultado.resposta);

  if (resultado.acao === 'confirmar' && resultado.para_salvar) {
    SessoesTreinamento.definirPendente(jid, {
      tipo: resultado.tipo as 'habilidade' | 'regra',
      ...resultado.para_salvar,
    });
  }

  if (resultado.acao === 'listar') {
    const habilidades = Habilidades.listar();
    const regras = Regras.listar();
    let msg = '';
    if (habilidades.length > 0) {
      msg += `📚 *Habilidades (${habilidades.length}):*\n`;
      msg += habilidades.map((h, i) => `${i + 1}. *${h.nome}* — ${h.descricao}`).join('\n');
    }
    if (regras.length > 0) {
      msg += `\n\n⚙️ *Regras de comportamento (${regras.length}):*\n`;
      msg += regras.map((r, i) => `${i + 1}. ${r.instrucao}`).join('\n');
    }
    if (!msg) msg = '📭 Nenhum conhecimento cadastrado ainda.';
    await enviarMensagem(jid, msg);
    return;
  }

  await enviarMensagem(jid, resultado.resposta);
}

async function handleComando(jid: string, texto: string): Promise<void> {
  if (texto === '!ajuda') {
    await enviarMensagem(jid, AJUDA);
    return;
  }

  if (texto === '!setup') {
    await iniciarSetup(jid);
    return;
  }

  if (texto === '!listar') {
    await processarAprendizado(jid, 'listar tudo que foi ensinado');
    return;
  }

  if (texto === '!regras') {
    const regras = Regras.listar();
    if (regras.length === 0) {
      await enviarMensagem(jid, '📭 Nenhuma regra de comportamento cadastrada ainda.');
      return;
    }
    const lista = regras.map((r, i) => `${i + 1}. ${r.instrucao}\n   🆔 \`${r.id.substring(0, 8)}\``).join('\n\n');
    await enviarMensagem(jid, `⚙️ *Regras de comportamento (${regras.length}):*\n\n${lista}`);
    return;
  }

  if (texto.startsWith('!ver ')) {
    const alvo = texto.slice(5).trim().toLowerCase();
    const mapa: Record<string, string> = { empresa: 'company.md', faq: 'faq.md', produtos: 'products.md', politicas: 'policies.md' };
    const arquivo = mapa[alvo];
    if (!arquivo) {
      await enviarMensagem(jid, '❓ Use: `!ver empresa`, `!ver faq`, `!ver produtos` ou `!ver politicas`');
      return;
    }
    const caminho = join(DIR_CONTEXTO, arquivo);
    const conteudo = existsSync(caminho) ? readFileSync(caminho, 'utf-8').trim() : '(vazio)';
    const preview = conteudo.length > 3000 ? conteudo.substring(0, 3000) + '\n…(truncado)' : conteudo;
    await enviarMensagem(jid, `📄 *!${alvo}:*\n\n${preview}`);
    return;
  }

  for (const [cmd, arquivo] of Object.entries(ARQUIVOS_CONTEXTO)) {
    if (texto.startsWith(cmd)) {
      const conteudo = texto.slice(cmd.length).trim();
      if (!conteudo) {
        const caminho = join(DIR_CONTEXTO, arquivo);
        const atual = existsSync(caminho) ? readFileSync(caminho, 'utf-8').trim() : '(vazio)';
        const preview = atual.length > 3000 ? atual.substring(0, 3000) + '\n…' : atual;
        await enviarMensagem(jid, `📄 *Conteúdo atual de ${cmd}:*\n\n${preview}\n\n_Envie \`${cmd} [novo texto]\` para atualizar._`);
        return;
      }
      writeFileSync(join(DIR_CONTEXTO, arquivo), conteudo, 'utf-8');
      recarregarContexto();
      await enviarMensagem(jid, `✅ *${cmd.slice(1)} atualizado!* O agente já usa as novas informações.`);
      return;
    }
  }

  await enviarMensagem(jid, `❓ Comando não reconhecido. Use \`!ajuda\` para ver os comandos disponíveis.`);
}

export async function handleTreinamento(msg: proto.IWebMessageInfo, texto: string): Promise<void> {
  const jid = msg.key.remoteJid;
  if (!jid) return;

  console.log(`🎓 [treinamento] ${texto.substring(0, 80)}`);

  // Documento → base de conhecimento
  const infoDoc = extrairDocumento(msg);
  if (infoDoc) {
    await enviarMensagem(jid, `⏳ Processando *${infoDoc.nome}*…`);
    try {
      const buffer = await downloadMediaMessage(msg, 'buffer', {}) as Buffer;
      const resultado = await processarDocumento({ buffer, nomeArquivo: infoDoc.nome, mimeType: infoDoc.mime, tamanhoBytes: infoDoc.tamanho });
      await enviarMensagem(jid, resultado.mensagem);
    } catch (err) {
      console.error('[treinamento] Erro ao processar documento:', err);
      await enviarMensagem(jid, '⚠️ Erro ao processar o documento. Tente novamente.');
    }
    return;
  }

  // Comandos com !
  if (texto.startsWith('!')) {
    await handleComando(jid, texto);
    return;
  }

  // Setup ativo → rotear para setup
  if (setupAtivo(jid)) {
    await processarRespostaSetup(jid, texto);
    return;
  }

  // Aprendizado conversacional
  await processarAprendizado(jid, texto);
}
