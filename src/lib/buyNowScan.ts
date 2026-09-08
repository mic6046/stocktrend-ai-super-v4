import { apiUrl, loggedFetch } from './api';
import { checkBuyNow } from './buyNowTrigger';
import type { StockRecommendation } from './recommendation';

export type BuyNowPick = {
  ticker: string;
  companyName: string;
  price: number;
  reason: string;
  recommendation: StockRecommendation['recommendation'];
};

/**
 * Re-checks each candidate's OWN entryZone (already computed by the Quantum
 * engine — nothing new here) against a fresh live quote. Run once whenever
 * Today's Picks is refreshed, not on a background interval: the point is
 * "does this already-vetted pick still look like a good entry right now,"
 * which only needs re-answering when you actually look again.
 */
export async function scanForBuyNow(candidates: StockRecommendation[]): Promise<BuyNowPick[]> {
  const byTicker = new Map<string, StockRecommendation>();
  for (const c of candidates) {
    if (c.entryZone && c.entryZone.hi > 0 && !byTicker.has(c.ticker)) {
      byTicker.set(c.ticker, c);
    }
  }

  const results = await Promise.all(
    Array.from(byTicker.values()).map(async (c): Promise<BuyNowPick | null> => {
      try {
        const res = await loggedFetch(apiUrl(`/api/quote/${encodeURIComponent(c.ticker)}`), {
          __qnTrigger: 'buy-now-scan',
        } as any);
        if (!res.ok) return null;
        const data = await res.json();
        const price = Number(data?.quote?.regularMarketPrice);
        const volume = Number(data?.quote?.regularMarketVolume);
        const avgVolume =
          Number(data?.quote?.averageDailyVolume10Day) || Number(data?.quote?.averageDailyVolume3Month);
        const marketState = data?.quote?.marketState ?? null;
        if (!Number.isFinite(price) || !Number.isFinite(volume)) return null;

        const rvol = avgVolume > 0 ? volume / avgVolume : 1;
        const check = checkBuyNow({ price, rvol, marketState }, { low: c.entryZone.lo, high: c.entryZone.hi });
        if (!check.qualifies) return null;

        return {
          ticker: c.ticker,
          companyName: c.companyName,
          price,
          reason: check.reason,
          recommendation: c.recommendation,
        };
      } catch {
        return null;
      }
    })
  );

  return results.filter((r): r is BuyNowPick => r != null);
}
