import React from 'react';
import { formatSeconds } from '../utils';

interface TodayStatsProps {
  codingTime: number;
  dailyTotal: number;
  commits: number;
  currentSessionDuration: string;
}

export const TodayStats: React.FC<TodayStatsProps> = ({
  codingTime,
  dailyTotal,
  commits,
  currentSessionDuration,
}) => {
  const metrics = [
    {
      label: 'Coding Time',
      value: formatSeconds(codingTime),
      detail: 'Focused editor time',
      tone: 'cyan',
    },
    {
      label: 'Daily Total',
      value: formatSeconds(dailyTotal),
      detail: 'All tracked time',
      tone: 'emerald',
    },
    {
      label: 'Commits',
      value: String(commits),
      detail: 'Source control output',
      tone: 'amber',
    },
    {
      label: 'Current Session',
      value: currentSessionDuration,
      detail: 'Live activity streak',
      tone: 'rose',
    },
  ];

  return (
    <section className="panel section today-stats">
      <div className="section-head section-head-compact">
        <div>
          <span className="section-kicker">Today</span>
          <h2>Key Metrics</h2>
        </div>
        <p>Compact operational KPIs for the current workday.</p>
      </div>

      <div className="stats-grid">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className={`stat-card stat-card-${metric.tone}`}
          >
            <div className="stat-label">{metric.label}</div>
            <div className="stat-value">{metric.value}</div>
            <div className="stat-detail">{metric.detail}</div>
          </article>
        ))}
      </div>
    </section>
  );
};
