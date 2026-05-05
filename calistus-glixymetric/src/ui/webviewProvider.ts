import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export const DASHBOARD_VIEW_ID = 'glixymetric.dashboardView';
export const DASHBOARD_CONTAINER_ID = 'glixymetricDashboard';
export const DASHBOARD_PANEL_VIEW_TYPE = 'glixymetric.dashboardPanel';

const DASHBOARD_PANEL_TITLE = 'GlixyMetric Dashboard';
const DASHBOARD_DIST_DIR = 'dist';
const DASHBOARD_SCRIPT_NAME = 'dashboard.js';
const DASHBOARD_STYLE_NAME = 'dashboard.css';
const UPDATE_INTERVAL_MS = 1000;

type DashboardTarget = {
  webview: vscode.Webview;
  isActive: () => boolean;
};

const dashboardTargets = new Map<string, DashboardTarget>();
let updateInterval: NodeJS.Timeout | null = null;

/**
 * Owns both dashboard surfaces:
 * 1. A primary webview panel opened from the status bar/command palette
 * 2. An optional webview sidebar hosted in its own Activity Bar container
 */
export class DashboardWebviewController implements vscode.WebviewViewProvider {
  private sidebarView: vscode.WebviewView | null = null;
  private dashboardPanel: vscode.WebviewPanel | null = null;
  private revealSidebarOnResolve = false;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.sidebarView = webviewView;
    configureDashboardWebview(webviewView.webview, this.extensionUri);
    addDashboardTarget('sidebar', webviewView.webview, () => webviewView.visible);

    const messageSubscription = webviewView.webview.onDidReceiveMessage((message) => {
      handleWebviewMessage(message);
    });

    if (this.revealSidebarOnResolve) {
      this.revealSidebarOnResolve = false;
      webviewView.show(false);
    }

    if (webviewView.visible) {
      void broadcastStatsUpdate();
    }

    refreshUpdateLoop();

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        void broadcastStatsUpdate();
      }

      refreshUpdateLoop();
    });

    webviewView.onDidDispose(() => {
      messageSubscription.dispose();
      removeDashboardTarget('sidebar');

      if (this.sidebarView === webviewView) {
        this.sidebarView = null;
      }
    });
  }

  showPanel(): void {
    const column = vscode.ViewColumn.Beside;

    if (this.dashboardPanel) {
      this.dashboardPanel.reveal(column, false);
      return;
    }

    this.dashboardPanel = vscode.window.createWebviewPanel(
      DASHBOARD_PANEL_VIEW_TYPE,
      DASHBOARD_PANEL_TITLE,
      column,
      {
        enableScripts: true,
        enableForms: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, DASHBOARD_DIST_DIR)],
      }
    );

    configureDashboardWebview(this.dashboardPanel.webview, this.extensionUri);
    addDashboardTarget('panel', this.dashboardPanel.webview, () => this.dashboardPanel?.visible ?? false);

    const messageSubscription = this.dashboardPanel.webview.onDidReceiveMessage((message) => {
      handleWebviewMessage(message);
    });

    void broadcastStatsUpdate();
    refreshUpdateLoop();

    this.dashboardPanel.onDidChangeViewState(() => {
      if (this.dashboardPanel?.visible) {
        void broadcastStatsUpdate();
      }

      refreshUpdateLoop();
    });

    this.dashboardPanel.onDidDispose(() => {
      messageSubscription.dispose();
      removeDashboardTarget('panel');
      this.dashboardPanel = null;
    });
  }

  async showSidebar(): Promise<void> {
    if (this.sidebarView) {
      await vscode.commands.executeCommand(`workbench.view.extension.${DASHBOARD_CONTAINER_ID}`);
      this.sidebarView.show(false);
      return;
    }

    this.revealSidebarOnResolve = true;
    await vscode.commands.executeCommand(`workbench.view.extension.${DASHBOARD_CONTAINER_ID}`);
    await vscode.commands.executeCommand(`${DASHBOARD_VIEW_ID}.focus`);
  }
}

export function registerDashboardWebviewProvider(
  context: vscode.ExtensionContext
): DashboardWebviewController {
  const controller = new DashboardWebviewController(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(DASHBOARD_VIEW_ID, controller, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    })
  );

  return controller;
}

function addDashboardTarget(
  id: string,
  webview: vscode.Webview,
  isActive: () => boolean
): void {
  dashboardTargets.set(id, { webview, isActive });
  refreshUpdateLoop();
}

function removeDashboardTarget(id: string): void {
  dashboardTargets.delete(id);
  refreshUpdateLoop();
}

