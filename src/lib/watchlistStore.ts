export type WatchlistItem = {
  ticker: string;
  name?: string;
  addedAt: number;
};

const KEY = 'qn-watchlist';

export function loadWatchlist(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.ticker === 'string')
      .map((x) => ({
        ticker: String(x.ticker).toUpperCase(),
        name: x.name ? String(x.name) : undefined,
        addedAt: typeof x.addedAt === 'number' ? x.addedAt : Date.now(),
      }));
  } catch {
    return [];
  }
}

export function saveWatchlist(items: WatchlistItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export function addToWatchlist(ticker: string, name?: string): WatchlistItem[] {
  const t = ticker.trim().toUpperCase();
  if (!t) return loadWatchlist();
  const list = loadWatchlist().filter((x) => x.ticker !== t);
  list.unshift({ ticker: t, name, addedAt: Date.now() });
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
