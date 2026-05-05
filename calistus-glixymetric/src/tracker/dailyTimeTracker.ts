import * as vscode from 'vscode';
import {
  insertDailyTotal,
  updateDailyTotal,
  getDailyTotalToday,
  resetDailyTotalForMidnight,
} from '../storage/repositories/dailyTimeRepository.js';

/**
 * Daily Time Tracker - Tracks TOTAL coding time for the day
 * 
 * KEY DIFFERENCES from Session Manager:
 * - NEVER pauses (even on workspace switch)
 * - ALWAYS accumulating
 * - Only resets at 12:00 AM midnight
 * - Persists across all VS Code closes/opens within the same day
 * 
 * TRIGGERS (all 3 start the daily timer):
 * 1. Window focus change
 * 2. Text document edit
 * 3. File focus change
 */

let dailyTotalId: number | null = null;
let lastActivityTime: number = 0;
let isDailyTimerActive: boolean = false;
let dailyTimerInterval: NodeJS.Timeout | null = null;
let dailyTimerStartTime: number = 0; // Track when the current timer session started

/**
 * Initialize daily time tracker on extension startup
 * Check if today's daily total exists, if not create it
 */
export function initializeDailyTimeTracker(): void {
  try {
    const existingTotal = getDailyTotalToday();
    
    if (existingTotal) {
      dailyTotalId = existingTotal.id;
      isDailyTimerActive = true;
      lastActivityTime = Math.floor(Date.now() / 1000);
      dailyTimerStartTime = Date.now();
      console.log('Daily time tracker initialized with existing total:', dailyTotalId);
    } else {
      // Create new daily total for today
      const now = Math.floor(Date.now() / 1000);
      const newId = insertDailyTotal({
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        total_seconds: 0,
      });
      if (newId !== null && newId !== undefined) {
        dailyTotalId = newId;
        isDailyTimerActive = true;
        lastActivityTime = now;
        dailyTimerStartTime = Date.now();
        console.log('New daily time tracker created:', dailyTotalId);
      } else {
        console.error('Failed to create daily total - insert returned null');
      }
    }

    // Start background timer that accumulates time every second
    startDailyAccumulationTimer();
    
    // Schedule midnight reset check
    scheduleMidnightReset();
  } catch (error) {
    console.error('Failed to initialize daily time tracker:', error);
  }
}

/**
 * Called when ANY activity is detected (edit, focus, etc.)
 * Updates lastActivityTime to prevent idle timeout
 * Also ensures the daily timer is running
 */
export function recordDailyActivity(): void {
  // Always ensure we have a valid dailyTotalId
  if (dailyTotalId === null) {
    // Try to get or create today's daily total
    const existingTotal = getDailyTotalToday();
    if (existingTotal) {
      dailyTotalId = existingTotal.id;
      console.log('Daily time tracker: recovered existing total on activity:', dailyTotalId);
    } else {
      // Create new daily total for today
      const newId = insertDailyTotal({
        date: new Date().toISOString().split('T')[0],
        total_seconds: 0,
      });
      if (newId !== null && newId !== undefined) {
        dailyTotalId = newId;
        console.log('Daily time tracker: created new total on activity:', dailyTotalId);
      } else {
        console.error('Daily time tracker: failed to create daily total on activity');
        return;
      }
    }
  }

  if (!isDailyTimerActive) {
    isDailyTimerActive = true;
    startDailyAccumulationTimer();
  }
  
  lastActivityTime = Math.floor(Date.now() / 1000);
}

/**
 * Start the background timer that accumulates 1 second every second
 * This timer NEVER stops during the day, it keeps running
 */
function startDailyAccumulationTimer(): void {
  if (dailyTimerInterval) {
    clearInterval(dailyTimerInterval);
  }

  dailyTimerStartTime = Date.now();
  dailyTimerInterval = setInterval(() => {
    if (dailyTotalId !== null) {
      try {
        const current = getDailyTotalToday();
        if (current && current.id === dailyTotalId) {
          // Add 1 second to total
          updateDailyTotal(dailyTotalId, current.total_seconds + 1);
        }
      } catch (error) {
        console.error('Failed to update daily total:', error);
      }
    }
  }, 1000); // Every 1 second
}

/**
 * Get current daily total time in seconds
 */
export function getDailyTotalTime(): number {
  try {
    const total = getDailyTotalToday();
    return total ? total.total_seconds : 0;
  } catch (error) {
    console.error('Failed to get daily total time:', error);
    return 0;
  }
}

/**
 * Get daily total time formatted
 * Example: 9900 seconds → "2h 45m"
 */
export function getDailyTotalTimeFormatted(): string {
  const seconds = getDailyTotalTime();
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Schedule midnight reset
 * Check every minute if it's past midnight (12:00 AM)
 */
function scheduleMidnightReset(): void {
  setInterval(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Check if we need to reset (new day)
    try {
      const current = getDailyTotalToday();
      if (!current || current.date !== today) {
        // It's a new day, reset
        resetDailyTimeForNewDay();
      }
    } catch (error) {
      console.error('Failed to check midnight reset:', error);
    }
  }, 60 * 1000); // Check every minute
}

/**
 * Reset daily time tracker for new day
 * Called automatically at midnight
 */
function resetDailyTimeForNewDay(): void {
  try {
    console.log('Resetting daily time tracker for new day');
    
    // Stop current timer
    if (dailyTimerInterval) {
      clearInterval(dailyTimerInterval);
      dailyTimerInterval = null;
    }

    // Create new daily total for today
    const now = Math.floor(Date.now() / 1000);
    const newId = insertDailyTotal({
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      total_seconds: 0,
    });
    
    if (newId !== null && newId !== undefined) {
      dailyTotalId = newId;
      isDailyTimerActive = true;
      lastActivityTime = now;
      dailyTimerStartTime = Date.now();

      // Restart accumulation timer
      startDailyAccumulationTimer();
    }
  } catch (error) {
    console.error('Failed to reset daily time tracker:', error);
  }
}

/**
 * Manual reset (for testing or user-triggered reset)
 */
export function manualResetDailyTime(): void {
  resetDailyTimeForNewDay();
  vscode.window.showInformationMessage('Daily time tracker reset');
}

/**
 * Cleanup when extension deactivates
 */
export function disposeDailyTimeTracker(): void {
  if (dailyTimerInterval) {
    clearInterval(dailyTimerInterval);
    dailyTimerInterval = null;
  }
}