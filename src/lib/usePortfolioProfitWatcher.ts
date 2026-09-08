import { useCallback, useEffect, useRef } from 'react';
import { loadPortfolio } from './portfolioStore';
import { scanHoldingsForTakePartialProfit, type ProfitAlertFireEvent } from './portfolioProfitWatcher';

/** Don't re-fire the same ticker's Take Partial Profit call on every scan while the underlying setup hasn't changed. */
const COOLDOWN_MS = 4 * 60 * 60 * 1000;
/** Slower than Buy Now's 60s poll — "reaching resistance with outflow" forms over hours, not minutes. */
const SCAN_INTERVAL_MS = 15 * 60 * 1000;

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

  useEffect(() => {
    void scanNow();
    const id = setInterval(() => {
      void scanNow();
    }, SCAN_INTERVAL_MS);
    return () => clearInterval(id);
  }, [scanNow]);

  return { scanNow };
}
