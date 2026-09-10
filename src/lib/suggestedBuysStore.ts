/**
 * Local-only (per-device) cache of recent BUY/STRONG BUY suggestions from
 * Today's Picks, so the fade watcher has a snapshot to compare fresh scans
 * against. Deliberately not synced to the account/Firestore layer like
 * portfolio or watchlist — this is a short-lived cache (auto-expires), not a
 * durable user record.
 */
export type SuggestedBuySnapshot = {
  ticker: string;
  companyName: string;
  suggestedAt: number;
  verdict: 'BUY' | 'STRONG BUY';
  confidence: number;
  setupTag: 'PULLBACK BUY' | 'BREAKOUT BUY' | null;
  price: number;
  fundFlow: string;
};

const KEY = 'qn-suggested-buys';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TRACKED = 20;

function isFresh(s: SuggestedBuySnapshot): boolean {
  return Date.now() - s.suggestedAt < MAX_AGE_MS;
}

export function loadSuggestedBuys(): SuggestedBuySnapshot[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is SuggestedBuySnapshot =>
        s && typeof s.ticker === 'string' && typeof s.suggestedAt === 'number' && isFresh(s)
    );
  } catch {
    return [];
  }
}

function saveSuggestedBuys(items: SuggestedBuySnapshot[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX_TRACKED)));
  } catch {
    /* best-effort only */
  }
}

/** Upsert by ticker (most recent suggestion wins), pruning expired entries. */
export function recordSuggestedBuy(snapshot: SuggestedBuySnapshot) {
  const rest = loadSuggestedBuys().filter((s) => s.ticker !== snapshot.ticker);
  saveSuggestedBuys([snapshot, ...rest]);
}

/** Stop tracking a ticker — called once its fade has already been reported. */
export function removeSuggestedBuy(ticker: string) {
  saveSuggestedBuys(loadSuggestedBuys().filter((s) => s.ticker !== ticker));
}
