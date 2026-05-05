import * as vscode from 'vscode';
import {
  insertSession,
  updateSessionEnd,
  getCurrentSession,
  pauseSession,
  resumeSession,
  getActiveSessionElapsedSeconds,
} from '../storage/repositories/sessionRepository';
import { resetBreakReminder } from '../features/breakReminder';

/**
 * Session Manager - Handles Smart Time Tracking
 * 
 * CORE RULES (from vs-ex.md - STRICTLY ENFORCED):
 * 1. Idle Detection: 5-minute threshold (no events = idle)
 * 2. Session Definition: Continuous activity without idle > 5 mins
 * 3. Track: {startTime, endTime, duration, projectPath}
 * 4. Multi-project: Use workspace.workspaceFolders
 */

const IDLE_THRESHOLD = 5 * 60; // 5 minutes in seconds (RULE: 5 minute threshold)
let lastEventTime: number = 0;
let currentSessionId: number | null = null;
let lastProjectPath: string | null = null;
let isSessionPaused: boolean = false;
let pausedSessionId: number | null = null;

/**
 * Initialize session manager
 */
export function initializeSessionManager(): void {
  // Reset all state when initializing (on extension startup/reload)
  const now = Math.floor(Date.now() / 1000);
  lastEventTime = now;
  currentSessionId = null;
  lastProjectPath = null;
  isSessionPaused = false;
  pausedSessionId = null;

  // Restore current active session (if any) so we don't accidentally start a new one
  // and reset the session timer back to 0.
  try {
    const session = getCurrentSession();
    if (session?.id) {
      currentSessionId = session.id;
      lastProjectPath = session.project_path;
      // If DB indicates the session is paused, restore paused state too.
      if (session.pause_started_at) {
        isSessionPaused = true;
        pausedSessionId = session.id;
      }
    }
  } catch (error) {
    console.error('[GlixyMetric Session Manager] Failed to restore active session on init:', error);
  }

  console.log('[GlixyMetric Session Manager] Initialized', {
    lastEventTime,
    currentSessionId,
    lastProjectPath,
    isSessionPaused,
    pausedSessionId,
  });
}

/**
 * Called when an event is tracked
 * 
 * Decision Logic:
 * 1. If idle > 5 mins: Close old session, start new one
 * 2. If project changed: Close old session, start new one  
 * 3. Otherwise: Update last event time only
 * 
 * @param projectPath - The project workspace path
 */
export function updateActivity(projectPath: string): void {
  const now = Math.floor(Date.now() / 1000);
  const timeSinceLastEvent = now - lastEventTime;

  // If tracking is paused, do not create/end sessions or trigger idle logic.
  // Still update lastEventTime to avoid false idle detection on resume.
  if (isSessionPaused) {
    lastEventTime = now;
    lastProjectPath = projectPath;
    return;
  }

  // RULE: Check if idle > 5 minutes
  if (timeSinceLastEvent > IDLE_THRESHOLD) {
    // RULE (from Break Reminder): Reset when idle detected
    resetBreakReminder();
    
    console.log(`[GlixyMetric] Idle detected (${timeSinceLastEvent}s > ${IDLE_THRESHOLD}s)`);
    
    // Session ended due to idle
    if (currentSessionId !== null) {
      console.log(`[GlixyMetric] Ending session ${currentSessionId} due to idle`);
      endCurrentSession(now);
    }
    // Start new session
    console.log(`[GlixyMetric] Starting new session after idle`);
    startNewSession(projectPath, now);
  }
  // Check if project changed
  else if (lastProjectPath !== null && lastProjectPath !== projectPath) {
    console.log(`[GlixyMetric] Project changed from ${lastProjectPath} to ${projectPath}`);
    
    // Project context changed, end current and start new
    if (currentSessionId !== null) {
      console.log(`[GlixyMetric] Ending session ${currentSessionId} due to project change`);
      endCurrentSession(now);
    }
    console.log(`[GlixyMetric] Starting new session for project ${projectPath}`);
    startNewSession(projectPath, now);
  }
  // Continue current session
  else if (currentSessionId === null) {
    // No active session, create one
    console.log(`[GlixyMetric] No active session, creating new session for ${projectPath}`);
    startNewSession(projectPath, now);
  } else {
    // Session continues - just update event time
    console.log(`[GlixyMetric] Session ${currentSessionId} continuing (idle: ${timeSinceLastEvent}s)`);
  }

  // Update last event time
  lastEventTime = now;
  lastProjectPath = projectPath;
}

/**
 * Start a new session
 * 
 * @param projectPath - Workspace folder path
 * @param startTime - Unix timestamp when session starts
 */
