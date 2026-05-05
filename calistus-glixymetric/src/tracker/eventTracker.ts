import * as vscode from 'vscode';
import { Event } from '../types';
import { insertEvent, getEventsToday as getEventsTodayRepo, getEventsByLanguageToday as getEventsByLanguageTodayRepo, countEventsInRange, getLastEventTimestamp as getLastEventTimestampRepo } from '../storage/repositories/eventRepository';
import { pauseSessionTracking, resumeSessionTracking, updateActivity } from './sessionManager';

// Lazy import to avoid circular dependency - module cache ensures singleton
let recordDailyActivityFn: ((x?: void) => void) | null = null;

async function ensureRecordDailyActivity() {
  if (!recordDailyActivityFn) {
    try {
      const { recordDailyActivity } = await import('./dailyTimeTracker.js');
      recordDailyActivityFn = recordDailyActivity;
    } catch (error) {
      console.error('Failed to load recordDailyActivity:', error);
      recordDailyActivityFn = () => {}; // Fallback no-op
    }
  }
  return recordDailyActivityFn;
}

/**
 * Event Tracker - Captures VS Code editing events
 * Uses 3 core VS Code APIs with debouncing for performance
 *
 * Tracked Events:
 * - onDidChangeActiveTextEditor (file focus) - TRIGGER #3
 * - onDidChangeTextDocument (file edits) - TRIGGER #2
 * - onDidSaveTextDocument (file saves)
 *
 * Debouncing: 1 second (prevents event spam)
 */

const DEBOUNCE_INTERVAL = 1000; // 1 second debounce
let debounceTimer: NodeJS.Timeout | null = null;
let lastEventTime: number = 0;
let pendingEvent: Event | null = null;
let isTrackingPaused: boolean = false;

// Store the original disposables for pause/resume
let originalDisposables: vscode.Disposable[] = [];

/**
 * CURRENT LANGUAGE TRACKING
 * 
 * Tracks the programming language of the currently active editor.
 * Updated whenever user switches to a different file.
 * Used by status bar to display ONLY the current language being edited.
 * 
 * Examples:
 * - If editing main.ts → currentLanguage = 'typescript'
 * - If editing script.py → currentLanguage = 'python'
 * - If editing index.html → currentLanguage = 'html'
 * - If no editor active → currentLanguage = null
 */
let currentLanguage: string | null = null;

/**
 * Start listening to VS Code events
 */
export function startEventTracking(): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  // 0. Track current language from active editor changes
  // Updated IMMEDIATELY when user switches files
  // This allows status bar to show real-time current language
  disposables.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document) {
        currentLanguage = editor.document.languageId;
        console.log(`[GlixyMetric] Current language: ${currentLanguage}`);
      } else {
        currentLanguage = null;
      }
    })
  );
  
  // Set initial language if editor is already open
  if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
    currentLanguage = vscode.window.activeTextEditor.document.languageId;
  }

  // 1. Track file focus changes - TRIGGER #3: File focus
  disposables.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        trackEvent('focus', editor.document);
      }
    })
  );

  // 2. Track text edits (with debouncing to prevent spam) - TRIGGER #2: Typing
  disposables.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document && !event.document.isUntitled) {
        trackEvent('edit', event.document);
      }
    })
  );

  // 3. Track file saves
  disposables.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document && !document.isUntitled) {
        trackEvent('save', document);
      }
    })
  );

  // Store original disposables for pause/resume
  originalDisposables = disposables;

  return disposables;
}

/**
 * Track an event with debouncing
 *
 * Why debounce?
 * - Prevents event spam (e.g., 100 events per keystroke)
 * - Reduces database writes
 * - Improves performance
 * 
 * Also updates session tracking for Smart Time Tracking (IMMEDIATELY, not debounced)
 * AND records daily activity (IMMEDIATELY, not debounced)
 */
function trackEvent(eventType: 'edit' | 'save' | 'focus', document: vscode.TextDocument): void {
  const now = Date.now();

  // Create event object
  const newEvent: Event = {
    type: eventType,
    timestamp: Math.floor(now / 1000), // Unix timestamp in seconds
    file: document.fileName,
    language: document.languageId,
  };

  // Update pending event
  pendingEvent = newEvent;

  // RULE: Update session manager IMMEDIATELY (not debounced)
  // This ensures accurate idle detection even if events are debounced
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (workspaceFolder) {
    console.log(`[GlixyMetric] Event: ${eventType} | File: ${document.fileName} | Language: ${document.languageId}`);
    updateActivity(workspaceFolder.uri.fsPath);
  } else {
    console.log(`[GlixyMetric] Event tracked but no workspace folder found for ${document.fileName}`);
  }

  // RULE: Record daily activity IMMEDIATELY (not debounced)
  // This ensures daily time tracking is always active
  ensureRecordDailyActivity().then(recordFn => {
    if (recordFn) {
      recordFn();
    }
  }).catch(err => {
    console.error('Failed to record daily activity:', err);
  });

  // Clear existing debounce timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // Set new debounce timer
  debounceTimer = setTimeout(() => {
    if (pendingEvent) {
      insertEventToDatabase(pendingEvent);
      pendingEvent = null;
    }
    debounceTimer = null;
  }, DEBOUNCE_INTERVAL);
}

