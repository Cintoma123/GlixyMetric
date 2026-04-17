import * as vscode from 'vscode';
import { Event } from '../types';
import { insertEvent, getEventsToday as getEventsTodayRepo, getEventsByLanguageToday as getEventsByLanguageTodayRepo, countEventsInRange, getLastEventTimestamp as getLastEventTimestampRepo } from '../storage/repositories/eventRepository';
import { updateActivity } from './sessionManager';

/**
 * Event Tracker - Captures VS Code editing events
 * Uses 3 core VS Code APIs with debouncing for performance
 *
 * Tracked Events:
 * - onDidChangeActiveTextEditor (file focus)
 * - onDidChangeTextDocument (file edits)
 * - onDidSaveTextDocument (file saves)
 *
 * Debouncing: 1 second (prevents event spam)
 */

const DEBOUNCE_INTERVAL = 1000; // 1 second debounce
let debounceTimer: NodeJS.Timeout | null = null;
let lastEventTime: number = 0;
let pendingEvent: Event | null = null;

/**
 * Start listening to VS Code events
 */
export function startEventTracking(): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  // 1. Track file focus changes
  disposables.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        trackEvent('focus', editor.document);
      }
    })
  );

  // 2. Track text edits (with debouncing to prevent spam)
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
    updateActivity(workspaceFolder.uri.fsPath);
  }

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
