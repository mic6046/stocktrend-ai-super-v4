/**
 * Find Trades / Suggest Trades — batch scout over ticker lists.
 *
 * - Find (`mode: 'find'`, default): Consensus AI BUY gates
 * - Suggest (`mode: 'suggest'`): priority factor engine
 *   whale → institutional inflow → momentum/support → fundamentals,
 *   with RSI overheat + Bollinger stretch warnings (all rated 1–5)
 */

import { computeTechnicalIndicators } from './technical';
import { apiUrl, loggedFetch } from './api';
import {
  runQuantumRecommendationEngine,
  type RecommendationLabel,
  type ZoneAction,
} from './quantumRecommendationEngine';
import {
  buildRealisticSuggestEntry,
  formatFactorStrip,
  scoreSuggestTrade,
  type SuggestBuyBand,
  type SuggestFactorRating,
} from './suggestTradeEngine';
import type { HorizonKey } from '../components/analysis/analysisTheme';

export const FIND_A_TRADE_MAX = 20;

export type FindATradeMode = 'find' | 'suggest';

export type SuggestBuyZone = {
  lo: number;
  hi: number;
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
  /** Preferred / core BUY band (Buy Zone 2). */
  buyZone?: SuggestBuyZone;
  /** Three scale-in entry chances: Buy Zone 1 → 3. */
  buyZones?: SuggestBuyBand[];
  stopLoss?: number;
  takeProfit?: number;
  /** How the Suggest buy zone was anchored (support / EMA / etc). */
  buyZoneAnchor?: string;
  /** Combined Buy Zone 1–3 width as % of live price. */
  buyZoneWidthPct?: number;
  /** Which buy zone live price is in, if any. */
  activeBuyLevel?: 1 | 2 | 3 | null;
  /** Suggest factor ratings (1–5) when mode=suggest. */
  factorRatings?: SuggestFactorRating[];
  /** Suggest weighted composite 0–100. */
  suggestComposite?: number;
  /** Compact Whale:4 Funds:5 … strip for logs. */
  factorStrip?: string;
  warnings?: string[];
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

function rankScoreFind(c: FindATradeCandidate): number {
  if (!c.isBuyCandidate) return -1e9;
  const actionBoost = c.currentAction === 'BUY' ? 18 : c.currentAction === 'WAIT' ? 4 : 0;
  const recBoost = c.recommendation === 'STRONG BUY' ? 12 : c.recommendation === 'BUY' ? 8 : 0;
  return c.score * 0.35 + c.confidence * 0.3 + Math.max(0, c.expectedReturn) * 2.2 + actionBoost + recBoost;
}

function rankScoreSuggest(c: FindATradeCandidate): number {
  if (!c.isBuyCandidate) return -1e9;
  const composite = c.suggestComposite ?? c.score;
  const whale = c.factorRatings?.find((f) => f.key === 'whaleAccumulation')?.rating ?? 3;
  const funds = c.factorRatings?.find((f) => f.key === 'institutionalInflow')?.rating ?? 3;
  const actionBoost = c.currentAction === 'BUY' ? 10 : c.currentAction === 'WAIT' ? 3 : 0;
  return composite * 1.15 + whale * 6 + funds * 5 + actionBoost + Math.max(0, c.expectedReturn);
}

/** Soft rank for near-miss / watchlist (not forced BUY). */
function watchScore(c: FindATradeCandidate, mode: FindATradeMode): number {
  if (c.error || c.price <= 0) return -1e9;
  if (mode === 'suggest') {
    const composite = c.suggestComposite ?? c.score;
    const whale = c.factorRatings?.find((f) => f.key === 'whaleAccumulation')?.rating ?? 0;
    const funds = c.factorRatings?.find((f) => f.key === 'institutionalInflow')?.rating ?? 0;
    return composite + whale * 4 + funds * 3;
  }
  const recBoost =
    c.recommendation === 'STRONG BUY'
      ? 20
      : c.recommendation === 'BUY'
        ? 16
        : c.recommendation === 'HOLD'
          ? 8
          : c.recommendation === 'REDUCE'
            ? -4
            : -12;
  const actionBoost =
    c.currentAction === 'BUY' ? 10 : c.currentAction === 'WAIT' || c.currentAction === 'HOLD' ? 3 : -6;
  return c.score * 0.4 + c.confidence * 0.25 + Math.max(-5, c.expectedReturn) * 1.5 + recBoost + actionBoost;
}

function emptyFail(ticker: string, why: string, error?: string): FindATradeCandidate {
  return {
    ticker,
    name: ticker,
    price: 0,
    recommendation: 'HOLD',
    currentAction: 'WAIT',
    confidence: 0,
    score: 0,
    expectedReturn: 0,
    why,
    tradeScore: -1e9,
    isBuyCandidate: false,
    error: error || why,
  };
}

async function scoutOne(
  ticker: string,
  horizon: HorizonKey,
  mode: FindATradeMode,
  fetchJson: (url: string) => Promise<any>,
  bypassCache = false
): Promise<FindATradeCandidate> {
  try {
    const cacheQs = bypassCache ? '&bypassCache=true' : '';
    const data = await fetchJson(
      `/api/stock?ticker=${encodeURIComponent(ticker)}&range=3mo&interval=1d${cacheQs}`
    );
    const history = (data?.history || []).filter(
      (h: any) => h?.close != null && Number.isFinite(Number(h.close))
    );
    if (!history.length) {
      return emptyFail(ticker, 'No price history returned.', 'No history');
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

    if (mode === 'suggest') {
      const suggest = scoreSuggestTrade({
        technical: tech,
        price: px,
        quote: data?.quote ?? null,
      });
      const entry = buildRealisticSuggestEntry({
        technical: tech,
        price: px,
        targetHint: engine.targetPrice,
      });

      const isBuyCandidate = suggest.isSuggestCandidate && engine.expectedReturn > -2;

      const candidate: FindATradeCandidate = {
        ticker: String(data?.ticker || ticker).toUpperCase(),
        name: data?.quote?.shortName || data?.quote?.longName || ticker,
        price: engine.currentPrice,
        recommendation: engine.finalVerdict,
        currentAction: entry.liveAction,
        confidence: Math.round(
          Math.min(95, Math.max(40, suggest.compositeScore * 0.55 + suggest.priorityAvg * 8))
        ),
        score: suggest.compositeScore,
        expectedReturn: engine.expectedReturn,
        why: `${suggest.summary} Scale-in: Buy Zone 1–3 via ${entry.anchorLabel}.`,
        tradeScore: 0,
        isBuyCandidate,
        buyZone: entry.buyZone,
        buyZones: entry.buyZones,
        stopLoss: entry.stopLoss,
        takeProfit: entry.takeProfit,
        buyZoneAnchor: entry.anchorLabel,
        buyZoneWidthPct: entry.widthPct,
        activeBuyLevel: entry.activeLevel,
        factorRatings: suggest.factors,
        suggestComposite: suggest.compositeScore,
        factorStrip: formatFactorStrip(suggest.factors),
        warnings: suggest.warnings,
      };
      candidate.tradeScore = rankScoreSuggest(candidate);
      return candidate;
    }

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
      buyZone: { lo: engine.buyZone.lo, hi: engine.buyZone.hi },
      stopLoss: engine.stopLoss,
      takeProfit: engine.takeProfit,
    };
    candidate.tradeScore = rankScoreFind(candidate);
    return candidate;
  } catch (err: any) {
    return emptyFail(ticker, err?.message || 'Scout failed', err?.message || 'Scout failed');
  }
}

export type FindATradeResult = {
  scanned: FindATradeCandidate[];
  buyCandidates: FindATradeCandidate[];
  /** Best non-cleared names — watchlist only, not forced trades. */
  watchlistCandidates: FindATradeCandidate[];
  topPick: FindATradeCandidate | null;
  message: string;
  /** How many of the scout list cleared suggestion / BUY gates. */
  buyCleared: number;
  scannedCount: number;
  mode: FindATradeMode;
};

export async function findATrade(opts: {
  tickers: string[];
  horizon?: HorizonKey;
  concurrency?: number;
  /** Fresh market data for this scout (no 10-min stock cache). */
  bypassCache?: boolean;
  /** `suggest` uses the priority factor engine (1–5 ratings). */
  mode?: FindATradeMode;
  fetchJson?: (url: string) => Promise<any>;
  onProgress?: (p: FindATradeProgress) => void;
}): Promise<FindATradeResult> {
  const tickers = opts.tickers.slice(0, FIND_A_TRADE_MAX);
  const horizon = opts.horizon ?? '1M';
  const concurrency = opts.concurrency ?? 3;
  const bypassCache = opts.bypassCache !== false;
  const mode: FindATradeMode = opts.mode ?? 'find';
  const fetchJson =
    opts.fetchJson ??
    (async (url: string) => {
      const res = await loggedFetch(apiUrl(url), {
        __qnMeta: {
          reason: mode === 'suggest' ? 'suggest-trade-factors' : 'find-or-suggest-trade',
          userAction: mode === 'suggest' ? 'Click Suggest Trades' : 'Click Find Trades/Suggest Trades',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });

  if (!tickers.length) {
    return {
      scanned: [],
      buyCandidates: [],
      watchlistCandidates: [],
      topPick: null,
      message: 'Enter at least one ticker to scout.',
      buyCleared: 0,
      scannedCount: 0,
      mode,
    };
  }

  opts.onProgress?.({ done: 0, total: tickers.length });

  const scanned = await mapPool(
    tickers,
    concurrency,
    (ticker) => scoutOne(ticker, horizon, mode, fetchJson, bypassCache),
    (done, ticker) => opts.onProgress?.({ done, total: tickers.length, current: String(ticker) })
  );

  const buyCandidates = scanned
    .filter((c) => c.isBuyCandidate)
    .sort((a, b) => b.tradeScore - a.tradeScore);

  // Prefer live action BUY over WAIT when ranking top pick
  const actionable = buyCandidates.filter((c) => c.currentAction === 'BUY');
  const topPick = (actionable[0] || buyCandidates[0]) ?? null;

  const buySet = new Set(buyCandidates.map((c) => c.ticker));
  const watchlistCandidates = scanned
    .filter((c) => !buySet.has(c.ticker) && !c.error && c.price > 0)
    .map((c) => ({ ...c, tradeScore: watchScore(c, mode) }))
    .sort((a, b) => b.tradeScore - a.tradeScore)
    .slice(0, 5);

  const buyCleared = buyCandidates.length;
  const scannedCount = scanned.length;

  const message =
    mode === 'suggest'
      ? topPick
        ? buyCleared === 1
          ? `Factor engine: 1 of ${scannedCount} cleared · ${topPick.ticker}${
              topPick.buyZones?.length >= 3
                ? ` · BZ1 ${topPick.buyZones[0].lo.toFixed(2)}–${topPick.buyZones[0].hi.toFixed(2)} · BZ2 ${topPick.buyZones[1].lo.toFixed(2)}–${topPick.buyZones[1].hi.toFixed(2)} · BZ3 ${topPick.buyZones[2].lo.toFixed(2)}–${topPick.buyZones[2].hi.toFixed(2)}`
                : topPick.buyZone
                  ? ` · buy zone ${topPick.buyZone.lo.toFixed(2)}–${topPick.buyZone.hi.toFixed(2)}`
                  : ''
            } (${topPick.factorStrip || `score ${topPick.score}`})`
          : `Factor engine: ${buyCleared} of ${scannedCount} cleared · top ${topPick.ticker}${
              topPick.buyZones?.length >= 3
                ? ` · BZ1–3 ${topPick.buyZones[0].hi.toFixed(2)}→${topPick.buyZones[1].lo.toFixed(2)}→${topPick.buyZones[2].lo.toFixed(2)}`
                : topPick.buyZone
                  ? ` · buy zone ${topPick.buyZone.lo.toFixed(2)}–${topPick.buyZone.hi.toFixed(2)}`
                  : ''
            } · ${topPick.factorStrip || `score ${topPick.score}`}`
        : `Factor engine: 0 of ${scannedCount} cleared. See watchlist or refresh — priority is whale → funds → momentum → fundamentals.`
      : topPick
        ? buyCleared === 1
          ? `Only 1 of ${scannedCount} cleared BUY gates: ${topPick.ticker} · Do now: ${topPick.currentAction}`
          : `${buyCleared} of ${scannedCount} cleared BUY · top: ${topPick.ticker} · Do now: ${topPick.currentAction}`
        : `0 of ${scannedCount} cleared BUY gates. See watchlist near-misses or refresh the list.`;

  return {
    scanned,
    buyCandidates,
    watchlistCandidates,
    topPick,
    buyCleared,
    scannedCount,
    message,
    mode,
  };
}
