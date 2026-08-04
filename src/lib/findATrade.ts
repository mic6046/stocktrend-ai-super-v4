/**
 * Find a Trade — batch scout over user ticker lists using Consensus AI.
 * Surfaces names whose horizon recommendation is BUY / STRONG BUY
 * (matches the Recommendation card users see), then ranks by setup quality.
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

export type FindATradeKnownHint = {
  recommendation?: string | null;
  score?: number | null;
  confidence?: number | null;
  expectedReturn?: number | null;
  price?: number | null;
  name?: string | null;
};

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

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** Same score→label bands as the Recommendation / Quantum score card. */
export function recommendationFromScore(score: number): RecommendationLabel {
  if (score >= 85) return 'STRONG BUY';
  if (score >= 70) return 'BUY';
  if (score >= 60) return 'HOLD';
  if (score >= 50) return 'REDUCE';
  if (score >= 40) return 'SELL';
  return 'AVOID NEW POSITION';
}

const REC_RANK: Record<RecommendationLabel, number> = {
  'STRONG BUY': 6,
  BUY: 5,
  HOLD: 4,
  REDUCE: 3,
  SELL: 2,
  'AVOID NEW POSITION': 1,
};

function parseRecommendationLabel(raw: string | null | undefined): RecommendationLabel | null {
  const s = String(raw || '')
    .trim()
    .toUpperCase();
  if (!s) return null;
  if (s.includes('STRONG BUY') || s.includes('VERY STRONG') || s.includes('EXCEPTIONAL')) return 'STRONG BUY';
  if (s.includes('ACCUMULAT')) return 'BUY';
  if (s === 'BUY' || (s.includes('BUY') && !s.includes('AVOID'))) return 'BUY';
  if (s.includes('REDUCE')) return 'REDUCE';
  if (s.includes('SELL') && !s.includes('STRONG')) return 'SELL';
  if (s.includes('AVOID') || s.includes('STRONG SELL')) return 'AVOID NEW POSITION';
  if (s.includes('HOLD') || s.includes('NEUTRAL')) return 'HOLD';
  return null;
}

function mostBullish(labels: Array<RecommendationLabel | null | undefined>): RecommendationLabel {
  let best: RecommendationLabel = 'HOLD';
  for (const lab of labels) {
    if (!lab) continue;
    if (REC_RANK[lab] > REC_RANK[best]) best = lab;
  }
  return best;
}

function techSignalLabel(tech: any): RecommendationLabel | null {
  const sig = String(tech?.masterScores?.signal || tech?.advancedIndicators?.aiBuyScore?.signal || '')
    .trim()
    .toUpperCase();
  if (sig === 'STRONG_BUY') return 'STRONG BUY';
  if (sig === 'BUY') return 'BUY';
  if (sig === 'HOLD') return 'HOLD';
  if (sig === 'REDUCE') return 'REDUCE';
  if (sig === 'SELL') return 'SELL';
  return null;
}

/** Technical-only Quantum-ish score so scout BUYs track chart analysis when full AI score is absent. */
function scoutBaseScore(tech: any, px: number): number {
  const ai = tech?.masterScores?.aiBuyScore;
  if (ai != null && Number.isFinite(Number(ai))) return clamp(Math.round(Number(ai)), 1, 99);

  let s = 58;
  const rsi = tech?.indicators?.rsi;
  if (rsi != null && Number.isFinite(rsi)) {
    if (rsi < 32) s += 10;
    else if (rsi < 45) s += 6;
    else if (rsi > 72) s -= 12;
    else if (rsi > 65) s -= 5;
    else s += 3;
  }
  const macd = tech?.indicators?.macd;
  if (macd != null) {
    s += macd.macdLine > macd.signalLine ? 7 : -6;
  }
  if (tech?.indicators?.ema20 != null) s += px > tech.indicators.ema20 ? 5 : -5;
  if (tech?.indicators?.sma50 != null) s += px > tech.indicators.sma50 ? 5 : -4;
  const ad = tech?.quantumRefinement?.accumulationDistribution?.status;
  if (ad === 'ACCUMULATION') s += 8;
  if (ad === 'DISTRIBUTION') s -= 8;
  const trend = tech?.quantumRefinement?.trendStrength?.status;
  if (typeof trend === 'string') {
    if (/strong|bull|up/i.test(trend)) s += 6;
    if (/weak|bear|down/i.test(trend)) s -= 6;
  }
  const sm = tech?.quantumRefinement?.smartMoneyIndex?.status;
  if (sm === 'BULLISH') s += 5;
  if (sm === 'BEARISH') s -= 5;
  return clamp(Math.round(s), 35, 92);
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
  // Prefer live BUY-zone entries, but still rank WAIT/HOLD thesis BUYs highly
  const actionBoost =
    c.currentAction === 'BUY'
      ? 18
      : c.currentAction === 'WAIT'
        ? 10
        : c.currentAction === 'HOLD'
          ? 6
          : c.currentAction === 'AVOID NEW POSITION'
            ? -8
            : 0;
  const recBoost = c.recommendation === 'STRONG BUY' ? 14 : c.recommendation === 'BUY' ? 10 : 0;
  return c.score * 0.35 + c.confidence * 0.3 + Math.max(0, c.expectedReturn) * 2.2 + actionBoost + recBoost;
}

