import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

let db: Database.Database | null = null;

/**
 * Initialize SQLite database with schema
 * @param storagePath - Path to store the database file
 * @returns Database instance
 */
export function initializeDatabase(storagePath: string): Database.Database {
  if (db) {
    return db;
  }

  // Ensure storage directory exists
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }

  const dbPath = path.join(storagePath, 'glixymetric.db');
  db = new Database(dbPath);

  // Enable foreign keys
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createSchema();

  return db;
}

/**
 * Create all database tables and indexes
 */
function createSchema(): void {
  if (!db) {
    throw new Error('Database not initialized');
  }

  // Events Table - Tracks all coding activities
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      file TEXT,
      language TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  // Sessions Table - Continuous coding periods
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      duration INTEGER,
      project_path TEXT NOT NULL,
      language TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  // Commits Table - Git activity tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS commits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT UNIQUE NOT NULL,
      message TEXT,
      timestamp INTEGER NOT NULL,
      repo_path TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  // Goals Table - Daily productivity targets
  db.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date INTEGER NOT NULL,
      daily_hours INTEGER,
      daily_commits INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      UNIQUE(date)
    );
  `);

  // Breaks Table - Break reminders and tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS breaks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      duration INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  // Create indexes for performance
  createIndexes();
}

/**
 * Create database indexes for frequently queried columns
 */
function createIndexes(): void {
  if (!db) {
    throw new Error('Database not initialized');
  }

  // Events indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_language ON events(language);
  `);

  // Sessions indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
    CREATE INDEX IF NOT EXISTS idx_sessions_project_path ON sessions(project_path);
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(strftime('%Y-%m-%d', datetime(start_time, 'unixepoch')));
  `);

  // Commits indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_commits_timestamp ON commits(timestamp);
    CREATE INDEX IF NOT EXISTS idx_commits_repo_path ON commits(repo_path);
    CREATE INDEX IF NOT EXISTS idx_commits_hash ON commits(hash);
  `);

  // Goals indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_goals_date ON goals(date);
  `);

  // Breaks indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_breaks_timestamp ON breaks(timestamp);
  `);
}

/**
 * Get database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Reset database (for testing purposes)
 */
export function resetDatabase(): void {
  if (!db) {
    throw new Error('Database not initialized');
  }

  db.exec(`
    DROP TABLE IF EXISTS events;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS commits;
    DROP TABLE IF EXISTS goals;
    DROP TABLE IF EXISTS breaks;
  `);

  createSchema();
}

export default {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  resetDatabase,
};
