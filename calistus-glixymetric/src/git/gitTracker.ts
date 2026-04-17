import * as vscode from 'vscode';
import { execSync } from 'child_process';
import { insertCommit } from '../storage/repositories/commitRepository';

/**
 * Git Tracker - Tracks commits via git log
 * 
 * CORE RULES (from vs-ex.md - STRICTLY ENFORCED):
 * 1. Use: git log --since=midnight
 * 2. Track: commits today, commit timestamps
 * 3. Extract: hash, message, timestamp
 * 4. Multi-project: Iterate workspace folders
 * 
 * DO NOT build:
 *   - commit/session correlation ❌
 *   - line-to-commit ratio ❌
 *   - co-author detection ❌
 */

/**
 * Initialize git tracker
 * Scans all workspace folders for commits made today
 */
export async function initializeGitTracker(): Promise<void> {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.log('No workspace folders found. Git tracking skipped.');
      return;
    }

    console.log(`Git Tracker: Scanning ${workspaceFolders.length} workspace folder(s)`);

    // Scan each workspace folder for commits today
    for (const folder of workspaceFolders) {
      await trackCommitsInRepository(folder.uri.fsPath);
    }

    console.log('Git Tracker: Initial scan complete');
  } catch (error) {
    console.error('Failed to initialize git tracker:', error);
  }
}

/**
 * Track commits for a specific repository (today only)
 * 
 * RULE: Execute: git log --since=midnight
 * 
 * @param repoPath - Path to repository
 */
export async function trackCommitsInRepository(repoPath: string): Promise<void> {
  try {
    // Check if this is a git repository
    if (!isGitRepository(repoPath)) {
      return;
    }

    console.log(`Git Tracker: Scanning repository: ${repoPath}`);

    // RULE: Execute git log with --since=midnight filter
    const gitCommand = `git -C "${repoPath}" log --since=midnight --format=%H%n%s%n%ct%n--END--`;
    
    const output = executeGitCommand(gitCommand);
    
    if (!output) {
      console.log(`Git Tracker: No commits found in ${repoPath} today`);
      return;
    }

    // Parse git log output
    const commits = parseGitLog(output, repoPath);

    // Store commits in database
    for (const commit of commits) {
      try {
        insertCommit(commit);
      } catch (error) {
        console.error(`Failed to insert commit ${commit.hash}:`, error);
      }
    }

    console.log(`Git Tracker: Stored ${commits.length} commits from ${repoPath}`);
  } catch (error) {
    // If it's not a git repo or git command fails, silently skip
    // This prevents errors in non-git folders
  }
}

/**
 * Check if a path is a git repository
 * 
 * @param repoPath - Path to check
 * @returns true if git repo
 */
function isGitRepository(repoPath: string): boolean {
  try {
    executeGitCommand(`git -C "${repoPath}" rev-parse --git-dir`);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Execute git command synchronously
 * 
 * Uses execSync for blocking execution (simpler, suitable for local operations)
 * 
 * @param command - Git command to execute
 * @returns Command output
 */
function executeGitCommand(command: string): string {
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large repos
    });
    return output.trim();
  } catch (error) {
    // Git command failed (no commits, not a repo, etc.)
    return '';
  }
}

/**
 * Parse git log output
 * 
 * Format:
 *   %H = hash
 *   %s = subject (message)
 *   %ct = commit timestamp (unix seconds)
 *   --END-- = delimiter
 * 
 * @param output - Raw git log output
 * @param repoPath - Repository path
 * @returns Array of parsed commits
 */
function parseGitLog(output: string, repoPath: string): Array<{
  hash: string;
  message: string;
  timestamp: number;
  repo_path: string;
}> {
  const commits = [];
  
  // Split by delimiter
  const entries = output.split('--END--').map(e => e.trim()).filter(e => e);

  for (let i = 0; i < entries.length; i += 3) {
    const hash = entries[i];
    const message = entries[i + 1];
    const timestamp = parseInt(entries[i + 2], 10);

    // Validate parsed data
    if (!hash || !message || isNaN(timestamp)) {
      console.warn(`Git Tracker: Invalid commit entry - hash: ${hash}, message: ${message}, timestamp: ${timestamp}`);
      continue;
    }

    commits.push({
      hash: hash.trim(),
      message: message.trim(),
      timestamp: timestamp,
      repo_path: repoPath,
    });
  }

  return commits;
}

/**
 * Re-scan repositories for new commits (call periodically or on user action)
 * 
 * Useful for long-running extension to capture new commits throughout the day
 */
export async function rescanRepositories(): Promise<void> {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    for (const folder of workspaceFolders) {
      await trackCommitsInRepository(folder.uri.fsPath);
    }

    console.log('Git Tracker: Rescan complete');
  } catch (error) {
    console.error('Failed to rescan repositories:', error);
  }
}
