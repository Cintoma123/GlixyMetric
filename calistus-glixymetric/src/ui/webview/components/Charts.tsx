import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { parseLanguages } from '../utils';
import {
  CHART_COLORS,
  CHART_TOOLTIP_STYLE,
} from '../constants';
import type { LanguageData } from '../types';

interface ChartsProps {
  languages: string;
}

export const Charts: React.FC<ChartsProps> = ({ languages }) => {
  const languagesData = parseLanguages(languages) as LanguageData[];

  return (
    <section className="panel section charts">
      <div className="section-head section-head-compact">
        <div>
          <span className="section-kicker">Mix</span>
          <h2>Languages</h2>
        </div>
        <p>Weighted distribution of the languages used today.</p>
      </div>

      {languagesData.length > 0 ? (
        <div className="language-layout">
          <div className="chart-surface chart-surface-compact">
            <ResponsiveContainer width="100%" height={214}>
              <PieChart>
                <Pie
                  data={languagesData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={3}
                  stroke="rgba(8, 15, 29, 0.9)"
                  strokeWidth={3}
                  dataKey="value"
                >
                  {languagesData.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.name}`}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => `${value}%`}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={{ color: '#E2E8F0', fontWeight: 600 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="language-list">
            {languagesData.map((entry, index) => (
              <div className="language-item" key={entry.name}>
                <span
                  className="language-swatch"
                  style={{
                    backgroundColor:
                      CHART_COLORS[index % CHART_COLORS.length],
                  }}
                ></span>
                <div className="language-meta">
                  <strong>{entry.name}</strong>
                  <span>Tracked share</span>
                </div>
                <strong className="language-percent">{entry.value}%</strong>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="no-data">
          Start coding to unlock language distribution insights.
        </div>
      )}
    </section>
  );
};
