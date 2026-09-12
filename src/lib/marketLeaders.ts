import { apiUrl, loggedFetch } from './api';
import { changePctOverBars } from './dashboardMarket';
import { MARKET_TREND_SYMBOL } from '../components/dashboard/MarketCommandCenter';
import type { StockRecommendation } from './recommendation';
import type { SuggestMarket } from './suggestTradeUniverses';

/**
 * "Market Leaders" — stocks holding up or rising while the broader index
 * falls. A real relative-strength signal (sector rotation, resilient
 * fundamentals, or institutional buyers stepping in during a selloff), not
 * just noise — but only when it's genuinely a leadership move, not simple
 * low-beta defensiveness (a utility that barely moves in ANY environment).
 *
 * USER RULE: a 2-trading-day window, not the more common 5-day one — 5 days
 * is often too late to still be a useful entry; 2 days catches the pattern
 * while it's still actionable.
 *
 * Deliberately scoped to candidates already rated BUY/STRONG BUY by the
 * Quantum engine — since whale/institutional accumulation is now a required
 * condition for that label (see quantumRecommendationEngine.ts's hasAccum
 * gate), filtering to BUY/STRONG BUY already guarantees real accumulation is
 * present, not just price stability.
 */
export const INDEX_DOWN_THRESHOLD = -0.5;
const STOCK_STABLE_FLOOR = -1;
const OUTPERFORMANCE_MARGIN = 1.5;

export type MarketLeader = {
  ticker: string;
  companyName: string;
  recommendation: StockRecommendation['recommendation'];
  change2dPct: number;
  indexChange2dPct: number;
  outperformancePts: number;
  nearResistance: boolean;
};

/** Pure classification — no network calls, easy to test against fixed inputs. */
export function findMarketLeaders(
  candidates: StockRecommendation[],
  indexChange2dPct: number | null
): MarketLeader[] {
  if (indexChange2dPct == null || indexChange2dPct >= INDEX_DOWN_THRESHOLD) return [];

  const seen = new Set<string>();
  const leaders: MarketLeader[] = [];
  for (const c of candidates) {
    if (c.recommendation !== 'BUY' && c.recommendation !== 'STRONG BUY') continue;
    if (seen.has(c.ticker)) continue;
    const change2dPct = c.boardMetrics?.change2dPct;
    if (change2dPct == null || !Number.isFinite(change2dPct)) continue;
    if (change2dPct < STOCK_STABLE_FLOOR) continue;
    const outperformancePts = change2dPct - indexChange2dPct;
    if (outperformancePts < OUTPERFORMANCE_MARGIN) continue;

    seen.add(c.ticker);
    leaders.push({
      ticker: c.ticker,
      companyName: c.companyName,
      recommendation: c.recommendation,
      change2dPct,
      indexChange2dPct,
      outperformancePts,
      nearResistance: c.boardMetrics?.srSignal === 'Near Resistance' || c.boardMetrics?.srSignal === 'Above Resistance',
    });
  }
  return leaders.sort((a, b) => b.outperformancePts - a.outperformancePts);
}

/** Fetches the relevant index's own 2-trading-day change for a market. */
export async function fetchIndexChange2dPct(market: SuggestMarket): Promise<number | null> {
  const symbol = MARKET_TREND_SYMBOL[market] ?? MARKET_TREND_SYMBOL.US;
  try {
    const res = await loggedFetch(
      apiUrl(`/api/stock?ticker=${encodeURIComponent(symbol)}&range=5d&interval=1d`),
      { __qnTrigger: 'market-leaders-index-check' } as any
    );
    if (!res.ok) return null;
    const data = await res.json();
    const history = (data?.history || []).filter((h: any) => h?.close != null && Number.isFinite(Number(h.close)));
    return changePctOverBars(history, 2);
  } catch {
    return null;
  }
}
