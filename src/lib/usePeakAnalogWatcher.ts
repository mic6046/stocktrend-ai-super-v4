import { useCallback, useRef } from 'react';
import { loadPortfolio } from './portfolioStore';
import { loadWatchlist } from './watchlistStore';
import { scanForPeakAnalogWarnings, type PeakAnalogFireEvent, type WatchedName } from './peakAnalogWatcher';

/** Peak-analog conditions build up over days, not hours — a longer cooldown
 * than the profit watcher's 4h is appropriate so this doesn't re-fire on
 * every refresh while a stock just sits near its high for a while. */
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * "Wide" watcher — covers both your portfolio holdings AND your watchlist,
 * deduped by ticker, so it warns on anything you're actually tracking, not
 * only what you currently own. No background timer — re-checked only when
 * the caller explicitly triggers scanNow(), same as the other watchers.
 */
export function usePeakAnalogWatcher(onFire: (event: PeakAnalogFireEvent) => void) {
  const lastFiredRef = useRef<Map<string, number>>(new Map());
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;

  const scanNow = useCallback(async () => {
    const holdings = loadPortfolio();
    const watchlist = loadWatchlist();
    const byTicker = new Map<string, WatchedName>();
    for (const h of holdings) byTicker.set(h.ticker, { ticker: h.ticker, name: h.name });
    for (const w of watchlist) if (!byTicker.has(w.ticker)) byTicker.set(w.ticker, { ticker: w.ticker, name: w.name });
    const names = Array.from(byTicker.values());
    if (!names.length) return;

    const fires = await scanForPeakAnalogWarnings(names);
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
