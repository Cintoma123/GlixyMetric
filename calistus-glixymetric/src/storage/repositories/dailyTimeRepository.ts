import { getDatabase } from '../db.js';

export interface DailyTotal {
  id: number;
  date: string; // YYYY-MM-DD format
  total_seconds: number;
  created_at: string;
}

/**
 * Insert a new daily total record
 */
export function insertDailyTotal(data: {
  date: string;
  total_seconds: number;
}): number {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT INTO daily_totals (date, total_seconds)
    VALUES (?, ?)
  `);
  
  const result = stmt.run(data.date, data.total_seconds);
  return result.lastID as number;
}

/**
 * Update daily total for a specific day
 */
export function updateDailyTotal(id: number, totalSeconds: number): void {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    UPDATE daily_totals
    SET total_seconds = ?
    WHERE id = ?
  `);
  
  stmt.run(totalSeconds, id);
}

/**
 * Get today's daily total
 */
export function getDailyTotalToday(): DailyTotal | null {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  const stmt = db.prepare(`
    SELECT * FROM daily_totals
    WHERE date = ?
    LIMIT 1
  `);
  
  const result = stmt.get(today) as DailyTotal | undefined;
  return result || null;
}

/**
 * Get daily total for a specific date
 */
export function getDailyTotalByDate(date: string): DailyTotal | null {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT * FROM daily_totals
    WHERE date = ?
    LIMIT 1
  `);
  
  const result = stmt.get(date) as DailyTotal | undefined;
  return result || null;
}

/**
 * Get all daily totals (for dashboard/stats)
 */
export function getAllDailyTotals(): DailyTotal[] {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT * FROM daily_totals
    ORDER BY date DESC
  `);
  
  const results = stmt.all() as DailyTotal[];
  return results;
}

/**
 * Delete daily total by date (for cleanup)
 */
export function deleteDailyTotalByDate(date: string): void {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    DELETE FROM daily_totals
    WHERE date = ?
  `);
  
  stmt.run(date);
}

/**
 * Reset daily total by manually deleting and recreating
 * Used when user manually resets the tracker
 */
export function resetDailyTotalForMidnight(): void {
  const today = new Date().toISOString().split('T')[0];
  deleteDailyTotalByDate(today);
  
  // Create new one with 0 seconds
  insertDailyTotal({
    date: today,
    total_seconds: 0,
  });
}
