/**
 * Find a Trade — batch scout over user ticker lists using Quantum AI Score.
 * Surfaces names whose AI Quantum Score is BUY / STRONG BUY (score ≥ 70),
 * matching the Recommendation card users see after /api/predict.
 */

import { computeTechnicalIndicators } from './technical';
import { apiUrl, loggedFetch } from './api';
import {
  runQuantumRecommendationEngine,
  type RecommendationLabel,
  type ZoneAction,
} from './quantumRecommendationEngine';
import type { HorizonKey } from '../components/analysis/analysisTheme';
import { persistQuantumHint } from './quantumScoreCache';

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
  /** Where the Quantum score came from */
  scoreSource?: 'predict' | 'cache' | 'known';
  cachedPredict?: boolean;
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

/** Same score→label bands as the Recommendation / Quantum score card (display). */
export function recommendationFromScore(score: number): RecommendationLabel {
  if (score >= 85) return 'STRONG BUY';
  if (score >= 70) return 'BUY';
  if (score >= 60) return 'HOLD';
  if (score >= 50) return 'REDUCE';
  if (score >= 40) return 'SELL';
  return 'AVOID NEW POSITION';
}

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

/** BUY gate: Quantum AI Score ≥ 70 or rating already BUY / STRONG BUY. */
export function isQuantumBuy(
  score: number | null | undefined,
  recommendation?: string | null
): boolean {
  const rec = parseRecommendationLabel(recommendation);
  if (rec === 'BUY' || rec === 'STRONG BUY') return true;
  if (score != null && Number.isFinite(Number(score)) && Number(score) >= 70) return true;
  return false;
}

