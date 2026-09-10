import { apiUrl, loggedFetch } from './api';
import { buildQuantumInputFromMarketData } from './quantumInputBuilder';
import { evaluateStockRecommendation } from './recommendation';
import { checkSuggestedBuyFade } from './suggestedBuyFadeTrigger';
import type { SuggestedBuySnapshot } from './suggestedBuysStore';
import type { HorizonKey } from '../components/analysis/analysisTheme';

export type FadeAlertFireEvent = {
  ticker: string;
  price: number;
  reason: string;
  at: number;
};

/**
 * Re-checks each previously-suggested BUY/STRONG BUY against fresh data and
 * reports the first concrete sign it has faded since it was shown — see
 * suggestedBuyFadeTrigger.ts for the actual comparison rules.
 *
 * Same cadence as the Take Partial Profit watcher — daily-bar data, checked
 * on open/refresh, not a live poller.
 */
export async function scanSuggestedBuysForFade(
  suggestions: SuggestedBuySnapshot[],
  horizon: HorizonKey = '1M'
): Promise<FadeAlertFireEvent[]> {
  const fires: FadeAlertFireEvent[] = [];

  await Promise.all(
    suggestions.map(async (s) => {
      try {
        const res = await loggedFetch(
          apiUrl(`/api/stock?ticker=${encodeURIComponent(s.ticker)}&range=1y&interval=1d`),
          { __qnTrigger: 'suggested-buy-fade-watcher' } as any
        );
        if (!res.ok) return;
        const data = await res.json();
        const history = (data?.history || []).filter((x: any) => x?.close != null && Number.isFinite(Number(x.close)));
        if (!history.length) return;

        const input = buildQuantumInputFromMarketData({
          horizon,
          ticker: s.ticker,
          quote: data?.quote,
          history,
          userHasPosition: false,
        });
        const fresh = evaluateStockRecommendation(input, { ticker: s.ticker, companyName: s.companyName });
        const check = checkSuggestedBuyFade(s, fresh);
        if (check.fire) {
          fires.push({ ticker: s.ticker, price: input.currentPrice, reason: check.reason, at: Date.now() });
        }
      } catch {
        /* best-effort scan across tracked tickers — one bad fetch shouldn't block the rest */
      }
    })
  );

  return fires;
}
