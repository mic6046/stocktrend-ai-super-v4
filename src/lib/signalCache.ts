import { notifyAccountDataChanged } from './accountSync';

/** Persist lightweight AI scan rows for Dashboard / AI Signals pages. */
export type CachedSignalRow = {
  ticker: string;
  name?: string;
  recommendation?: string;
  confidence?: number;
  trend?: string;
  smartMoney?: string;
  fundFlow?: string;
  rsi?: number | null;
  momentum?: string;
  technicalTrend?: string;
  risk?: string;
  price?: number;
  changePct?: number;
  bucket?: 'opportunity' | 'watch' | 'risk';
};

const KEY = 'qn-signal-cache-v1';

export function loadSignalCache(): CachedSignalRow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSignalCache(rows: CachedSignalRow[], opts?: { silent?: boolean }) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 60)));
  } catch {
    /* ignore */
  }
  if (!opts?.silent) notifyAccountDataChanged('signals');
}

export function mergeSignalCache(rows: CachedSignalRow[]) {
  const map = new Map<string, CachedSignalRow>();
  for (const r of loadSignalCache()) map.set(r.ticker.toUpperCase(), r);
  for (const r of rows) {
    if (!r?.ticker) continue;
    const key = r.ticker.toUpperCase();
    const prev = map.get(key) || { ticker: key };
    const next: CachedSignalRow = { ...prev, ticker: key };
    for (const [k, v] of Object.entries(r) as [keyof CachedSignalRow, CachedSignalRow[keyof CachedSignalRow]][]) {
      if (k === 'ticker') continue;
      if (v !== undefined) (next as any)[k] = v;
    }
    map.set(key, next);
  }
  const out = Array.from(map.values());
  saveSignalCache(out);
  return out;
}

export function removeSignalCache(ticker: string) {
  const key = ticker.trim().toUpperCase();
  if (!key) return loadSignalCache();
  const next = loadSignalCache().filter((r) => r.ticker.toUpperCase() !== key);
  saveSignalCache(next);
  return next;
}
