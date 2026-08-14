import { notifyAccountDataChanged } from './accountSync';

export type PortfolioHolding = {
  ticker: string;
  name?: string;
  quantity: number;
  avgCost: number;
  updatedAt: number;
};

const KEY = 'qn-portfolio';
const UPDATED_KEY = 'qn-portfolio-updated-at';

export function normalizeHolding(x: Partial<PortfolioHolding> | null | undefined): PortfolioHolding | null {
  if (!x || typeof x.ticker !== 'string') return null;
  const ticker = String(x.ticker).trim().toUpperCase();
  const quantity = Number(x.quantity) || 0;
  if (!ticker || quantity <= 0) return null;
  const item: PortfolioHolding = {
    ticker,
    quantity,
    avgCost: Number(x.avgCost) || 0,
    updatedAt: typeof x.updatedAt === 'number' && Number.isFinite(x.updatedAt) ? x.updatedAt : Date.now(),
  };
  if (x.name && String(x.name).trim()) item.name = String(x.name).trim();
  return item;
}

export function normalizePortfolio(items: unknown): PortfolioHolding[] {
  if (!Array.isArray(items)) return [];
  const map = new Map<string, PortfolioHolding>();
  for (const raw of items) {
    const item = normalizeHolding(raw as Partial<PortfolioHolding>);
    if (!item) continue;
    const prev = map.get(item.ticker);
    if (!prev || item.updatedAt >= prev.updatedAt) map.set(item.ticker, item);
  }
  return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function portfolioFingerprint(items: PortfolioHolding[]): string {
  return JSON.stringify(
    normalizePortfolio(items).map((x) => ({
      ticker: x.ticker,
      quantity: x.quantity,
      avgCost: x.avgCost,
      updatedAt: x.updatedAt,
      ...(x.name ? { name: x.name } : {}),
    }))
  );
}

export function mergePortfolios(a: PortfolioHolding[], b: PortfolioHolding[]): PortfolioHolding[] {
  return normalizePortfolio([...normalizePortfolio(a), ...normalizePortfolio(b)]);
}

export function loadLocalPortfolioUpdatedAt(): number {
  try {
    const n = Number(localStorage.getItem(UPDATED_KEY) || '0');
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function saveLocalPortfolioUpdatedAt(ts: number) {
  try {
    localStorage.setItem(UPDATED_KEY, String(ts));
  } catch {
    /* ignore */
  }
}

export function loadPortfolio(): PortfolioHolding[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return normalizePortfolio(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function savePortfolio(items: PortfolioHolding[], opts?: { silent?: boolean }) {
  const normalized = normalizePortfolio(items);
  try {
    localStorage.setItem(KEY, JSON.stringify(normalized));
  } catch {
    /* ignore */
  }
  try {
    for (const h of normalized) {
      localStorage.setItem(`qn-owns-${h.ticker}`, h.quantity > 0 ? '1' : '0');
    }
  } catch {
    /* ignore */
  }
  if (!opts?.silent) {
    saveLocalPortfolioUpdatedAt(Date.now());
    notifyAccountDataChanged('portfolio');
  }
}

export function upsertHolding(
  ticker: string,
  quantity: number,
  avgCost: number,
  name?: string
): PortfolioHolding[] {
  const t = ticker.trim().toUpperCase();
  const list = loadPortfolio().filter((x) => x.ticker !== t);
  if (quantity > 0) {
    list.unshift({
      ticker: t,
      name,
      quantity,
      avgCost,
      updatedAt: Date.now(),
    });
  } else {
    try {
      localStorage.setItem(`qn-owns-${t}`, '0');
    } catch {
      /* ignore */
    }
  }
  savePortfolio(list);
  return list;
}

export function removeHolding(ticker: string): PortfolioHolding[] {
  const t = ticker.trim().toUpperCase();
  const list = loadPortfolio().filter((x) => x.ticker !== t);
  try {
    localStorage.setItem(`qn-owns-${t}`, '0');
  } catch {
    /* ignore */
  }
  savePortfolio(list);
  return list;
}
