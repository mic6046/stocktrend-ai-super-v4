/**
 * Day Trade scout — batch scan popular liquid names in a selected market
 * for same-session tradeability (liquidity, ATR range, momentum bias).
 */

import { computeTechnicalIndicators } from './technical';
import { apiUrl, loggedFetch } from './api';
import {
  formatDayTradeStrip,
  scoreDayTrade,
  type DayTradeBias,
  type DayTradeFactor,
} from './dayTradeEngine';
import {
  buildSuggestUniverse,
  type SuggestMarket,
} from './suggestTradeUniverses';

export const DAY_TRADE_MAX = 20;

export type DayTradeCandidate = {
  ticker: string;
  name: string;
  price: number;
  bias: DayTradeBias;
  biasDetail: string;
  score: number;
  atrPct: number;
  rvol: number;
  why: string;
  tradeScore: number;
  isDayTradeCandidate: boolean;
  factorRatings?: DayTradeFactor[];
  factorStrip?: string;
  error?: string;
};

export type DayTradeProgress = {
  done: number;
  total: number;
  current?: string;
};

export type DayTradeResult = {
  scanned: DayTradeCandidate[];
  candidates: DayTradeCandidate[];
  watchlist: DayTradeCandidate[];
  topPick: DayTradeCandidate | null;
  cleared: number;
  scannedCount: number;
  message: string;
  market: SuggestMarket;
};

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, item: T) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      const item = items[i];
      results[i] = await worker(item, i);
      done += 1;
      onProgress?.(done, item);
    }
  }
  const n = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: n }, () => run()));
  return results;
}

function rankDayTrade(c: DayTradeCandidate): number {
  if (!c.isDayTradeCandidate) return -1e9;
  const biasBoost =
    c.bias === 'LONG' || c.bias === 'SHORT' ? 12 : c.bias === 'FADE' ? 6 : 0;
  return c.score * 1.2 + c.rvol * 8 + c.atrPct * 2 + biasBoost;
}

function watchRank(c: DayTradeCandidate): number {
  if (c.error || c.price <= 0) return -1e9;
  return c.score + c.rvol * 5 + c.atrPct;
}

async function scoutOne(
  ticker: string,
  nameHint: string,
  fetchJson: (url: string) => Promise<any>,
  bypassCache = true
): Promise<DayTradeCandidate> {
  try {
    const cacheQs = bypassCache ? '&bypassCache=true' : '';
    // 1mo daily is enough for ATR / RVOL / momentum day-trade filters
    const data = await fetchJson(
      `/api/stock?ticker=${encodeURIComponent(ticker)}&range=1mo&interval=1d${cacheQs}`
    );
    const history = (data?.history || []).filter(
      (h: any) => h?.close != null && Number.isFinite(Number(h.close))
    );
    if (!history.length) {
      return {
        ticker,
        name: nameHint || ticker,
        price: 0,
        bias: 'WAIT',
        biasDetail: 'No history',
        score: 0,
        atrPct: 0,
        rvol: 0,
        why: 'No price history returned.',
        tradeScore: -1e9,
        isDayTradeCandidate: false,
        error: 'No history',
      };
    }

    const px =
      Number(data?.quote?.regularMarketPrice) ||
      Number(history[history.length - 1].close) ||
      0;
    const tech = computeTechnicalIndicators(history, data?.quote);
    if (!tech) {
      return {
        ticker,
        name: nameHint || ticker,
        price: 0,
        bias: 'WAIT',
        biasDetail: 'No technicals',
        score: 0,
        atrPct: 0,
        rvol: 0,
        why: 'Technical indicators unavailable.',
        tradeScore: -1e9,
        isDayTradeCandidate: false,
        error: 'No technicals',
      };
    }
    const scored = scoreDayTrade({ technical: tech, price: px, ticker });

    const candidate: DayTradeCandidate = {
      ticker: String(data?.ticker || ticker).toUpperCase(),
      name: data?.quote?.shortName || data?.quote?.longName || nameHint || ticker,
      price: px,
      bias: scored.bias,
      biasDetail: scored.biasDetail,
      score: scored.compositeScore,
      atrPct: scored.atrPct,
      rvol: scored.rvol,
      why: `${scored.summary}. ${scored.biasDetail}`,
      tradeScore: 0,
      isDayTradeCandidate: scored.isDayTradeCandidate,
      factorRatings: scored.factors,
      factorStrip: formatDayTradeStrip(scored.factors),
    };
    candidate.tradeScore = rankDayTrade(candidate);
    return candidate;
  } catch (err: any) {
    return {
      ticker,
      name: nameHint || ticker,
      price: 0,
      bias: 'WAIT',
      biasDetail: err?.message || 'Scout failed',
      score: 0,
      atrPct: 0,
      rvol: 0,
      why: err?.message || 'Scout failed',
      tradeScore: -1e9,
      isDayTradeCandidate: false,
      error: err?.message || 'Scout failed',
    };
  }
}

export async function scoutDayTrades(opts: {
  market: SuggestMarket;
  max?: number;
  concurrency?: number;
  bypassCache?: boolean;
  shuffle?: boolean;
  fetchJson?: (url: string) => Promise<any>;
  onProgress?: (p: DayTradeProgress) => void;
}): Promise<DayTradeResult> {
  const market = opts.market;
  const max = Math.min(opts.max ?? DAY_TRADE_MAX, DAY_TRADE_MAX);
  const concurrency = opts.concurrency ?? 3;
  const bypassCache = opts.bypassCache !== false;
  const universe = buildSuggestUniverse(market, 'ALL', max, {
    shuffle: opts.shuffle !== false,
  });
  const fetchJson =
    opts.fetchJson ??
    (async (url: string) => {
      const res = await loggedFetch(apiUrl(url), {
        __qnMeta: {
          reason: 'day-trade-scout',
          userAction: 'Click Day Trade',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });

  if (!universe.length) {
    return {
      scanned: [],
      candidates: [],
      watchlist: [],
      topPick: null,
      cleared: 0,
      scannedCount: 0,
      message: 'No popular names available for this market.',
      market,
    };
  }

  opts.onProgress?.({ done: 0, total: universe.length });

  const scanned = await mapPool(
    universe,
    concurrency,
    (row) => scoutOne(row.ticker, row.name, fetchJson, bypassCache),
    (done, row) => opts.onProgress?.({ done, total: universe.length, current: row.ticker })
  );

  const candidates = scanned
    .filter((c) => c.isDayTradeCandidate)
    .sort((a, b) => b.tradeScore - a.tradeScore);

  const topPick = candidates[0] ?? null;
  const clearedSet = new Set(candidates.map((c) => c.ticker));
  const watchlist = scanned
    .filter((c) => !clearedSet.has(c.ticker) && !c.error && c.price > 0)
    .map((c) => ({ ...c, tradeScore: watchRank(c) }))
    .sort((a, b) => b.tradeScore - a.tradeScore)
    .slice(0, 5);

  const cleared = candidates.length;
  const scannedCount = scanned.length;

  return {
    scanned,
    candidates,
    watchlist,
    topPick,
    cleared,
    scannedCount,
    market,
    message: topPick
      ? cleared === 1
        ? `Day Trade: 1 of ${scannedCount} cleared · ${topPick.ticker} · ${topPick.bias} · score ${topPick.score}`
        : `Day Trade: ${cleared} of ${scannedCount} cleared · top ${topPick.ticker} · ${topPick.bias} · ${topPick.factorStrip}`
      : `Day Trade: 0 of ${scannedCount} cleared liquidity / range / bias gates. Try another market or refresh.`,
  };
}
