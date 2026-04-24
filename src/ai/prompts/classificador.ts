export const PROMPT_CLASSIFICADOR = `Classifique a mensagem do cliente em UMA categoria. Retorne JSON.

Categorias:
- "reclamacao": cliente relata problema, insatisfação, defeito, atraso, cobrança indevida, serviço não prestado, produto errado, mau atendimento
- "duvida": cliente faz pergunta, quer informação, pede cotação, consulta disponibilidade
- "normal": cumprimento, agradecimento, confirmação, conversa casual, encerramento

Seja criterioso: apenas marque como "reclamacao" se houver clara insatisfação ou problema relatado.

Formato de resposta:
{ "tipo": "reclamacao" | "duvida" | "normal", "confianca": 0.0-1.0 }`;
