import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';

const DB_PATH = path.join(app.getPath('userData'), 'sessions.db');

let db: Database.Database | null = null;

export function initDatabase(): Database.Database {
  if (db) return db;

  db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      agent_id TEXT,
      title TEXT,
      status TEXT DEFAULT 'idle',
      created_at INTEGER,
      updated_at INTEGER,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      type TEXT,
      content TEXT,
      created_at INTEGER,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);
  `);

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Session operations
export interface SessionRow {
  id: string;
  agent_id: string | null;
  title: string | null;
  status: string;
  created_at: number;
  updated_at: number;
  metadata: string | null;
}

export function saveSession(session: {
  id: string;
  agentId?: string;
  title?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}): void {
  const database = getDatabase();
  const now = Date.now();

  const stmt = database.prepare(`
    INSERT INTO sessions (id, agent_id, title, status, created_at, updated_at, metadata)
    VALUES (@id, @agentId, @title, @status, @createdAt, @updatedAt, @metadata)
    ON CONFLICT(id) DO UPDATE SET
      agent_id = @agentId,
      title = @title,
      status = @status,
      updated_at = @updatedAt,
      metadata = @metadata
  `);

  stmt.run({
    id: session.id,
    agentId: session.agentId || null,
    title: session.title || null,
    status: session.status || 'idle',
    createdAt: now,
    updatedAt: now,
    metadata: session.metadata ? JSON.stringify(session.metadata) : null
  });
}

export function getSession(sessionId: string): SessionRow | undefined {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM sessions WHERE id = ?');
  return stmt.get(sessionId) as SessionRow | undefined;
}

export function getAllSessions(): SessionRow[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM sessions ORDER BY updated_at DESC');
  return stmt.all() as SessionRow[];
}

export function deleteSession(sessionId: string): void {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM sessions WHERE id = ?');
  stmt.run(sessionId);
}

export function updateSessionStatus(sessionId: string, status: string): void {
  const database = getDatabase();
  const stmt = database.prepare(`
    UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?
  `);
  stmt.run(status, Date.now(), sessionId);
}
