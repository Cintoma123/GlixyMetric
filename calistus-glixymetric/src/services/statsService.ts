/**
 * Stats Service - Aggregates data from all trackers
 * 
 * CORE RULE (from vs-ex.md Section 5):
 * "Just simple functions... computed on demand"
 * 
 * Functions:
 *   - getTodayCodingTime()
 *   - getTodaySessions()
 *   - getTodayCommits()
 *   - getCurrentSession()
 *   - Productivity Score (active_time / total_time)
 * 
 * DO NOT build:
 *   - hourly_stats ❌
 *   - monthly_metrics ❌
 *   - language_stats ❌
 * 
 * PURPOSE:
 * Service layer that wraps repository functions and provides clean API
 * for UI components, Status Bar, and other features to display data.
 */

import {
  getTodayTotalTime,
  getSessionCountToday,
  getAvgSessionDurationToday,
  getCurrentSession,
  getActiveSessionElapsedSeconds,
} from '../storage/repositories/sessionRepository';

import {
  getCommitCountToday,
  getCommitsToday,
} from '../storage/repositories/commitRepository';

import {
  getTodayGoal,
} from '../storage/repositories/goalsRepository';

import {
  getEventsToday,
} from '../storage/repositories/eventRepository';

import {
  getDailyTotalTime,
  getDailyTotalTimeFormatted,
} from '../tracker/dailyTimeTracker.js';

import {
  getCurrentLanguage,
} from '../tracker/eventTracker.js';

// ============================================================================
// SESSION & TIME DATA
// ============================================================================

/**
 * Get total coding time for today in seconds
 * 
 * RULE: Computed on demand from sessions table
 * Sum all session durations where start_time >= midnight
 * 
 * @returns Total seconds coded today
 */
export function getTodayCodingTime(): number {
  try {
    return getTodayTotalTime();
  } catch (error) {
    console.error('Failed to get today coding time:', error);
    return 0;
  }
}

/**
 * Get total coding time for today formatted as human-readable string
 * 
 * Converts seconds to "Xh Ym" format
 * Example: 9900 seconds → "2h 45m"
 * 
 * @returns Formatted string (e.g., "2h 45m")
 */
