/**
 * Event Type - Represents a single coding activity event
 */
export interface Event {
  id?: number;
  type: 'edit' | 'save' | 'focus';
  timestamp: number;
  file: string;
  language: string;
  created_at?: number;
}

/**
 * Session Type - Represents a continuous coding session
 */
export interface Session {
  id?: number;
  start_time: number;
  end_time?: number;
  duration?: number;
  project_path: string;
  language?: string;
  created_at?: number;
}

/**
 * Commit Type - Represents a git commit
 */
export interface Commit {
  id?: number;
  hash: string;
  message: string;
  timestamp: number;
  repo_path: string;
  created_at?: number;
}

/**
 * Goal Type - Represents daily productivity goals
 */
export interface Goal {
  id?: number;
  date: number;
  daily_hours: number;
  daily_commits: number;
  created_at?: number;
}

/**
 * Break Type - Represents a break taken
 */
export interface Break {
  id?: number;
  timestamp: number;
  duration: number;
  created_at?: number;
}

/**
 * Stats Type - Real-time productivity statistics
 */
export interface Stats {
  todayCodingTime: number;
  todaySessions: number;
  todayCommits: number;
  currentSession?: {
    duration: number;
    file: string;
    language: string;
  };
  productivityScore: number;
}
