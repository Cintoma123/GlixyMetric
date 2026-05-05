import { getDatabase } from '../db';

/**
 * Break Repository - Data access layer for breaks
 * 
 * RULE: Store only what you need (per vs-ex.md)
 * Fields: id, timestamp, duration
 * 
 * Purpose: Track when user took breaks and for how long
 * Used by breakReminder.ts to log breaks
 */

export interface Break {
  id?: number;
  timestamp: number;    // When break was taken (Unix seconds)
  duration: number;     // How long break lasted (seconds)
}

/**
 * Insert a new break record
 * 
 * Called when user dismisses or snoozes break reminder
 * 
 * @param breakRecord - Break data
 * @returns Break ID
 */
export function insertBreak(breakRecord: Break): number {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT INTO breaks (timestamp, duration)
    VALUES (?, ?)
  `);
  
  const result = stmt.run(breakRecord.timestamp, breakRecord.duration);
  return result.lastInsertRowid as number;
}

/**
 * Get all breaks taken today
 * 
 * @returns Array of break records
 */
export function getBreaksToday(): Break[] {
  const db = getDatabase();
  const today = Math.floor(Date.now() / 1000);
  const startOfDay = today - (today % 86400);
  
  const stmt = db.prepare(`
    SELECT id, timestamp, duration
    FROM breaks
    WHERE timestamp >= ?
    ORDER BY timestamp DESC
  `);
  
  return stmt.all(startOfDay) as Break[];
}

/**
 * Get total break time taken today in seconds
 * 
 * @returns Total break duration (seconds)
 */
export function getTotalBreakTimeToday(): number {
  const db = getDatabase();
  const today = Math.floor(Date.now() / 1000);
  const startOfDay = today - (today % 86400);
  
  const stmt = db.prepare(`
    SELECT COALESCE(SUM(duration), 0) as total
    FROM breaks
    WHERE timestamp >= ?
  `);
  
  const result = stmt.get(startOfDay) as { total: number };
  return result.total;
}

/**
 * Get count of breaks taken today
 * 
 * @returns Number of breaks
 */
export function getBreakCountToday(): number {
  const db = getDatabase();
  const today = Math.floor(Date.now() / 1000);
  const startOfDay = today - (today % 86400);
  
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM breaks
    WHERE timestamp >= ?
  `);
  
  const result = stmt.get(startOfDay) as { count: number };
  return result.count;
}

/**
 * Delete breaks older than N days (cleanup)
 * 
 * @param daysOld - Number of days
 * @returns Number of deleted records
 */
export function deleteBreaksOlderThan(daysOld: number): number {
  const db = getDatabase();
  const cutoffTime = Math.floor(Date.now() / 1000) - (daysOld * 86400);
  
  const stmt = db.prepare(`
    DELETE FROM breaks
    WHERE timestamp < ?
  `);
  
  const result = stmt.run(cutoffTime);
  return result.changes;
}
