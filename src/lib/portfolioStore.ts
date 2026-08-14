import { notifyAccountDataChanged } from './accountSync';

export type PortfolioHolding = {
  ticker: string;
  name?: string;
  quantity: number;
  avgCost: number;
  updatedAt: number;
};

const KEY = 'qn-portfolio';

export function loadPortfolio(): PortfolioHolding[] {
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
        quantity: Number(x.quantity) || 0,
        avgCost: Number(x.avgCost) || 0,
        updatedAt: typeof x.updatedAt === 'number' ? x.updatedAt : Date.now(),
      }))
      .filter((x) => x.quantity > 0);
  } catch {
    return [];
  }
}

export function savePortfolio(items: PortfolioHolding[], opts?: { silent?: boolean }) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
  // Keep TradeZones "owns" flags in sync
  try {
    for (const h of items) {
      localStorage.setItem(`qn-owns-${h.ticker}`, h.quantity > 0 ? '1' : '0');
    }
  } catch {
    /* ignore */
  }
  if (!opts?.silent) notifyAccountDataChanged('portfolio');
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
