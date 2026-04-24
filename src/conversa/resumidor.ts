import { chat } from '../ai/provedor';
import { PROMPT_RESUMIDOR } from '../ai/prompts/resumidor';
import { Conversas } from '../banco/repositorios/conversas';
import { Resumos } from '../banco/repositorios/resumos';
import { config } from '../config';

export async function resumirSeNecessario(contatoJid: string): Promise<void> {
  const total = Conversas.contarMensagens(contatoJid);
  const existente = Resumos.buscar(contatoJid);
  const jaResumidas = existente?.mensagens_resumidas ?? 0;

  if (total - jaResumidas < config.agente.resumirAposMensagens) return;

  const historico = Conversas.buscarHistorico(contatoJid, 60);
  if (historico.length === 0) return;

  const transcricao = historico
    .map((m) => `${m.papel === 'usuario' ? 'Cliente' : 'Agente'}: ${m.conteudo}`)
    .join('\n');

  try {
    const novoResumo = await chat({
      sistema: PROMPT_RESUMIDOR,
      mensagem: `Conversa:\n${transcricao}`,
      maxTokens: 400,
    });

    if (novoResumo.trim()) {
      Resumos.salvar(contatoJid, novoResumo.trim(), total);
    }
  } catch (err) {
    console.error('[resumidor] Erro ao gerar resumo:', err);
  }
}
