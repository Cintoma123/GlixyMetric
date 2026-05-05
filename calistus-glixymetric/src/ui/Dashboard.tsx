import React, { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

interface Stats {
  codingTime: number;
  dailyTotal: number;
  commits: number;
  sessions: number;
  avgSessionDuration: number;
  currentSessionDuration: string;
  languages: string;
  goalStatus: string;
  goal: { daily_hours?: number; daily_commits?: number } | null;
  sessionsData: any[];
  timestamp: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Detect system theme
    const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkMediaQuery.matches);

    const themeChangeHandler = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    darkMediaQuery.addEventListener('change', themeChangeHandler);

    // Listen for stats updates from extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'statsUpdate') {
        setStats(message.data);
      }
    };

    window.addEventListener('message', messageHandler);

    return () => {
      darkMediaQuery.removeEventListener('change', themeChangeHandler);
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  if (!stats) {
    return <div className="dashboard loading">Loading stats...</div>;
  }

  /**
   * Format seconds to human-readable string
   * 
   * FORMAT RULES:
   * - Prevents negative values using Math.max(0, ...)
   * - < 1 hour → mm:ss (e.g., "45:30")
   * - ≥ 1 hour → hh:mm:ss (e.g., "1:30:45")
   */
  const formatSeconds = (seconds: number): string => {
    // FIX: Prevent negative values from showing
    const safeSeconds = Math.max(0, Math.floor(seconds));
    
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const secs = safeSeconds % 60;
    
    if (hours > 0) {
      // Format: hh:mm:ss
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    // Format: mm:ss
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  // Parse languages data for pie chart
  const parseLanguages = (langStr: string): { name: string; value: number }[] => {
    if (!langStr) return [];
    return langStr.split(', ').map((lang) => {
      const [name, percent] = lang.split(' (');
      return {
        name: name.trim(),
        value: parseInt(percent?.replace('%', '') || '0'),
      };
    });
  };

  // Prepare bar chart data for sessions
  const sessionsChartData = stats.sessionsData.slice(0, 5).map((session, idx) => ({
    name: `Session ${idx + 1}`,
    duration: Math.round((session.duration || 0) / 60), // Convert to minutes
  }));

  const languagesData = parseLanguages(stats.languages);
  const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];

  return (
    <div className={`dashboard ${isDarkMode ? 'dark' : 'light'}`}>
      {/* Section 1: Today's Stats */}
      <section className="section today-stats">
        <h2>TODAY</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Coding Time</div>
            <div className="stat-value">{formatSeconds(stats.codingTime)}</div>
            <div className="stat-detail">Session Time</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Daily Total</div>
            <div className="stat-value">{formatSeconds(stats.dailyTotal)}</div>
            <div className="stat-detail">Never Pauses</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Commits</div>
            <div className="stat-value">{stats.commits}</div>
            <div className="stat-detail">Made Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Current Session</div>
            <div className="stat-value">{stats.currentSessionDuration}</div>
            <div className="stat-detail">Active Time</div>
          </div>
        </div>
      </section>

      {/* Section 2: Sessions */}
      <section className="section sessions">
        <h2>SESSIONS</h2>
        <div className="sessions-grid">
          <div className="session-info">
            <div className="session-stat">
              <span className="label">Sessions Today</span>
              <span className="value">{stats.sessions}</span>
            </div>
          </div>
          <div className="session-info">
            <div className="session-stat">
              <span className="label">Avg Duration</span>
              <span className="value">{formatSeconds(stats.avgSessionDuration)}</span>
            </div>
          </div>
        </div>

        {sessionsChartData.length > 0 && (
          <div className="chart-container">
            <h3>Session Durations</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sessionsChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="duration" fill="#45B7D1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Section 3: Goals */}
      <section className="section goals">
        <h2>GOALS</h2>
        {stats.goal ? (
          <div className="goals-container">
            {stats.goal.daily_hours && (
              <div className="goal-item">
                <div className="goal-label">Daily Hours Target</div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min((stats.codingTime / (stats.goal.daily_hours * 3600)) * 100, 100)}%`,
                    }}
                  ></div>
                </div>
                <div className="goal-detail">
                  {formatSeconds(stats.codingTime)} / {stats.goal.daily_hours}h
                </div>
              </div>
            )}
            {stats.goal.daily_commits && (
              <div className="goal-item">
                <div className="goal-label">Daily Commits Target</div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min((stats.commits / stats.goal.daily_commits) * 100, 100)}%`,
                    }}
                  ></div>
                </div>
                <div className="goal-detail">
                  {stats.commits} / {stats.goal.daily_commits}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="no-goals">No goals set yet. Use 'Set Daily Goals' command to get started!</div>
        )}
      </section>

      {/* Section 4: Charts */}
      <section className="section charts">
        <h2>LANGUAGES</h2>
        {languagesData.length > 0 ? (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={languagesData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name} ${value}%`}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {languagesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="no-data">No language data yet. Start coding to see stats!</div>
        )}
      </section>

      {/* Footer */}
      <footer className="dashboard-footer">
        <div className="last-update">Last updated: {new Date(stats.timestamp).toLocaleTimeString()}</div>
      </footer>
    </div>
  );
};

export default Dashboard;
