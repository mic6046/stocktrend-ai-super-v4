/** Dashboard / pulse market filter helpers. */

export type DashboardMarket = 'US' | 'HK' | 'JP' | 'EU' | 'ALL';

export const DASHBOARD_MARKETS: { key: DashboardMarket; label: string; short: string }[] = [
  { key: 'US', label: 'United States', short: 'US' },
  { key: 'HK', label: 'Hong Kong', short: 'HK' },
  { key: 'JP', label: 'Japan', short: 'JP' },
  { key: 'EU', label: 'Europe', short: 'EU' },
  { key: 'ALL', label: 'All markets', short: 'ALL' },
];

export const DASHBOARD_INDEX_SYMBOLS: Record<Exclude<DashboardMarket, 'ALL'>, string[]> = {
  US: ['^GSPC', '^IXIC', '^DJI', '^RUT'],
  HK: ['^HSI', '^KS11'],
  JP: ['^N225', '^KS11'],
  EU: ['^STOXX50E', '^FTSE', '^GDAXI', '^FCHI'],
};

export const DASHBOARD_ALL_INDEX_SYMBOLS = ['^GSPC', '^HSI', '^N225', '^STOXX50E'];

const STORAGE_KEY = 'qn-dashboard-market';

export function loadDashboardMarket(): DashboardMarket {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'US' || v === 'HK' || v === 'JP' || v === 'EU' || v === 'ALL') return v;
  } catch {
    /* ignore */
  }
  return 'US';
}

export function saveDashboardMarket(market: DashboardMarket) {
  try {
    localStorage.setItem(STORAGE_KEY, market);
  } catch {
    /* ignore */
  }
}

export function filterIndicesByMarket<T extends { symbol?: string }>(
  indices: T[],
  market: DashboardMarket
): T[] {
  const list = Array.isArray(indices) ? indices.filter(Boolean) : [];
  const symbols =
    market === 'ALL' ? DASHBOARD_ALL_INDEX_SYMBOLS : DASHBOARD_INDEX_SYMBOLS[market];
  const bySym = new Map(list.map((i) => [i.symbol, i]));
  const out: T[] = [];
  for (const sym of symbols) {
    const hit = bySym.get(sym);
    if (hit) out.push(hit);
  }
  // If nothing matched (stale feed), fall back to unfiltered so pulse isn't empty
  return out.length ? out : list.slice(0, 4);
}

const EU_SUFFIX = /\.(PA|DE|L|AS|BR|MI|MC)$/i;

export function tickerBelongsToMarket(ticker: string, market: DashboardMarket): boolean {
  if (market === 'ALL') return true;
  const t = ticker.toUpperCase();
  if (market === 'HK') return t.endsWith('.HK') || /^\d{1,5}$/.test(t);
  if (market === 'JP') return t.endsWith('.T');
  if (market === 'EU') return EU_SUFFIX.test(t);
  // US: letter tickers / crypto — not HK/JP/EU
  return !t.endsWith('.HK') && !t.endsWith('.T') && !EU_SUFFIX.test(t) && !/^\d{1,5}$/.test(t);
}
