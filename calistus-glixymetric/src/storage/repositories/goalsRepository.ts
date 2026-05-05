import { getDatabase } from '../db';

/**
 * Goals Repository - Data access layer for daily goals
 * 
 * RULE: Store only what you need (per vs-ex.md)
 * Fields: id, date, daily_hours, daily_commits
 * 
 * One goal per day - represents user's target for that day
 */

export interface Goal {
  id?: number;
  date: number;           // Unix timestamp (start of day)
  daily_hours: number;    // Target hours to code
  daily_commits: number;  // Target commits to make
}

/**
 * Insert or update goal for a specific date
 * 
 * If goal exists for date: update it
 * If goal doesn't exist: insert it
 * 
 * @param goal - Goal data
 * @returns Goal ID
 */
export function upsertGoalForDate(goal: Goal): number {
  const db = getDatabase();
  
  try {
    const stmt = db.prepare(`
      INSERT INTO goals (date, daily_hours, daily_commits)
      VALUES (?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        daily_hours = excluded.daily_hours,
        daily_commits = excluded.daily_commits
    `);
    
    const result = stmt.run(goal.date, goal.daily_hours, goal.daily_commits);
    return result.lastInsertRowid as number;
  } catch (error) {
    throw new Error(`Failed to upsert goal: ${error}`);
  }
}

/**
 * Get goal for today
 * 
 * @returns Goal object or null
 */
export function getTodayGoal(): Goal | null {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  // Calculate midnight in LOCAL timezone
  const timezoneOffset = new Date().getTimezoneOffset() * 60; // Convert minutes to seconds
  const startOfDay = now - ((now + timezoneOffset) % 86400); // Midnight in LOCAL timezone
  
  const stmt = db.prepare(`
    SELECT id, date, daily_hours, daily_commits
    FROM goals
    WHERE date = ?
  `);
  
  return stmt.get(startOfDay) as Goal | null;
}

/**
 * Get goal for a specific date
 * 
 * @param date - Unix timestamp (start of day)
 * @returns Goal object or null
 */
export function getGoalByDate(date: number): Goal | null {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT id, date, daily_hours, daily_commits
    FROM goals
    WHERE date = ?
  `);
  
  return stmt.get(date) as Goal | null;
}

/**
 * Get goals for a date range
 * 
 * @param startDate - Start date (Unix timestamp)
 * @param endDate - End date (Unix timestamp)
 * @returns Array of goal objects
 */
export function getGoalsByDateRange(startDate: number, endDate: number): Goal[] {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT id, date, daily_hours, daily_commits
    FROM goals
    WHERE date >= ? AND date <= ?
    ORDER BY date DESC
  `);
  
  return stmt.all(startDate, endDate) as Goal[];
}

/**
 * Delete goal for a specific date
 * 
 * @param date - Unix timestamp (start of day)
 */
export function deleteGoalByDate(date: number): void {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    DELETE FROM goals
    WHERE date = ?
  `);
  
  stmt.run(date);
}

/**
 * Check if goal exists for today
 * 
 * @returns true if goal exists
 */
export function hasTodayGoal(): boolean {
  const goal = getTodayGoal();
  return goal !== null;
}

/**
 * Get last set goal (most recent)
 * 
 * @returns Most recent goal or null
 */
export function getLastGoal(): Goal | null {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT id, date, daily_hours, daily_commits
    FROM goals
    ORDER BY date DESC
    LIMIT 1
  `);
  
  return stmt.get() as Goal | null;
}
