import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { config } from '../config';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    mkdirSync(dirname(config.paths.database), { recursive: true });
    db = new Database(config.paths.database);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_jid TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_conv_contact_ts
      ON conversations(contact_jid, timestamp);

    CREATE TABLE IF NOT EXISTS knowledge (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manager',
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS escalations (
      id TEXT PRIMARY KEY,
      client_jid TEXT NOT NULL,
      client_message TEXT NOT NULL,
      agent_attempt TEXT NOT NULL DEFAULT '',
      manager_message_id TEXT,
      manager_response TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'resolved')),
      created_at INTEGER NOT NULL,
      resolved_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      content TEXT NOT NULL,
      examples TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversation_summaries (
      contact_jid TEXT PRIMARY KEY,
      summary TEXT NOT NULL,
      messages_summarized INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
  `);
}

// ── Conversations ──────────────────────────────────────────────────────────

export interface ConversationRow {
  role: 'user' | 'assistant';
  content: string;
}

export function getConversationHistory(contactJid: string, limit?: number): ConversationRow[] {
  const rows = getDb()
    .prepare(
      `SELECT role, content FROM conversations
       WHERE contact_jid = ?
       ORDER BY timestamp DESC
       LIMIT ?`
    )
    .all(contactJid, limit ?? config.agent.maxHistoryLength) as ConversationRow[];
  return rows.reverse();
}

export function getConversationMessageCount(contactJid: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS cnt FROM conversations WHERE contact_jid = ?')
    .get(contactJid) as { cnt: number };
  return row.cnt;
}

export function saveMessage(
  contactJid: string,
  role: 'user' | 'assistant',
  content: string
): void {
  getDb()
    .prepare(
      'INSERT INTO conversations (contact_jid, role, content, timestamp) VALUES (?, ?, ?, ?)'
    )
    .run(contactJid, role, content, Date.now());
}

// ── Knowledge base ──────────────────────────────────────────────────────────

export function getLearnedKnowledge(): string {
  const rows = getDb()
    .prepare(
      `SELECT question, answer FROM knowledge
       ORDER BY usage_count DESC, updated_at DESC
       LIMIT 50`
    )
    .all() as Array<{ question: string; answer: string }>;

  if (rows.length === 0) return '';
  return rows
    .map((r, i) => `${i + 1}. P: ${r.question}\n   R: ${r.answer}`)
    .join('\n\n');
}

export function saveKnowledge(
  id: string,
  question: string,
  answer: string,
  source = 'manager'
): void {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO knowledge (id, question, answer, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET answer = excluded.answer, updated_at = excluded.updated_at`
    )
    .run(id, question, answer, source, now, now);
}

// ── Escalations ─────────────────────────────────────────────────────────────

export function createEscalation(params: {
  id: string;
  clientJid: string;
  clientMessage: string;
  agentAttempt: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO escalations (id, client_jid, client_message, agent_attempt, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(params.id, params.clientJid, params.clientMessage, params.agentAttempt, Date.now());
}

export function setEscalationManagerMessageId(escalationId: string, msgId: string): void {
  getDb()
    .prepare('UPDATE escalations SET manager_message_id = ? WHERE id = ?')
    .run(msgId, escalationId);
}

export interface EscalationRow {
  id: string;
  client_jid: string;
  client_message: string;
  agent_attempt: string;
}

export function findPendingEscalationByManagerMsgId(
  managerMsgId: string
): EscalationRow | undefined {
  return getDb()
    .prepare(
      `SELECT id, client_jid, client_message, agent_attempt
       FROM escalations
       WHERE manager_message_id = ? AND status = 'pending'`
    )
    .get(managerMsgId) as EscalationRow | undefined;
}

export function resolveEscalation(escalationId: string, managerResponse: string): void {
  getDb()
    .prepare(
      `UPDATE escalations
       SET status = 'resolved', manager_response = ?, resolved_at = ?
       WHERE id = ?`
    )
    .run(managerResponse, Date.now(), escalationId);
}

// ── Skills ───────────────────────────────────────────────────────────────────

export interface SkillRow {
  id: string;
  name: string;
  description: string;
  content: string;
  examples: string; // JSON string
  usage_count: number;
}

export function saveSkill(skill: {
  id: string;
  name: string;
  description: string;
  content: string;
  examples: string[];
}): void {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO skills (id, name, description, content, examples, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         content = excluded.content,
         examples = excluded.examples,
         updated_at = excluded.updated_at`
    )
    .run(skill.id, skill.name, skill.description, skill.content, JSON.stringify(skill.examples), now, now);
}

export function getAllSkills(): SkillRow[] {
  return getDb()
    .prepare(
      `SELECT id, name, description, content, examples, usage_count
       FROM skills WHERE active = 1
       ORDER BY usage_count DESC, updated_at DESC`
    )
    .all() as SkillRow[];
}

export function deleteSkill(nameOrId: string): boolean {
  const result = getDb()
    .prepare(
      `UPDATE skills SET active = 0
       WHERE active = 1 AND (id = ? OR name LIKE ?)`
    )
    .run(nameOrId, `%${nameOrId}%`);
  return result.changes > 0;
}

export function incrementSkillUsage(skillId: string): void {
  getDb()
    .prepare('UPDATE skills SET usage_count = usage_count + 1 WHERE id = ?')
    .run(skillId);
}

// ── Conversation summaries ────────────────────────────────────────────────────

export interface SummaryRow {
  summary: string;
  messages_summarized: number;
}

export function getConversationSummary(contactJid: string): SummaryRow | undefined {
  return getDb()
    .prepare(
      'SELECT summary, messages_summarized FROM conversation_summaries WHERE contact_jid = ?'
    )
    .get(contactJid) as SummaryRow | undefined;
}

export function saveConversationSummary(
  contactJid: string,
  summary: string,
  messagesSummarized: number
): void {
  getDb()
    .prepare(
      `INSERT INTO conversation_summaries (contact_jid, summary, messages_summarized, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(contact_jid) DO UPDATE SET
         summary = excluded.summary,
         messages_summarized = excluded.messages_summarized,
         updated_at = excluded.updated_at`
    )
    .run(contactJid, summary, messagesSummarized, Date.now());
}
