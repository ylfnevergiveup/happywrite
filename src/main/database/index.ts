import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'

let db: Database.Database

export function initDatabase(): Database.Database {
  const dbPath = join(app.getPath('userData'), 'happywrite.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Migrations for existing databases
  try { db.exec('ALTER TABLE chapters ADD COLUMN notes TEXT DEFAULT \'\'') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE style_skills ADD COLUMN is_default INTEGER DEFAULT 0') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE novels ADD COLUMN cloud_id TEXT DEFAULT \'\'') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE chapters ADD COLUMN cloud_id TEXT DEFAULT \'\'') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE characters ADD COLUMN cloud_id TEXT DEFAULT \'\'') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE outline_nodes ADD COLUMN cloud_id TEXT DEFAULT \'\'') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE world_settings ADD COLUMN cloud_id TEXT DEFAULT \'\'') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE style_skills ADD COLUMN cloud_id TEXT DEFAULT \'\'') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE chapters ADD COLUMN word_target INTEGER DEFAULT 0') } catch { /* already exists */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS novels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      cover_path TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS volumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      novel_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      novel_id INTEGER NOT NULL,
      volume_id INTEGER,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      word_count INTEGER DEFAULT 0,
      word_target INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
      FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      novel_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      aliases TEXT DEFAULT '',
      role TEXT DEFAULT '',
      description TEXT DEFAULT '',
      avatar_path TEXT DEFAULT '',
      attributes TEXT DEFAULT '{}',
      relationships TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS outline_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      novel_id INTEGER NOT NULL,
      parent_id INTEGER,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      type TEXT DEFAULT 'scene',
      sort_order INTEGER DEFAULT 0,
      chapter_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES outline_nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL DEFAULT 'character',
      name TEXT NOT NULL,
      content TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS world_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      novel_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS ai_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      novel_id INTEGER NOT NULL,
      chapter_id INTEGER,
      context_type TEXT DEFAULT 'general',
      messages TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS style_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      novel_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'paste',
      source_text TEXT DEFAULT '',
      style_profile TEXT DEFAULT '',
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chapter_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chapter_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      word_count INTEGER DEFAULT 0,
      saved_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );


    CREATE INDEX IF NOT EXISTS idx_chapters_novel_order ON chapters(novel_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_history_chapter_time ON chapter_history(chapter_id, saved_at DESC);
    CREATE INDEX IF NOT EXISTS idx_outline_novel_parent ON outline_nodes(novel_id, parent_id);
  `)

  return db
}

export function getDatabase(): Database.Database {
  return db
}
