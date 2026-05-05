import { getDatabase } from '../db';

/**
 * Commit Repository - Data access layer for commits
 * 
 * RULE: Only store essential data (per vs-ex.md)
 * Fields: id, hash, message, timestamp, repo_path
 * 
 * DO NOT build:
 *   - commit/session correlation ❌
 *   - line-to-commit ratio ❌
 *   - co-author detection ❌
 */

export interface Commit {
  id?: number;
  hash: string;           // Git commit hash (unique)
  message: string;        // Commit message
  timestamp: number;      // Unix timestamp (seconds)
  repo_path: string;      // Repository path
}

/**
 * Insert a new commit (if not already exists)
 * 
 * RULE: Use UNIQUE constraint on hash to prevent duplicates
 * 
 * @param commit - Commit data
 * @returns Commit ID or existing commit ID
 */
export function insertCommit(commit: Commit): number | null {
  const db = getDatabase();
  
  try {
    const stmt = db.prepare(`
      INSERT INTO commits (hash, message, timestamp, repo_path)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(commit.hash, commit.message, commit.timestamp, commit.repo_path);
    return result.lastInsertRowid as number;
  } catch (error: any) {
    // UNIQUE constraint violation - commit already exists
    if (error.message.includes('UNIQUE constraint failed')) {
      // Get existing commit ID
      const existing = getCommitByHash(commit.hash);
      return existing?.id || null;
    }
    throw error;
  }
}

/**
 * Get commit by hash
 * @param hash - Git commit hash
 * @returns Commit record or null
 */
export function getCommitByHash(hash: string): Commit | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, hash, message, timestamp, repo_path
    FROM commits
    WHERE hash = ?
  `);
  
  return stmt.get(hash) as Commit | null;
}

/**
 * Get commits for today
 * @returns Array of commits from today onwards
 */
export function getCommitsToday(): Commit[] {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  // Calculate midnight in LOCAL timezone (to match git log --since=midnight)
  const timezoneOffset = new Date().getTimezoneOffset() * 60; // Convert minutes to seconds
  const startOfDay = now - ((now + timezoneOffset) % 86400);
  
  const stmt = db.prepare(`
    SELECT id, hash, message, timestamp, repo_path
    FROM commits
    WHERE timestamp >= ?
    ORDER BY timestamp DESC
  `);
  
  return stmt.all(startOfDay) as Commit[];
}

/**
 * Get commit count for today
 * @returns Number of commits today
 */
export function getCommitCountToday(): number {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  // Calculate midnight in LOCAL timezone (to match git log --since=midnight)
  const timezoneOffset = new Date().getTimezoneOffset() * 60; // Convert minutes to seconds
  const startOfDay = now - ((now + timezoneOffset) % 86400);
  
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM commits
    WHERE timestamp >= ?
  `);
  
  const result = stmt.get(startOfDay) as { count: number };
  return result.count;
}

/**
 * Get commits by repository for today
 * @param repoPath - Repository path
 * @returns Array of commits
 */
export function getCommitsByRepoToday(repoPath: string): Commit[] {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  // Calculate midnight in LOCAL timezone (to match git log --since=midnight)
  const timezoneOffset = new Date().getTimezoneOffset() * 60; // Convert minutes to seconds
  const startOfDay = now - ((now + timezoneOffset) % 86400);
  
  const stmt = db.prepare(`
    SELECT id, hash, message, timestamp, repo_path
    FROM commits
    WHERE timestamp >= ? AND repo_path = ?
    ORDER BY timestamp DESC
  `);
  
  return stmt.all(startOfDay, repoPath) as Commit[];
}

/**
 * Get commit count by repository for today
 * @param repoPath - Repository path
 * @returns Number of commits
 */
export function getCommitCountByRepoToday(repoPath: string): number {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  // Calculate midnight in LOCAL timezone (to match git log --since=midnight)
  const timezoneOffset = new Date().getTimezoneOffset() * 60; // Convert minutes to seconds
  const startOfDay = now - ((now + timezoneOffset) % 86400);
  
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM commits
    WHERE timestamp >= ? AND repo_path = ?
  `);
  
  const result = stmt.get(startOfDay, repoPath) as { count: number };
  return result.count;
}

/**
 * Delete commits older than N days (for cleanup)
 * @param daysOld - Number of days
 */
export function deleteCommitsOlderThan(daysOld: number): number {
  const db = getDatabase();
  const cutoffTime = Math.floor(Date.now() / 1000) - (daysOld * 86400);
  
  const stmt = db.prepare(`
    DELETE FROM commits
    WHERE timestamp < ?
  `);
  
  const result = stmt.run(cutoffTime);
  return result.changes;
}
