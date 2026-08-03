/**
 * Find a Trade — scouts tickers via AI Quantum Score (SSOT).
 * Uses the same market-data → Quantum input builder as Individual Analysis.
 */

import { apiUrl, loggedFetch } from './api';
import { buildQuantumInputFromMarketData } from './quantumInputBuilder';
import {
  evaluateStockRecommendation,
  formatActionNote,
  formatRecommendationDisplay,
  rankByQuantumScore,
  selectBuyCandidates,
  type StockRecommendation,
} from './recommendation';
import type { HorizonKey } from '../components/analysis/analysisTheme';

export const FIND_A_TRADE_MAX = 30;

/** @deprecated Prefer StockRecommendation — kept as alias for UI compatibility. */
export type FindATradeCandidate = StockRecommendation;

export type FindATradeProgress = {
  done: number;
  total: number;
  current?: string;
};

function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase().replace(/^\$/, '');
}

/** Parse comma / space / newline separated tickers; dedupe; cap list size. */
export function parseTickerList(input: string, max = FIND_A_TRADE_MAX): string[] {
  const parts = input
    .split(/[\s,;|]+/)
    .map(normalizeTicker)
    .filter((t) => /^[A-Z0-9.-]{1,16}$/.test(t));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of parts) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

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

function errorRecommendation(ticker: string, message: string): StockRecommendation {
  const ts = Date.now();
  return {
    ticker,
    companyName: ticker,
    overallScore: 0,
    confidence: 0,
    recommendation: 'HOLD',
    currentAction: 'WAIT',
    currentActionReason: message,
    entryZone: { lo: 0, hi: 0 },
    targetPrice: 0,
    stopLoss: 0,
    expectedReturn: 0,
    riskScore: 100,
    riskLabel: 'High',
    aiExplanation: message,
    indicatorScores: {
      technical: 0,
      fundamental: 0,
      whale: 0,
      news: 0,
      risk: 0,
      momentum: 0,
      overall: 0,
    },
    ranking: 0,
    dataTimestamp: ts,
    isBuyCandidate: false,
    engine: null,
    error: message,
  };
}

async function scoutOne(
  ticker: string,
  horizon: HorizonKey,
  fetchJson: (url: string) => Promise<any>
): Promise<StockRecommendation & { error?: string }> {
  try {
    // Match individual-analysis lookback (1y daily) so Quantum inputs align.
    const data = await fetchJson(
      `/api/stock?ticker=${encodeURIComponent(ticker)}&range=1y&interval=1d`
    );
    const history = (data?.history || []).filter(
      (h: any) => h?.close != null && Number.isFinite(Number(h.close))
    );
    if (!history.length) {
      return errorRecommendation(ticker, 'No price history returned.');
    }

    const sym = String(data?.ticker || ticker).toUpperCase();
    const companyName =
      data?.quote?.shortName || data?.quote?.longName || sym;

    const input = buildQuantumInputFromMarketData({
      horizon,
      ticker: sym,
      quote: data?.quote,
      history,
      userHasPosition: false,
    });

    return evaluateStockRecommendation(input, {
      ticker: sym,
      companyName,
      dataTimestamp: Date.now(),
    });
  } catch (err: any) {
    return errorRecommendation(ticker, err?.message || 'Scout failed');
  }
}

export type FindATradeResult = {
  scanned: Array<StockRecommendation & { error?: string }>;
  buyCandidates: StockRecommendation[];
  topPick: StockRecommendation | null;
  message: string;
};

export async function findATrade(opts: {
  tickers: string[];
  horizon?: HorizonKey;
  concurrency?: number;
  fetchJson?: (url: string) => Promise<any>;
  onProgress?: (p: FindATradeProgress) => void;
}): Promise<FindATradeResult> {
  const tickers = opts.tickers.slice(0, FIND_A_TRADE_MAX);
  const horizon = opts.horizon ?? '1M';
  const concurrency = opts.concurrency ?? 3;
  const fetchJson =
    opts.fetchJson ??
    (async (url: string) => {
      const res = await loggedFetch(apiUrl(url), {
        __qnMeta: {
          reason: 'find-or-suggest-trade',
          userAction: 'Click Find a Trade +',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });

  if (!tickers.length) {
    return {
      scanned: [],
      buyCandidates: [],
      topPick: null,
      message: 'Enter at least one ticker to scout.',
    };
  }

  opts.onProgress?.({ done: 0, total: tickers.length });

  const raw = await mapPool(
    tickers,
    concurrency,
    (ticker) => scoutOne(ticker, horizon, fetchJson),
    (done, ticker) => opts.onProgress?.({ done, total: tickers.length, current: String(ticker) })
  );

  const scanned = rankByQuantumScore(raw) as Array<StockRecommendation & { error?: string }>;
  const buyCandidates = selectBuyCandidates(scanned);
  const topPick = buyCandidates[0] ?? null;

  return {
    scanned,
    buyCandidates,
    topPick,
    message: topPick
      ? `Top trade: ${topPick.ticker} · ${formatRecommendationDisplay(topPick)} · ${formatActionNote(topPick)}`
      : 'No BUY / STRONG BUY cleared AI Quantum Score gates in this list. Wait or refresh the universe.',
  };
}

export { formatActionNote, formatRecommendationDisplay };
