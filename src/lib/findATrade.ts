/**
 * Find a Trade / Suggest Trades — batch scout over ticker lists.
 *
 * - Find (`mode: 'find'`, default): AI Quantum Score SSOT (same as Individual Analysis)
 * - Suggest (`mode: 'suggest'`): priority factor engine
 *   whale → institutional inflow → momentum/support → fundamentals,
 *   with RSI overheat + Bollinger stretch warnings (all rated 1–5)
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
import {
  runQuantumRecommendationEngine,
  type RecommendationLabel,
  type ZoneAction,
} from './quantumRecommendationEngine';
import { computeTechnicalIndicators } from './technical';
import { toHkTickerIfNumeric } from './tickerNormalize';
import {
  buildRealisticSuggestEntry,
  formatFactorStrip,
  scoreSuggestTrade,
  type SuggestBuyBand,
  type SuggestFactorRating,
} from './suggestTradeEngine';
import type { HorizonKey } from '../components/analysis/analysisTheme';

export const FIND_A_TRADE_MAX = 30;

export type FindATradeMode = 'find' | 'suggest';

/** @deprecated Prefer StockRecommendation — kept as alias for UI compatibility. */
export type FindATradeCandidate = StockRecommendation;

export type FindATradeProgress = {
  done: number;
  total: number;
  current?: string;
};

export type SuggestBuyZone = {
  lo: number;
  hi: number;
};

