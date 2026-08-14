import { notifyAccountDataChanged } from './accountSync';

/**
 * Market Data Refresh — manual-first API policy.
 * Default is always Manual Refresh; no background market requests unless Auto is enabled.
 */

export type MarketDataStatus = 'idle' | 'loading' | 'updated';

export type RefreshMode = 'manual' | 'auto';

export type AutoRefreshIntervalSec = 30 | 60 | 300 | 900;

export const AUTO_REFRESH_OPTIONS: { sec: AutoRefreshIntervalSec; label: string }[] = [
  { sec: 30, label: '30 seconds' },
  { sec: 60, label: '60 seconds' },
  { sec: 300, label: '5 minutes' },
  { sec: 900, label: '15 minutes' },
];

const MODE_KEY = 'qn-market-refresh-mode';
const INTERVAL_KEY = 'qn-market-auto-refresh-interval';
/** Legacy key from earlier builds — migrate once. */
const LEGACY_AUTO_KEY = 'qn-market-auto-refresh';

export function loadRefreshMode(): RefreshMode {
  try {
    const mode = localStorage.getItem(MODE_KEY);
    if (mode === 'auto' || mode === 'manual') return mode;
    if (localStorage.getItem(LEGACY_AUTO_KEY) === '1') return 'auto';
  } catch {
    /* ignore */
  }
  return 'manual';
}

export function saveRefreshMode(mode: RefreshMode, opts?: { silent?: boolean }) {
  try {
    localStorage.setItem(MODE_KEY, mode);
    localStorage.setItem(LEGACY_AUTO_KEY, mode === 'auto' ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (!opts?.silent) notifyAccountDataChanged('prefs');
}

/** @deprecated Prefer loadRefreshMode — kept for App.tsx compatibility during transition */
export function loadAutoRefreshEnabled(): boolean {
  return loadRefreshMode() === 'auto';
}

/** @deprecated Prefer saveRefreshMode */
export function saveAutoRefreshEnabled(on: boolean) {
  saveRefreshMode(on ? 'auto' : 'manual');
}

export function loadAutoRefreshIntervalSec(): AutoRefreshIntervalSec {
  try {
    const n = Number(localStorage.getItem(INTERVAL_KEY));
    if (n === 30 || n === 60 || n === 300 || n === 900) return n;
  } catch {
    /* ignore */
  }
  return 60;
}

export function saveAutoRefreshIntervalSec(sec: AutoRefreshIntervalSec, opts?: { silent?: boolean }) {
  try {
    localStorage.setItem(INTERVAL_KEY, String(sec));
  } catch {
    /* ignore */
  }
  if (!opts?.silent) notifyAccountDataChanged('prefs');
}

export function formatLastUpdated(ts: number | null | undefined): string {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return '—';
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function statusLabel(status: MarketDataStatus): string {
  if (status === 'loading') return 'Loading...';
  if (status === 'updated') return 'Updated';
  return 'Idle';
}
