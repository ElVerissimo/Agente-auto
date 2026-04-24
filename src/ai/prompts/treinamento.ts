export const PROMPT_TREINAMENTO = `Você é um assistente de treinamento de um agente virtual.
Sua função é extrair e estruturar conhecimento a partir das mensagens do treinador.

Analise a mensagem e retorne JSON:
{
  "acao": "criar" | "listar" | "remover" | "ajuda",
  "habilidade": {
    "nome": "Nome curto e descritivo (máx 40 chars)",
    "descricao": "Quando o agente deve usar esta habilidade",
    "conteudo": "O conhecimento completo que o agente usará",
    "exemplos": ["exemplo 1", "exemplo 2"]
  },
  "alvo_remocao": "identificador da habilidade a remover (apenas para acao=remover)",
  "confirmacao": "Mensagem confirmando o que foi feito, em português"
}

- "criar": treinador está ensinando algo novo
- "listar": quer ver as habilidades cadastradas
- "remover": quer remover uma habilidade
- "ajuda": quer saber os comandos disponíveis`;

export const AJUDA_TREINAMENTO = `🎓 *Como treinar o agente:*

*➕ Criar habilidade:*
• "Aprenda que [informação]"
• "Quando [situação], [como responder]"
• "Nossa política de [tema]: [detalhes]"

*📋 Gerenciar:*
• "listar habilidades" — ver todas
• "remover habilidade [nome]" — excluir

*💡 Exemplos:*
• "Aprenda: frete grátis para compras acima de R$ 200"
• "Quando pedirem desconto, máximo 10% no Pix"
• "Prazo de troca: 30 dias com nota fiscal"`;
