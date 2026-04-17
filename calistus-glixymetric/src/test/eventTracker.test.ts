import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { initializeDatabase, closeDatabase, resetDatabase } from '../storage/db';
import * as eventRepository from '../storage/repositories/eventRepository';
import { Event } from '../types';

/**
 * EVENT TRACKER TEST SUITE
 * 
 * Tests event insertion, querying, idle detection, and debouncing logic
 * Run with: npm run test
 */

describe('Event Tracker Logic', () => {
  let dbPath: string;

  /**
   * Setup: Create temporary database before each test
   */
  beforeEach(() => {
    // Create temp directory for test database
    dbPath = path.join(os.tmpdir(), 'test_glixymetric_' + Date.now() + '.db');
    process.env.TEST_DB_PATH = dbPath;
    
    // Initialize fresh database
    initializeDatabase(path.dirname(dbPath));
  });

  /**
   * Cleanup: Close and delete database after each test
   */
  afterEach(() => {
    try {
      closeDatabase();
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  /**
   * TEST 1: Insert Single Event
   * 
   * Verify:
   * - Event is inserted successfully
   * - Returns valid ID
   * - Event can be retrieved
   */
  it('should insert an event and retrieve it', () => {
    const testEvent: Event = {
      type: 'edit',
      timestamp: Math.floor(Date.now() / 1000),
      file: '/test/file.ts',
      language: 'typescript',
    };

    // Insert
    const eventId = eventRepository.insertEvent(testEvent);
    assert.ok(eventId > 0, 'Event ID should be positive');

    // Retrieve
    const retrieved = eventRepository.getEventById(eventId);
    assert.ok(retrieved, 'Event should be retrievable');
    assert.strictEqual(retrieved?.type, 'edit');
    assert.strictEqual(retrieved?.language, 'typescript');
  });

  /**
   * TEST 2: Multiple Events Insertion
   * 
   * Verify:
   * - Multiple events can be inserted
   * - All events are stored
   * - Count is correct
   */
  it('should insert multiple events', () => {
    const events: Event[] = [
      {
        type: 'edit',
        timestamp: Math.floor(Date.now() / 1000),
        file: '/test/file1.ts',
        language: 'typescript',
      },
      {
        type: 'save',
        timestamp: Math.floor(Date.now() / 1000) + 1,
        file: '/test/file1.ts',
        language: 'typescript',
      },
      {
        type: 'focus',
        timestamp: Math.floor(Date.now() / 1000) + 2,
        file: '/test/file2.py',
        language: 'python',
      },
    ];

    events.forEach((e: Event) => eventRepository.insertEvent(e));

    const todayEvents = eventRepository.getEventsToday();
    assert.strictEqual(todayEvents.length, 3, 'Should have 3 events today');
  });

  /**
   * TEST 3: Filter Events by Language
   * 
   * Verify:
   * - Events can be filtered by language
   * - Only matching language events are returned
   * - Other languages excluded
   */
  it('should filter events by language', () => {
    const now = Math.floor(Date.now() / 1000);

    eventRepository.insertEvent({
      type: 'edit',
      timestamp: now,
      file: '/test/file1.ts',
      language: 'typescript',
    });

    eventRepository.insertEvent({
      type: 'edit',
      timestamp: now + 1,
      file: '/test/file2.ts',
      language: 'typescript',
    });

    eventRepository.insertEvent({
      type: 'edit',
      timestamp: now + 2,
      file: '/test/file1.py',
      language: 'python',
    });

    const tsEvents = eventRepository.getEventsByLanguageToday('typescript');
    const pyEvents = eventRepository.getEventsByLanguageToday('python');

    assert.strictEqual(tsEvents.length, 2, 'Should have 2 TypeScript events');
    assert.strictEqual(pyEvents.length, 1, 'Should have 1 Python event');
  });

  /**
   * TEST 4: Filter Events by File
   * 
   * Verify:
   * - Events can be filtered by file path
   * - Only events from that file are returned
   */
  it('should filter events by file', () => {
    const now = Math.floor(Date.now() / 1000);
    const filePath = '/test/myfile.ts';

    eventRepository.insertEvent({
      type: 'edit',
      timestamp: now,
      file: filePath,
      language: 'typescript',
    });

    eventRepository.insertEvent({
      type: 'save',
      timestamp: now + 1,
      file: filePath,
      language: 'typescript',
    });

    eventRepository.insertEvent({
      type: 'edit',
      timestamp: now + 2,
      file: '/test/other.ts',
      language: 'typescript',
    });

    const fileEvents = eventRepository.getEventsByFileToday(filePath);
    assert.strictEqual(fileEvents.length, 2, 'Should have 2 events for this file');
    fileEvents.forEach((e: Event) => {
      assert.strictEqual(e.file, filePath);
    });
  });

  /**
   * TEST 5: Idle Detection Logic
   * 
   * Verify:
   * - User detected as NOT idle when recent events exist
   * - User detected as IDLE when no recent events
   * - Threshold works correctly
   */
  it('should detect idle status correctly', () => {
    const now = Math.floor(Date.now() / 1000);

    // Insert event 2 minutes ago
    eventRepository.insertEvent({
      type: 'edit',
      timestamp: now - 120,
      file: '/test/file.ts',
      language: 'typescript',
    });

    // Should NOT be idle (2 min < 5 min threshold)
    const isIdle5min = eventRepository.isUserIdle(300);
    assert.strictEqual(isIdle5min, false, 'Should not be idle at 2 minutes');

    // Should be idle with 1 min threshold
    const isIdle1min = eventRepository.isUserIdle(60);
    assert.strictEqual(isIdle1min, true, 'Should be idle at 1 minute threshold');
  });

  /**
   * TEST 6: Event Count in Range
   * 
   * Verify:
   * - Count is accurate for time range
   * - Empty ranges return 0
   */
  it('should count events in time range', () => {
    const now = Math.floor(Date.now() / 1000);

    // Insert 5 events in next 60 seconds
    for (let i = 0; i < 5; i++) {
      eventRepository.insertEvent({
        type: 'edit',
        timestamp: now + i * 10,
        file: '/test/file.ts',
        language: 'typescript',
      });
    }

    const count = eventRepository.countEventsInRange(now, now + 60);
    assert.strictEqual(count, 5, 'Should count 5 events in range');

    const noCount = eventRepository.countEventsInRange(now + 3600, now + 7200);
    assert.strictEqual(noCount, 0, 'Should count 0 events outside range');
  });

  /**
   * TEST 7: Unique Languages
   * 
   * Verify:
   * - Returns all unique languages used today
   * - No duplicates
   * - Correct count
   */
  it('should get unique languages today', () => {
    const now = Math.floor(Date.now() / 1000);

    const languages = ['typescript', 'python', 'javascript', 'typescript', 'python'];
    languages.forEach((lang: string, idx: number) => {
      eventRepository.insertEvent({
        type: 'edit',
        timestamp: now + idx,
        file: `/test/file${idx}.${lang}`,
        language: lang,
      });
    });

    const unique = eventRepository.getUniqueLanguagesToday();
    assert.strictEqual(
      unique.length,
      3,
      'Should have 3 unique languages (ts, py, js)'
    );
    assert.ok(unique.includes('typescript'));
    assert.ok(unique.includes('python'));
    assert.ok(unique.includes('javascript'));
  });

  /**
   * TEST 8: Event Statistics Summary
   * 
   * Verify:
   * - Stats correctly count event types
   * - Total, edit, save, focus counts are accurate
   * - Unique files/languages counted correctly
   */
  it('should generate event statistics', () => {
    const now = Math.floor(Date.now() / 1000);

    // Create mixed events
    eventRepository.insertEvent({ type: 'edit', timestamp: now, file: '/f1.ts', language: 'typescript' });
    eventRepository.insertEvent({ type: 'edit', timestamp: now + 1, file: '/f1.ts', language: 'typescript' });
    eventRepository.insertEvent({ type: 'save', timestamp: now + 2, file: '/f1.ts', language: 'typescript' });
    eventRepository.insertEvent({ type: 'focus', timestamp: now + 3, file: '/f2.py', language: 'python' });

    const stats = eventRepository.getEventStats();

    assert.strictEqual(stats.totalEvents, 4, 'Should have 4 total events');
    assert.strictEqual(stats.editEvents, 2, 'Should have 2 edit events');
    assert.strictEqual(stats.saveEvents, 1, 'Should have 1 save event');
    assert.strictEqual(stats.focusEvents, 1, 'Should have 1 focus event');
    assert.strictEqual(stats.uniqueLanguages, 2, 'Should have 2 unique languages');
    assert.strictEqual(stats.uniqueFiles, 2, 'Should have 2 unique files');
  });

  /**
   * TEST 9: Last Event Timestamp
   * 
   * Verify:
   * - Returns most recent event timestamp
   * - Works with no events
   * - Correctly identifies newest event
   */
  it('should get last event timestamp', () => {
    const now = Math.floor(Date.now() / 1000);

    // Initially no events
    let lastTime = eventRepository.getLastEventTimestamp();
    assert.strictEqual(lastTime, 0, 'Should return 0 for no events');

    // Insert 3 events
    const times = [now - 100, now - 50, now];
    times.forEach((t: number) => {
      eventRepository.insertEvent({
        type: 'edit',
        timestamp: t,
        file: '/test/file.ts',
        language: 'typescript',
      });
    });

    lastTime = eventRepository.getLastEventTimestamp();
    assert.strictEqual(lastTime, now, 'Should return most recent timestamp');
  });

  /**
   * TEST 10: Delete Old Events (Cleanup)
   * 
   * Verify:
   * - Old events are deleted
   * - Recent events retained
   * - Count of deleted events is correct
   */
  it('should delete events before timestamp', () => {
    const now = Math.floor(Date.now() / 1000);

    // Insert old and new events
    eventRepository.insertEvent({
      type: 'edit',
      timestamp: now - 100000, // Very old
      file: '/test/file1.ts',
      language: 'typescript',
    });

    eventRepository.insertEvent({
      type: 'edit',
      timestamp: now - 50000, // Old
      file: '/test/file2.ts',
      language: 'typescript',
    });

    eventRepository.insertEvent({
      type: 'edit',
      timestamp: now, // Recent
      file: '/test/file3.ts',
      language: 'typescript',
    });

    // Delete events before cutoff
    const deleted = eventRepository.deleteEventsBefore(now - 60000);
    assert.strictEqual(deleted, 2, 'Should delete 2 old events');

    // Verify recent event still exists
    const remaining = eventRepository.getEventsToday();
    assert.strictEqual(remaining.length, 1, 'Should have 1 recent event');
  });
});
