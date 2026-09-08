import { useCallback, useRef } from 'react';
import { loadPortfolio } from './portfolioStore';
import { scanHoldingsForTakePartialProfit, type ProfitAlertFireEvent } from './portfolioProfitWatcher';

/** Don't re-fire the same ticker's Take Partial Profit call on every scan while the underlying setup hasn't changed. */
const COOLDOWN_MS = 4 * 60 * 60 * 1000;

/**
 * No background timer — deliberately. Re-checks your holdings only when the
 * caller explicitly triggers scanNow() (Today's Picks calls this on its own
 * open/refresh cycle, the same trigger Buy Now uses), not on a schedule.
 */
export function usePortfolioProfitWatcher(onFire: (event: ProfitAlertFireEvent) => void) {
  const lastFiredRef = useRef<Map<string, number>>(new Map());
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;

  const scanNow = useCallback(async () => {
    const holdings = loadPortfolio();
    if (!holdings.length) return;

    const fires = await scanHoldingsForTakePartialProfit(holdings);
    const now = Date.now();
    for (const fire of fires) {
      const last = lastFiredRef.current.get(fire.ticker);
      if (last != null && now - last < COOLDOWN_MS) continue;
      lastFiredRef.current.set(fire.ticker, now);
      onFireRef.current(fire);
    }
  }, []);

  return { scanNow };
}
