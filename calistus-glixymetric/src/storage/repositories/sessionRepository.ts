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
  paused_seconds?: number;  // Seconds accumulated while paused
  pause_started_at?: number; // Unix timestamp (seconds) when pause began (null when running)
}

/**
 * Calculate elapsed seconds for an ACTIVE session, excluding paused time.
 *
 * NOTE: This should only be used for sessions with end_time = NULL.
 */
export function getActiveSessionElapsedSeconds(session: Session, nowSeconds: number = Math.floor(Date.now() / 1000)): number {
  const pausedSeconds = session.paused_seconds ?? 0;
  const pauseStartedAt = session.pause_started_at ?? null;
  const additionalPaused = pauseStartedAt ? Math.max(0, nowSeconds - pauseStartedAt) : 0;
  return Math.max(0, nowSeconds - session.start_time - pausedSeconds - additionalPaused);
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
 * Mark an active session as paused (stores the pause start timestamp).
 * No-op if the session is already paused.
 */
export function pauseSession(sessionId: number, pauseTime: number): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE sessions
    SET pause_started_at = ?
    WHERE id = ? AND end_time IS NULL AND pause_started_at IS NULL
  `);
  stmt.run(pauseTime, sessionId);
}

/**
 * Resume a paused session by accumulating paused seconds and clearing pause_started_at.
 * No-op if the session is not currently paused.
 */
export function resumeSession(sessionId: number, resumeTime: number): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE sessions
    SET paused_seconds = paused_seconds + MAX(0, (? - pause_started_at)),
        pause_started_at = NULL
    WHERE id = ? AND end_time IS NULL AND pause_started_at IS NOT NULL
  `);
  stmt.run(resumeTime, sessionId);
}

/**
 * Get the current active session (no end_time) FROM TODAY ONLY
 * 
 * IMPORTANT: Only returns sessions started today (after midnight)
 * Sessions from before today are filtered out to prevent cross-day sessions
 * 
 * @returns Current session or null
 */
export function getCurrentSession(): Session | null {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  // Calculate midnight in LOCAL timezone
  const timezoneOffset = new Date().getTimezoneOffset() * 60; // Convert minutes to seconds
  const startOfDay = now - ((now + timezoneOffset) % 86400);
  
  const stmt = db.prepare(`
    SELECT id, start_time, end_time, duration, project_path, paused_seconds, pause_started_at
    FROM sessions
    WHERE end_time IS NULL AND start_time >= ?
    ORDER BY start_time DESC
    LIMIT 1
  `);
  
  return stmt.get(startOfDay) as Session | null;
}

/**
 * Get all sessions for today
 * @returns Array of sessions
 */
export function getSessionsToday(): Session[] {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  // Calculate midnight in LOCAL timezone
  const timezoneOffset = new Date().getTimezoneOffset() * 60; // Convert minutes to seconds
  const startOfDay = now - ((now + timezoneOffset) % 86400);
  
  const stmt = db.prepare(`
    SELECT id, start_time, end_time, duration, project_path, paused_seconds, pause_started_at
    FROM sessions
    WHERE start_time >= ?
    ORDER BY start_time DESC
  `);
  
  return stmt.all(startOfDay) as Session[];
}

/**
 * Get total coding time for today (sum of all session durations + current active session)
 * 
 * IMPORTANT FIX: Includes the currently active session's elapsed time
 * Active sessions have duration = NULL, so we calculate: (now - start_time)
 * 
 * FIX: Use Math.max(0, ...) to prevent negative values from clock skew or edge cases
 * 
 * @returns Total time in seconds
 */
export function getTodayTotalTime(): number {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  // Calculate midnight in LOCAL timezone
  const timezoneOffset = new Date().getTimezoneOffset() * 60; // Convert minutes to seconds
  const startOfDay = now - ((now + timezoneOffset) % 86400);
  
  // Query 1: Sum all completed sessions (with end_time)
  // FIX: Ensure completed sessions with negative duration are treated as 0
  const completedStmt = db.prepare(`
    SELECT COALESCE(SUM(MAX(duration, 0)), 0) as total
    FROM sessions
    WHERE start_time >= ? AND duration IS NOT NULL
  `);
  const completedResult = completedStmt.get(startOfDay) as { total: number };
  const completedTime = completedResult.total;
  
  // Query 2: Get current active session (no end_time) and calculate elapsed time
  const activeStmt = db.prepare(`
    SELECT start_time, paused_seconds, pause_started_at
    FROM sessions
    WHERE start_time >= ? AND end_time IS NULL
    ORDER BY start_time DESC
    LIMIT 1
  `);
  const activeSession = activeStmt.get(startOfDay) as { start_time: number; paused_seconds?: number; pause_started_at?: number } | undefined;
  const activeTime = activeSession
    ? Math.max(
        0,
        (now - activeSession.start_time)
          - (activeSession.paused_seconds ?? 0)
          - (activeSession.pause_started_at ? Math.max(0, now - activeSession.pause_started_at) : 0)
      )
    : 0;
  
  return completedTime + activeTime;
}

/**
 * Get number of sessions for today
 * @returns Number of sessions
 */
export function getSessionCountToday(): number {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  // Calculate midnight in LOCAL timezone
  const timezoneOffset = new Date().getTimezoneOffset() * 60; // Convert minutes to seconds
  const startOfDay = now - ((now + timezoneOffset) % 86400);
  
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
  const now = Math.floor(Date.now() / 1000);
  // Calculate midnight in LOCAL timezone
  const timezoneOffset = new Date().getTimezoneOffset() * 60; // Convert minutes to seconds
  const startOfDay = now - ((now + timezoneOffset) % 86400);
  
  const stmt = db.prepare(`
    SELECT COALESCE(AVG(duration), 0) as avg
    FROM sessions
    WHERE start_time >= ? AND duration IS NOT NULL
  `);
  
  const result = stmt.get(startOfDay) as { avg: number };
  return result.avg;
}
