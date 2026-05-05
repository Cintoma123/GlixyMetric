/**
 * WebView-specific TypeScript interfaces
 */

export interface Stats {
  codingTime: number;
  dailyTotal: number;
  commits: number;
  sessions: number;
  avgSessionDuration: number;
  currentSessionDuration: string;
  currentSessionSeconds: number;
  currentLanguage: string;
  languages: string;
  goalStatus: string;
  goal: { daily_hours?: number; daily_commits?: number } | null;
  sessionsData: SessionData[];
  activityState: 'active' | 'idle' | 'not_started';
  activeProjectName: string;
  lastSessionDuration: number;
  timestamp: number;
}

export interface SessionData {
  id?: number;
  start_time: number;
  end_time?: number;
  duration?: number;
  project_path: string;
}

export interface Goal {
  daily_hours?: number;
  daily_commits?: number;
}

export interface LanguageData {
  name: string;
  value: number;
}

export interface ChartDataPoint {
  name: string;
  duration: number;
}
