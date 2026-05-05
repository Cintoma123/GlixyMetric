// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import { registerDashboardWebviewProvider, type DashboardWebviewController } from './ui/webviewProvider';

let eventTrackerDisposables: vscode.Disposable[] = [];

/**
 * Extension activation - Initialize GlixyMetric
 * 
 * Runs once when extension first activates
 * Auto-starts when VS Code finishes loading (via onStartupFinished)
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('$(check) GlixyMetric extension activated');

	const dashboardController = registerDashboardWebviewProvider(context);
	registerCommands(context, dashboardController);

	// Show loading indicator immediately
	vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Window,
			title: 'GlixyMetric',
			cancellable: false,
		},
		async (progress) => {
			progress.report({ message: 'Loading extension...' });

			// Initialize everything else in background (non-blocking)
			await initializeAsync(context).catch(err => {
				console.error('Async init failed:', err);
				vscode.window.showErrorMessage(`[ERROR] GlixyMetric initialization failed: ${err.message}`);
			});

			progress.report({ message: 'Ready!' });
		}
	);

		// Show welcome notification after a brief delay to avoid notification spam
		setTimeout(() => {
			vscode.window.showInformationMessage(
				'GlixyMetric started! Auto-tracking is active.',
				'Open Dashboard'
		).then((selection) => {
			if (selection === 'Open Dashboard') {
				vscode.commands.executeCommand('calistus-glixymetric.openDashboard');
			}
		});
	}, 1500);

	return { dispose: () => { } };
}

function registerCommands(
	context: vscode.ExtensionContext,
	dashboardController: DashboardWebviewController
): void {
	// Register test command (immediate, no dependencies)
	const testCommand = vscode.commands.registerCommand(
		'calistus-glixymetric.testTracking',
		() => {
			vscode.window.showInformationMessage('[INFO] GlixyMetric is running!');
		}
	);
	context.subscriptions.push(testCommand);

	// Register dashboard panel command (primary dashboard entry point)
	const dashboardCmd = vscode.commands.registerCommand(
		'calistus-glixymetric.openDashboard',
		() => {
			dashboardController.showPanel();
		}
	);
	context.subscriptions.push(dashboardCmd);

	// Register sidebar command (optional Activity Bar view)
	const sidebarCmd = vscode.commands.registerCommand(
		'calistus-glixymetric.openSidebar',
		async () => {
			await dashboardController.showSidebar();
		}
	);
	context.subscriptions.push(sidebarCmd);

	// Register view stats command (using proper goals feature)
	const statsCmd = vscode.commands.registerCommand(
		'calistus-glixymetric.viewTodayStats',
		async () => {
			const { showGoalsStatus } = await import('./features/goals.js');
			await showGoalsStatus();
		}
	);
	context.subscriptions.push(statsCmd);

	// Register set goals command (using proper goals feature)
	const goalsCmd = vscode.commands.registerCommand(
		'calistus-glixymetric.setDailyGoals',
		async () => {
			const { showSetGoalsUI } = await import('./features/goals.js');
			await showSetGoalsUI();
		}
	);
	context.subscriptions.push(goalsCmd);

	// Register clear goals command
	const clearGoalsCmd = vscode.commands.registerCommand(
		'calistus-glixymetric.clearDailyGoals',
		async () => {
			const { clearGoals } = await import('./features/goals.js');
			await clearGoals();
		}
	);
	context.subscriptions.push(clearGoalsCmd);

	// Register pause tracking command
	const pauseCmd = vscode.commands.registerCommand(
		'calistus-glixymetric.pauseTracking',
		async () => {
			const { toggleTrackingPause } = await import('./tracker/eventTracker.js');
			const { forceUpdateStatusBar } = await import('./ui/statusBar.js');
			const result = toggleTrackingPause(eventTrackerDisposables);
			
			// Update disposables reference if new ones were returned (on resume)
			if (result.newDisposables) {
				eventTrackerDisposables = result.newDisposables;
			}
			
			forceUpdateStatusBar();
			const status = result.isPaused ? '[WARNING] Tracking Paused' : '[INFO] Tracking Resumed';
			vscode.window.showInformationMessage(`${status}`);
		}
	);
	context.subscriptions.push(pauseCmd);
}

/**
 * Non-blocking async initialization
 */
