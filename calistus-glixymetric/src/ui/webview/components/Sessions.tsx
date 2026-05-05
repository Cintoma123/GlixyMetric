import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatSeconds } from '../utils';
import {
  CHART_AXIS_COLOR,
  CHART_BAR_COLOR,
  CHART_GRID_COLOR,
  CHART_TOOLTIP_STYLE,
} from '../constants';

interface SessionsProps {
  sessions: number;
  avgSessionDuration: number;
  sessionsData: Array<{ duration?: number }>;
}

export const Sessions: React.FC<SessionsProps> = ({
  sessions,
  avgSessionDuration,
  sessionsData,
}) => {
  const chartData = sessionsData.slice(0, 5).map((session, idx) => ({
    name: `Session ${idx + 1}`,
    duration: Math.round((session.duration || 0) / 60),
  }));
  const longestSessionSeconds = sessionsData.reduce(
    (maxDuration, session) => Math.max(maxDuration, session.duration || 0),
    0
  );

  return (
    <section className="panel section sessions">
      <div className="section-head section-head-compact">
        <div>
          <span className="section-kicker">Flow</span>
          <h2>Sessions</h2>
        </div>
        <p>Frequency, duration, and recent streak quality.</p>
      </div>

      <div className="sessions-grid">
        <article className="session-info">
          <div className="session-stat">
            <span className="label">Sessions Today</span>
            <span className="value">{sessions}</span>
          </div>
        </article>

        <article className="session-info">
          <div className="session-stat">
            <span className="label">Avg Duration</span>
            <span className="value">{formatSeconds(avgSessionDuration)}</span>
          </div>
        </article>

        <article className="session-info">
          <div className="session-stat">
            <span className="label">Longest Session</span>
            <span className="value">{formatSeconds(longestSessionSeconds)}</span>
          </div>
        </article>
      </div>

      {chartData.length > 0 ? (
        <div className="chart-surface">
          <div className="chart-head">
            <div>
              <h3>Recent Session Durations</h3>
              <p>Minutes across your most recent tracked sessions.</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={chartData}>
              <CartesianGrid
                strokeDasharray="4 4"
                vertical={false}
                stroke={CHART_GRID_COLOR}
              />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                stroke={CHART_AXIS_COLOR}
                tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                stroke={CHART_AXIS_COLOR}
                tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(77, 215, 255, 0.06)' }}
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={{ color: '#E2E8F0', fontWeight: 600 }}
              />
              <Bar dataKey="duration" fill={CHART_BAR_COLOR} radius={[10, 10, 4, 4]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="chart-empty">
          Session visualizations will appear as soon as activity is recorded.
        </div>
      )}
    </section>
  );
};
