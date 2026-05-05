import { Event } from '../../types';
import { getDatabase } from '../db';

/**
 * EVENT REPOSITORY
 * 
 * Purpose: Data Access Layer for events
 * All event-related database queries go through this module
 * 
 * Benefits:
 * - Centralized database queries
 * - Easy to modify queries without touching eventTracker.ts
 * - Reusable across sessionManager, statsService, breakReminder
 * - Testable in isolation
 */

/**
 * STEP 1: INSERT EVENT
 * 
 * Purpose: Save a new event to database
 * Used by: eventTracker.ts (tracks every edit/save/focus)
 * 
 * SQL: INSERT INTO events (type, timestamp, file, language) VALUES (?, ?, ?, ?)
 * Parameters:
 * - ?: type (edit | save | focus)
 * - ?: timestamp (Unix seconds)
 * - ?: file (file path)
 * - ?: language (language ID)
 * 
 * Returns: Event ID (for reference if needed)
 */
export function insertEvent(event: Event): number {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO events (type, timestamp, file, language)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(event.type, event.timestamp, event.file, event.language);
    return result.lastInsertRowid as number;
  } catch (error) {
    console.error('Repository: Failed to insert event:', error);
    throw error;
  }
}

/**
 * STEP 2: GET EVENT BY ID
 * 
 * Purpose: Fetch a single event by ID
 * Used by: Debugging, specific queries
 * 
 * SQL: SELECT * FROM events WHERE id = ? LIMIT 1
 * Parameter: id (event primary key)
 * 
 * Returns: Event object or undefined
 */
export function getEventById(id: number): Event | undefined {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT id, type, timestamp, file, language
      FROM events
      WHERE id = ?
      LIMIT 1
    `);

    return stmt.get(id) as Event | undefined;
  } catch (error) {
    console.error('Repository: Failed to get event by ID:', error);
    return undefined;
  }
}

/**
 * STEP 3: GET ALL EVENTS TODAY
 * 
 * Purpose: Fetch all coding events from start of day (midnight UTC)
 * Used by: statsService (daily stats), UI display
 * 
 * SQL: SELECT * FROM events WHERE timestamp >= startOfDay ORDER BY timestamp DESC
 * 
 * How it works:
 * 1. Get current timestamp (seconds)
 * 2. Calculate start of TODAY (midnight)
 *    - now % 86400 = seconds since midnight
 *    - 86400 = seconds in a day
 *    - Subtract to get midnight
 * 3. Query all events since midnight
 * 4. Sort newest first
 * 
 * Returns: Array of Event objects
 */
export function getEventsToday(): Event[] {
  try {
    const db = getDatabase();
    const now = Math.floor(Date.now() / 1000); // Current timestamp
    // Calculate midnight in LOCAL timezone
    const timezoneOffset = new Date().getTimezoneOffset() * 60; // Convert minutes to seconds
    const startOfDay = now - ((now + timezoneOffset) % 86400); // Midnight in LOCAL timezone

    const stmt = db.prepare(`
      SELECT id, type, timestamp, file, language
      FROM events
      WHERE timestamp >= ?
      ORDER BY timestamp DESC
    `);

    return stmt.all(startOfDay) as Event[];
  } catch (error) {
    console.error('Repository: Failed to get events today:', error);
    return [];
  }
}

/**
 * STEP 4: GET EVENTS BY LANGUAGE TODAY
 * 
 * Purpose: Filter today's events by programming language
 * Used by: Stats breakdown (% time in Python vs JavaScript, etc.)
 * 
 * SQL: SELECT * FROM events WHERE timestamp >= startOfDay AND language = ? 
 * Parameters:
 * - startOfDay: timestamp
 * - language: language ID (e.g., 'typescript', 'python')
 * 
 * Returns: Array of Event objects filtered by language
 */
export function getEventsByLanguageToday(language: string): Event[] {
  try {
    const db = getDatabase();
    const now = Math.floor(Date.now() / 1000);
    // Calculate midnight in LOCAL timezone
    const timezoneOffset = new Date().getTimezoneOffset() * 60; // Convert minutes to seconds
    const startOfDay = now - ((now + timezoneOffset) % 86400); // Midnight in LOCAL timezone

    const stmt = db.prepare(`
      SELECT id, type, timestamp, file, language
      FROM events
      WHERE timestamp >= ? AND language = ?
      ORDER BY timestamp DESC
    `);

    return stmt.all(startOfDay, language) as Event[];
  } catch (error) {
    console.error('Repository: Failed to get events by language:', error);
    return [];
  }
}

/**
 * STEP 5: GET EVENTS BY FILE TODAY
 * 
 * Purpose: Find all events for a specific file
 * Used by: Per-file stats (how much time in each file?)
 * 
 * SQL: SELECT * FROM events WHERE timestamp >= startOfDay AND file = ?
 * Parameter: file (file path)
 * 
 * Returns: Array of Event objects for that file
 */
export function getEventsByFileToday(filePath: string): Event[] {
  try {
    const db = getDatabase();
    const now = Math.floor(Date.now() / 1000);
    // Calculate midnight in LOCAL timezone
    const timezoneOffset = new Date().getTimezoneOffset() * 60; // Convert minutes to seconds
    const startOfDay = now - ((now + timezoneOffset) % 86400); // Midnight in LOCAL timezone

    const stmt = db.prepare(`
      SELECT id, type, timestamp, file, language
      FROM events
      WHERE timestamp >= ? AND file = ?
      ORDER BY timestamp DESC
    `);

    return stmt.all(startOfDay, filePath) as Event[];
  } catch (error) {
    console.error('Repository: Failed to get events by file:', error);
    return [];
  }
}

/**
 * STEP 6: GET EVENTS IN TIME RANGE
 * 
 * Purpose: Fetch events between two timestamps (flexible query)
 * Used by: Weekly/monthly stats, custom time ranges
 * 
 * SQL: SELECT * FROM events WHERE timestamp BETWEEN ? AND ?
 * Parameters:
 * - startTime: Unix timestamp (seconds)
 * - endTime: Unix timestamp (seconds)
 * 
 * Returns: Array of Event objects in range
 */
export function getEventsInRange(startTime: number, endTime: number): Event[] {
  try {
    const db = getDatabase();

    const stmt = db.prepare(`
      SELECT id, type, timestamp, file, language
      FROM events
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp ASC
    `);

    return stmt.all(startTime, endTime) as Event[];
  } catch (error) {
    console.error('Repository: Failed to get events in range:', error);
    return [];
  }
}

/**
 * STEP 7: COUNT EVENTS IN TIME RANGE
 * 
 * Purpose: Get total event count (for activity density)
 * Used by: Check if user is active, productivity score
 * 
 * SQL: SELECT COUNT(*) as count FROM events WHERE timestamp BETWEEN ? AND ?
 * 
 * Returns: Number of events
 */
export function countEventsInRange(startTime: number, endTime: number): number {
  try {
    const db = getDatabase();

    const stmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM events
      WHERE timestamp >= ? AND timestamp <= ?
    `);

    const result = stmt.get(startTime, endTime) as { count: number };
    return result.count;
  } catch (error) {
    console.error('Repository: Failed to count events:', error);
    return 0;
  }
}

