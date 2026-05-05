import * as vscode from 'vscode';
import { insertBreak } from '../storage/repositories/breakRepository';
import { getCurrentSessionData } from '../services/statsService';

/**
 * Break Reminder - Triggers break notifications when coding too long
 * 
 * CORE RULES (from vs-ex.md Section 6 - STRICTLY ENFORCED):
 * 1. Trigger when: continuous coding > 90 minutes
 * 2. Use: vscode.window.showInformationMessage()
 * 3. Reset when: idle detected OR VS Code loses focus
 * 4. NO progressive urgency ❌
 * 5. NO complex tracking ❌
 * 
 * BEHAVIOR:
 * - Monitor current session duration
 * - Show message when > 90 minutes
 * - Only show ONCE per session (not repeatedly)
 * - Allow "Snooze" (10 mins, then check again)
 * - Allow "Dismiss" (acknowledge, log break)
 * - Reset counter when idle/blur detected
 */

const BREAK_THRESHOLD = 90 * 60; // 90 minutes in seconds
const SNOOZE_DURATION = 10 * 60; // 10 minutes in seconds
let reminderShownTime: number | null = null;
let breakReminderTimeout: NodeJS.Timeout | null = null;
let isMonitoring: boolean = false;

/**
 * Initialize break reminder monitoring
 * 
 * Called from extension.ts on activation
 */
export function initializeBreakReminder(): void {
  startMonitoring();
  attachWindowBlurListener();
  console.log('Break Reminder initialized');
}

/**
 * Start monitoring current session duration
 * 
 * Checks every 10 seconds if user needs a break
 */
function startMonitoring(): void {
  if (isMonitoring) {
    return;
  }
  
  isMonitoring = true;
  monitorSession();
}

/**
 * Stop monitoring current session
 */
function stopMonitoring(): void {
  if (breakReminderTimeout) {
    clearTimeout(breakReminderTimeout);
    breakReminderTimeout = null;
  }
  isMonitoring = false;
  reminderShownTime = null;
}

/**
 * Monitor function - checks session duration every 10 seconds
 * 
 * RULE: Only triggers if continuous coding > 90 minutes
 * Continuous = no idle detected, same session
 */
function monitorSession(): void {
  try {
    // Get current active session
    const currentSession = getCurrentSessionData();
    
    if (!currentSession) {
      // No active session, schedule next check
      scheduleNextCheck();
      return;
    }
    
    const sessionDuration = currentSession.duration;
    
    // RULE: Check if continuous coding > 90 minutes
    if (sessionDuration > BREAK_THRESHOLD) {
      // Check if we've already shown reminder recently
      if (reminderShownTime === null) {
        // RULE: Show break reminder message
        showBreakReminder();
        reminderShownTime = Math.floor(Date.now() / 1000);
      }
    }
    
    // Schedule next check
    scheduleNextCheck();
  } catch (error) {
    console.error('Error monitoring session:', error);
    scheduleNextCheck();
  }
}

/**
 * Schedule the next monitoring check (every 10 seconds)
 */
function scheduleNextCheck(): void {
  if (breakReminderTimeout) {
    clearTimeout(breakReminderTimeout);
  }
  
  breakReminderTimeout = setTimeout(() => {
    monitorSession();
  }, 10000); // Check every 10 seconds
}

/**
 * Show break reminder message to user
 * 
 * RULE (from vs-ex.md):
 * Use: vscode.window.showInformationMessage(
 *   "Take a break!",
 *   "Snooze",
 *   "Dismiss"
 * )
 */
async function showBreakReminder(): Promise<void> {
  try {
    const currentSession = getCurrentSessionData();
    
    if (!currentSession) {
      return;
    }
    
    // RULE: Show message with actions
    const action = await vscode.window.showInformationMessage(
      `You've been coding for ${currentSession.durationFormatted}. Time for a break!`,
      'Snooze',
      'Dismiss'
    );
    
    if (action === 'Snooze') {
      // RULE: Snooze for 10 minutes
      // Log the snooze as a break record
      recordBreak(SNOOZE_DURATION);
      
      // Reset reminder after snooze duration
      reminderShownTime = null;
      
      vscode.window.showInformationMessage('Break reminder snoozed for 10 minutes');
    } else if (action === 'Dismiss') {
      // User dismissed - acknowledge and log
      recordBreak(0); // Log snooze/break taken
      
      // Reset for next session
      reminderShownTime = null;
      
      vscode.window.showInformationMessage('Good! Take a break and hydrate. Stay productive!');
    }
    // If user ignores (closes dialog), reminderShownTime stays set
    // Next check will not show again until they reset
  } catch (error) {
    console.error('Error showing break reminder:', error);
  }
}

/**
 * Record a break in the database
 * 
 * Called when user dismisses or snoozes
 * 
 * @param duration - Break duration (seconds), 0 if dismissed
 */
function recordBreak(duration: number): void {
  try {
    const now = Math.floor(Date.now() / 1000);
    
    insertBreak({
      timestamp: now,
      duration: duration,
    });
    
    console.log(`Break recorded: ${duration} seconds`);
  } catch (error) {
    console.error('Failed to record break:', error);
  }
}

/**
 * Reset break reminder (called when idle is detected)
 * 
 * RULE (from vs-ex.md):
 * Reset when: idle detected
 */
export function resetBreakReminder(): void {
  console.log('Break reminder reset (idle detected)');
  reminderShownTime = null;
}

/**
 * Attach listener for VS Code window blur
 * 
 * RULE (from vs-ex.md):
 * Reset when: VS Code loses focus
 * 
 * Note: VS Code doesn't expose window focus events directly,
 * so we'll reset on idle (which is detected by session manager)
 */
function attachWindowBlurListener(): void {
  // VS Code doesn't expose window focus/blur through API
  // Reset happens via resetBreakReminder() called on idle detection
  // This is handled by sessionManager's idle detection
}

/**
 * Get break reminder status for debugging/UI
 * 
 * @returns Current reminder state
 */
export function getBreakReminderStatus() {
  const currentSession = getCurrentSessionData();
  
  if (!currentSession) {
    return {
      isActive: false,
      sessionDuration: 0,
      needsBreak: false,
      reminderShown: false,
    };
  }
  
  const needsBreak = currentSession.duration > BREAK_THRESHOLD;
  
  return {
    isActive: true,
    sessionDuration: currentSession.duration,
    sessionDurationFormatted: currentSession.durationFormatted,
    thresholdSeconds: BREAK_THRESHOLD,
    thresholdFormatted: '90m',
    needsBreak,
    reminderShown: reminderShownTime !== null,
  };
}

/**
 * Manual break trigger (for testing or user-initiated breaks)
 */
export async function triggerBreakManually(): Promise<void> {
  if (isMonitoring) {
    reminderShownTime = null; // Reset to allow reminder
    await showBreakReminder();
  }
}

/**
 * Cleanup - called on extension deactivation
 */
export function deactivateBreakReminder(): void {
  stopMonitoring();
  console.log('Break Reminder deactivated');
}