/**
 * Insert event to SQLite database via repository
 *
 * Delegates to eventRepository.insertEvent()
 */
function insertEventToDatabase(event: Event): void {
  try {
    insertEvent(event);
  } catch (error) {
    console.error('Failed to insert event:', error);
  }
}

/**
 * Stop all event tracking and cleanup
 */
export function stopEventTracking(disposables: vscode.Disposable[]): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  disposables.forEach((disposable) => disposable.dispose());
}

/**
 * Pause event tracking (temporarily disable)
 * 
 * Disposes all event listeners and stores them for later restoration
 * 
 * @param disposables - Array of disposables to pause
 */
export function pauseEventTracking(disposables: vscode.Disposable[]): void {
  if (isTrackingPaused) {
    console.log('Tracking already paused');
    return;
  }

  // Store disposables for later restoration
  originalDisposables = [...disposables];
  
  // Dispose all listeners
  disposables.forEach((disposable) => disposable.dispose());
  
  isTrackingPaused = true;
  console.log('Event tracking paused');
}

/**
 * Resume event tracking (restart from paused state)
 * 
 * Re-creates all event listeners and returns new disposables
 * The caller must update their reference to the disposables
 * 
 * @returns New array of disposables if tracking was paused, null otherwise
 */
export function resumeEventTracking(): vscode.Disposable[] | null {
  if (!isTrackingPaused) {
    console.log('Tracking not paused');
    return null;
  }

  isTrackingPaused = false;
  console.log('Event tracking resumed');
  
  // Re-start event tracking and return new disposables
  const newDisposables = startEventTracking();
  return newDisposables;
}

/**
 * Toggle pause/resume state
 * 
 * @param disposables - Array of disposables to manage
 * @returns Object with { isPaused: boolean, newDisposables?: vscode.Disposable[] }
 */
export function toggleTrackingPause(disposables: vscode.Disposable[]): { isPaused: boolean; newDisposables?: vscode.Disposable[] } {
  if (isTrackingPaused) {
    // Resume session time first so subsequent activity doesn't get treated as idle.
    resumeSessionTracking();
    const newDisposables = resumeEventTracking();
    return { isPaused: false, newDisposables: newDisposables ?? undefined };
  } else {
    // Pause session time so active session elapsed stops increasing.
    pauseSessionTracking();
    pauseEventTracking(disposables);
    return { isPaused: true };
  }
}

/**
 * Check if tracking is paused
 */
export function isTrackingCurrentlyPaused(): boolean {
  return isTrackingPaused;
}

/**
 * Get events for today (UTC midnight)
 * 
 * Delegates to eventRepository.getEventsToday()
 */
export function getEventsToday(): Event[] {
  try {
    return getEventsTodayRepo();
  } catch (error) {
    console.error('Failed to get events:', error);
    return [];
  }
}

/**
 * Get events by language today
 * 
 * Delegates to eventRepository.getEventsByLanguageToday()
 */
export function getEventsByLanguageToday(language: string): Event[] {
  try {
    return getEventsByLanguageTodayRepo(language);
  } catch (error) {
    console.error('Failed to get events by language:', error);
    return [];
  }
}

/**
 * Get event count for a specific time range
 * 
 * Delegates to eventRepository.countEventsInRange()
 */
export function getEventCount(startTimestamp: number, endTimestamp: number): number {
  try {
    return countEventsInRange(startTimestamp, endTimestamp);
  } catch (error) {
    console.error('Failed to get event count:', error);
    return 0;
  }
}

/**
 * Get last event timestamp
 * 
 * Delegates to eventRepository.getLastEventTimestamp()
 */
export function getLastEventTimestamp(): number {
  try {
    return getLastEventTimestampRepo();
  } catch (error) {
    console.error('Failed to get last event timestamp:', error);
    return 0;
  }
}

/**
 * Get CURRENT language from active editor
 * 
 * PURPOSE:
 * Used by status bar to display what language the user is CURRENTLY editing
 * Updated IMMEDIATELY when switching files (no debouncing)
 * 
 * EXAMPLES:
 * - User editing main.ts → returns 'typescript'
 * - User editing script.py → returns 'python'
 * - User editing style.css → returns 'css'
 * - No editor open → returns null
 * - Editing untitled file → returns language of that file (e.g., 'javascript' for new JS file)
 * 
 * NOTE: This is DIFFERENT from getTodayLanguagesFormatted() which shows ALL languages worked on today
 * This getter returns ONLY the current language for real-time status bar display
 * 
 * @returns Language ID (e.g., 'typescript', 'python') or null if no editor active
 */
export function getCurrentLanguage(): string | null {
  return currentLanguage;
}