function startNewSession(projectPath: string, startTime: number): void {
  try {
    currentSessionId = insertSession({
      start_time: startTime,
      project_path: projectPath,
    });
    console.log(`[GlixyMetric] ✓ Session ${currentSessionId} created at project: ${projectPath}`);
  } catch (error) {
    console.error('Failed to start session:', error);
    currentSessionId = null;
  }
}

/**
 * End current session (when idle detected)
 * 
 * @param endTime - Unix timestamp when session ends
 */
function endCurrentSession(endTime: number): void {
  if (currentSessionId === null) {
    return;
  }

  try {
    const session = getCurrentSession();
    if (session && session.id === currentSessionId) {
      // Duration MUST exclude paused time.
      // If a pause is currently in progress, count it as paused up to endTime.
      const duration = getActiveSessionElapsedSeconds(session, endTime);
      updateSessionEnd(currentSessionId, endTime, duration);
      console.log(`[GlixyMetric] ✓ Session ${currentSessionId} ended - Duration: ${duration}s`);
    }
  } catch (error) {
    console.error('Failed to end session:', error);
  }

  currentSessionId = null;
}

/**
 * Manually close the current session
 * (called when user manually stops tracking)
 */
export function closeCurrentSession(): void {
  const now = Math.floor(Date.now() / 1000);
  endCurrentSession(now);
}

/**
 * Reset session manager (e.g., at midnight or on extension reload)
 */
export function resetSessionManager(): void {
  lastEventTime = Math.floor(Date.now() / 1000);
  currentSessionId = null;
  lastProjectPath = null;
}

/**
 * Schedule daily session reset at midnight
 * 
 * IMPORTANT: Sessions that span across midnight should be closed
 * This ensures "today's" session durations don't include time from yesterday
 */
export function scheduleMidnightSessionReset(): void {
  setInterval(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Check if we need to reset (new day)
    try {
      // Get current session to check its timestamp
      const session = getCurrentSession();
      if (session) {
        const sessionDate = new Date(session.start_time * 1000).toISOString().split('T')[0];
        // If session started before today, close it and reset
        if (sessionDate !== today) {
          console.log(`[MIDNIGHT RESET] Closing session from ${sessionDate} (started before midnight)`);
          endCurrentSession(now.getTime() / 1000);
          resetSessionManager();
        }
      }
    } catch (error) {
      console.error('Failed to check midnight session reset:', error);
    }
  }, 60 * 1000); // Check every minute
}

/**
 * Get current session ID
 */
export function getCurrentSessionId(): number | null {
  return currentSessionId;
}

/**
 * Get time since last event (for debugging/UI)
 */
export function getIdleTime(): number {
  const now = Math.floor(Date.now() / 1000);
  return now - lastEventTime;
}

/**
 * Check if currently idle
 */
export function isIdle(): boolean {
  return getIdleTime() > IDLE_THRESHOLD;
}

/**
 * Get idle threshold (in seconds)
 */
export function getIdleThreshold(): number {
  return IDLE_THRESHOLD;
}

/**
 * Pause session tracking (called when switching away from current workspace)
 * Saves the current session ID so we can resume it later
 */
export function pauseSessionTracking(): void {
  if (isSessionPaused || currentSessionId === null) {
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  isSessionPaused = true;
  pausedSessionId = currentSessionId;

  try {
    pauseSession(currentSessionId, now);
  } catch (error) {
    console.error('Failed to pause session in DB:', error);
  }

  // Prevent false idle detection if updateActivity is triggered while paused.
  lastEventTime = now;
  console.log('Session tracking PAUSED. Paused session ID:', pausedSessionId);
}

/**
 * Resume session tracking (called when switching back to previous workspace)
 * Restores the paused session so it continues counting
 * Updates lastEventTime to prevent false idle detection on resume
 */
export function resumeSessionTracking(): void {
  if (!isSessionPaused) {
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const sessionIdToResume = pausedSessionId ?? currentSessionId;
  isSessionPaused = false;

  if (sessionIdToResume !== null) {
    try {
      resumeSession(sessionIdToResume, now);
      currentSessionId = sessionIdToResume;
    } catch (error) {
      console.error('Failed to resume session in DB:', error);
    }
  }

  pausedSessionId = null;
  // Update lastEventTime to current time to prevent false idle detection
  lastEventTime = now;
  // Session ID is restored, activity will resume on next event
  console.log('Session tracking RESUMED. Session ID:', currentSessionId);
}

/**
 * Check if session is currently paused
 */
export function isSessionTrackingPaused(): boolean {
  return isSessionPaused;
}

/**
 * Get paused session ID (for debugging)
 */
export function getPausedSessionId(): number | null {
  return pausedSessionId;
}
