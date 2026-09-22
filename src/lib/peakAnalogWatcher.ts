import { apiUrl, loggedFetch } from './api';
import { analyzePeakAnalogs } from './peakAnalog';
import { checkPeakAnalogWarning } from './peakAnalogWarningTrigger';

export type PeakAnalogFireEvent = {
  ticker: string;
  price: number;
  reason: string;
  at: number;
};

export type WatchedName = { ticker: string; name?: string };

/**
 * "Wide" watcher — scans BOTH your portfolio holdings and your watchlist
 * (deduped by ticker), not just one or the other, since the whole point of
 * "warn me when it's reaching a peak" is to cover everything you're actually
 * paying attention to, not only what you currently own.
 *
 * Same cadence as the other watchers — daily-bar data, checked on open/
 * refresh, not a live poller. Peak-analog conditions (RSI, extension above
 * the 50-day MA) build up over days, not minutes.
 */
export async function scanForPeakAnalogWarnings(names: WatchedName[]): Promise<PeakAnalogFireEvent[]> {
  const fires: PeakAnalogFireEvent[] = [];

  await Promise.all(
    names.map(async (n) => {
      try {
        const res = await loggedFetch(
          apiUrl(`/api/stock?ticker=${encodeURIComponent(n.ticker)}&range=2y&interval=1d`),
          { __qnTrigger: 'peak-analog-watcher' } as any
        );
        if (!res.ok) return;
        const data = await res.json();
        const history = (data?.history || []).filter((x: any) => x?.close != null && Number.isFinite(Number(x.close)));
        if (!history.length) return;

        const result = analyzePeakAnalogs(history);
        const check = checkPeakAnalogWarning(n.ticker, result);
        if (check.fire && result) {
          fires.push({ ticker: n.ticker, price: result.current.price, reason: check.reason, at: Date.now() });
        }
      } catch {
        /* best-effort scan across the whole list — one bad fetch shouldn't block the rest */
      }
    })
  );

  return fires;
}