/**
 * STEP 8: GET LAST EVENT TIMESTAMP
 * 
 * Purpose: Find the most recent event (for IDLE DETECTION)
 * Used by: breakReminder.ts (is user idle?), sessionManager.ts
 * 
 * SQL: SELECT MAX(timestamp) FROM events
 * 
 * How it works:
 * 1. Query database for maximum timestamp
 * 2. If no events exist, return 0
 * 3. Compare to current time to see if idle
 *    Example: if last event 5+ minutes ago = idle
 * 
 * Returns: Unix timestamp (seconds) or 0 if no events
 */
export function getLastEventTimestamp(): number {
  try {
    const db = getDatabase();

    const stmt = db.prepare(`
      SELECT MAX(timestamp) as last_timestamp
      FROM events
    `);

    const result = stmt.get() as { last_timestamp: number | null };
    return result.last_timestamp || 0;
  } catch (error) {
    console.error('Repository: Failed to get last event timestamp:', error);
    return 0;
  }
}

/**
 * STEP 9: GET UNIQUE LANGUAGES TODAY
 * 
 * Purpose: Which languages did user code in today?
 * Used by: UI display, language breakdown stats
 * 
 * SQL: SELECT DISTINCT language FROM events WHERE timestamp >= startOfDay
 * 
 * Returns: Array of language IDs
 */
export function getUniqueLanguagesToday(): string[] {
  try {
    const db = getDatabase();
    const now = Math.floor(Date.now() / 1000);
    const startOfDay = now - ((now % 86400) + new Date().getTimezoneOffset() * 60);

    const stmt = db.prepare(`
      SELECT DISTINCT language
      FROM events
      WHERE timestamp >= ?
      ORDER BY language
    `);

    const results = stmt.all(startOfDay) as Array<{ language: string }>;
    return results.map(r => r.language);
  } catch (error) {
    console.error('Repository: Failed to get unique languages:', error);
    return [];
  }
}

