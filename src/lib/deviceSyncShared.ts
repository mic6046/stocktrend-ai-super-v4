/**
 * Shared helpers for dedicated per-field cloud sync (iPhone / Android / PC).
 */

export type FieldSyncStatus = 'idle' | 'connecting' | 'synced' | 'saving' | 'error';

export function userDocIdFromEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function readMillisField(raw: Record<string, unknown> | undefined, key: string): number {
  const v = raw?.[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v && typeof v === 'object' && typeof (v as { toMillis?: () => number }).toMillis === 'function') {
    try {
      return (v as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }
  return 0;
}

export function loadLocalUpdatedAt(storageKey: string): number {
  try {
    const n = Number(localStorage.getItem(storageKey) || '0');
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function saveLocalUpdatedAt(storageKey: string, ts: number) {
  try {
    localStorage.setItem(storageKey, String(ts));
  } catch {
    /* ignore */
  }
}

export function bindMobileResume(onResume: () => void): () => void {
  const run = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    onResume();
  };
  window.addEventListener('online', run);
  window.addEventListener('focus', run);
  window.addEventListener('pageshow', run);
  document.addEventListener('visibilitychange', run);
  return () => {
    window.removeEventListener('online', run);
    window.removeEventListener('focus', run);
    window.removeEventListener('pageshow', run);
    document.removeEventListener('visibilitychange', run);
  };
}
