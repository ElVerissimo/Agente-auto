import { existsSync, mkdirSync } from 'fs';
import { extname } from 'path';
import { v4 as uuid } from 'uuid';
import { config } from '../config';
import { Documentos } from '../banco/repositorios/documentos';

const TIPOS_SUPORTADOS = ['pdf', 'xlsx', 'xls', 'txt', 'csv'] as const;
type ExtensaoSuportada = typeof TIPOS_SUPORTADOS[number];

function detectarTipo(nomeArquivo: string, mimeType: string): 'pdf' | 'excel' | 'txt' | 'csv' | null {
  const ext = extname(nomeArquivo).toLowerCase().replace('.', '') as ExtensaoSuportada;
  if (ext === 'pdf' || mimeType === 'application/pdf') return 'pdf';
  if (ext === 'xlsx' || ext === 'xls' || mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'excel';
  if (ext === 'csv' || mimeType === 'text/csv') return 'csv';
  if (ext === 'txt' || mimeType === 'text/plain') return 'txt';
  return null;
}

async function extrairTextoPDF(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const dados = await pdfParse(buffer);
  return dados.text;
}

function extrairTextoExcel(buffer: Buffer): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as typeof import('xlsx');
  const workbook = XLSX.read(buffer);
  return workbook.SheetNames.map((nome) => {
    const planilha = workbook.Sheets[nome];
    const csv = XLSX.utils.sheet_to_csv(planilha);
    return `[Planilha: ${nome}]\n${csv}`;
  }).join('\n\n');
}

function extrairTextoPlano(buffer: Buffer): string {
  return buffer.toString('utf-8');
}

export async function processarDocumento(params: {
  buffer: Buffer;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
}): Promise<{ sucesso: boolean; mensagem: string }> {
  if (!existsSync(config.caminhos.baseConhecimento)) {
    mkdirSync(config.caminhos.baseConhecimento, { recursive: true });
  }

  const tipo = detectarTipo(params.nomeArquivo, params.mimeType);
  if (!tipo) {
    return {
      sucesso: false,
      mensagem: `Formato não suportado: *${params.nomeArquivo}*\nFormatos aceitos: PDF, Excel (.xlsx), TXT, CSV`,
    };
  }

  try {
    let conteudo: string;
    if (tipo === 'pdf')        conteudo = await extrairTextoPDF(params.buffer);
    else if (tipo === 'excel') conteudo = extrairTextoExcel(params.buffer);
    else                       conteudo = extrairTextoPlano(params.buffer);

    if (!conteudo.trim()) {
      return { sucesso: false, mensagem: `O documento *${params.nomeArquivo}* está vazio ou não foi possível extrair texto.` };
    }

    Documentos.salvar({
      id: uuid(),
      nomeArquivo: params.nomeArquivo,
      tipo,
      conteudoTexto: conteudo,
      tamanhoBytes: params.tamanhoBytes,
    });

    return {
      sucesso: true,
      mensagem: `✅ *${params.nomeArquivo}* processado e adicionado à base de conhecimento!\n_${conteudo.length.toLocaleString('pt-BR')} caracteres extraídos._`,
    };
  } catch (err) {
    console.error(`Erro ao processar ${params.nomeArquivo}:`, err);
    return { sucesso: false, mensagem: `⚠️ Erro ao processar *${params.nomeArquivo}*. Verifique se o arquivo não está corrompido.` };
  }
}
