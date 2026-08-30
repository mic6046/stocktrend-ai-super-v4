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
  /** Near Support / Near Resistance / Mid Range / … */
  srSignal?: string;
  srDetail?: string;
  /** Per-row freshness for cross-device merge */
  updatedAt?: number;
};

export type SignalBucket = 'opportunity' | 'watch' | 'risk';

/**
 * Single source of truth for Dashboard bucketing. Previously three call sites
 * (Portfolio refresh, AI Signals scan, Watchlist scan) each inlined a slightly
 * different regex — one didn't treat REDUCE as risk, none treated AVOID NEW
 * POSITION as risk — so the same recommendation could land in a different
 * bucket depending on which feature last touched the cache.
 */
export function classifySignalBucket(recommendation?: string | null): SignalBucket {
  const rec = String(recommendation || '');
  if (/buy|add/i.test(rec)) return 'opportunity';
  if (/sell|trim|reduce|avoid/i.test(rec)) return 'risk';
  return 'watch';
}

/** How old a cached row can be before the Dashboard should stop treating it as current. */
export const SIGNAL_ROW_STALE_MS = 48 * 60 * 60 * 1000;

export function isSignalRowFresh(row: Pick<CachedSignalRow, 'updatedAt'>, now = Date.now()): boolean {
  if (!row.updatedAt) return true;
  return now - row.updatedAt < SIGNAL_ROW_STALE_MS;
}

const KEY = 'qn-signal-cache-v1';
const UPDATED_KEY = 'qn-signal-cache-updated-at';

export function normalizeSignalRow(raw: Partial<CachedSignalRow> | null | undefined): CachedSignalRow | null {
  if (!raw || typeof raw.ticker !== 'string') return null;
  const ticker = String(raw.ticker).trim().toUpperCase();
  if (!ticker) return null;
  const row: CachedSignalRow = { ticker };
  if (raw.name) row.name = String(raw.name);
  if (raw.recommendation) row.recommendation = String(raw.recommendation);
  if (typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)) row.confidence = raw.confidence;
  if (raw.trend) row.trend = String(raw.trend);
  if (raw.smartMoney) row.smartMoney = String(raw.smartMoney);
  if (raw.fundFlow) row.fundFlow = String(raw.fundFlow);
  if (raw.rsi === null) row.rsi = null;
  else if (typeof raw.rsi === 'number' && Number.isFinite(raw.rsi)) row.rsi = raw.rsi;
  if (raw.momentum) row.momentum = String(raw.momentum);
  if (raw.technicalTrend) row.technicalTrend = String(raw.technicalTrend);
  if (raw.risk) row.risk = String(raw.risk);
  if (typeof raw.price === 'number' && Number.isFinite(raw.price)) row.price = raw.price;
  if (typeof raw.changePct === 'number' && Number.isFinite(raw.changePct)) row.changePct = raw.changePct;
  if (raw.bucket === 'opportunity' || raw.bucket === 'watch' || raw.bucket === 'risk') row.bucket = raw.bucket;
  if (raw.srSignal) row.srSignal = String(raw.srSignal);
  if (raw.srDetail) row.srDetail = String(raw.srDetail);
  if (typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)) row.updatedAt = raw.updatedAt;
  return row;
}

export function normalizeSignalCache(rows: unknown): CachedSignalRow[] {
  if (!Array.isArray(rows)) return [];
  const map = new Map<string, CachedSignalRow>();
  for (const raw of rows) {
    const row = normalizeSignalRow(raw as Partial<CachedSignalRow>);
    if (!row) continue;
    map.set(row.ticker, row);
  }
  return Array.from(map.values()).slice(0, 60);
}

export function signalCacheFingerprint(rows: CachedSignalRow[]): string {
  return JSON.stringify(
    normalizeSignalCache(rows).map((r) => ({
      ticker: r.ticker,
      recommendation: r.recommendation || '',
      confidence: r.confidence ?? null,
      bucket: r.bucket || '',
      price: r.price ?? null,
      updatedAt: r.updatedAt ?? null,
    }))
  );
}

function rowScore(r: CachedSignalRow): number {
  let s = typeof r.confidence === 'number' ? r.confidence : 0;
  if (r.recommendation) s += 5;
  if (r.bucket) s += 3;
  if (r.price != null) s += 2;
  if (r.updatedAt) s += Math.min(r.updatedAt / 1e13, 1);
  return s;
}

/** Union by ticker; keep the richer / newer row. */
export function mergeSignalCaches(a: CachedSignalRow[], b: CachedSignalRow[]): CachedSignalRow[] {
  const map = new Map<string, CachedSignalRow>();
  for (const list of [normalizeSignalCache(a), normalizeSignalCache(b)]) {
    for (const row of list) {
      const prev = map.get(row.ticker);
      if (!prev) {
        map.set(row.ticker, row);
        continue;
      }
      const prevAt = prev.updatedAt || 0;
      const nextAt = row.updatedAt || 0;
      if (nextAt > prevAt || (nextAt === prevAt && rowScore(row) >= rowScore(prev))) {
        map.set(row.ticker, { ...prev, ...row, ticker: row.ticker });
      } else {
        map.set(row.ticker, { ...row, ...prev, ticker: prev.ticker });
      }
    }
  }
  return Array.from(map.values()).slice(0, 60);
}

export function loadLocalSignalCacheUpdatedAt(): number {
  try {
    const n = Number(localStorage.getItem(UPDATED_KEY) || '0');
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function saveLocalSignalCacheUpdatedAt(ts: number) {
  try {
    localStorage.setItem(UPDATED_KEY, String(ts));
  } catch {
    /* ignore */
  }
}

export function loadSignalCache(): CachedSignalRow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return normalizeSignalCache(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveSignalCache(rows: CachedSignalRow[], opts?: { silent?: boolean }) {
  const normalized = normalizeSignalCache(rows).map((r) => ({
    ...r,
    updatedAt: r.updatedAt || Date.now(),
  }));
  try {
    localStorage.setItem(KEY, JSON.stringify(normalized.slice(0, 60)));
  } catch {
    /* ignore */
  }
  if (!opts?.silent) {
    saveLocalSignalCacheUpdatedAt(Date.now());
    notifyAccountDataChanged('signals');
  }
}

export function mergeSignalCache(rows: CachedSignalRow[]) {
  const now = Date.now();
  const stamped = rows.map((r) => ({ ...r, updatedAt: r.updatedAt || now }));
  const out = mergeSignalCaches(loadSignalCache(), stamped);
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
