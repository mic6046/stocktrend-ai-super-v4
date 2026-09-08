import { apiUrl, loggedFetch } from './api';
import { buildQuantumInputFromMarketData } from './quantumInputBuilder';
import { evaluateStockRecommendation } from './recommendation';
import { checkTakePartialProfit } from './takePartialProfitTrigger';
import type { PortfolioHolding } from './portfolioStore';
import type { HorizonKey } from '../components/analysis/analysisTheme';

export type ProfitAlertFireEvent = {
  ticker: string;
  price: number;
  reason: string;
  at: number;
};

/**
 * Scans your actual holdings (not a market-universe candidate list) for the
 * engine's "TAKE PARTIAL PROFIT" call, evaluated with userHasPosition: true
 * so the same reaching-resistance-with-outflow rule the detail page already
 * applies runs proactively across your portfolio instead of only showing up
 * when you happen to open that specific ticker.
 *
 * Deliberately NOT a live-price poller like the Buy Now watcher — this
 * condition (price near resistance + fund flow reducing) forms over hours,
 * not minutes, so a slower periodic scan against daily bars is the right
 * cadence, not a 60s intraday loop.
 */
export async function scanHoldingsForTakePartialProfit(
  holdings: PortfolioHolding[],
  horizon: HorizonKey = '1M'
): Promise<ProfitAlertFireEvent[]> {
  const fires: ProfitAlertFireEvent[] = [];

  await Promise.all(
    holdings.map(async (h) => {
      try {
        const res = await loggedFetch(
          apiUrl(`/api/stock?ticker=${encodeURIComponent(h.ticker)}&range=1y&interval=1d`),
          { __qnTrigger: 'take-profit-watcher' } as any
        );
        if (!res.ok) return;
        const data = await res.json();
        const history = (data?.history || []).filter((x: any) => x?.close != null && Number.isFinite(Number(x.close)));
        if (!history.length) return;

        const input = buildQuantumInputFromMarketData({
          horizon,
          ticker: h.ticker,
          quote: data?.quote,
          history,
          userHasPosition: true,
        });
        const rec = evaluateStockRecommendation(input, {
          ticker: h.ticker,
          companyName: h.name || h.ticker,
        });
        const check = checkTakePartialProfit(rec);
        if (check.fire) {
          fires.push({ ticker: h.ticker, price: input.currentPrice, reason: check.reason, at: Date.now() });
        }
      } catch {
        /* best-effort scan across the whole portfolio — one bad fetch shouldn't block the rest */
      }
    })
  );

  return fires;
}
