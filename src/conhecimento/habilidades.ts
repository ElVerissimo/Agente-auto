import { v4 as uuid } from 'uuid';
import { Habilidades } from '../banco/repositorios/habilidades';

export function salvarHabilidade(params: { nome: string; descricao: string; conteudo: string; exemplos?: string[] }): string {
  const id = uuid();
  Habilidades.salvar({ id, nome: params.nome, descricao: params.descricao, conteudo: params.conteudo, exemplos: params.exemplos ?? [] });
  return id;
}