async function scoutOne(
  ticker: string,
  horizon: HorizonKey,
  fetchJson: (url: string) => Promise<any>,
  known?: FindATradeKnownHint | null
): Promise<FindATradeCandidate> {
  try {
    const data = await fetchJson(
      `/api/stock?ticker=${encodeURIComponent(ticker)}&range=3mo&interval=1d`
    );
    const history = (data?.history || []).filter(
      (h: any) => h?.close != null && Number.isFinite(Number(h.close))
    );
    if (!history.length) {
      // Still honor an already-analyzed BUY from the open Recommendation card / predict cache
      const knownRec =
        parseRecommendationLabel(known?.recommendation) ||
        (known?.score != null ? recommendationFromScore(Number(known.score)) : null);
      if (knownRec === 'BUY' || knownRec === 'STRONG BUY') {
        return {
          ticker,
          name: known?.name || ticker,
          price: Number(known?.price) || 0,
          recommendation: knownRec,
          currentAction: 'WAIT',
          confidence: Number(known?.confidence) || 70,
          score: Number(known?.score) || 70,
          expectedReturn: Number(known?.expectedReturn) || 3,
          why: 'Using your open analysis / cached Quantum score (no fresh history in scout).',
          tradeScore: 0,
          isBuyCandidate: true,
        };
      }
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
      Number(known?.price) ||
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
    const knownScore =
      known?.score != null && Number.isFinite(Number(known.score)) ? Number(known.score) : null;
    const techScore = scoutBaseScore(tech, px);
    // Prefer the live Quantum / Recommendation card score when we already analyzed this ticker
    const baseScore = clamp(Math.round(knownScore ?? techScore), 1, 99);
    // Horizon-scaled target so 1M/3M BUY can clear return + buy gates like the main card
    const horizonLift = horizon === '1W' ? 0.03 : horizon === '1M' ? 0.06 : horizon === '3M' ? 0.1 : 0.16;
    const bullLift = horizonLift * 1.7;
    const bearLift = horizonLift * 0.9;

    const engine = runQuantumRecommendationEngine({
      horizon,
      currentPrice: px,
      baseScore,
      baseConfidence: clamp(
        Math.round(
          known?.confidence != null && Number.isFinite(Number(known.confidence))
            ? Number(known.confidence)
            : baseScore * 0.85 + 8
        ),
        45,
        92
      ),
      baseTarget: px * (1 + horizonLift),
      bullTarget: px * (1 + bullLift),
      bearTarget: px * (1 - bearLift),
      baseReturn:
        known?.expectedReturn != null && Number.isFinite(Number(known.expectedReturn))
          ? Number(known.expectedReturn)
          : horizonLift * 100,
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

    // Align Find a Trade with the Recommendation card:
    // 1) already-analyzed Quantum score / rating (known hint)
    // 2) score bands (70+ = BUY) — engine buy-gates often collapse BUY→HOLD in scout
    // 3) technical master signal
    // 4) engine finalVerdict
    const knownRec = parseRecommendationLabel(known?.recommendation);
    const scoreRec = recommendationFromScore(
      Math.max(baseScore, engine.score, Number.isFinite(techScore) ? techScore : 0)
    );
    const techRec = techSignalLabel(tech);
    const recommendation = mostBullish([knownRec, scoreRec, techRec, engine.finalVerdict]);
    const isBuyCandidate = recommendation === 'BUY' || recommendation === 'STRONG BUY';

    const candidate: FindATradeCandidate = {
      ticker: String(data?.ticker || ticker).toUpperCase(),
      name: known?.name || data?.quote?.shortName || data?.quote?.longName || ticker,
      price: engine.currentPrice || px,
      recommendation,
      currentAction: engine.currentAction.action,
      confidence: Math.round(
        known?.confidence != null && Number.isFinite(Number(known.confidence))
          ? Number(known.confidence)
          : engine.confidence
      ),
      score: Math.round(Math.max(baseScore, engine.score)),
      expectedReturn:
        known?.expectedReturn != null && Number.isFinite(Number(known.expectedReturn))
          ? Number(known.expectedReturn)
          : engine.expectedReturn,
      why:
        knownRec && (knownRec === 'BUY' || knownRec === 'STRONG BUY')
          ? `Matched open/cached analysis (${knownRec}). ${engine.whyWins}`
          : engine.whyWins,
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
  /** Already-analyzed names (open card + predict cache) — keeps scout aligned with Recommendation. */
  knownByTicker?: Record<string, FindATradeKnownHint>;
  fetchJson?: (url: string) => Promise<any>;
  onProgress?: (p: FindATradeProgress) => void;
}): Promise<FindATradeResult> {
  const tickers = opts.tickers.slice(0, FIND_A_TRADE_MAX);
  const horizon = opts.horizon ?? '1M';
  const concurrency = opts.concurrency ?? 3;
  const knownByTicker = opts.knownByTicker || {};
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
    (ticker) => {
      const key = normalizeTicker(ticker);
      return scoutOne(ticker, horizon, fetchJson, knownByTicker[key] || null);
    },
    (done, ticker) => opts.onProgress?.({ done, total: tickers.length, current: String(ticker) })
  );

  // Recompute rank after known overrides
  for (const c of scanned) c.tradeScore = rankScore(c);

  const buyCandidates = scanned
    .filter((c) => c.isBuyCandidate)
    .sort((a, b) => b.tradeScore - a.tradeScore);

  // Prefer live action BUY over WAIT when ranking top pick, but never hide WAIT thesis BUYs
  const actionable = buyCandidates.filter((c) => c.currentAction === 'BUY');
  const topPick = (actionable[0] || buyCandidates[0]) ?? null;

  const waitOnly =
    topPick && topPick.currentAction !== 'BUY'
      ? ` · Do now: ${topPick.currentAction} (entry timing — thesis is still ${topPick.recommendation})`
      : topPick
        ? ` · Do now: ${topPick.currentAction}`
        : '';

  return {
    scanned,
    buyCandidates,
    topPick,
    message: topPick
      ? `Top trade: ${topPick.ticker} · ${topPick.recommendation}${waitOnly}`
      : 'No BUY / STRONG BUY recommendation in this list. Try another paste list or market/theme.',
  };
}
