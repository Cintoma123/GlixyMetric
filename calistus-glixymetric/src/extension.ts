// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import * as path from 'path';
import { initializeDatabase, closeDatabase } from './storage/db';
import { startEventTracking, stopEventTracking } from './tracker/eventTracker';
import { initializeSessionManager, closeCurrentSession } from './tracker/sessionManager';
import { initializeGitTracker } from './git/gitTracker';

let eventTrackerDisposables: vscode.Disposable[] = [];

/**
 * Extension activation - Initialize GlixyMetric
 * 
 * Runs once when extension first activates
 * Initializes database, session manager, git tracker, and starts event tracking
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('GlixyMetric extension is now active');

	try {
		// Initialize SQLite database
		const storagePath = context.globalStorageUri.fsPath;
		initializeDatabase(storagePath);
		console.log('Database initialized');

		// Initialize session manager (Smart Time Tracking)
		initializeSessionManager();
		console.log('Session manager initialized');

		// Initialize git tracker (Commit tracking)
		initializeGitTracker().catch(error => {
			console.error('Git tracker initialization failed:', error);
		});
		console.log('Git tracker initialized');

		// Start event tracking
		eventTrackerDisposables = startEventTracking();
		console.log('Event tracking started');

		// Register test command
		const testCommand = vscode.commands.registerCommand(
			'calistus-glixymetric.testTracking',
			async () => {
				vscode.window.showInformationMessage('GlixyMetric is tracking your activity');
			}
		);

		context.subscriptions.push(testCommand);
		context.subscriptions.push({
			dispose: () => {
				stopEventTracking(eventTrackerDisposables);
			}
		});

	} catch (error) {
		console.error('Failed to activate GlixyMetric:', error);
		vscode.window.showErrorMessage('GlixyMetric: Failed to initialize. Check console for details.');
	}
}

/**
 * Extension deactivation - Cleanup
 * 
 * Runs when extension is deactivated
 * Closes current session, stops event tracking, and closes database
 */
export function deactivate() {
	console.log('GlixyMetric extension is deactivating');
	
	try {
		// Close any active session
		closeCurrentSession();
		console.log('Active session closed');

		// Stop event tracking
		stopEventTracking(eventTrackerDisposables);
		console.log('Event tracking stopped');

		// Close database connection
		closeDatabase();
		console.log('Database closed');
	} catch (error) {
		console.error('Error during deactivation:', error);
	}
}