function configureDashboardWebview(webview: vscode.Webview, extensionUri: vscode.Uri): void {
  webview.options = {
    enableScripts: true,
    enableForms: true,
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, DASHBOARD_DIST_DIR)],
  };

  webview.html = getWebviewContent(webview, extensionUri);
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const distPath = vscode.Uri.joinPath(extensionUri, DASHBOARD_DIST_DIR);
  const dashboardScriptPath = path.join(extensionUri.fsPath, DASHBOARD_DIST_DIR, DASHBOARD_SCRIPT_NAME);
  const dashboardStylePath = path.join(extensionUri.fsPath, DASHBOARD_DIST_DIR, DASHBOARD_STYLE_NAME);

  if (!fs.existsSync(dashboardScriptPath)) {
    console.error('[GlixyMetric] React webview assets missing in dist/. Run `npm run compile`.', {
      dashboardScriptPath,
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${DASHBOARD_PANEL_TITLE}</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 16px;
      line-height: 1.5;
    }
    code {
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <h2>${DASHBOARD_PANEL_TITLE}</h2>
  <p>React webview bundle was not found in <code>dist/</code>.</p>
  <p>Run <code>npm run compile</code> and reopen the dashboard.</p>
</body>
</html>`;
  }

  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distPath, DASHBOARD_SCRIPT_NAME));
  const styleUri = fs.existsSync(dashboardStylePath)
    ? webview.asWebviewUri(vscode.Uri.joinPath(distPath, DASHBOARD_STYLE_NAME))
    : null;
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:;">
  <title>${DASHBOARD_PANEL_TITLE}</title>
  <style>
    :root {
      color-scheme: light dark;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
        sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
  </style>
  ${styleUri ? `<link rel="stylesheet" href="${styleUri}">` : ''}
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function refreshUpdateLoop(): void {
  const hasActiveTargets = Array.from(dashboardTargets.values()).some((target) => target.isActive());

  if (hasActiveTargets && !updateInterval) {
    updateInterval = setInterval(() => {
      void broadcastStatsUpdate();
    }, UPDATE_INTERVAL_MS);
    return;
  }

  if (!hasActiveTargets && updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
}

async function broadcastStatsUpdate(): Promise<void> {
  const activeTargets = Array.from(dashboardTargets.values()).filter((target) => target.isActive());

  if (activeTargets.length === 0) {
    return;
  }

  try {
    const stats = await getDashboardStats();

    for (const target of activeTargets) {
      target.webview.postMessage({
        type: 'statsUpdate',
        data: stats,
      });
    }
  } catch (error) {
    console.error('Failed to send stats update:', error);
  }
}

async function getDashboardStats() {
  const {
    getTodayCodingTime,
    getTodayDailyTotalTime,
    getTodayCommits,
    getTodaySessions,
    getAverageSessionDurationToday,
    getCurrentSessionDurationFormatted,
    getTodayLanguagesFormatted,
    getCurrentLanguageFormatted,
    getTodayGoalTarget,
    getTodayGoalStatus,
  } = await import('../services/statsService.js');
  const {
    getSessionsToday,
    getCurrentSession,
    getActiveSessionElapsedSeconds,
  } = await import('../storage/repositories/sessionRepository.js');
  const { isIdle } = await import('../tracker/sessionManager.js');

  const sessionsData = getSessionsToday();
  const currentSession = getCurrentSession();
  const currentSessionSeconds = currentSession
    ? getActiveSessionElapsedSeconds(currentSession, Math.floor(Date.now() / 1000))
    : 0;
  const hasTrackedActivity = sessionsData.length > 0 || getTodayCodingTime() > 0;
  const activityState = currentSession && !isIdle()
    ? 'active'
    : hasTrackedActivity
      ? 'idle'
      : 'not_started';
  const lastSession = sessionsData.find((session) => session.duration && session.duration > 0) ?? null;
  const activeProjectName = currentSession?.project_path ?? sessionsData[0]?.project_path ?? '';

  return {
    codingTime: getTodayCodingTime(),
    dailyTotal: getTodayDailyTotalTime(),
    commits: getTodayCommits(),
    sessions: getTodaySessions(),
    avgSessionDuration: getAverageSessionDurationToday(),
    currentSessionDuration: getCurrentSessionDurationFormatted(),
    currentSessionSeconds,
    currentLanguage: getCurrentLanguageFormatted(),
    languages: getTodayLanguagesFormatted(),
    goalStatus: getTodayGoalStatus() ?? '',
    goal: getTodayGoalTarget(),
    sessionsData,
    activityState,
    activeProjectName,
    lastSessionDuration: lastSession?.duration ?? 0,
    timestamp: Date.now(),
  };
}

function handleWebviewMessage(message: any): void {
  switch (message.type) {
    case 'log':
      console.log('Webview:', message.data);
      break;
    case 'setGoals':
      console.log('Set goals:', message.data);
      break;
    default:
      break;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}
