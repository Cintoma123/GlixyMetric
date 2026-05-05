import React, { useEffect, useState } from 'react';
import type { Stats } from './types';
import {
  formatClock,
  formatSeconds,
  formatUpdateDate,
  formatUpdateTime,
  getLanguagePreview,
  getProjectName,
  parseLanguages,
} from './utils';
import '../Dashboard.css';

function getGoalStatusMeta(goalStatus: string): { label: string; tone: string } {
  switch (goalStatus) {
    case 'on-track':
      return { label: 'On track', tone: 'success' };
    case 'almost':
      return { label: 'Almost there', tone: 'warning' };
    case 'behind':
      return { label: 'Needs attention', tone: 'danger' };
    default:
      return { label: 'No goals set', tone: 'neutral' };
  }
}

function getActivityCopy(stats: Stats): { status: string; headline: string; subline: string } {
  switch (stats.activityState) {
    case 'active':
      return {
        status: 'Active',
        headline: `Coding ${formatClock(stats.currentSessionSeconds)}`,
        subline: 'Live session is updating every second.',
      };
    case 'idle':
      return {
        status: 'Idle',
        headline: `Idle - Last session ${formatSeconds(stats.lastSessionDuration)}`,
        subline: 'Tracking is waiting for your next coding event.',
      };
    default:
      return {
        status: 'Not Started',
        headline: 'Start coding to begin tracking',
        subline: 'Your first edit or file switch will start a session.',
      };
  }
}

