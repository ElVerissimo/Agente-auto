import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { config } from '../config';

let banco: Database.Database | null = null;

export function getBanco(): Database.Database {
  if (!banco) {
    mkdirSync(dirname(config.caminhos.bancoDados), { recursive: true });
    banco = new Database(config.caminhos.bancoDados);
    banco.pragma('journal_mode = WAL');
    inicializarEsquema(banco);
  }
  return banco;
}

function inicializarEsquema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversas (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      contato_jid TEXT NOT NULL,
      papel      TEXT NOT NULL CHECK(papel IN ('usuario', 'assistente')),
      conteudo   TEXT NOT NULL,
      criado_em  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_conversas_contato
      ON conversas(contato_jid, criado_em);

    CREATE TABLE IF NOT EXISTS conhecimentos (
      id           TEXT PRIMARY KEY,
      pergunta     TEXT NOT NULL,
      resposta     TEXT NOT NULL,
      origem       TEXT NOT NULL DEFAULT 'gestor',
      vezes_usado  INTEGER NOT NULL DEFAULT 0,
      criado_em    INTEGER NOT NULL,
      atualizado_em INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS habilidades (
      id           TEXT PRIMARY KEY,
      nome         TEXT NOT NULL,
      descricao    TEXT NOT NULL,
      conteudo     TEXT NOT NULL,
      exemplos     TEXT NOT NULL DEFAULT '[]',
      ativo        INTEGER NOT NULL DEFAULT 1,
      vezes_usado  INTEGER NOT NULL DEFAULT 0,
      criado_em    INTEGER NOT NULL,
      atualizado_em INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS escalacoes (
      id                 TEXT PRIMARY KEY,
      contato_jid        TEXT NOT NULL,
      mensagem_cliente   TEXT NOT NULL,
      tentativa_agente   TEXT NOT NULL DEFAULT '',
      id_mensagem_grupo  TEXT,
      resposta_gestor    TEXT,
      status             TEXT NOT NULL DEFAULT 'pendente'
                           CHECK(status IN ('pendente', 'resolvida')),
      criado_em          INTEGER NOT NULL,
      resolvido_em       INTEGER
    );

    CREATE TABLE IF NOT EXISTS grupos (
      id_grupo   TEXT PRIMARY KEY,
      nome       TEXT NOT NULL DEFAULT '',
      descricao  TEXT NOT NULL DEFAULT '',
      tipo       TEXT NOT NULL DEFAULT 'geral'
                   CHECK(tipo IN ('reclamacao', 'escalacao', 'treinamento', 'geral')),
      status     TEXT NOT NULL DEFAULT 'configurando'
                   CHECK(status IN ('configurando', 'ativo')),
      criado_em  INTEGER NOT NULL,
      atualizado_em INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reclamacoes (
      id               TEXT PRIMARY KEY,
      contato_jid      TEXT NOT NULL,
      telefone_contato TEXT NOT NULL,
      nome_cliente     TEXT,
      telefone_cliente TEXT,
      numero_pedido    TEXT,
      descricao        TEXT,
      status           TEXT NOT NULL DEFAULT 'coletando'
                         CHECK(status IN ('coletando', 'enviada')),
      id_grupo_destino TEXT,
      criado_em        INTEGER NOT NULL,
      atualizado_em    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resumos_conversas (
      contato_jid          TEXT PRIMARY KEY,
      resumo               TEXT NOT NULL,
      mensagens_resumidas  INTEGER NOT NULL DEFAULT 0,
      atualizado_em        INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documentos (
      id              TEXT PRIMARY KEY,
      nome_arquivo    TEXT NOT NULL,
      tipo            TEXT NOT NULL CHECK(tipo IN ('pdf', 'excel', 'txt', 'csv')),
      conteudo_texto  TEXT NOT NULL,
      tamanho_bytes   INTEGER NOT NULL DEFAULT 0,
      ativo           INTEGER NOT NULL DEFAULT 1,
      criado_em       INTEGER NOT NULL
    );
  `);
}
