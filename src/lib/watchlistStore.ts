import { notifyAccountDataChanged } from './accountSync';

export type WatchlistItem = {
  ticker: string;
  name?: string;
  addedAt: number;
};

const KEY = 'qn-watchlist';

/** Normalize for localStorage + Firestore (no undefined fields). */
export function normalizeWatchlistItem(x: Partial<WatchlistItem> | null | undefined): WatchlistItem | null {
  if (!x || typeof x.ticker !== 'string') return null;
  const ticker = String(x.ticker).trim().toUpperCase();
  if (!ticker) return null;
  const item: WatchlistItem = {
    ticker,
    addedAt: typeof x.addedAt === 'number' && Number.isFinite(x.addedAt) ? x.addedAt : Date.now(),
  };
  if (x.name && String(x.name).trim()) item.name = String(x.name).trim();
  return item;
}

export function normalizeWatchlist(items: unknown): WatchlistItem[] {
  if (!Array.isArray(items)) return [];
  const out: WatchlistItem[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const item = normalizeWatchlistItem(raw as Partial<WatchlistItem>);
    if (!item || seen.has(item.ticker)) continue;
    seen.add(item.ticker);
    out.push(item);
  }
  return out;
}

export function watchlistFingerprint(items: WatchlistItem[]): string {
  return JSON.stringify(
    normalizeWatchlist(items).map((x) => ({
      ticker: x.ticker,
      addedAt: x.addedAt,
      ...(x.name ? { name: x.name } : {}),
    }))
  );
}

export function loadWatchlist(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return normalizeWatchlist(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveWatchlist(items: WatchlistItem[], opts?: { silent?: boolean }) {
  const normalized = normalizeWatchlist(items);
  try {
    localStorage.setItem(KEY, JSON.stringify(normalized));
  } catch {
    /* ignore */
  }
  if (!opts?.silent) notifyAccountDataChanged('watchlist');
}

export function addToWatchlist(ticker: string, name?: string): WatchlistItem[] {
  const t = ticker.trim().toUpperCase();
  if (!t) return loadWatchlist();
  const list = loadWatchlist().filter((x) => x.ticker !== t);
  list.unshift(
    normalizeWatchlistItem({ ticker: t, name, addedAt: Date.now() }) || {
      ticker: t,
      addedAt: Date.now(),
    }
  );
  saveWatchlist(list);
  return list;
}

export function removeFromWatchlist(ticker: string): WatchlistItem[] {
  const t = ticker.trim().toUpperCase();
  const list = loadWatchlist().filter((x) => x.ticker !== t);
  saveWatchlist(list);
  return list;
}

export function isOnWatchlist(ticker: string): boolean {
  const t = ticker.trim().toUpperCase();
  return loadWatchlist().some((x) => x.ticker === t);
}
