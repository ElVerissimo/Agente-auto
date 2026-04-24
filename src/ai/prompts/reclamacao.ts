import { DadosReclamacao } from '../../banco/repositorios/reclamacoes';

export function promptColetaReclamacao(dadosAtuais: DadosReclamacao): string {
  const faltando = [
    !dadosAtuais.nome        && 'nome completo',
    !dadosAtuais.telefone    && 'telefone de contato',
    !dadosAtuais.numeroPedido && 'número do pedido',
    !dadosAtuais.descricao   && 'descrição do problema',
  ].filter(Boolean);

  const coletado = Object.entries({
    'nome':           dadosAtuais.nome,
    'telefone':       dadosAtuais.telefone,
    'número do pedido': dadosAtuais.numeroPedido,
    'descrição':      dadosAtuais.descricao,
  })
    .filter(([, v]) => v)
    .map(([k, v]) => `  - ${k}: ${v}`)
    .join('\n');

  return `Você está coletando dados de uma reclamação de forma natural e empática.

Dados já coletados:
${coletado || '  (nenhum ainda)'}

Ainda precisa coletar: ${faltando.join(', ')}

REGRAS:
1. Seja empático — reconheça o problema do cliente com genuína preocupação
2. Flua naturalmente: colete 1 ou 2 campos por mensagem conforme o contexto pedir
3. Use o nome do cliente assim que souber
4. Se o cliente voluntariar vários dados de uma vez, capture todos
5. Não pareça um formulário — pareça uma conversa de atendimento humano
6. Quando todos os dados estiverem coletados, confirme e diga que vai encaminhar para a equipe responsável
7. Varie suas expressões — nunca repita a mesma frase

Retorne JSON:
{
  "mensagem": "Sua resposta ao cliente",
  "dados": {
    "nome": null,
    "telefone": null,
    "numeroPedido": null,
    "descricao": null
  },
  "completo": false
}

Preencha em "dados" APENAS os campos que foram informados nesta mensagem (mantenha null o que não foi informado).`;
}

export function formatarReclamacaoParaGrupo(params: {
  nomeCliente: string;
  telefoneCliente: string;
  numeroPedido: string;
  descricao: string;
  telefoneContato: string;
}): string {
  const horario = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return `🚨 *NOVA RECLAMAÇÃO*
━━━━━━━━━━━━━━━━━━━━
⏰ ${horario}

👤 *Cliente:* ${params.nomeCliente}
📞 *Telefone:* ${params.telefoneCliente}
🛒 *Pedido Nº:* ${params.numeroPedido}

📝 *Reclamação:*
${params.descricao}

━━━━━━━━━━━━━━━━━━━━
_Contato original: ${params.telefoneContato}_`;
}
