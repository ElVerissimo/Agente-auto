import { readFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from '../config';

let cache: string | null = null;

export function carregarContextoEmpresa(forcarRecarga = false): string {
  if (cache && !forcarRecarga) return cache;

  const dir = config.caminhos.contextoEmpresa;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.warn(`⚠️  Pasta ${dir} criada. Preencha os arquivos .md com os dados da empresa.`);
    return '[Contexto da empresa não configurado. Edite os arquivos em data/contexto-empresa/]';
  }

  const arquivos = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  if (arquivos.length === 0) {
    return '[Nenhum arquivo .md encontrado em data/contexto-empresa/]';
  }

  const secoes: string[] = [];
  for (const arquivo of arquivos) {
    try {
      secoes.push(readFileSync(join(dir, arquivo), 'utf-8').trim());
    } catch (err) {
      console.error(`Erro ao ler ${arquivo}:`, err);
    }
  }

  cache = secoes.join('\n\n---\n\n');
  console.log(`📖 Contexto da empresa carregado: ${arquivos.length} arquivo(s)`);
  return cache;
}

export function recarregarContexto(): string {
  cache = null;
  return carregarContextoEmpresa();
}