async function initializeAsync(context: vscode.ExtensionContext) {
	try {
		// Lazy import heavy modules only when needed
		const { initializeDatabase, closeDatabase } = await import('./storage/db.js');
		const { createStatusBar, disposeStatusBar } = await import('./ui/statusBar.js');
		const { initializeSessionManager, closeCurrentSession, pauseSessionTracking, resumeSessionTracking, updateActivity, scheduleMidnightSessionReset } = await import('./tracker/sessionManager.js');
		const { startEventTracking, stopEventTracking, isTrackingCurrentlyPaused } = await import('./tracker/eventTracker.js');
		const { initializeGitTracker } = await import('./git/gitTracker.js');
		const { initializeDailyTimeTracker, disposeDailyTimeTracker, recordDailyActivity } = await import('./tracker/dailyTimeTracker.js');

		console.log('Starting background initialization...');

		// Initialize database
		const storagePath = context.globalStorageUri.fsPath;
		await initializeDatabase(storagePath);
		console.log('$(check) Database initialized');

		// Initialize session manager
		initializeSessionManager();
		console.log('$(check) Session manager initialized');

		// IMMEDIATELY CREATE SESSION when VS Code opens (don't wait for user action)
		// This ensures session counting starts right away
		const initialWorkspace = vscode.workspace.workspaceFolders?.[0];
		if (initialWorkspace) {
			updateActivity(initialWorkspace.uri.fsPath);
			console.log('[GlixyMetric] ✓ Initial session created - session timer started immediately');
		} else {
			console.log('[GlixyMetric] ⚠ No workspace folder found - session will start on first activity');
		}
		
		// Also record daily activity immediately to kick off the daily timer
		recordDailyActivity();
		console.log('[GlixyMetric] ✓ Daily activity tracking started');

		// Schedule midnight session reset to close sessions from previous day
		scheduleMidnightSessionReset();
		console.log('$(check) Midnight session reset scheduler activated');

		// Initialize daily time tracker (tracks total time, never pauses)
		initializeDailyTimeTracker();
		console.log('$(check) Daily time tracker initialized');

		// Initialize git tracker (scan for commits today)
		await initializeGitTracker();
		console.log('$(check) Git tracker initialized');

		// Create status bar
		createStatusBar();
		console.log('$(check) Status bar created');

		console.log('$(check) All commands registered');

		// Start event tracking
		eventTrackerDisposables = startEventTracking();
		console.log('$(check) Event tracking started');

		// ===== WORKSPACE SWITCHING DETECTION =====
		// Pause session timer when switching away from current workspace
		const workspaceChangeListener = vscode.workspace.onDidChangeWorkspaceFolders((e) => {
			console.log('Workspace change detected');
			
			// When workspace folders are removed (switched away)
			if (e.removed.length > 0) {
				pauseSessionTracking();
				console.log('Session paused due to workspace switch away');
			}
			
			// When workspace folders are added (switched back)
			if (e.added.length > 0) {
				// If the user manually paused tracking, do not auto-resume on workspace switches.
				if (!isTrackingCurrentlyPaused()) {
					resumeSessionTracking();
					console.log('Session resumed due to workspace switch back');
					recordDailyActivity(); // Record activity on resuming
				} else {
					console.log('Tracking is manually paused; skipping auto-resume on workspace switch');
				}
			}
		});
		context.subscriptions.push(workspaceChangeListener);

		// ===== TRIGGER #1: VS CODE WINDOW FOCUS =====
		// When window regains focus, update activity to keep session alive
		const windowFocusListener = vscode.window.onDidChangeWindowState((e) => {
			if (e.focused) {
				console.log('VS Code window focused - session continues');
				recordDailyActivity(); // Update daily time
				
				// Update session activity to indicate user is back
				const currentWorkspace = vscode.workspace.workspaceFolders?.[0];
				if (currentWorkspace) {
					updateActivity(currentWorkspace.uri.fsPath);
					console.log('Session activity updated on window focus');
				}
			}
		});
		context.subscriptions.push(windowFocusListener);

		// Add cleanup
		context.subscriptions.push({
			dispose: () => {
				stopEventTracking(eventTrackerDisposables);
				closeCurrentSession();
				disposeDailyTimeTracker();
				closeDatabase();
			}
		});

	} catch (error) {
		console.error('Background init error:', error);
	}
}

/**
 * Extension deactivation - Cleanup
 */
export function deactivate() {
	console.log('GlixyMetric extension deactivating - closing all sessions and resources');
	
	// Cleanup disposables will be called automatically by VS Code
	// This ensures all subscriptions are disposed properly
	// Including stopEventTracking, closeCurrentSession, disposeDailyTimeTracker, closeDatabase
	
	// If manual cleanup is needed, it's handled by the context.subscriptions cleanup
}