/** Candidate shape returned by Suggest Trades (`mode: 'suggest'`). */
export type SuggestTradeCandidate = {
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

function normalizeTicker(raw: string): string {
  return toHkTickerIfNumeric(raw.trim().toUpperCase().replace(/^\$/, ''));
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

async function scoutOneFind(
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
    const companyName = data?.quote?.shortName || data?.quote?.longName || sym;

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

function rankScoreSuggest(c: SuggestTradeCandidate): number {
  if (!c.isBuyCandidate) return -1e9;
  const composite = c.suggestComposite ?? c.score;
  const whale = c.factorRatings?.find((f) => f.key === 'whaleAccumulation')?.rating ?? 3;
  const funds = c.factorRatings?.find((f) => f.key === 'institutionalInflow')?.rating ?? 3;
  const actionBoost = c.currentAction === 'BUY' ? 10 : c.currentAction === 'WAIT' ? 3 : 0;
  return composite * 1.15 + whale * 6 + funds * 5 + actionBoost + Math.max(0, c.expectedReturn);
}

/** Soft rank for near-miss / watchlist (not forced BUY). */
function watchScoreSuggest(c: SuggestTradeCandidate): number {
  if (c.error || c.price <= 0) return -1e9;
  const composite = c.suggestComposite ?? c.score;
  const whale = c.factorRatings?.find((f) => f.key === 'whaleAccumulation')?.rating ?? 0;
  const funds = c.factorRatings?.find((f) => f.key === 'institutionalInflow')?.rating ?? 0;
  return composite + whale * 4 + funds * 3;
}

function emptySuggestFail(ticker: string, why: string, error?: string): SuggestTradeCandidate {
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

async function scoutOneSuggest(
  ticker: string,
  horizon: HorizonKey,
  fetchJson: (url: string) => Promise<any>,
  bypassCache = false
): Promise<SuggestTradeCandidate> {
  try {
    const cacheQs = bypassCache ? '&bypassCache=true' : '';
    const data = await fetchJson(
      `/api/stock?ticker=${encodeURIComponent(ticker)}&range=3mo&interval=1d${cacheQs}`
    );
    const history = (data?.history || []).filter(
      (h: any) => h?.close != null && Number.isFinite(Number(h.close))
    );
    if (!history.length) {
      return emptySuggestFail(ticker, 'No price history returned.', 'No history');
    }

    const px =
      Number(data?.quote?.regularMarketPrice) ||
      Number(history[history.length - 1].close) ||
      0;
    const tech = computeTechnicalIndicators(history, data?.quote);
    if (!tech) {
      return emptySuggestFail(ticker, 'Technical indicators unavailable.', 'No technicals');
    }

    const closes = history.map((h: any) => Number(h.close));
    const levels = roughLevels(closes, px);
    const instFlow = tech.indicators?.institutionalFlow?.status;
    const ad = tech.quantumRefinement?.accumulationDistribution?.status;
    const sm = tech.quantumRefinement?.smartMoneyIndex?.status;
    const sector = tech.quantumRefinement?.sectorRotation?.status;

    const whaleScore = ad === 'ACCUMULATION' ? 78 : ad === 'DISTRIBUTION' ? 32 : 52;
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
      baseScore: tech.masterScores?.aiBuyScore ?? 60,
      baseConfidence: 65,
      baseTarget: px * 1.06,
      bullTarget: px * 1.12,
      bearTarget: px * 0.92,
      technical: {
        rsi: tech.indicators?.rsi ?? null,
        macdBullish:
          tech.indicators?.macd != null
            ? tech.indicators.macd.macdLine > tech.indicators.macd.signalLine
            : null,
        trend: tech.quantumRefinement?.trendStrength?.status ?? null,
        volatility: tech.indicators?.volatility ?? null,
        emaBias:
          tech.indicators?.ema20 != null && px > tech.indicators.ema20 ? 'bull' : 'bear',
        smaBias:
          tech.indicators?.sma50 != null && px > tech.indicators.sma50 ? 'bull' : 'bear',
        bollingerBias:
          tech.indicators?.bollinger?.percent != null
            ? tech.indicators.bollinger.percent <= 0.2
              ? 'oversold'
              : tech.indicators.bollinger.percent >= 0.8
                ? 'overbought'
                : 'mid'
            : null,
        obvBias: ad === 'ACCUMULATION' ? 'bull' : ad === 'DISTRIBUTION' ? 'bear' : 'neutral',
        volumeBias:
          (tech.quantumRefinement?.rvol?.ratio ?? 1) >= 1.4
            ? 'high'
            : (tech.quantumRefinement?.rvol?.ratio ?? 1) <= 0.7
              ? 'low'
              : 'normal',
      },
      levels,
      whaleScore,
      institutionalScore,
      sentimentScore: 58,
      momentumScore: tech.indicators?.rsi != null ? Math.round(tech.indicators.rsi) : 55,
      smartMoneyScore,
      fundFlowBias: ad === 'ACCUMULATION' ? 'inflow' : ad === 'DISTRIBUTION' ? 'outflow' : 'neutral',
      sectorBias: sector === 'LEADER' ? 'leader' : sector === 'LAGGARD' ? 'laggard' : 'neutral',
      userHasPosition: false,
      ticker,
    });

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

    const candidate: SuggestTradeCandidate = {
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
  } catch (err: any) {
    return emptySuggestFail(ticker, err?.message || 'Scout failed', err?.message || 'Scout failed');
  }
}

export type FindATradeResult = {
  scanned: Array<StockRecommendation & { error?: string }>;
  buyCandidates: StockRecommendation[];
  topPick: StockRecommendation | null;
  message: string;
};

export type SuggestTradeResult = {
  scanned: SuggestTradeCandidate[];
  buyCandidates: SuggestTradeCandidate[];
  /** Best non-cleared names — watchlist only, not forced trades. */
  watchlistCandidates: SuggestTradeCandidate[];
  topPick: SuggestTradeCandidate | null;
  message: string;
  /** How many of the scout list cleared suggestion gates. */
  buyCleared: number;
  scannedCount: number;
  mode: 'suggest';
};

type FindATradeOptsBase = {
  tickers: string[];
  horizon?: HorizonKey;
  concurrency?: number;
  fetchJson?: (url: string) => Promise<any>;
  onProgress?: (p: FindATradeProgress) => void;
};

export type FindATradeFindOpts = FindATradeOptsBase & {
  mode?: 'find';
  bypassCache?: boolean;
};

export type FindATradeSuggestOpts = FindATradeOptsBase & {
  mode: 'suggest';
  /** Fresh market data for this scout (no 10-min stock cache). */
  bypassCache?: boolean;
};

export async function findATrade(opts: FindATradeSuggestOpts): Promise<SuggestTradeResult>;
export async function findATrade(opts: FindATradeFindOpts): Promise<FindATradeResult>;
export async function findATrade(
  opts: FindATradeFindOpts | FindATradeSuggestOpts
): Promise<FindATradeResult | SuggestTradeResult> {
  const tickers = opts.tickers.slice(0, FIND_A_TRADE_MAX);
  const horizon = opts.horizon ?? '1M';
  const concurrency = opts.concurrency ?? 3;
  const mode: FindATradeMode = opts.mode ?? 'find';
  const bypassCache = opts.bypassCache !== false;

  const fetchJson =
    opts.fetchJson ??
    (async (url: string) => {
      const res = await loggedFetch(apiUrl(url), {
        __qnMeta: {
          reason: mode === 'suggest' ? 'suggest-trade-factors' : 'find-or-suggest-trade',
          userAction: mode === 'suggest' ? 'Click Suggest Trades' : 'Click Find a Trade +',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });

  if (mode === 'suggest') {
    if (!tickers.length) {
      return {
        scanned: [],
        buyCandidates: [],
        watchlistCandidates: [],
        topPick: null,
        message: 'Enter at least one ticker to scout.',
        buyCleared: 0,
        scannedCount: 0,
        mode: 'suggest',
      };
    }

    opts.onProgress?.({ done: 0, total: tickers.length });

    const scanned = await mapPool(
      tickers,
      concurrency,
      (ticker) => scoutOneSuggest(ticker, horizon, fetchJson, bypassCache),
      (done, ticker) => opts.onProgress?.({ done, total: tickers.length, current: String(ticker) })
    );

    const buyCandidates = scanned
      .filter((c) => c.isBuyCandidate)
      .sort((a, b) => b.tradeScore - a.tradeScore);

    const actionable = buyCandidates.filter((c) => c.currentAction === 'BUY');
    const topPick = (actionable[0] || buyCandidates[0]) ?? null;

    const buySet = new Set(buyCandidates.map((c) => c.ticker));
    const watchlistCandidates = scanned
      .filter((c) => !buySet.has(c.ticker) && !c.error && c.price > 0)
      .map((c) => ({ ...c, tradeScore: watchScoreSuggest(c) }))
      .sort((a, b) => b.tradeScore - a.tradeScore)
      .slice(0, 5);

    const buyCleared = buyCandidates.length;
    const scannedCount = scanned.length;

    const message = topPick
      ? buyCleared === 1
        ? `Factor engine: 1 of ${scannedCount} cleared · ${topPick.ticker}${
            topPick.buyZones && topPick.buyZones.length >= 3
              ? ` · BZ1 ${topPick.buyZones[0].lo.toFixed(2)}–${topPick.buyZones[0].hi.toFixed(2)} · BZ2 ${topPick.buyZones[1].lo.toFixed(2)}–${topPick.buyZones[1].hi.toFixed(2)} · BZ3 ${topPick.buyZones[2].lo.toFixed(2)}–${topPick.buyZones[2].hi.toFixed(2)}`
              : topPick.buyZone
                ? ` · buy zone ${topPick.buyZone.lo.toFixed(2)}–${topPick.buyZone.hi.toFixed(2)}`
                : ''
          } (${topPick.factorStrip || `score ${topPick.score}`})`
        : `Factor engine: ${buyCleared} of ${scannedCount} cleared · top ${topPick.ticker}${
            topPick.buyZones && topPick.buyZones.length >= 3
              ? ` · BZ1–3 ${topPick.buyZones[0].hi.toFixed(2)}→${topPick.buyZones[1].lo.toFixed(2)}→${topPick.buyZones[2].lo.toFixed(2)}`
              : topPick.buyZone
                ? ` · buy zone ${topPick.buyZone.lo.toFixed(2)}–${topPick.buyZone.hi.toFixed(2)}`
                : ''
          } · ${topPick.factorStrip || `score ${topPick.score}`}`
      : `Factor engine: 0 of ${scannedCount} cleared. See watchlist or refresh — priority is whale → funds → momentum → fundamentals.`;

    return {
      scanned,
      buyCandidates,
      watchlistCandidates,
      topPick,
      buyCleared,
      scannedCount,
      message,
      mode: 'suggest',
    };
  }

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
    (ticker) => scoutOneFind(ticker, horizon, fetchJson),
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
