/**
 * Trade Suggestions — flow / sentiment / smart-money scout.
 * Different engine from Find a Trade (Quantum Consensus): uses technical +
 * institutional / whale / capital-inflow signals only. No /api/predict.
 */

import { computeTechnicalIndicators } from './technical';
import { apiUrl, loggedFetch } from './api';

export const TRADE_SUGGESTIONS_MAX = 30;

export type WarningLevel = 0 | 1 | 2 | 3;

/** Traffic-light market sentiment for Trade Suggestions. */
export type MarketSentimentLight = 'Green' | 'Yellow' | 'Red';

export type TradeSuggestionWarning = {
  rsi: WarningLevel;
  bollinger: WarningLevel;
  resistance: WarningLevel;
  /** Max of the three axes */
  overall: WarningLevel;
  reasons: string[];
};

export type TradeSuggestionCandidate = {
  ticker: string;
  name: string;
  price: number;
  /** 0–100 flow/sentiment constructive score */
  score: number;
  signals: string[];
  /** Red / Yellow / Green market sentiment indicator */
  marketSentiment: MarketSentimentLight;
  sentimentScore: number | null;
  smartMoneyScore: number | null;
  whaleScore: number | null;
  fundamentalScore: number | null;
  institutionalStatus: string | null;
  capitalInflow: number | null;
  rsi: number | null;
  bollingerPercent: number | null;
  nearestResistance: number | null;
  warning: TradeSuggestionWarning;
  isCandidate: boolean;
  rankScore: number;
  why: string;
  error?: string;
};

export type TradeSuggestionsProgress = {
  done: number;
  total: number;
  current?: string;
};

export type TradeSuggestionsResult = {
  scanned: TradeSuggestionCandidate[];
  candidates: TradeSuggestionCandidate[];
  topPick: TradeSuggestionCandidate | null;
  message: string;
};

function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase().replace(/^\$/, '');
}

