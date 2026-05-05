import * as vscode from 'vscode';
import {
  getTodayGoalTarget,
  getHoursProgress,
  getCommitsProgress,
  getTodayGoalStatus,
  getTodayGoalStatusEmoji,
} from '../services/statsService';
import { upsertGoalForDate, getTodayGoal } from '../storage/repositories/goalsRepository';

/**
 * Goals Feature - Manages daily goals functionality
 * 
 * Per vs-ex.md Section 7:
 * - User sets: dailyHours and dailyCommits
 * - Track progress: hours completed, commits completed
 * - Status Bar Indicator: 🟢 On track | 🟡 Almost | 🔴 Behind
 */

/**
 * Show input UI to set daily goals
 * Called from command palette: "GlixyMetric: Set Daily Goals"
 */
export async function showSetGoalsUI(): Promise<void> {
  try {
    // Get existing goals to pre-fill
    const existingGoal = getTodayGoal();
    const defaultHours = existingGoal?.daily_hours?.toString() || '4';
    const defaultCommits = existingGoal?.daily_commits?.toString() || '2';

    // Step 1: Ask for daily hours goal
    const hoursInput = await vscode.window.showInputBox({
      prompt: 'Set your daily coding hours target',
      placeHolder: 'e.g., 4',
      value: defaultHours,
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num <= 0) {
          return 'Please enter a positive number';
        }
        if (num > 24) {
          return 'Please enter a value between 1 and 24';
        }
        return null;
      },
    });

    // User cancelled
    if (hoursInput === undefined) {
      return;
    }

    const dailyHours = parseInt(hoursInput);

    // Step 2: Ask for daily commits goal
    const commitsInput = await vscode.window.showInputBox({
      prompt: 'Set your daily commits target',
      placeHolder: 'e.g., 2',
      value: defaultCommits,
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 0) {
          return 'Please enter a non-negative number';
        }
        if (num > 100) {
          return 'Please enter a value between 0 and 100';
        }
        return null;
      },
    });

    // User cancelled
    if (commitsInput === undefined) {
      return;
    }

    const dailyCommits = parseInt(commitsInput);

    // Calculate start of today (midnight) in local timezone
    const now = Math.floor(Date.now() / 1000);
    const timezoneOffset = new Date().getTimezoneOffset() * 60;
    const startOfDay = now - ((now + timezoneOffset) % 86400);

    // Save goals to database
    upsertGoalForDate({
      date: startOfDay,
      daily_hours: dailyHours,
      daily_commits: dailyCommits,
    });

    // Show success message with summary
    let message = `Daily goals set: ${dailyHours}h coding`;
    if (dailyCommits > 0) {
      message += `, ${dailyCommits} commits`;
    }

    vscode.window.showInformationMessage(message, 'View Progress').then((selection) => {
      if (selection === 'View Progress') {
        vscode.commands.executeCommand('calistus-glixymetric.openDashboard');
      }
    });

    // Force update status bar to show new goal status
    const { forceUpdateStatusBar } = require('../ui/statusBar');
    forceUpdateStatusBar();

    console.log(`[Goals] Daily goals set: ${dailyHours}h, ${dailyCommits} commits`);
  } catch (error) {
    console.error('Failed to set goals:', error);
    vscode.window.showErrorMessage('Failed to set daily goals');
  }
}

/**
 * Clear today's goals
 * Called from command palette: "GlixyMetric: Clear Daily Goals"
 */
export async function clearGoals(): Promise<void> {
  try {
    const { deleteGoalByDate } = await import('../storage/repositories/goalsRepository.js');

    const now = Math.floor(Date.now() / 1000);
    const timezoneOffset = new Date().getTimezoneOffset() * 60;
    const startOfDay = now - ((now + timezoneOffset) % 86400);

    deleteGoalByDate(startOfDay);

    vscode.window.showInformationMessage('Daily goals cleared');

    // Force update status bar
    const { forceUpdateStatusBar } = require('../ui/statusBar');
    forceUpdateStatusBar();

    console.log('[Goals] Daily goals cleared');
  } catch (error) {
    console.error('Failed to clear goals:', error);
    vscode.window.showErrorMessage('Failed to clear daily goals');
  }
}

/**
 * Show current goals status
 * Called from command palette: "GlixyMetric: View Today Stats"
 */
export async function showGoalsStatus(): Promise<void> {
  try {
    const goal = getTodayGoalTarget();

    if (!goal) {
      vscode.window.showInformationMessage(
        'No daily goals set. Use "Set Daily Goals" command to get started!'
      );
      return;
    }

    const hoursProgress = getHoursProgress();
    const commitsProgress = getCommitsProgress();
    const status = getTodayGoalStatus();
    const statusEmoji = getTodayGoalStatusEmoji();

    let message = '📊 Today\'s Goals Status:\n\n';

    if (hoursProgress) {
      message += `⏱ Hours: ${hoursProgress.actual}h / ${hoursProgress.target}h (${Math.round(hoursProgress.percentage)}%)\n`;
    }

    if (commitsProgress) {
      message += `🔥 Commits: ${commitsProgress.actual} / ${commitsProgress.target} (${Math.round(commitsProgress.percentage)}%)\n`;
    }

    message += `\nStatus: ${statusEmoji} ${status ?? 'No goals'}`;

    vscode.window.showInformationMessage(message, 'Open Dashboard').then((selection) => {
      if (selection === 'Open Dashboard') {
        vscode.commands.executeCommand('calistus-glixymetric.openDashboard');
      }
    });
  } catch (error) {
    console.error('Failed to show goals status:', error);
    vscode.window.showErrorMessage('Failed to show goals status');
  }
}

/**
 * Get goals progress summary for dashboard
 * Returns formatted data for the React dashboard
 */
export function getGoalsProgressSummary() {
  const goal = getTodayGoalTarget();

  if (!goal) {
    return null;
  }

  const hoursProgress = getHoursProgress();
  const commitsProgress = getCommitsProgress();
  const status = getTodayGoalStatus();

  return {
    goal,
    hours: hoursProgress,
    commits: commitsProgress,
    status,
  };
}