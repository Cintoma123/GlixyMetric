import { getDatabase } from '../db';

/**
 * Session Repository - Data access layer for sessions
 * 
 * RULE: Only store essential data (per vs-ex.md)
 * Fields: id, start_time, end_time, duration, project_path
 */

export interface Session {
  id?: number;
  start_time: number;      // Unix timestamp (seconds)
  end_time?: number;        // Unix timestamp (seconds)
  duration?: number;        // Seconds
  project_path: string;
}

/**
 * Insert a new session (when user starts coding)
 * @param session - Session data
 * @returns Session ID
 */
export function insertSession(session: Session): number {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO sessions (start_time, project_path)
    VALUES (?, ?)
  `);
  
  const result = stmt.run(session.start_time, session.project_path);
  return result.lastInsertRowid as number;
}

/**
 * Update session end time and duration (when session ends due to idle)
 * @param sessionId - Session ID to update
 * @param endTime - End time (Unix timestamp in seconds)
 * @param duration - Duration in seconds
 */
export function updateSessionEnd(sessionId: number, endTime: number, duration: number): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE sessions
    SET end_time = ?, duration = ?
    WHERE id = ?
  `);
  
  stmt.run(endTime, duration, sessionId);
}

/**
 * Get the current active session (no end_time)
 * @returns Current session or null
 */
export function getCurrentSession(): Session | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, start_time, end_time, duration, project_path
    FROM sessions
    WHERE end_time IS NULL
    ORDER BY start_time DESC
    LIMIT 1
  `);
  
  return stmt.get() as Session | null;
}

/**
 * Get all sessions for today
 * @returns Array of sessions
 */
export function getSessionsToday(): Session[] {
  const db = getDatabase();
  const today = Math.floor(Date.now() / 1000);
  const startOfDay = today - (today % 86400);
  
  const stmt = db.prepare(`
    SELECT id, start_time, end_time, duration, project_path
    FROM sessions
    WHERE start_time >= ?
    ORDER BY start_time DESC
  `);
  
  return stmt.all(startOfDay) as Session[];
}

/**
 * Get total coding time for today (sum of all session durations)
 * @returns Total time in seconds
 */
export function getTodayTotalTime(): number {
  const db = getDatabase();
  const today = Math.floor(Date.now() / 1000);
  const startOfDay = today - (today % 86400);
  
  const stmt = db.prepare(`
    SELECT COALESCE(SUM(duration), 0) as total
    FROM sessions
    WHERE start_time >= ? AND duration IS NOT NULL
  `);
  
  const result = stmt.get(startOfDay) as { total: number };
  return result.total;
}

/**
 * Get number of sessions for today
 * @returns Number of sessions
 */
export function getSessionCountToday(): number {
  const db = getDatabase();
  const today = Math.floor(Date.now() / 1000);
  const startOfDay = today - (today % 86400);
  
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM sessions
    WHERE start_time >= ?
  `);
  
  const result = stmt.get(startOfDay) as { count: number };
  return result.count;
}

/**
 * Get average session duration for today
 * @returns Average duration in seconds
 */
export function getAvgSessionDurationToday(): number {
  const db = getDatabase();
  const today = Math.floor(Date.now() / 1000);
  const startOfDay = today - (today % 86400);
  
  const stmt = db.prepare(`
    SELECT COALESCE(AVG(duration), 0) as avg
    FROM sessions
    WHERE start_time >= ? AND duration IS NOT NULL
  `);
  
  const result = stmt.get(startOfDay) as { avg: number };
  return result.avg;
}
