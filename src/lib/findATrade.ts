/**
 * Find a Trade — batch scout over user ticker lists using Consensus AI.
 * Only surfaces names that clear BUY / STRONG BUY with a constructive live action.
 */

import { computeTechnicalIndicators } from './technical';
import { apiUrl, loggedFetch } from './api';
import {
  runQuantumRecommendationEngine,
  type RecommendationLabel,
  type ZoneAction,
} from './quantumRecommendationEngine';
import type { HorizonKey } from '../components/analysis/analysisTheme';

export const FIND_A_TRADE_MAX = 20;

export type FindATradeCandidate = {
  ticker: string;
  name: string;
  price: number;
  recommendation: RecommendationLabel;
  currentAction: ZoneAction;
  confidence: number;
  score: number;
  expectedReturn: number;
  why: string;
  tradeScore: number;
  isBuyCandidate: boolean;
  error?: string;
};

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

function rankScore(c: FindATradeCandidate): number {
  if (!c.isBuyCandidate) return -1e9;
  const actionBoost = c.currentAction === 'BUY' ? 18 : c.currentAction === 'WAIT' ? 4 : 0;
  const recBoost = c.recommendation === 'STRONG BUY' ? 12 : c.recommendation === 'BUY' ? 8 : 0;
  return c.score * 0.35 + c.confidence * 0.3 + Math.max(0, c.expectedReturn) * 2.2 + actionBoost + recBoost;
}

async function scoutOne(
  ticker: string,
  horizon: HorizonKey,
  fetchJson: (url: string) => Promise<any>
): Promise<FindATradeCandidate> {
  try {
    const data = await fetchJson(
      `/api/stock?ticker=${encodeURIComponent(ticker)}&range=3mo&interval=1d`
    );
    const history = (data?.history || []).filter(
      (h: any) => h?.close != null && Number.isFinite(Number(h.close))
    );
    if (!history.length) {
      return {
        ticker,
        name: ticker,
        price: 0,
        recommendation: 'HOLD',
        currentAction: 'WAIT',
        confidence: 0,
        score: 0,
        expectedReturn: 0,
        why: 'No price history returned.',
        tradeScore: -1e9,
        isBuyCandidate: false,
        error: 'No history',
      };
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

    const engine = runQuantumRecommendationEngine({
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
    });

    const isBuyCandidate =
      (engine.finalVerdict === 'BUY' || engine.finalVerdict === 'STRONG BUY') &&
      (engine.currentAction.action === 'BUY' || engine.currentAction.action === 'WAIT') &&
      engine.expectedReturn > 0;

    const candidate: FindATradeCandidate = {
      ticker: String(data?.ticker || ticker).toUpperCase(),
      name: data?.quote?.shortName || data?.quote?.longName || ticker,
      price: engine.currentPrice,
      recommendation: engine.finalVerdict,
      currentAction: engine.currentAction.action,
      confidence: engine.confidence,
      score: engine.score,
      expectedReturn: engine.expectedReturn,
      why: engine.whyWins,
      tradeScore: 0,
      isBuyCandidate,
    };
    candidate.tradeScore = rankScore(candidate);
    return candidate;
  } catch (err: any) {
    return {
      ticker,
      name: ticker,
      price: 0,
      recommendation: 'HOLD',
      currentAction: 'WAIT',
      confidence: 0,
      score: 0,
      expectedReturn: 0,
      why: err?.message || 'Scout failed',
      tradeScore: -1e9,
      isBuyCandidate: false,
      error: err?.message || 'Scout failed',
    };
  }
}

export type FindATradeResult = {
  scanned: FindATradeCandidate[];
  buyCandidates: FindATradeCandidate[];
  topPick: FindATradeCandidate | null;
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
          userAction: 'Click Find/Suggest Trade',
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

  const scanned = await mapPool(
    tickers,
    concurrency,
    (ticker) => scoutOne(ticker, horizon, fetchJson),
    (done, ticker) => opts.onProgress?.({ done, total: tickers.length, current: String(ticker) })
  );

  const buyCandidates = scanned
    .filter((c) => c.isBuyCandidate)
    .sort((a, b) => b.tradeScore - a.tradeScore);

  // Prefer live action BUY over WAIT when ranking top pick
  const actionable = buyCandidates.filter((c) => c.currentAction === 'BUY');
  const topPick = (actionable[0] || buyCandidates[0]) ?? null;

  return {
    scanned,
    buyCandidates,
    topPick,
    message: topPick
      ? `Top trade: ${topPick.ticker} · ${topPick.recommendation} · Do now: ${topPick.currentAction}`
      : 'No BUY trade cleared Consensus gates in this list. Wait or refresh the universe.',
  };
}
