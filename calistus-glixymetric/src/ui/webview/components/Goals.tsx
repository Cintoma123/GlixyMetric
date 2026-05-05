import React from 'react';
import { formatSeconds } from '../utils';
import type { Goal } from '../types';

interface GoalsProps {
  codingTime: number;
  commits: number;
  goal: Goal | null;
}

export const Goals: React.FC<GoalsProps> = ({ codingTime, commits, goal }) => {
  const goalCards: Array<{
    label: string;
    target: string;
    detail: string;
    progress: number;
    tone: string;
  }> = [];

  if (goal?.daily_hours) {
    const hoursProgress = Math.min(
      (codingTime / (goal.daily_hours * 3600)) * 100,
      100
    );

    goalCards.push({
      label: 'Daily Hours',
      target: `${goal.daily_hours}h target`,
      detail: `${formatSeconds(codingTime)} logged`,
      progress: hoursProgress,
      tone: 'cyan',
    });
  }

  if (goal?.daily_commits) {
    const commitsProgress = Math.min(
      (commits / goal.daily_commits) * 100,
      100
    );

    goalCards.push({
      label: 'Daily Commits',
      target: `${goal.daily_commits} commits target`,
      detail: `${commits} commits recorded`,
      progress: commitsProgress,
      tone: 'amber',
    });
  }

  return (
    <section className="panel section goals">
      <div className="section-head section-head-compact">
        <div>
          <span className="section-kicker">Targets</span>
          <h2>Goals</h2>
        </div>
        <p>Progress versus the targets set for today.</p>
      </div>

      {goalCards.length > 0 ? (
        <div className="goals-container">
          {goalCards.map((goalCard) => (
            <article
              key={goalCard.label}
              className={`goal-card goal-card-${goalCard.tone}`}
            >
              <div className="goal-card-header">
                <div>
                  <div className="goal-label">{goalCard.label}</div>
                  <div className="goal-target">{goalCard.target}</div>
                </div>
                <div className="goal-percent">
                  {Math.round(goalCard.progress)}%
                </div>
              </div>

              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${goalCard.progress}%` }}
                ></div>
              </div>

              <div className="goal-detail">{goalCard.detail}</div>
            </article>
          ))}
        </div>
      ) : (
        <div className="no-goals">
          Set daily goals to unlock progress and pacing signals.
        </div>
      )}
    </section>
  );
};