const App: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [showInsights, setShowInsights] = useState(false);

  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'statsUpdate') {
        setStats(message.data);
      }
    };

    window.addEventListener('message', messageHandler);

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  if (!stats) {
    return (
      <div className="dashboard dashboard-loading">
        <div className="loading-shell">
          <span className="loading-kicker">GlixyMetric</span>
          <h1 className="loading-title">Preparing your coding session</h1>
          <p className="loading-copy">
            Pulling live time, activity state, commits, and today&apos;s context.
          </p>
          <div className="loading-bars">
            <span className="loading-bar"></span>
            <span className="loading-bar loading-bar-delay"></span>
            <span className="loading-bar loading-bar-short"></span>
          </div>
        </div>
      </div>
    );
  }

  const goalMeta = getGoalStatusMeta(stats.goalStatus);
  const activityCopy = getActivityCopy(stats);
  const languagesData = parseLanguages(stats.languages);
  const sessionClock =
    stats.activityState === 'active'
      ? formatClock(stats.currentSessionSeconds)
      : stats.activityState === 'idle'
        ? formatClock(stats.lastSessionDuration)
        : '00:00:00';
  const contextItems = [
    {
      label: 'Status',
      value: activityCopy.status,
    },
    {
      label: 'Language',
      value:
        stats.currentLanguage && stats.currentLanguage !== 'No language'
          ? stats.currentLanguage
          : 'No active editor',
    },
    {
      label: 'Project',
      value: getProjectName(stats.activeProjectName),
    },
  ];
  const sessionBars = stats.sessionsData
    .filter((session) => (session.duration ?? 0) > 0)
    .slice(0, 5)
    .reverse();
  const maxSessionDuration = Math.max(
    ...sessionBars.map((session) => session.duration ?? 0),
    1
  );

  return (
    <div className={`dashboard activity-${stats.activityState}`}>
      <header className="hero-card">
        <div className="hero-topline">
          <span className="brand-mark">GlixyMetric</span>
          <span className={`status-pill status-pill-${goalMeta.tone}`}>
            {goalMeta.label}
          </span>
          <span className="update-pill">Updated {formatUpdateTime(stats.timestamp)}</span>
        </div>

        <div className="hero-session">
          <span className="hero-label">Coding Session</span>
          <div className="hero-timer-wrap">
            <div className="hero-timer">{sessionClock}</div>
            <span className="hero-pulse" aria-hidden="true"></span>
          </div>
          <h1 className="hero-headline">{activityCopy.headline}</h1>
          <p className="hero-subline">{activityCopy.subline}</p>
        </div>

        <div className="hero-summary">
          <div className="summary-chip">
            <span className="summary-label">Today</span>
            <strong className="summary-value">{formatSeconds(stats.dailyTotal)}</strong>
          </div>
          <div className="summary-chip">
            <span className="summary-label">Commits</span>
            <strong className="summary-value">{stats.commits}</strong>
          </div>
        </div>
      </header>

      <section className="context-strip panel-shell">
        {contextItems.map((item) => (
          <article key={item.label} className="context-item">
            <span className="context-label">{item.label}</span>
            <strong className="context-value">{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="metrics-grid">
        <article className="metric-card">
          <span className="metric-label">Sessions</span>
          <strong className="metric-value">{stats.sessions} sessions today</strong>
          <p className="metric-copy">
            Average session {formatSeconds(stats.avgSessionDuration)}.
          </p>
        </article>

        <article className="metric-card">
          <span className="metric-label">Languages</span>
          <strong className="metric-value">{getLanguagePreview(stats.languages)}</strong>
          <p className="metric-copy">
            Current focus{' '}
            {stats.currentLanguage && stats.currentLanguage !== 'No language'
              ? stats.currentLanguage
              : 'none'}
            .
          </p>
        </article>
      </section>

      <section className="insights-shell panel-shell">
        <button
          type="button"
          className="insights-toggle"
          onClick={() => setShowInsights((value) => !value)}
          aria-expanded={showInsights}
        >
          <span>
            <span className="insights-label">Optional Insights</span>
            <strong className="insights-title">Trends and progress</strong>
          </span>
          <span className="insights-action">{showInsights ? 'Hide' : 'Show'}</span>
        </button>

        {showInsights ? (
          <div className="insights-grid">
            <article className="insight-card">
              <div className="insight-head">
                <span className="insight-kicker">Goals</span>
                <span className={`status-pill status-pill-${goalMeta.tone}`}>
                  {goalMeta.label}
                </span>
              </div>

              {stats.goal ? (
                <div className="goal-stack">
                  {stats.goal.daily_hours ? (
                    <div className="goal-row">
                      <div className="goal-copy">
                        <strong>Hours</strong>
                        <span>
                          {formatSeconds(stats.codingTime)} / {stats.goal.daily_hours}h
                        </span>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(
                              (stats.codingTime / (stats.goal.daily_hours * 3600)) * 100,
                              100
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  ) : null}

                  {stats.goal.daily_commits ? (
                    <div className="goal-row">
                      <div className="goal-copy">
                        <strong>Commits</strong>
                        <span>
                          {stats.commits} / {stats.goal.daily_commits}
                        </span>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill progress-fill-warm"
                          style={{
                            width: `${Math.min(
                              (stats.commits / stats.goal.daily_commits) * 100,
                              100
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="empty-copy">
                  Set daily goals to add pacing signals to the dashboard.
                </p>
              )}
            </article>

            <article className="insight-card">
              <div className="insight-head">
                <span className="insight-kicker">Sessions</span>
                <span className="insight-note">Recent durations</span>
              </div>

              {sessionBars.length > 0 ? (
                <div className="mini-bars">
                  {sessionBars.map((session, index) => {
                    const duration = session.duration ?? 0;
                    return (
                      <div key={`${session.start_time}-${index}`} className="mini-bar-row">
                        <span className="mini-bar-label">S{index + 1}</span>
                        <div className="mini-bar-track">
                          <div
                            className="mini-bar-fill"
                            style={{
                              width: `${Math.max((duration / maxSessionDuration) * 100, 8)}%`,
                            }}
                          ></div>
                        </div>
                        <span className="mini-bar-value">{formatSeconds(duration)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-copy">Session trends appear after your first completed session.</p>
              )}
            </article>

            <article className="insight-card">
              <div className="insight-head">
                <span className="insight-kicker">Languages</span>
                <span className="insight-note">Today&apos;s mix</span>
              </div>

              {languagesData.length > 0 ? (
                <div className="language-stack">
                  {languagesData.map((language) => (
                    <div key={language.name} className="language-row">
                      <div className="language-copy">
                        <strong>{language.name}</strong>
                        <span>{language.value}% of tracked events</span>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${language.value}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-copy">Language distribution appears once activity is tracked.</p>
              )}
            </article>
          </div>
        ) : null}
      </section>

      <footer className="dashboard-footer">
        <div className="footer-copy">
          {formatUpdateDate(stats.timestamp)} at {formatUpdateTime(stats.timestamp)}
        </div>
      </footer>
    </div>
  );
};

export default App;
