import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl, loggedFetch } from './api';
import {
  evaluateBuyNowTrigger,
  createBuyNowArmedState,
  DEFAULT_BUY_NOW_CONFIG,
  type BuyZone,
  type BuyNowArmedState,
  type BuyNowConfig,
  type QuoteSample,
} from './buyNowTrigger';

/**
 * Client-side V1 of the "Buy Now" watcher: polls live quotes for armed
 * tickers every minute and runs each sample through evaluateBuyNowTrigger.
 * Only works while this hook is mounted (i.e. the app is open) — a known
 * V1 limitation; a server-side poller is the natural V2 for
 * notify-me-even-when-closed. Does not consume analysis-credit quota:
 * /api/quote is a plain live-price lookup, not an AI analysis call.
 */

export type BuyNowWatchTarget = {
  ticker: string;
  zone: BuyZone;
  /** Baseline average daily volume (e.g. the 10-day average from data already
   * fetched when the candidate was qualified) used to turn live volume into RVOL. */
  avgDailyVolume: number;
};

export type BuyNowStatus = {
  ticker: string;
  armedAt: number;
  lastPolledAt: number | null;
  confirmingCount: number;
  reason: string;
  error?: string;
};

export type BuyNowFireEvent = {
  ticker: string;
  price: number;
  reason: string;
  at: number;
};

const POLL_INTERVAL_MS = 60_000;

export function useBuyNowWatcher(
  onFire: (event: BuyNowFireEvent) => void,
  config: BuyNowConfig = DEFAULT_BUY_NOW_CONFIG
) {
  const [statuses, setStatuses] = useState<Record<string, BuyNowStatus>>({});
  const targetsRef = useRef<Map<string, BuyNowWatchTarget>>(new Map());
  const armedStateRef = useRef<Map<string, BuyNowArmedState>>(new Map());
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;

  const arm = useCallback((target: BuyNowWatchTarget) => {
    targetsRef.current.set(target.ticker, target);
    armedStateRef.current.set(target.ticker, createBuyNowArmedState());
    setStatuses((prev) => ({
      ...prev,
      [target.ticker]: {
        ticker: target.ticker,
        armedAt: Date.now(),
        lastPolledAt: null,
        confirmingCount: 0,
        reason: 'Watching for entry…',
      },
    }));
  }, []);

  const disarm = useCallback((ticker: string) => {
    const key = ticker.toUpperCase();
    targetsRef.current.delete(key);
    armedStateRef.current.delete(key);
    setStatuses((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const isArmed = useCallback((ticker: string) => targetsRef.current.has(ticker.toUpperCase()), []);

  const pollOnce = useCallback(async () => {
    const targets = Array.from(targetsRef.current.values());
    if (!targets.length) return;

    await Promise.all(
      targets.map(async (target) => {
        try {
          const res = await loggedFetch(
            apiUrl(`/api/quote/${encodeURIComponent(target.ticker)}`),
            { __qnTrigger: 'buy-now-watcher' } as any
          );
          if (!res.ok) throw new Error(`Quote fetch failed (${res.status})`);
          const data = await res.json();
          const price = Number(data?.quote?.regularMarketPrice);
          const volume = Number(data?.quote?.regularMarketVolume);
          const marketState = data?.quote?.marketState ?? null;
          if (!Number.isFinite(price) || !Number.isFinite(volume)) {
            throw new Error('Quote missing price/volume');
          }
          const rvol = target.avgDailyVolume > 0 ? volume / target.avgDailyVolume : 1;
          const sample: QuoteSample = { price, rvol, at: Date.now(), marketState };

          const prior = armedStateRef.current.get(target.ticker) ?? createBuyNowArmedState();
          const evaluation = evaluateBuyNowTrigger(sample, target.zone, prior, config);
          armedStateRef.current.set(target.ticker, evaluation.state);

          setStatuses((prev) => ({
            ...prev,
            [target.ticker]: {
              ticker: target.ticker,
              armedAt: prev[target.ticker]?.armedAt ?? Date.now(),
              lastPolledAt: sample.at,
              confirmingCount: evaluation.confirmingCount,
              reason: evaluation.reason,
            },
          }));

          if (evaluation.fire) {
            onFireRef.current({ ticker: target.ticker, price, reason: evaluation.reason, at: sample.at });
          }
        } catch (err: any) {
          setStatuses((prev) => ({
            ...prev,
            [target.ticker]: {
              ticker: target.ticker,
              armedAt: prev[target.ticker]?.armedAt ?? Date.now(),
              lastPolledAt: Date.now(),
              confirmingCount: prev[target.ticker]?.confirmingCount ?? 0,
              reason: prev[target.ticker]?.reason ?? '',
              error: err?.message || 'Poll failed',
            },
          }));
        }
      })
    );
  }, [config]);

  useEffect(() => {
    const id = setInterval(() => {
      void pollOnce();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pollOnce]);

  return { statuses, arm, disarm, isArmed, pollOnce };
}