export function getTodayCodingTimeFormatted(): string {
  const seconds = getTodayCodingTime();
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// ============================================================================
// DAILY TOTAL TIME DATA (NEVER PAUSES)
// ============================================================================

/**
 * Get daily total time for today in seconds
 * 
 * KEY DIFFERENCE from session time:
 * - NEVER pauses, keeps accumulating all day
 * - Only resets at 12:00 AM midnight
 * - Persists across workspace switches and VS Code closes
 * 
 * @returns Total seconds accumulated today (never paused)
 */
export function getTodayDailyTotalTime(): number {
  try {
    return getDailyTotalTime();
  } catch (error) {
    console.error('Failed to get daily total time:', error);
    return 0;
  }
}

/**
 * Get daily total time for today formatted as human-readable string
 * 
 * NEVER pauses - always accumulating
 * Example: 12600 seconds → "3h 30m"
 * 
 * @returns Formatted string (e.g., "3h 30m")
 */
export function getTodayDailyTotalTimeFormatted(): string {
  try {
    return getDailyTotalTimeFormatted();
  } catch (error) {
    console.error('Failed to format daily total time:', error);
    return '0m';
  }
}

/**
 * Get number of coding sessions for today
 * 
 * RULE: Computed on demand from sessions table
 * Count all sessions where start_time >= midnight
 * 
 * @returns Number of sessions today
 */
export function getTodaySessions(): number {
  try {
    return getSessionCountToday();
  } catch (error) {
    console.error('Failed to get today sessions:', error);
    return 0;
  }
}

/**
 * Get average session duration for today in seconds
 * 
 * RULE: Computed on demand
 * Sum(duration) / Count(sessions)
 * 
 * @returns Average session duration in seconds
 */
export function getAverageSessionDurationToday(): number {
  try {
    return Math.round(getAvgSessionDurationToday());
  } catch (error) {
    console.error('Failed to get average session duration:', error);
    return 0;
  }
}

/**
 * Get average session duration formatted as human-readable string
 * 
 * Example: 1800 seconds → "30m"
 * 
 * @returns Formatted string (e.g., "30m", "1h 15m")
 */
export function getAverageSessionDurationFormatted(): string {
  const seconds = getAverageSessionDurationToday();
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get current active session data
 * 
 * RULE: Computed on demand from sessions table
 * Returns the session with end_time = NULL (still active)
 * 
 * @returns Current session or null if not in a session
 */
export function getCurrentSessionData() {
  try {
    const session = getCurrentSession();
    
    if (!session) {
      return null;
    }
    
    // Calculate current session duration (if it's still running)
    const now = Math.floor(Date.now() / 1000);
    const currentDuration = getActiveSessionElapsedSeconds(session, now);
    
    return {
      id: session.id,
      startTime: session.start_time,
      duration: currentDuration,
      projectPath: session.project_path,
      durationFormatted: formatSeconds(currentDuration),
    };
  } catch (error) {
    console.error('Failed to get current session:', error);
    return null;
  }
}

/**
 * Get CURRENT session duration formatted (not total of all sessions)
 * 
 * This shows how long the ACTIVE session has been running
 * When closed/reopened, this resets to 0m for the new session
 * 
 * @returns Formatted string (e.g., "2h 45m") or "0m" if no active session
 */
export function getCurrentSessionDurationFormatted(): string {
  try {
    const sessionData = getCurrentSessionData();
    if (sessionData) {
      return sessionData.durationFormatted;
    }
    return '0m'; // No active session
  } catch (error) {
    console.error('Failed to get current session duration:', error);
    return '0m';
  }
}

// ============================================================================
// GIT & COMMITS DATA
// ============================================================================

/**
 * Get number of commits made today
 * 
 * RULE: Computed on demand from commits table
 * Count all commits where timestamp >= midnight
 * NO correlation with sessions ❌
 * 
 * @returns Number of commits today
 */
export function getTodayCommits(): number {
  try {
    return getCommitCountToday();
  } catch (error) {
    console.error('Failed to get today commits:', error);
    return 0;
  }
}

/**
 * Get list of all commits made today (with details)
 * 
 * RULE: Computed on demand
 * Returns array of commits for today
 * 
 * @returns Array of commit objects {hash, message, timestamp, repo_path}
 */
export function getTodayCommitsList() {
  try {
    return getCommitsToday();
  } catch (error) {
    console.error('Failed to get today commits list:', error);
    return [];
  }
}

// ============================================================================
// PRODUCTIVITY METRICS
// ============================================================================

/**
 * Calculate productivity score for today
 * 
 * RULE (from vs-ex.md):
 * productivity = active_time / total_time
 * Computed on demand 
 * 
 * INTERPRETATION:
 * - active_time = sum of all session durations
 * - total_time = time since first event to now (24 hours if no events)
 * - Returns percentage: 0-100
 * 
 * EXAMPLE:
 * - If coded for 3 hours out of 8 hours worked: 37.5%
 * - If coded for 6 hours out of 8 hours worked: 75%
 * 
 * @returns Productivity score (0-100, percentage)
 */
export function getProductivityScore(): number {
  try {
    const activeTime = getTodayCodingTime(); // seconds
    
    if (activeTime === 0) {
      return 0;
    }
    
    // Total time available today: from the user's first event to now
    // If no events yet, assume started at midnight
    const now = Math.floor(Date.now() / 1000);
    const today = Math.floor(now / 86400) * 86400; // Midnight today
    const totalTimeAvailable = now - today; // Since midnight
    
    if (totalTimeAvailable === 0) {
      return 0;
    }
    
    // Calculate percentage
    const score = (activeTime / totalTimeAvailable) * 100;
    
    // Cap at 100% (can't code more than 100% of time)
    return Math.min(score, 100);
  } catch (error) {
    console.error('Failed to calculate productivity score:', error);
    return 0;
  }
}

/**
 * Get productivity score formatted as string with one decimal
 * 
 * Example: 37.5 → "37.5%"
 * 
 * @returns Formatted string (e.g., "75.2%")
 */
export function getProductivityScoreFormatted(): string {
  const score = getProductivityScore();
  return `${score.toFixed(1)}%`;
}

// ============================================================================
// TODAY'S SUMMARY (Aggregate Data)
// ============================================================================

/**
 * Get complete summary of today's activity
 * 
 * RULE: Computed on demand
 * Aggregates all stats into one object for UI
 * 
 * @returns Object with all today's statistics
 */
export function getTodaySummary() {
  return {
    // Time tracking
    totalCodingTime: getTodayCodingTime(),
    totalCodingTimeFormatted: getTodayCodingTimeFormatted(),
    codingTimeFormatted: getTodayCodingTimeFormatted(),
    sessionCount: getTodaySessions(),
    sessions: getTodaySessions(),
    averageSessionDuration: getAverageSessionDurationToday(),
    averageSessionDurationFormatted: getAverageSessionDurationFormatted(),
    avgSessionFormatted: getAverageSessionDurationFormatted(),
    currentSession: getCurrentSessionData(),
    
    // Git tracking
    commitCount: getTodayCommits(),
    commits: getTodayCommits(),
    commitsList: getTodayCommitsList(),
    
    // Productivity
    productivityScore: getProductivityScore(),
    productivityScoreFormatted: getProductivityScoreFormatted(),
    
    // Goals
    hoursProgress: getHoursProgress(),
    commitsProgress: getCommitsProgress(),
    goalStatus: getTodayGoalStatus(),
    goalStatusEmoji: getTodayGoalStatusEmoji(),
    
    // Languages
    languages: getTodayLanguageStats(),
    languagesFormatted: getTodayLanguagesFormatted(),
    topLanguage: getTopLanguageTodayFormatted(),
    languageBreakdown: getTodayLanguageBreakdown(),
    
    // Metadata
    timestamp: Math.floor(Date.now() / 1000),
  };
}

/**
 * Helper: Format seconds to human-readable string
 * 
 * FORMAT RULES (from session-fix.md):
 * - < 1 hour → mm:ss (e.g., "45:30")
 * - ≥ 1 hour → hh:mm:ss (e.g., "1:30:45")
 * 
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "45:30", "1:30:45")
 */
function formatSeconds(seconds: number): string {
  // Prevent negative values from showing
  const safeSeconds = Math.max(0, Math.floor(seconds));
  
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  
  if (hours > 0) {
    // Format: hh:mm:ss
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  // Format: mm:ss
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

// ============================================================================
// GOALS & PROGRESS TRACKING
// ============================================================================

/**
 * Get today's goal (if set by user)
 * 
 * @returns Goal object {daily_hours, daily_commits} or null if not set
 */
export function getTodayGoalTarget() {
  try {
    return getTodayGoal();
  } catch (error) {
    console.error('Failed to get today goal:', error);
    return null;
  }
}

/**
 * Check progress on daily hours goal
 * 
 * Returns object with:
 *   - target: goal hours
 *   - actual: coded hours
 *   - percentage: progress (0-100)
 *   - status: "on-track" | "almost" | "behind"
 * 
 * Status rules:
 *   - 75-100%: "on-track" ($(pass))
 *   - 50-74%: "almost" ($(warning))
 *   - 0-49%: "behind" ($(error))
 * 
 * @returns Progress object or null if no goal
 */
export function getHoursProgress() {
  try {
    const goal = getTodayGoal();
    
    if (!goal || goal.daily_hours === 0) {
      return null;
    }
    
    const actualSeconds = getTodayCodingTime();
    const actualHours = actualSeconds / 3600;
    const targetHours = goal.daily_hours;
    
    const percentage = (actualHours / targetHours) * 100;
    
    let status: 'on-track' | 'almost' | 'behind';
    if (percentage >= 75) {
      status = 'on-track';
    } else if (percentage >= 50) {
      status = 'almost';
    } else {
      status = 'behind';
    }
    
    return {
      target: targetHours,
      actual: Math.round(actualHours * 10) / 10, // Round to 1 decimal
      percentage: Math.min(percentage, 100),
      status,
    };
  } catch (error) {
    console.error('Failed to get hours progress:', error);
    return null;
  }
}

/**
 * Check progress on daily commits goal
 * 
 * Returns object with:
 *   - target: goal commits
 *   - actual: commits made
 *   - percentage: progress (0-100)
 *   - status: "on-track" | "almost" | "behind"
 * 
 * Status rules:
 *   - 75-100%: "on-track" ($(pass))
 *   - 50-74%: "almost" ($(warning))
 *   - 0-49%: "behind" ($(error))
 * 
 * @returns Progress object or null if no goal
 */
export function getCommitsProgress() {
  try {
    const goal = getTodayGoal();
    
    if (!goal || goal.daily_commits === 0) {
      return null;
    }
    
    const actualCommits = getTodayCommits();
    const targetCommits = goal.daily_commits;
    
    const percentage = (actualCommits / targetCommits) * 100;
    
    let status: 'on-track' | 'almost' | 'behind';
    if (percentage >= 75) {
      status = 'on-track';
    } else if (percentage >= 50) {
      status = 'almost';
    } else {
      status = 'behind';
    }
    
    return {
      target: targetCommits,
      actual: actualCommits,
      percentage: Math.min(percentage, 100),
      status,
    };
  } catch (error) {
    console.error('Failed to get commits progress:', error);
    return null;
  }
}

/**
 * Get overall goal status for today
 * 
 * Returns the "worst" status between hours and commits goals
 * Used for Status Bar indicator: $(pass) (on-track) | $(warning) (almost) | $(error) (behind)
 * 
 * @returns "on-track" | "almost" | "behind" | null (no goals)
 */
export function getTodayGoalStatus(): 'on-track' | 'almost' | 'behind' | null {
  try {
    const hoursProgress = getHoursProgress();
    const commitsProgress = getCommitsProgress();
    
    // If no goals set, return null
    if (!hoursProgress && !commitsProgress) {
      return null;
    }
    
    // If one or both goals exist, determine worst status
    const statuses = [];
    if (hoursProgress) {
      statuses.push(hoursProgress.status);
    }
    if (commitsProgress) {
      statuses.push(commitsProgress.status);
    }
    
    // Hierarchy: "behind" > "almost" > "on-track"
    if (statuses.includes('behind')) {
      return 'behind';
    }
    if (statuses.includes('almost')) {
      return 'almost';
    }
    return 'on-track';
  } catch (error) {
    console.error('Failed to get today goal status:', error);
    return null;
  }
}

/**
 * Get status indicator icon for Status Bar display
 * 
 * $(pass) = on-track (green)
 * $(warning) = almost (yellow/orange)
 * $(error) = behind (red)
 * (empty) = no goals set
 * 
 * @returns Status icon codicon string or empty string
 */
export function getTodayGoalStatusEmoji(): string {
  const status = getTodayGoalStatus();
  
  switch (status) {
    case 'on-track':
      return '$(pass)';
    case 'almost':
      return '$(warning)';
    case 'behind':
      return '$(error)';
    default:
      return '';
  }
}

// ============================================================================
// LANGUAGE STATISTICS
// ============================================================================

/**
 * Get programming languages worked on today
 * 
 * Returns array of unique languages with event count
 * Sorted by most used first
 * 
 * @returns Array of { language: string, count: number, percentage: number }
 */
export function getTodayLanguageStats() {
  try {
    const events = getEventsToday();
    
    if (events.length === 0) {
      return [];
    }

    // Group events by language
    const languageMap = new Map<string, number>();
    
    events.forEach(event => {
      if (event.language) {
        const count = languageMap.get(event.language) || 0;
        languageMap.set(event.language, count + 1);
      }
    });

    // Convert to sorted array
    const stats = Array.from(languageMap.entries())
      .map(([language, count]) => ({
        language,
        count,
        percentage: (count / events.length) * 100,
      }))
      .sort((a, b) => b.count - a.count); // Sort by count descending

    return stats;
  } catch (error) {
    console.error('Failed to get today language stats:', error);
    return [];
  }
}

/**
 * Get top programming language for today
 * 
 * Returns the most used language
 * 
 * @returns Language string (e.g., 'typescript', 'python') or null
 */
export function getTopLanguageTodayFormatted(): string {
  try {
    const stats = getTodayLanguageStats();
    if (stats.length === 0) {
      return 'None';
    }
    
    const topLang = stats[0];
    return `${topLang.language} (${Math.round(topLang.percentage)}%)`;
  } catch (error) {
    console.error('Failed to get top language:', error);
    return 'Unknown';
  }
}

/**
 * Get all languages for today as formatted string
 * 
 * Example: "TypeScript (42%), Python (35%), JavaScript (23%)"
 * 
 * @returns Formatted string with all languages
 */
export function getTodayLanguagesFormatted(): string {
  try {
    const stats = getTodayLanguageStats();
    
    if (stats.length === 0) {
      return 'No languages tracked';
    }

    return stats
      .map(
        (stat) => `${stat.language} (${Math.round(stat.percentage)}%)`
      )
      .join(', ');
  } catch (error) {
    console.error('Failed to format languages:', error);
    return 'Error loading languages';
  }
}

/**
 * Get language breakdown summary
 * 
 * Returns object with counts and percentages
 * 
 * @returns { total: number, languages: array }
 */
export function getTodayLanguageBreakdown() {
  try {
    const stats = getTodayLanguageStats();
    return {
      total: stats.reduce((sum, stat) => sum + stat.count, 0),
      languages: stats,
      primaryLanguage: stats.length > 0 ? stats[0].language : null,
    };
  } catch (error) {
    console.error('Failed to get language breakdown:', error);
    return { total: 0, languages: [], primaryLanguage: null };
  }
}

// ============================================================================
// CURRENT LANGUAGE DATA (Real-time from active editor)
// ============================================================================

/**
 * Get CURRENT language being edited
 * 
 * PURPOSE:
 * Real-time language detection from the active editor
 * Used by status bar to display what you're CURRENTLY working on
 * Updated IMMEDIATELY when you switch files (no delay)
 * 
 * KEY DIFFERENCE from getTodayLanguageStats():
 * - getTodayLanguageStats() = All languages you worked on TODAY (historical)
 * - getCurrentLanguageFormatted() = Language you're editing RIGHT NOW (real-time)
 * 
 * EXAMPLES:
 * - Editing main.ts → "TypeScript"
 * - Editing script.py → "Python"
 * - Editing styles.css → "CSS"
 * - No editor open → "No language"
 * 
 * FORMAT:
 * Returns human-readable language name with proper capitalization
 * 
 * @returns Formatted language name (e.g., "TypeScript", "Python") or "No language"
 */
export function getCurrentLanguageFormatted(): string {
  try {
    const lang = getCurrentLanguage();
    
    if (!lang) {
      return 'No language';
    }
    
    // Map language IDs to human-readable names
    const languageNames: { [key: string]: string } = {
      'typescript': 'TypeScript',
      'javascript': 'JavaScript',
      'python': 'Python',
      'java': 'Java',
      'cpp': 'C++',
      'csharp': 'C#',
      'php': 'PHP',
      'ruby': 'Ruby',
      'go': 'Go',
      'rust': 'Rust',
      'swift': 'Swift',
      'kotlin': 'Kotlin',
      'r': 'R',
      'sql': 'SQL',
      'html': 'HTML',
      'css': 'CSS',
      'scss': 'SCSS',
      'less': 'Less',
      'json': 'JSON',
      'xml': 'XML',
      'yaml': 'YAML',
      'markdown': 'Markdown',
      'shell': 'Shell',
      'bash': 'Bash',
      'powershell': 'PowerShell',
      'dockerfile': 'Dockerfile',
      'graphql': 'GraphQL',
      'vue': 'Vue',
      'jsx': 'JSX',
      'tsx': 'TSX',
    };
    
    // Return human-readable name or capitalize first letter as fallback
    if (languageNames[lang]) {
      return languageNames[lang];
    }
    
    // Fallback: capitalize first letter of language ID
    return lang.charAt(0).toUpperCase() + lang.slice(1);
  } catch (error) {
    console.error('Failed to get current language:', error);
    return 'Error';
  }
}
