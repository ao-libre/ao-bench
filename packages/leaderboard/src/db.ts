import Database from 'better-sqlite3';
import path from 'node:path';

const DB_PATH = process.env['DB_PATH'] ?? path.join(process.cwd(), 'leaderboard.db');

export const db: Database.Database = new Database(DB_PATH);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    task TEXT NOT NULL,
    xp_gained INTEGER NOT NULL DEFAULT 0,
    xp_rate REAL NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    success INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    log TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bugs (
    id TEXT PRIMARY KEY,
    charname TEXT NOT NULL,
    description TEXT NOT NULL,
    state_json TEXT,
    sdk_version TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
