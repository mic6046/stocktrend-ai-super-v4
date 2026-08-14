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

export function saveSignalCache(rows: CachedSignalRow[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 60)));
  } catch {
    /* ignore */
  }
}

export function mergeSignalCache(rows: CachedSignalRow[]) {
  const map = new Map<string, CachedSignalRow>();
  for (const r of loadSignalCache()) map.set(r.ticker.toUpperCase(), r);
  for (const r of rows) {
    if (!r?.ticker) continue;
    map.set(r.ticker.toUpperCase(), { ...map.get(r.ticker.toUpperCase()), ...r, ticker: r.ticker.toUpperCase() });
  }
  const next = Array.from(map.values());
  saveSignalCache(next);
  return next;
}

export function removeSignalCache(ticker: string) {
  const key = ticker.trim().toUpperCase();
  if (!key) return loadSignalCache();
  const next = loadSignalCache().filter((r) => r.ticker.toUpperCase() !== key);
  saveSignalCache(next);
  return next;
}
