import * as vscode from 'vscode';
import {
  insertSession,
  updateSessionEnd,
  getCurrentSession,
} from '../storage/repositories/sessionRepository';

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

/**
 * Initialize session manager
 */
export function initializeSessionManager(): void {
  lastEventTime = Math.floor(Date.now() / 1000);
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

  // RULE: Check if idle > 5 minutes
  if (timeSinceLastEvent > IDLE_THRESHOLD) {
    // Session ended due to idle
    if (currentSessionId !== null) {
      endCurrentSession(now);
    }
    // Start new session
    startNewSession(projectPath, now);
  }
  // Check if project changed
  else if (lastProjectPath !== null && lastProjectPath !== projectPath) {
    // Project context changed, end current and start new
    if (currentSessionId !== null) {
      endCurrentSession(now);
    }
    startNewSession(projectPath, now);
  }
  // Continue current session
  else if (currentSessionId === null) {
    // No active session, create one
    startNewSession(projectPath, now);
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
  } catch (error) {
    console.error('Failed to start session:', error);
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
      const duration = endTime - session.start_time;
      updateSessionEnd(currentSessionId, endTime, duration);
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
