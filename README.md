# GlixyMetric

GlixyMetric is Visual Studio Code extension for tracking real coding activity, sessions, and development patterns in real time. It provides a clean, focused dashboard and status bar insights to help you understand how you spend time while coding—without external services or cloud dependencies.

---

## Overview

GlixyMetric automatically tracks your coding activity based on editor events and session behavior. It measures active coding time, detects idle periods, and aggregates useful insights such as daily totals, session durations, language usage, and commit activity.

All data is stored locally. No internet connection or external API is required.

---

## Features

- Real-time session tracking
- Automatic idle detection
- Daily coding time aggregation
- Status bar live timer
- Lightweight dashboard view
- Language usage tracking
- Git commit tracking (local repositories)
- Pause and resume tracking
- Local data storage (no external services)

---

## Installation

1. Open Visual Studio Code
2. Go to Extensions
3. Search for "GlixyMetric"
4. Click Install

Alternatively, install from the marketplace page.

---

## Usage

### Automatic Tracking

GlixyMetric starts automatically when Visual Studio Code is opened.

It listens to editor activity such as:
- opening files
- editing code
- switching between files

Tracking is based on real interaction, not just open time.

---

### Session Tracking

A session represents continuous coding activity.

- A new session starts when you begin interacting with the editor
- A session ends after a period of inactivity (idle threshold)

---

### Status Bar

The status bar displays:

- current session time (live)
- total time spent today
- commit count (if available)

Clicking the status bar opens the dashboard.

---

### Dashboard

The dashboard provides:

- live session timer
- total coding time for the day
- commit count
- current language
- session insights

The layout is designed for clarity and quick understanding.

---

### Pause and Resume

You can pause tracking manually:

- Pausing ends the current session
- No new activity is recorded while paused
- Resume starts a new session

---

### Git Integration

GlixyMetric reads local Git data to provide:

- commits per day
- commit timestamps
- simple correlation with coding sessions

No remote repositories are accessed.

---

## Commands

The extension provides the following commands:

- GlixyMetric: Open Dashboard
- GlixyMetric: Pause Tracking
- GlixyMetric: Resume Tracking

Access commands via the Command Palette.

---

## Data Storage

All data is stored locally on your machine.

Typical storage includes:

- session timestamps
- activity events
- language usage
- commit metadata

No data is sent outside your system.

---

## Privacy

GlixyMetric is fully offline.

- No data collection
- No analytics tracking
- No external API calls
- No user accounts

Your data remains on your machine at all times.

---

## Configuration

You may configure:

- idle timeout duration
- excluded files or folders
- tracking behavior

Configuration is done through VS Code settings.

---

## Limitations

- Works only with local activity (no cross-device sync)
- Git tracking depends on local repositories
- Accuracy depends on editor interaction events

---

## Roadmap

- improved session visualization
- enhanced language insights
- exportable activity summaries
- better UI customization

---

## Contributing

Contributions, issues, and suggestions are welcome.

Please open an issue or submit a pull request on the project repository.

---

## License

Specify your license here.