/** Parse comma / space / newline separated tickers; dedupe; cap. */
export function parseSuggestionTickers(input: string, max = TRADE_SUGGESTIONS_MAX): string[] {
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

/**
 * Market sentiment traffic light from composite sentiment score (0–100).
 * Green ≥ 58 constructive · Yellow 40–57 mixed · Red < 40 defensive.
 */
export function marketSentimentLight(
  sentimentScore: number | null | undefined,
  newsSentiment?: string | null
): MarketSentimentLight {
  if (sentimentScore != null && Number.isFinite(sentimentScore)) {
    if (sentimentScore >= 58) return 'Green';
    if (sentimentScore >= 40) return 'Yellow';
    return 'Red';
  }
  const news = String(newsSentiment || '').toLowerCase();
  if (/positive|bull/i.test(news)) return 'Green';
  if (/negative|bear/i.test(news)) return 'Red';
  return 'Yellow';
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

/** RSI overbought warning 1–3. */
export function rsiOverboughtLevel(rsi: number | null | undefined): WarningLevel {
  if (rsi == null || !Number.isFinite(rsi)) return 0;
  if (rsi > 80) return 3;
  if (rsi > 70) return 2;
  if (rsi >= 65) return 1;
  return 0;
}

/** Bollinger upper-band stretch warning 1–3 (% of band). */
export function bollingerStretchLevel(percent: number | null | undefined): WarningLevel {
  if (percent == null || !Number.isFinite(percent)) return 0;
  if (percent > 0.92) return 3;
  if (percent > 0.85) return 2;
  if (percent >= 0.75) return 1;
  return 0;
}

/** Distance-to-resistance warning 1–3. */
export function resistanceProximityLevel(
  price: number,
  nearestResistance: number | null | undefined
): WarningLevel {
  if (!nearestResistance || !Number.isFinite(nearestResistance) || !Number.isFinite(price) || price <= 0) {
    return 0;
  }
  if (price >= nearestResistance) return 3;
  const distPct = ((nearestResistance - price) / price) * 100;
  if (distPct <= 1) return 3;
  if (distPct <= 2) return 2;
  if (distPct <= 5) return 1;
  return 0;
}

function buildWarning(
  rsi: number | null,
  bbPercent: number | null,
  price: number,
  nearestResistance: number | null
): TradeSuggestionWarning {
  const rsiLvl = rsiOverboughtLevel(rsi);
  const bbLvl = bollingerStretchLevel(bbPercent);
  const resLvl = resistanceProximityLevel(price, nearestResistance);
  const overall = Math.max(rsiLvl, bbLvl, resLvl) as WarningLevel;
  const reasons: string[] = [];
  if (rsiLvl > 0) {
    reasons.push(
      rsiLvl === 3
        ? `RSI overbought L3 (${rsi?.toFixed(0)}) — exhaustion risk`
        : rsiLvl === 2
          ? `RSI overbought L2 (${rsi?.toFixed(0)}) — elevated`
          : `RSI warming L1 (${rsi?.toFixed(0)}) — watch for stretch`
    );
  }
  if (bbLvl > 0) {
    reasons.push(
      bbLvl === 3
        ? `Bollinger upper stretch L3 (${((bbPercent || 0) * 100).toFixed(0)}%) — band expansion`
        : bbLvl === 2
          ? `Bollinger upper stretch L2 (${((bbPercent || 0) * 100).toFixed(0)}%)`
          : `Bollinger upper stretch L1 (${((bbPercent || 0) * 100).toFixed(0)}%)`
    );
  }
  if (resLvl > 0 && nearestResistance != null) {
    const distPct = ((nearestResistance - price) / price) * 100;
    reasons.push(
      resLvl === 3
        ? `Resistance L3 at $${nearestResistance.toFixed(2)} — at/through ceiling`
        : resLvl === 2
          ? `Resistance L2 at $${nearestResistance.toFixed(2)} (${distPct.toFixed(1)}% above)`
          : `Resistance L1 at $${nearestResistance.toFixed(2)} (${distPct.toFixed(1)}% above)`
    );
  }
  return { rsi: rsiLvl, bollinger: bbLvl, resistance: resLvl, overall, reasons };
}

function nearestResistanceAbove(tech: any, px: number): number | null {
  const list = tech?.quantumRefinement?.supportResistance?.resistances;
  if (!Array.isArray(list) || !list.length) {
    // Fallback: recent high-ish from bollinger upper
    const upper = tech?.indicators?.bollinger?.upper;
    if (upper != null && Number.isFinite(upper) && upper > px) return Number(upper);
    return null;
  }
  const above = list
    .map((r: any) => (typeof r === 'number' ? r : Number(r?.price ?? r)))
    .filter((n: number) => Number.isFinite(n) && n >= px * 0.98)
    .sort((a: number, b: number) => a - b);
  return above[0] ?? null;
}

/** Score constructive flow / sentiment / fundamentals pillars. */
export function scoreFlowConstructive(tech: any, px: number): {
  score: number;
  signals: string[];
  sentimentScore: number | null;
  newsSentiment: string | null;
  marketSentiment: MarketSentimentLight;
  smartMoneyScore: number | null;
  whaleScore: number | null;
  fundamentalScore: number | null;
  institutionalStatus: string | null;
  capitalInflow: number | null;
} {
  const signals: string[] = [];
  let score = 38;

  const instStatus = tech?.indicators?.institutionalFlow?.status || null;
  const instBuying = tech?.quantumRefinement?.institutionalBuying;
  const ad = tech?.quantumRefinement?.accumulationDistribution?.status;
  const early = tech?.quantumRefinement?.earlyAccumulation?.status;
  const smStatus = tech?.quantumRefinement?.smartMoneyIndex?.status;
  const masters = tech?.masterScores;
  const adv = tech?.advancedIndicators;
  const instDecision = tech?.institutionalDecision;

  const sentimentScore =
    Number.isFinite(Number(masters?.sentimentScore))
      ? Number(masters.sentimentScore)
      : Number.isFinite(Number(adv?.newsSentimentAi?.score))
        ? Number(adv.newsSentimentAi.score)
        : Number.isFinite(Number(instDecision?.sentimentScore))
          ? Number(instDecision.sentimentScore)
          : null;

  const newsSentiment =
    (typeof adv?.newsSentimentAi?.sentiment === 'string' && adv.newsSentimentAi.sentiment) ||
    (typeof adv?.socialSentimentAi?.sentiment === 'string' && adv.socialSentimentAi.sentiment) ||
    null;

  const marketSentiment = marketSentimentLight(sentimentScore, newsSentiment);

  const smartMoneyScore = Number.isFinite(Number(masters?.smartMoneyScore))
    ? Number(masters.smartMoneyScore)
    : null;

  const whaleScore = Number.isFinite(Number(adv?.whaleAlert?.score))
    ? Number(adv.whaleAlert.score)
    : null;

  const fundamentalScore = Number.isFinite(Number(instDecision?.fundamentalScore))
    ? Number(instDecision.fundamentalScore)
    : Number.isFinite(Number(masters?.valueScore))
      ? Number(masters.valueScore)
      : null;

  const capitalInflow =
    instBuying?.netCapitalInflow != null && Number.isFinite(Number(instBuying.netCapitalInflow))
      ? Number(instBuying.netCapitalInflow)
      : null;

  // —— Institutional ——
  if (instStatus === 'LARGE_INFLOW' || instStatus === 'STEALTH_ACCUMULATION') {
    score += 14;
    signals.push('Institutional accumulation');
  } else if (instStatus === 'LARGE_OUTFLOW' || instStatus === 'STEALTH_DISTRIBUTION') {
    score -= 10;
  }

  // —— Whale / A-D ——
  if (ad === 'ACCUMULATION' || early === 'STRONG_ACCUMULATION' || early === 'POSSIBLE_ACCUMULATION') {
    score += 12;
    signals.push('Whale accumulation detected');
  } else if (ad === 'DISTRIBUTION') {
    score -= 10;
  }
  if (whaleScore != null && whaleScore >= 65) {
    score += 8;
    if (!signals.some((s) => /Whale/i.test(s))) signals.push('Whale alert constructive');
  }

  // —— Smart money ——
  if (smStatus === 'BULLISH' || (smartMoneyScore != null && smartMoneyScore >= 62)) {
    score += 12;
    signals.push('Smart money accumulation');
  } else if (smStatus === 'BEARISH' || (smartMoneyScore != null && smartMoneyScore < 40)) {
    score -= 8;
  }

  // —— Market sentiment ——
  if (marketSentiment === 'Green') {
    score += 10;
    signals.push('Market sentiment Green');
  } else if (marketSentiment === 'Red') {
    score -= 6;
  }
  if (/Positive/i.test(String(newsSentiment || '')) && marketSentiment !== 'Green') {
    score += 4;
  }

  // —— Composite fundamentals constructive ——
  if (fundamentalScore != null && fundamentalScore >= 55) {
    score += 10;
    signals.push('Composite fundamentals constructive');
  } else if (fundamentalScore != null && fundamentalScore < 40) {
    score -= 5;
  }
  const valueScore = Number(masters?.valueScore);
  if (Number.isFinite(valueScore) && valueScore >= 60 && !signals.some((s) => /fundamentals/i.test(s))) {
    score += 6;
    signals.push('Value composite constructive');
  }

  // —— Fund / capital inflow ——
  let inflowHit = false;
  if (capitalInflow != null && capitalInflow > 0) {
    score += 10;
    signals.push('Fund / capital inflow');
    inflowHit = true;
  }
  const etfIn = Number(adv?.etfFlow?.inflowM);
  const etfOut = Number(adv?.etfFlow?.outflowM);
  if (Number.isFinite(etfIn) && Number.isFinite(etfOut) && etfIn > etfOut) {
    score += inflowHit ? 4 : 10;
    if (!inflowHit) signals.push('ETF capital inflow');
    inflowHit = true;
  }
  const fff = String(adv?.foreignFundFlow?.sentiment || '');
  if (/Accumul/i.test(fff)) {
    score += inflowHit ? 4 : 8;
    if (!signals.some((s) => /inflow|Fund/i.test(s))) signals.push('Foreign fund accumulation');
  }
  if (instBuying?.score != null && Number(instBuying.score) >= 60 && !inflowHit) {
    score += 6;
    signals.push('Institutional capital buying');
  }

  return {
    score: clamp(Math.round(score), 5, 98),
    signals: [...new Set(signals)],
    sentimentScore,
    newsSentiment,
    marketSentiment,
    smartMoneyScore,
    whaleScore,
    fundamentalScore,
    institutionalStatus: instStatus,
    capitalInflow,
  };
}

function rankCandidate(c: TradeSuggestionCandidate): number {
  if (!c.isCandidate) return -1e9;
  // Prefer strong flow with lower stretch risk; Green sentiment boosts rank
  const warnPenalty = c.warning.overall * 6;
  const sentimentBoost =
    c.marketSentiment === 'Green' ? 8 : c.marketSentiment === 'Yellow' ? 2 : -4;
  return c.score * 0.7 + c.signals.length * 4 - warnPenalty + sentimentBoost;
}

function emptyCandidate(
  ticker: string,
  why: string,
  error?: string
): TradeSuggestionCandidate {
  return {
    ticker,
    name: ticker,
    price: 0,
    score: 0,
    signals: [],
    marketSentiment: 'Yellow',
    sentimentScore: null,
    smartMoneyScore: null,
    whaleScore: null,
    fundamentalScore: null,
    institutionalStatus: null,
    capitalInflow: null,
    rsi: null,
    bollingerPercent: null,
    nearestResistance: null,
    warning: { rsi: 0, bollinger: 0, resistance: 0, overall: 0, reasons: [] },
    isCandidate: false,
    rankScore: -1e9,
    why,
    error,
  };
}

async function scoutOne(
  ticker: string,
  fetchJson: (url: string) => Promise<any>
): Promise<TradeSuggestionCandidate> {
  try {
    const data = await fetchJson(
      `/api/stock?ticker=${encodeURIComponent(ticker)}&range=3mo&interval=1d`
    );
    const history = (data?.history || []).filter(
      (h: any) => h?.close != null && Number.isFinite(Number(h.close))
    );
    if (!history.length) {
      return emptyCandidate(ticker, 'No price history returned.', 'No history');
    }

    const px =
      Number(data?.quote?.regularMarketPrice) || Number(history[history.length - 1].close) || 0;
    const tech = computeTechnicalIndicators(history, data?.quote);
    const flow = scoreFlowConstructive(tech, px);
    const rsi = tech?.indicators?.rsi != null ? Number(tech.indicators.rsi) : null;
    const bbPercent =
      tech?.indicators?.bollinger?.percent != null ? Number(tech.indicators.bollinger.percent) : null;
    const nearestResistance = nearestResistanceAbove(tech, px);
    const warning = buildWarning(rsi, bbPercent, px, nearestResistance);

    // Qualify when enough constructive pillars fire (different engine from Quantum BUY)
    const isCandidate = flow.signals.length >= 2 && flow.score >= 58;

    const sentimentLabel =
      flow.marketSentiment === 'Green'
        ? 'Market sentiment Green (constructive)'
        : flow.marketSentiment === 'Red'
          ? 'Market sentiment Red (defensive)'
          : 'Market sentiment Yellow (mixed)';

    const whyParts = [
      isCandidate
        ? `Flow engine constructive (${flow.score}/100).`
        : `Below suggestion bar (${flow.score}/100 · ${flow.signals.length} signals).`,
      sentimentLabel +
        (flow.sentimentScore != null ? ` · score ${Math.round(flow.sentimentScore)}` : '') +
        '.',
      flow.signals.length ? flow.signals.join(' · ') : 'No constructive flow pillars.',
      warning.reasons.length ? `Warnings: ${warning.reasons.join('; ')}` : 'No stretch warnings.',
    ];

    const candidate: TradeSuggestionCandidate = {
      ticker: String(data?.ticker || ticker).toUpperCase(),
      name: data?.quote?.shortName || data?.quote?.longName || ticker,
      price: px,
      score: flow.score,
      signals: flow.signals,
      marketSentiment: flow.marketSentiment,
      sentimentScore: flow.sentimentScore,
      smartMoneyScore: flow.smartMoneyScore,
      whaleScore: flow.whaleScore,
      fundamentalScore: flow.fundamentalScore,
      institutionalStatus: flow.institutionalStatus,
      capitalInflow: flow.capitalInflow,
      rsi,
      bollingerPercent: bbPercent,
      nearestResistance,
      warning,
      isCandidate,
      rankScore: 0,
      why: whyParts.join(' '),
    };
    candidate.rankScore = rankCandidate(candidate);
    return candidate;
  } catch (err: any) {
    return emptyCandidate(ticker, err?.message || 'Scout failed', err?.message || 'Scout failed');
  }
}

export async function scanTradeSuggestions(opts: {
  tickers: string[];
  concurrency?: number;
  fetchJson?: (url: string) => Promise<any>;
  onProgress?: (p: TradeSuggestionsProgress) => void;
}): Promise<TradeSuggestionsResult> {
  const tickers = opts.tickers.slice(0, TRADE_SUGGESTIONS_MAX).map(normalizeTicker);
  const concurrency = opts.concurrency ?? 4;
  const fetchJson =
    opts.fetchJson ??
    (async (url: string) => {
      const res = await loggedFetch(apiUrl(url), {
        __qnMeta: {
          reason: 'trade-suggestions-stock',
          userAction: 'Click Trade Suggestions',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });

  if (!tickers.length) {
    return {
      scanned: [],
      candidates: [],
      topPick: null,
      message: 'Add at least one ticker to the suggestion list.',
    };
  }

  opts.onProgress?.({ done: 0, total: tickers.length });

  const scanned = await mapPool(
    tickers,
    concurrency,
    (ticker) => scoutOne(ticker, fetchJson),
    (done, ticker) => opts.onProgress?.({ done, total: tickers.length, current: String(ticker) })
  );

  for (const c of scanned) c.rankScore = rankCandidate(c);

  const candidates = scanned
    .filter((c) => c.isCandidate)
    .sort((a, b) => b.rankScore - a.rankScore);

  // Prefer lower stretch warning when scores are close
  const topPick = candidates[0] ?? null;

  return {
    scanned,
    candidates,
    topPick,
    message: topPick
      ? `Top suggestion: ${topPick.ticker} · sentiment ${topPick.marketSentiment} · flow ${topPick.score}${
          topPick.warning.overall > 0 ? ` · stretch warn L${topPick.warning.overall}` : ''
        }`
      : 'No constructive flow setups in this list. Try another market/theme or add tickers.',
  };
}
