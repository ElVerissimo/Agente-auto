import { readFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from '../config';

let cache: string | null = null;

export function loadCompanyContext(forceReload = false): string {
  if (cache && !forceReload) return cache;

  const dir = config.paths.companyContext;

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.warn(`⚠️  Pasta ${dir} criada. Preencha os arquivos .md com os dados da sua empresa.`);
    return '[Contexto da empresa não configurado. Edite os arquivos em data/company-context/]';
  }

  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort();

  if (files.length === 0) {
    console.warn(`⚠️  Nenhum arquivo .md encontrado em ${dir}`);
    return '[Contexto da empresa não configurado. Adicione arquivos .md em data/company-context/]';
  }

  const sections: string[] = [];
  for (const file of files) {
    try {
      sections.push(readFileSync(join(dir, file), 'utf-8').trim());
    } catch (err) {
      console.error(`Erro ao ler ${file}:`, err);
    }
  }

  cache = sections.join('\n\n---\n\n');
  console.log(`📖 Contexto carregado: ${files.length} arquivo(s) de ${dir}`);
  return cache;
}

export function reloadCompanyContext(): string {
  cache = null;
  return loadCompanyContext();
}
