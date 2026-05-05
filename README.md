# GlixyMetric

Automatic coding activity tracker for VS Code. Track your daily coding time, sessions, commits, and productivity metrics without manual time logging.

## Overview

GlixyMetric is a lightweight developer productivity extension that runs silently in the background, monitoring your coding activity in real-time. It tracks continuous coding sessions, accumulates daily time metrics, monitors git commits, and provides visual insights through an interactive dashboard—all stored locally with zero external connections.

## Features

- **Automatic Session Tracking**: Monitors continuous coding sessions with intelligent 5-minute idle detection
- **Daily Time Metrics**: Accumulates total coding time per day with automatic midnight reset
- **Git Integration**: Automatically captures commits from your workspace
- **Daily Goals**: Set and track daily targets for coding hours and commits
- **Break Reminders**: Notifies when you've coded continuously for 90+ minutes
- **Real-time Dashboard**: Interactive React-based interface showing stats, charts, sessions, and goals
- **Status Bar Widget**: Always-visible quick stats with live updates
- **Multi-Project Support**: Tracks activity across multiple workspace folders
- **Pause/Resume**: Temporarily pause tracking without losing session data
- **Privacy-First**: All data stored locally, no external services

## Installation

1. Install from the VS Code Extension Marketplace by searching for "GlixyMetric"
2. Or download the .vsix file and install manually via `Extensions: Install from VSIX`
3. Reload VS Code after installation

## Quick Start

1. Open the GlixyMetric dashboard by clicking the sidebar icon or running the "GlixyMetric: Open Dashboard" command
2. Set your daily goals using "GlixyMetric: Set Daily Goals" command
3. Start coding. GlixyMetric automatically begins tracking your activity
4. View real-time stats in the status bar or open the full dashboard anytime

## How Tracking Works

GlixyMetric monitors three core VS Code events to detect coding activity:

- File edits (when you change text)
- File switches (when you open or focus a different file)
- File saves (when you save changes)

When these events occur, a session begins. Sessions automatically close when:
- You've been idle in the editor for more than 5 minutes
- You switch to a different workspace folder

Daily time is tracked separately and continuously, resetting at midnight. Git commits are captured automatically once per minute if new commits exist since midnight.

## Status Bar

The status bar displays four key pieces of information (right side):

- **Clock icon + time**: Duration of your current active session
- **Flame icon + number**: Total commits made today
- **Goal emoji**: Status indicator (green = on track, yellow = nearly there, red = behind)

Click the status bar to open the full dashboard.

## Commands

Run any command with Ctrl+Shift+P (Windows/Linux) or Cmd+Shift+P (macOS):

| Command | Function |
|---------|----------|
| GlixyMetric: Open Dashboard | Open the main dashboard in a panel |
| GlixyMetric: Open Dashboard Sidebar | Open dashboard in the Activity Bar sidebar |
| GlixyMetric: View Today Stats | Quick notification with today's stats |
| GlixyMetric: Set Daily Goals | Configure daily hour and commit targets |
| GlixyMetric: Clear Daily Goals | Reset goals for today |
| GlixyMetric: Pause/Resume Tracking | Temporarily pause tracking on/off |

## Dashboard Components

The dashboard displays four main sections:

**Today Stats**: Key metrics grid showing:
- Coding Time: Time spent with active editor focus
- Daily Total: Cumulative time tracked today
- Commits: Git commits authored today
- Current Session: Duration of ongoing session

**Sessions**: Chronological list of today's coding sessions with:
- Session duration
- Project path
- Start and end times
- Pause status

**Goals**: Progress toward daily targets with:
- Hours target and current progress
- Commits target and current progress
- Status indicators showing if you're on track

**Charts**: Visual data breakdown including:
- Language distribution (pie chart)
- Session duration patterns (bar chart)
- Time allocation per project

## Extension Behavior

**On Startup**:
GlixyMetric activates automatically when VS Code starts (no configuration needed). The first time you use it, a welcome notification guides you to open the dashboard.

**Tracking Behavior**:
- Sessions start with the first code change, file switch, or save event
- Sessions persist while you actively code
- Idle threshold is 5 minutes of inactivity
- Daily timer never pauses and resets at midnight UTC
- Break reminders trigger after 90 continuous minutes of coding

**Data Persistence**:
All data persists across VS Code restarts and sessions. Data is stored in a local SQLite database in your workspace storage directory.

## Privacy

GlixyMetric stores all data locally on your machine. No information is transmitted to external services. No analytics, no tracking, no cloud storage. Your data remains entirely under your control.

Database location: `~/.config/Code/User/workspaceStorage/[workspace-id]/calistus-glixymetric.db`

## Known Limitations

- Idle detection only works when VS Code is the active window (minimization may pause tracking)
- Git integration requires git to be in your system PATH
- Git commits are scanned once per minute for performance
- Multi-folder workspaces track each folder separately

## Troubleshooting

**Dashboard not updating**:
- Try reloading the dashboard panel
- Close and reopen VS Code

**Commits not showing**:
- Ensure git is installed and accessible in your PATH
- Verify the git repository is properly initialized in your workspace

**Tracking paused unexpectedly**:
- Check if you've used "Pause/Resume Tracking" command
- Sessions auto-close after 5 minutes of inactivity

## Roadmap

- Keyboard shortcuts for frequently-used commands
- Export daily reports as PDF or CSV
- Weekly and monthly analytics views
- Customizable idle timeout and break reminder thresholds
- Dark mode for dashboard
- Time distribution by language and file type

## Release Notes

### 0.0.1
Initial release with core features: session tracking, daily metrics, git integration, goals, and interactive dashboard.

## Support

For issues, feature requests, or feedback, visit the project repository.
