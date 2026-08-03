/**
 * Find a Trade — scouts tickers via AI Quantum Score (SSOT).
 * No independent BUY/HOLD/SELL or ranking logic: rank = Quantum Overall Score.
 */

import { computeTechnicalIndicators } from './technical';
import { apiUrl, loggedFetch } from './api';
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

function roughLevels(closes: number[], px: number) {
  if (closes.length < 10) {
    return { s1: px * 0.97, s2: px * 0.94, r1: px * 1.03, r2: px * 1.06 };
  }
  const window = closes.slice(-40);
  const lo = Math.min(...window);
  const hi = Math.max(...window);
  const mid = (lo + hi) / 2;
  return {
    s1: Math.min(px * 0.98, mid + (lo - mid) * 0.35),
    s2: lo,
    r1: Math.max(px * 1.02, mid + (hi - mid) * 0.35),
    r2: hi,
  };
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
    const data = await fetchJson(
      `/api/stock?ticker=${encodeURIComponent(ticker)}&range=3mo&interval=1d`
    );
    const history = (data?.history || []).filter(
      (h: any) => h?.close != null && Number.isFinite(Number(h.close))
    );
    if (!history.length) {
      return errorRecommendation(ticker, 'No price history returned.');
    }

    const px =
      Number(data?.quote?.regularMarketPrice) ||
      Number(history[history.length - 1].close) ||
      0;
    const tech = computeTechnicalIndicators(history, data?.quote);
    const closes = history.map((h: any) => Number(h.close));
    const levels = roughLevels(closes, px);
    const instFlow = tech?.indicators?.institutionalFlow?.status;
    const ad = tech?.quantumRefinement?.accumulationDistribution?.status;
    const sm = tech?.quantumRefinement?.smartMoneyIndex?.status;
    const sector = tech?.quantumRefinement?.sectorRotation?.status;

    const whaleScore =
      ad === 'ACCUMULATION' ? 78 : ad === 'DISTRIBUTION' ? 32 : 52;
    const institutionalScore =
      instFlow === 'LARGE_INFLOW' || instFlow === 'STEALTH_ACCUMULATION'
        ? 80
        : instFlow === 'LARGE_OUTFLOW' || instFlow === 'STEALTH_DISTRIBUTION'
          ? 30
          : 55;
    const smartMoneyScore = sm === 'BULLISH' ? 85 : sm === 'BEARISH' ? 35 : 50;

    const companyName =
      data?.quote?.shortName || data?.quote?.longName || String(data?.ticker || ticker);

    // ONE evaluation — AI Quantum Score is the only recommendation engine.
    return evaluateStockRecommendation(
      {
        horizon,
        currentPrice: px,
        baseScore: tech?.masterScores?.aiBuyScore ?? 60,
        baseConfidence: 65,
        baseTarget: px * 1.06,
        bullTarget: px * 1.12,
        bearTarget: px * 0.92,
        technical: {
          rsi: tech?.indicators?.rsi ?? null,
          macdBullish:
            tech?.indicators?.macd != null
              ? tech.indicators.macd.macdLine > tech.indicators.macd.signalLine
              : null,
          trend: tech?.quantumRefinement?.trendStrength?.status ?? null,
          volatility: tech?.indicators?.volatility ?? null,
          emaBias:
            tech?.indicators?.ema20 != null && px > tech.indicators.ema20 ? 'bull' : 'bear',
          smaBias:
            tech?.indicators?.sma50 != null && px > tech.indicators.sma50 ? 'bull' : 'bear',
          bollingerBias:
            tech?.indicators?.bollinger?.percent != null
              ? tech.indicators.bollinger.percent <= 0.2
                ? 'oversold'
                : tech.indicators.bollinger.percent >= 0.8
                  ? 'overbought'
                  : 'mid'
              : null,
          obvBias: ad === 'ACCUMULATION' ? 'bull' : ad === 'DISTRIBUTION' ? 'bear' : 'neutral',
          volumeBias:
            (tech?.quantumRefinement?.rvol?.ratio ?? 1) >= 1.4
              ? 'high'
              : (tech?.quantumRefinement?.rvol?.ratio ?? 1) <= 0.7
                ? 'low'
                : 'normal',
        },
        levels,
        whaleScore,
        institutionalScore,
        sentimentScore: 58,
        momentumScore: tech?.indicators?.rsi != null ? Math.round(tech.indicators.rsi) : 55,
        smartMoneyScore,
        fundFlowBias: ad === 'ACCUMULATION' ? 'inflow' : ad === 'DISTRIBUTION' ? 'outflow' : 'neutral',
        sectorBias: sector === 'LEADER' ? 'leader' : sector === 'LAGGARD' ? 'laggard' : 'neutral',
        userHasPosition: false,
        ticker,
      },
      {
        ticker: String(data?.ticker || ticker).toUpperCase(),
        companyName,
        dataTimestamp: Date.now(),
      }
    );
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

  // Rank EVERY stock by Quantum Overall Score (SSOT) — no secondary tradeScore.
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
