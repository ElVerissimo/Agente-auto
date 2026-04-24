import { readFileSync, writeFileSync, existsSync } from 'fs';

export function atualizarEnv(chave: string, valor: string): void {
  const caminho = '.env';
  let conteudo = existsSync(caminho) ? readFileSync(caminho, 'utf-8') : '';

  const regex = new RegExp(`^${chave}=.*$`, 'm');
  if (regex.test(conteudo)) {
    conteudo = conteudo.replace(regex, `${chave}=${valor}`);
  } else {
    conteudo = conteudo.trimEnd() + `\n${chave}=${valor}\n`;
  }

  writeFileSync(caminho, conteudo, 'utf-8');
  process.env[chave] = valor;
}
