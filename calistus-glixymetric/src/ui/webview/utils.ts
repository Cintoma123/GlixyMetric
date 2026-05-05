/**
 * Shared utilities for webview components
 */

/**
 * Format seconds to human-readable time string
 * @param seconds - Total seconds
 * @returns Formatted string (e.g., "2h 45m", "30m")
 */
export const formatSeconds = (seconds: number): string => {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

/**
 * Format seconds as hh:mm:ss for the live hero timer.
 * @param seconds - Total seconds
 * @returns Clock string (e.g., "00:12:34")
 */
export const formatClock = (seconds: number): string => {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((safeSeconds % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const remainingSeconds = Math.floor(safeSeconds % 60)
    .toString()
    .padStart(2, '0');

  return `${hours}:${minutes}:${remainingSeconds}`;
};

/**
 * Shorten a project path into a display name.
 * @param projectPath - Workspace path
 * @returns Leaf folder name or fallback label
 */
export const getProjectName = (projectPath: string): string => {
  if (!projectPath) {
    return 'No active project';
  }

  const normalized = projectPath.replace(/\\/g, '/').replace(/\/$/, '');
  const segments = normalized.split('/').filter(Boolean);
  return segments[segments.length - 1] || projectPath;
};

/**
 * Reduce language mix to a compact preview string.
 * @param langStr - Language string
 * @returns Preview string
 */
export const getLanguagePreview = (langStr: string): string => {
  if (!langStr) {
    return 'No activity yet';
  }

  return langStr
    .split(', ')
    .slice(0, 2)
    .map((entry) => entry.replace(/[()]/g, ''))
    .join(' | ');
};

/**
 * Format a timestamp for compact UI display.
 * @param timestamp - Epoch milliseconds
 * @returns Formatted time
 */
export const formatUpdateTime = (timestamp: number): string => {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
};

/**
 * Format a timestamp for compact UI display.
 * @param timestamp - Epoch milliseconds
 * @returns Formatted date
 */
export const formatUpdateDate = (timestamp: number): string => {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
};

/**
 * Parse language string into chart data
 * @param langStr - Language string (e.g., "TypeScript (50%), Python (50%)")
 * @returns Array of language data objects
 */
export const parseLanguages = (
  langStr: string
): Array<{ name: string; value: number }> => {
  if (!langStr) {
    return [];
  }

  return langStr.split(', ').map((lang) => {
    const [name, percent] = lang.split(' (');
    return {
      name: name.trim(),
      value: parseInt(percent?.replace('%', '') || '0'),
    };
  });
};