/**
 * STEP 10: DELETE EVENTS BEFORE TIMESTAMP (CLEANUP)
 * 
 * Purpose: Remove old data to keep database small
 * Used by: Maintenance (e.g., delete events older than 30 days)
 * 
 * SQL: DELETE FROM events WHERE timestamp < ?
 * Parameter: timestamp (cutoff point)
 * 
 * Returns: Number of events deleted
 * 
 * Example usage:
 * - Delete events older than 30 days: deleteEventsBefore(now - 30*86400)
 */
export function deleteEventsBefore(timestamp: number): number {
  try {
    const db = getDatabase();

    const stmt = db.prepare(`
      DELETE FROM events
      WHERE timestamp < ?
    `);

    const result = stmt.run(timestamp);
    return result.changes;
  } catch (error) {
    console.error('Repository: Failed to delete old events:', error);
    return 0;
  }
}

/**
 * STEP 11: CHECK IS USER IDLE
 * 
 * Purpose: Determine if user should be considered idle
 * Used by: sessionManager (end session), breakReminder (don't suggest break if idle)
 * 
 * How it works:
 * 1. Get last event timestamp
 * 2. Calculate seconds since last event
 * 3. Compare to idle threshold (default 300 seconds = 5 minutes)
 * 4. Return true if > threshold
 * 
 * Returns: boolean (true = idle, false = active)
 */
export function isUserIdle(thresholdSeconds: number = 300): boolean {
  try {
    const lastEventTime = getLastEventTimestamp();
    const now = Math.floor(Date.now() / 1000);
    const secondsSinceLastEvent = now - lastEventTime;

    return secondsSinceLastEvent > thresholdSeconds;
  } catch (error) {
    console.error('Repository: Failed to check idle status:', error);
    return true; // Assume idle on error (safe default)
  }
}

/**
 * STEP 12: GET EVENT STATS SUMMARY
 * 
 * Purpose: Get quick summary of today's activity
 * Used by: UI dashboard, status bar
 * 
 * Returns: Object with counts
 * {
 *   totalEvents: 150,
 *   editEvents: 120,
 *   saveEvents: 20,
 *   focusEvents: 10,
 *   uniqueLanguages: 3,
 *   uniqueFiles: 8
 * }
 */
export function getEventStats(): {
  totalEvents: number;
  editEvents: number;
  saveEvents: number;
  focusEvents: number;
  uniqueLanguages: number;
  uniqueFiles: number;
} {
  try {
    const db = getDatabase();
    const now = Math.floor(Date.now() / 1000);
    const startOfDay = now - ((now % 86400) + new Date().getTimezoneOffset() * 60);

    const stmt = db.prepare(`
      SELECT
        COUNT(*) as totalEvents,
        SUM(CASE WHEN type = 'edit' THEN 1 ELSE 0 END) as editEvents,
        SUM(CASE WHEN type = 'save' THEN 1 ELSE 0 END) as saveEvents,
        SUM(CASE WHEN type = 'focus' THEN 1 ELSE 0 END) as focusEvents,
        COUNT(DISTINCT language) as uniqueLanguages,
        COUNT(DISTINCT file) as uniqueFiles
      FROM events
      WHERE timestamp >= ?
    `);

    const result = stmt.get(startOfDay) as any;
    return {
      totalEvents: result.totalEvents || 0,
      editEvents: result.editEvents || 0,
      saveEvents: result.saveEvents || 0,
      focusEvents: result.focusEvents || 0,
      uniqueLanguages: result.uniqueLanguages || 0,
      uniqueFiles: result.uniqueFiles || 0,
    };
  } catch (error) {
    console.error('Repository: Failed to get event stats:', error);
    return {
      totalEvents: 0,
      editEvents: 0,
      saveEvents: 0,
      focusEvents: 0,
      uniqueLanguages: 0,
      uniqueFiles: 0,
    };
  }
}

export default {
  insertEvent,
  getEventById,
  getEventsToday,
  getEventsByLanguageToday,
  getEventsByFileToday,
  getEventsInRange,
  countEventsInRange,
  getLastEventTimestamp,
  getUniqueLanguagesToday,
  deleteEventsBefore,
  isUserIdle,
  getEventStats,
};
