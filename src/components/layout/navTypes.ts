export type AppPage =
  | 'DASHBOARD'
  | 'FIND_TRADES'
  | 'AI_SIGNALS'
  | 'WATCHLIST'
  | 'PORTFOLIO'
  | 'ANALYSIS'
  | 'NEWS_CENTER'
  | 'ALERTS'
  | 'SETTINGS';

export const SIDEBAR_COLLAPSED_KEY = 'qn-sidebar-collapsed';

export function loadSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveSidebarCollapsed(collapsed: boolean, opts?: { silent?: boolean }) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (opts?.silent) return;
  try {
    window.dispatchEvent(
      new CustomEvent('qn-account-data', { detail: { kind: 'prefs', at: Date.now() } })
    );
  } catch {
    /* ignore */
  }
}