function labelFromQuantum(
  score: number,
  recommendation?: string | null
): RecommendationLabel {
  const parsed = parseRecommendationLabel(recommendation);
  if (parsed === 'STRONG BUY' || parsed === 'BUY') return parsed;
  if (parsed && !isQuantumBuy(score, recommendation)) return parsed;
  return recommendationFromScore(score);
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
  onProgress?: (done: number, item: T) => void,
  shouldStop?: () => boolean
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  async function run() {
    while (next < items.length) {
      if (shouldStop?.()) break;
      const i = next++;
      if (i >= items.length) break;
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
  // Quantum AI Score dominates ranking
  return c.score * 0.55 + c.confidence * 0.2 + Math.max(0, c.expectedReturn) * 1.8 + actionBoost + recBoost;
}

export class FindQuotaExceededError extends Error {
  usage?: any;
  constructor(message: string, usage?: any) {
    super(message);
    this.name = 'FindQuotaExceededError';
    this.usage = usage;
  }
}

type PredictResult = {
  score: number;
  recommendation: string | null;
  confidence: number | null;
  expectedReturn: number | null;
  why: string;
  source: 'predict' | 'cache' | 'known';
  cachedPredict?: boolean;
  usage?: any;
};

function extractQuantumFromPredict(result: any): Omit<PredictResult, 'source' | 'cachedPredict' | 'usage'> {
  const score = Number(result?.aiStockScore?.totalScore ?? result?.overallScore ?? result?.score);
  const recommendation =
    (typeof result?.aiStockScore?.rating === 'string' && result.aiStockScore.rating) ||
    (typeof result?.recommendation === 'string' && result.recommendation) ||
    (typeof result?.rating === 'string' && result.rating) ||
    null;
  const confidence =
    result?.confidence != null && Number.isFinite(Number(result.confidence))
      ? Number(result.confidence)
      : null;
  const expectedReturn =
    result?.forecastHorizons?.[1]?.expectedReturn != null
      ? Number(result.forecastHorizons[1].expectedReturn)
      : result?.ensembleForecast?.baseCase?.expectedReturn != null
        ? Number(result.ensembleForecast.baseCase.expectedReturn)
        : null;
  const why =
    result?.aiStockScore?.overallExplanation ||
    result?.whyBuyNow ||
    result?.newsSummary ||
    'Quantum AI Score from full analysis.';
  return {
    score: Number.isFinite(score) ? score : 0,
    recommendation,
    confidence,
    expectedReturn,
    why: String(why).slice(0, 280),
  };
}

async function scoutOne(
  ticker: string,
  horizon: HorizonKey,
  fetchJson: (url: string) => Promise<any>,
  postPredict: (body: any) => Promise<{ ok: boolean; status: number; data: any }>,
  known?: FindATradeKnownHint | null,
  email?: string | null,
  onHint?: (hint: FindATradeKnownHint & { ticker: string }) => void
): Promise<FindATradeCandidate> {
  try {
    // Prefer 1y history so Quantum predict matches the main Recommendation card lookback
    const data = await fetchJson(
      `/api/stock?ticker=${encodeURIComponent(ticker)}&range=1y&interval=1d`
    );
    const history = (data?.history || []).filter(
      (h: any) => h?.close != null && Number.isFinite(Number(h.close))
    );

    const knownScore =
      known?.score != null && Number.isFinite(Number(known.score)) ? Number(known.score) : null;
    const knownRec = parseRecommendationLabel(known?.recommendation);

    if (!history.length) {
      if (knownScore != null || knownRec) {
        const recommendation = labelFromQuantum(knownScore ?? 0, known?.recommendation);
        const isBuyCandidate = isQuantumBuy(knownScore, known?.recommendation);
        return {
          ticker,
          name: known?.name || ticker,
          price: Number(known?.price) || 0,
          recommendation,
          currentAction: 'WAIT',
          confidence: Number(known?.confidence) || 70,
          score: knownScore ?? (isBuyCandidate ? 70 : 0),
          expectedReturn: Number(known?.expectedReturn) || 3,
          why: 'Using cached Quantum AI Score (no fresh history).',
          tradeScore: 0,
          isBuyCandidate,
          scoreSource: 'known',
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

    let quantum: PredictResult;

    // Reuse an already-analyzed Quantum AI Score (open card / predict-cache / persistence)
    if (knownScore != null || knownRec) {
      quantum = {
        score: knownScore ?? (knownRec === 'STRONG BUY' ? 88 : knownRec === 'BUY' ? 75 : 60),
        recommendation: known?.recommendation || knownRec,
        confidence: known?.confidence != null ? Number(known.confidence) : null,
        expectedReturn: known?.expectedReturn != null ? Number(known.expectedReturn) : null,
        why: `Cached Quantum AI Score (${knownRec || recommendationFromScore(knownScore!)}).`,
        source: 'known',
      };
    } else {
      const predictRes = await postPredict({
        ticker,
        history,
        quote: data?.quote,
        indicators: tech,
        news: [],
        bypassCache: false,
        email: email || undefined,
      });

      if (predictRes.status === 402) {
        throw new FindQuotaExceededError(
          predictRes.data?.error ||
            'Daily AI analysis credits are out. Reload credits to continue Find a Trade.',
          predictRes.data?.usage
        );
      }
      if (!predictRes.ok) {
        throw new Error(predictRes.data?.error || `Predict HTTP ${predictRes.status}`);
      }

      const extracted = extractQuantumFromPredict(predictRes.data);
      quantum = {
        ...extracted,
        source: predictRes.data?.cached ? 'cache' : 'predict',
        cachedPredict: !!predictRes.data?.cached,
        usage: predictRes.data?.usage,
      };

      onHint?.({
        ticker,
        recommendation: quantum.recommendation,
        score: quantum.score,
        confidence: quantum.confidence,
        expectedReturn: quantum.expectedReturn,
        price: px,
        name: data?.quote?.shortName || data?.quote?.longName || ticker,
      });
      persistQuantumHint({
        ticker,
        recommendation: quantum.recommendation,
        score: quantum.score,
        confidence: quantum.confidence,
        expectedReturn: quantum.expectedReturn,
        price: px,
        name: data?.quote?.shortName || data?.quote?.longName || ticker,
      });
    }

    const aiScore = clamp(Math.round(quantum.score), 1, 99);
    const recommendation = labelFromQuantum(aiScore, quantum.recommendation);
    // Sole BUY filter: Quantum AI Score / rating — not technical scout proxies
    const isBuyCandidate = isQuantumBuy(aiScore, quantum.recommendation);

    const whaleScore = ad === 'ACCUMULATION' ? 78 : ad === 'DISTRIBUTION' ? 32 : 52;
    const institutionalScore =
      instFlow === 'LARGE_INFLOW' || instFlow === 'STEALTH_ACCUMULATION'
        ? 80
        : instFlow === 'LARGE_OUTFLOW' || instFlow === 'STEALTH_DISTRIBUTION'
          ? 30
          : 55;
    const smartMoneyScore = sm === 'BULLISH' ? 85 : sm === 'BEARISH' ? 35 : 50;
    const horizonLift = horizon === '1W' ? 0.03 : horizon === '1M' ? 0.06 : horizon === '3M' ? 0.1 : 0.16;

    // Engine only for entry timing (Do Now) — baseScore is the Quantum AI Score
    const engine = runQuantumRecommendationEngine({
      horizon,
      currentPrice: px,
      baseScore: aiScore,
      baseConfidence: clamp(
        Math.round(quantum.confidence != null ? quantum.confidence : aiScore * 0.85 + 8),
        45,
        92
      ),
      baseTarget: px * (1 + horizonLift),
      bullTarget: px * (1 + horizonLift * 1.7),
      bearTarget: px * (1 - horizonLift * 0.9),
      baseReturn:
        quantum.expectedReturn != null && Number.isFinite(quantum.expectedReturn)
          ? quantum.expectedReturn
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

    const candidate: FindATradeCandidate = {
      ticker: String(data?.ticker || ticker).toUpperCase(),
      name: known?.name || data?.quote?.shortName || data?.quote?.longName || ticker,
      price: engine.currentPrice || px,
      recommendation,
      currentAction: engine.currentAction.action,
      confidence: Math.round(
        quantum.confidence != null && Number.isFinite(quantum.confidence)
          ? quantum.confidence
          : engine.confidence
      ),
      score: aiScore,
      expectedReturn:
        quantum.expectedReturn != null && Number.isFinite(quantum.expectedReturn)
          ? quantum.expectedReturn
          : engine.expectedReturn,
      why: `Quantum AI Score ${aiScore}/100 · ${recommendation}. ${quantum.why}`,
      tradeScore: 0,
      isBuyCandidate,
      scoreSource: quantum.source,
      cachedPredict: quantum.cachedPredict,
    };
    candidate.tradeScore = rankScore(candidate);
    return candidate;
  } catch (err: any) {
    if (err instanceof FindQuotaExceededError) throw err;
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
  quotaExceeded?: boolean;
  usage?: any;
  predictCalls?: number;
};

export async function findATrade(opts: {
  tickers: string[];
  horizon?: HorizonKey;
  concurrency?: number;
  /** Already-analyzed Quantum scores (open card + predict cache + persistence). */
  knownByTicker?: Record<string, FindATradeKnownHint>;
  email?: string | null;
  fetchJson?: (url: string) => Promise<any>;
  postPredict?: (body: any) => Promise<{ ok: boolean; status: number; data: any }>;
  onProgress?: (p: FindATradeProgress) => void;
  onHint?: (hint: FindATradeKnownHint & { ticker: string }) => void;
  onUsage?: (usage: any) => void;
}): Promise<FindATradeResult> {
  const tickers = opts.tickers.slice(0, FIND_A_TRADE_MAX);
  const horizon = opts.horizon ?? '1M';
  const concurrency = opts.concurrency ?? 2;
  const knownByTicker = opts.knownByTicker || {};
  const fetchJson =
    opts.fetchJson ??
    (async (url: string) => {
      const res = await loggedFetch(apiUrl(url), {
        __qnMeta: {
          reason: 'find-a-trade-stock',
          userAction: 'Click Find a Trade +',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
  const postPredict =
    opts.postPredict ??
    (async (body: any) => {
      const res = await loggedFetch(apiUrl('/api/predict'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        __qnMeta: {
          reason: 'find-a-trade-quantum-score',
          userAction: 'Click Find a Trade +',
        },
      } as any);
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = { error: `HTTP ${res.status}` };
      }
      if (data?.usage) opts.onUsage?.(data.usage);
      return { ok: res.ok, status: res.status, data };
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

  let quotaExceeded = false;
  let quotaUsage: any;
  let quotaMessage = '';
  let predictCalls = 0;
  const stop = () => quotaExceeded;

  const scanned = await mapPool(
    tickers,
    concurrency,
    async (ticker) => {
      if (quotaExceeded) {
        return {
          ticker,
          name: ticker,
          price: 0,
          recommendation: 'HOLD' as RecommendationLabel,
          currentAction: 'WAIT' as ZoneAction,
          confidence: 0,
          score: 0,
          expectedReturn: 0,
          why: 'Skipped — analysis credits exhausted mid-scan.',
          tradeScore: -1e9,
          isBuyCandidate: false,
          error: 'quota_skipped',
        };
      }
      const key = normalizeTicker(ticker);
      const known = knownByTicker[key] || null;
      const needsPredict =
        !(known?.score != null && Number.isFinite(Number(known.score))) &&
        !parseRecommendationLabel(known?.recommendation);
      try {
        const c = await scoutOne(
          ticker,
          horizon,
          fetchJson,
          postPredict,
          known,
          opts.email,
          opts.onHint
        );
        if (needsPredict && c.scoreSource === 'predict') predictCalls += 1;
        return c;
      } catch (err: any) {
        if (err instanceof FindQuotaExceededError) {
          quotaExceeded = true;
          quotaUsage = err.usage;
          quotaMessage = err.message;
          if (err.usage) opts.onUsage?.(err.usage);
          return {
            ticker,
            name: ticker,
            price: 0,
            recommendation: 'HOLD' as RecommendationLabel,
            currentAction: 'WAIT' as ZoneAction,
            confidence: 0,
            score: 0,
            expectedReturn: 0,
            why: err.message,
            tradeScore: -1e9,
            isBuyCandidate: false,
            error: 'quota_exceeded',
          };
        }
        throw err;
      }
    },
    (done, ticker) => opts.onProgress?.({ done, total: tickers.length, current: String(ticker) }),
    stop
  );

  // Fill any slots never started after quota abort
  for (let i = 0; i < scanned.length; i++) {
    if (!scanned[i]) {
      scanned[i] = {
        ticker: tickers[i],
        name: tickers[i],
        price: 0,
        recommendation: 'HOLD',
        currentAction: 'WAIT',
        confidence: 0,
        score: 0,
        expectedReturn: 0,
        why: 'Skipped — analysis credits exhausted mid-scan.',
        tradeScore: -1e9,
        isBuyCandidate: false,
        error: 'quota_skipped',
      };
    }
  }

  for (const c of scanned) c.tradeScore = rankScore(c);

  const buyCandidates = scanned
    .filter((c) => c.isBuyCandidate)
    .sort((a, b) => b.tradeScore - a.tradeScore);

  const actionable = buyCandidates.filter((c) => c.currentAction === 'BUY');
  const topPick = (actionable[0] || buyCandidates[0]) ?? null;

  const waitOnly =
    topPick && topPick.currentAction !== 'BUY'
      ? ` · Do now: ${topPick.currentAction} (entry timing — thesis is still ${topPick.recommendation})`
      : topPick
        ? ` · Do now: ${topPick.currentAction}`
        : '';

  const quotaNote = quotaExceeded ? ` · Scan stopped: analysis credits out.` : '';

  return {
    scanned,
    buyCandidates,
    topPick,
    quotaExceeded,
    usage: quotaUsage,
    predictCalls,
    message: topPick
      ? `Top trade: ${topPick.ticker} · Quantum ${topPick.recommendation} (${topPick.score})${waitOnly}${quotaNote}`
      : quotaExceeded
        ? quotaMessage ||
          'No Quantum BUY found before analysis credits ran out. Reload credits and retry.'
        : 'No Quantum AI Score BUY / STRONG BUY (70+) in this list. Try another paste list or market/theme.',
  };
}
