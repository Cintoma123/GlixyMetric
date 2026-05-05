import * as vscode from 'vscode';
import {
  getTodayCodingTimeFormatted,
  getTodayCommits,
  getTodayGoalStatusEmoji,
  getTodayLanguagesFormatted,
  getTodayDailyTotalTimeFormatted,
  getCurrentSessionDurationFormatted,
  getCurrentLanguageFormatted,
} from '../services/statsService';
import { isTrackingCurrentlyPaused } from '../tracker/eventTracker';

/**
 * Status Bar - Shows quick stats in VS Code status bar
 * 
 * RULES (from vs-ex.md Section 8 - STRICTLY ENFORCED):
 * 
 * Display: $(clock) 2h 45m | $(flame) 3 commits
 * Status Indicator: $(pass) On track | $(warning) Almost | $(error) Behind
 * Click → opens sidebar
 * 
 * PURPOSE:
 * Provides always-visible quick stats without cluttering the UI
 * One click opens the full dashboard panel
 */

let statusBarItem: vscode.StatusBarItem | null = null;
let updateInterval: NodeJS.Timeout | null = null;

const UPDATE_INTERVAL = 1000; // Update every 1 second

/**
 * Create and initialize status bar item
 * 
 * Called from extension.ts on activation
 */
export function createStatusBar(): vscode.StatusBarItem {
  // Create status bar item positioned on the right side
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100 // Priority: higher = further right
  );

  // RULE: Set command to run when clicked
  // Command: open dashboard panel
  statusBarItem.command = 'calistus-glixymetric.openDashboard';

  // Show the status bar
  statusBarItem.show();

  // Update immediately
  updateStatusBarDisplay();

  // Start periodic updates (every 30 seconds)
  startPeriodicUpdate();

  console.log('Status Bar created');
  return statusBarItem;
}

/**
 * Update status bar display with current stats
 * 
 * RULE: Display format: $(clock) 2h 45m | $(flame) 3 commits
 * Plus: Status indicator ($(pass) $(warning) $(error)) from Section 7
 * Plus: Pause indicator ($(debug-pause) if tracking is paused)
 * Plus: Current language (what you're editing RIGHT NOW)
 */
function updateStatusBarDisplay(): void {
  if (!statusBarItem) {
    return;
  }

  try {
    // Get stats from statsService
    const currentSessionTime = getCurrentSessionDurationFormatted(); // Current session: "0m" when closed, then counts up
    const dailyTotal = getTodayDailyTotalTimeFormatted(); // Daily total (never pauses): "3h 20m"
    const commits = getTodayCommits(); // 3
    const goalStatus = getTodayGoalStatusEmoji(); // "$(pass)" | "$(warning)" | "$(error)" | ""
    const currentLanguage = getCurrentLanguageFormatted(); // "TypeScript" - CURRENT language, not all languages
    const allLanguagesToday = getTodayLanguagesFormatted(); // "TypeScript (50%), Python (50%)" - ALL languages for the day (for tooltip only)
    const isPaused = isTrackingCurrentlyPaused(); // true | false

    // RULE (from vs-ex.md): Display: $(clock) 2h 45m | $(flame) 3 commits
    // Enhanced to show BOTH current session time (resets on close/open) and daily total (persists)
    // Plus: Current language being edited
    let displayText = '';
    
    // Add extension name prefix so users know it's working
    displayText = '$(code) glixymetric';
    
    // Add pause indicator if tracking is paused
    if (isPaused) {
      displayText += ' $(debug-pause)';
    }
    
    // Show CURRENT session time (resets to 0m on new session) and daily total time (persists all day)
    displayText += ` | $(clock) ${currentSessionTime}`;
    displayText += ` | $(history) ${dailyTotal}`;
    displayText += ` | $(flame) ${commits}`;
    
    // Add CURRENT language being edited (real-time update)
    displayText += ` | 🔤 ${currentLanguage}`;

    // Add goal status if goals are set
    if (goalStatus) {
      displayText += ` ${goalStatus}`;
    }

    // Set the status bar text
    statusBarItem.text = displayText;

    // Set tooltip for additional context (includes all details and languages)
    // Tooltip shows ALL languages worked on today for reference
    const pauseInfo = isPaused ? ' (tracking paused)' : ' (tracking active)';
    statusBarItem.tooltip = `GlixyMetric Status:\n\nCurrent Language: ${currentLanguage}\n\nSession Time: ${currentSessionTime}\nDaily Total: ${dailyTotal}\nCommits: ${commits}\n\nAll Languages Today: ${allLanguagesToday}${pauseInfo}\n\nClick to open dashboard panel`;

  } catch (error) {
    console.error('Error updating status bar:', error);
    // Fallback display
    if (statusBarItem) {
      statusBarItem.text = '$(clock) GlixyMetric';
      statusBarItem.tooltip = 'GlixyMetric: Click to open dashboard panel';
    }
  }
}

/**
 * Start periodic updates of status bar
 * 
 * Calls updateStatusBarDisplay() every 30 seconds
 * Updates stats without requiring user action
 */
function startPeriodicUpdate(): void {
  if (updateInterval) {
    clearInterval(updateInterval);
  }

  updateInterval = setInterval(() => {
    updateStatusBarDisplay();
  }, UPDATE_INTERVAL);

  console.log('Status Bar periodic update started (30s interval)');
}

/**
 * Stop periodic updates
 * 
 * Called on extension deactivation
 */
function stopPeriodicUpdate(): void {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
}


/**
 * Force update status bar display
 * 
 * Called when significant events occur (new commit, session end, etc.)
 * Doesn't wait for periodic update
 */
export function forceUpdateStatusBar(): void {
  updateStatusBarDisplay();
}

/**
 * Dispose status bar and cleanup
 * 
 * Called from extension.ts on deactivation
 */
export function disposeStatusBar(): void {
  stopPeriodicUpdate();

  if (statusBarItem) {
    statusBarItem.dispose();
    statusBarItem = null;
  }

  console.log('Status Bar disposed');
}
