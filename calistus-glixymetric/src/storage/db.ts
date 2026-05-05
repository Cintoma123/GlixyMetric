import initSqlJs from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';

interface Database {
  run: (sql: string, ...params: any[]) => any;
  exec: (sql: string) => void;
  prepare: (sql: string) => any;
  close: () => void;
}

let db: Database | null = null;
let sqlJs: any = null;
let dbPath: string = '';
let sqliteDb: any = null;

/**
 * Initialize SQLite database with schema
 * @param storagePath - Path to store the database file
 * @returns Database instance reference
 */
export async function initializeDatabase(storagePath: string): Promise<Database> {
  if (db) {
    return db;
  }

  // Ensure storage directory exists
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }

  dbPath = path.join(storagePath, 'glixymetric.db');
  
  // Initialize sql.js and tell it exactly where the WASM binary lives.
  const wasmPath = path.join(__dirname, 'sql-wasm.wasm');
  sqlJs = await initSqlJs({
    locateFile: () => wasmPath
  });
  
  // Load or create database
  let fileBuffer: Buffer | undefined;
  if (fs.existsSync(dbPath)) {
    fileBuffer = fs.readFileSync(dbPath);
  }
  
  const SQL = new sqlJs.Database(fileBuffer);
  sqliteDb = SQL;

  // Create wrapper with persistence
  db = {
    run: (sql: string, ...params: any[]) => {
      SQL.run(sql, params);
      saveDatabase();
      return { changes: SQL.getRowsModified() };
    },
    exec: (sql: string) => {
      SQL.exec(sql);
      saveDatabase();
    },
    prepare: (sql: string) => {
      const stmt = SQL.prepare(sql);
      const stmtWrapper = {
        run: function(...params: any[]) {
          stmt.bind(params);
          stmt.step();
          const lastId = SQL.exec("SELECT last_insert_rowid() as id")[0]?.values[0]?.[0] || 0;
          stmt.free();
          saveDatabase();
          return { lastInsertRowid: lastId, changes: SQL.getRowsModified() };
        },
        get: function(...params: any[]) {
          stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        },
        all: function(...params: any[]) {
          stmt.bind(params);
          const result = [];
          while (stmt.step()) {
            result.push(stmt.getAsObject());
          }
          stmt.free();
          return result;
        },
        bind: (...params: any[]) => { stmt.bind(params); return stmtWrapper; },
        step: () => stmt.step(),
        getAsObject: () => stmt.getAsObject(),
        free: () => stmt.free(),
      };
      return stmtWrapper;
    },
    close: () => {
      if (SQL) {
        saveDatabaseSync();
        SQL.close();
        db = null;
      }
    }
  };

  createSchema();

  return db;
}

function saveDatabase(): void {
  if (sqliteDb && dbPath) {
    try {
      const data = sqliteDb.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    } catch (err) {
      console.error('Failed to save database:', err);
    }
  }
}

function saveDatabaseSync(): void {
  saveDatabase();
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
      paused_seconds INTEGER NOT NULL DEFAULT 0,
      pause_started_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  // Lightweight migration for older DBs that may not have pause columns.
  // SQLite doesn't support `ADD COLUMN IF NOT EXISTS`, so we attempt and ignore failures.
  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN paused_seconds INTEGER NOT NULL DEFAULT 0;`);
  } catch {
    // Column likely already exists
  }
  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN pause_started_at INTEGER;`);
  } catch {
    // Column likely already exists
  }

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

  // Daily Totals Table - Total coding time per day (NEVER pauses, resets at midnight)
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_totals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      total_seconds INTEGER NOT NULL DEFAULT 0,
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

  // Daily Totals indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_daily_totals_date ON daily_totals(date);
  `);
}

/**
 * Get database instance
 */
export function getDatabase(): Database {
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
    sqliteDb = null;
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
