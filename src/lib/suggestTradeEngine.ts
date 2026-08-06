/**
 * Suggest a Trade — factor search engine.
 *
 * Priority order (weights):
 * 1. Whale accumulation
 * 2. Institutional funds inflow
 * 3. Positive momentum structure / support
 * 4. Fundamental strength
 * 5. RSI overheat warning (high rating = cooler / safer)
 * 6. Bollinger overstretch warning (high rating = not stretched / safer)
 *
 * Every factor is rated 1–5.
 */

import type { TechnicalBreakdown } from './technical';

export type SuggestFactorKey =
  | 'whaleAccumulation'
  | 'institutionalInflow'
  | 'momentumStructure'
  | 'fundamentalStrength'
  | 'rsiHeat'
  | 'bollingerStretch';

export type SuggestRating = 1 | 2 | 3 | 4 | 5;

export type SuggestFactorRating = {
  key: SuggestFactorKey;
  label: string;
  shortLabel: string;
  rating: SuggestRating;
  /** True when this factor is a risk/warning axis (higher = safer). */
  isWarning: boolean;
  detail: string;
};

/** Higher weight = higher search priority. */
export const SUGGEST_FACTOR_WEIGHTS: Record<SuggestFactorKey, number> = {
  whaleAccumulation: 30,
  institutionalInflow: 25,
  momentumStructure: 20,
  fundamentalStrength: 15,
  rsiHeat: 5,
  bollingerStretch: 5,
};

export const SUGGEST_FACTOR_ORDER: SuggestFactorKey[] = [
  'whaleAccumulation',
  'institutionalInflow',
  'momentumStructure',
  'fundamentalStrength',
  'rsiHeat',
  'bollingerStretch',
];

const FACTOR_META: Record<
  SuggestFactorKey,
  { label: string; shortLabel: string; isWarning: boolean }
> = {
  whaleAccumulation: {
    label: 'Whale accumulation',
    shortLabel: 'Whale',
    isWarning: false,
  },
  institutionalInflow: {
    label: 'Institutional funds inflow',
    shortLabel: 'Funds',
    isWarning: false,
  },
  momentumStructure: {
    label: 'Momentum structure / support',
    shortLabel: 'Momentum',
    isWarning: false,
  },
  fundamentalStrength: {
    label: 'Fundamental strength',
    shortLabel: 'Fundamentals',
    isWarning: false,
  },
  rsiHeat: {
    label: 'RSI overheat (safer when higher)',
    shortLabel: 'RSI',
    isWarning: true,
  },
  bollingerStretch: {
    label: 'Bollinger stretch (safer when higher)',
    shortLabel: 'BB',
    isWarning: true,
  },
};

export type SuggestEngineResult = {
  factors: SuggestFactorRating[];
  /** Weighted composite 0–100 from the 1–5 ratings. */
  compositeScore: number;
  /** Average of priority factors (whale, funds, momentum, fundamentals). */
  priorityAvg: number;
  /** Passes Suggest search gates. */
  isSuggestCandidate: boolean;
  gateFails: string[];
  warnings: string[];
  summary: string;
};

function clampRating(n: number): SuggestRating {
  const r = Math.round(Math.max(1, Math.min(5, n)));
  return r as SuggestRating;
}

function scoreToRating(score0to100: number): SuggestRating {
  if (score0to100 >= 80) return 5;
  if (score0to100 >= 65) return 4;
  if (score0to100 >= 50) return 3;
  if (score0to100 >= 35) return 2;
  return 1;
}

function rateWhale(tech: TechnicalBreakdown): SuggestFactorRating {
  const ad = tech.quantumRefinement?.accumulationDistribution;
  const early = tech.quantumRefinement?.earlyAccumulation;
  const whale = tech.advancedIndicators?.whaleAlert;
  const sm = tech.quantumRefinement?.smartMoneyIndex;

  let rating: SuggestRating = 3;
  let detail = 'Neutral accumulation read.';

  if (ad?.status === 'ACCUMULATION' && (ad.confidence ?? 50) >= 70) {
    rating = 5;
    detail = ad.label || 'Strong whale accumulation.';
  } else if (
    early?.status === 'STRONG_ACCUMULATION' ||
    (ad?.status === 'ACCUMULATION' && (whale?.score ?? 0) >= 65)
  ) {
    rating = 5;
    detail = early?.label || ad?.label || 'Strong accumulation footprint.';
  } else if (ad?.status === 'ACCUMULATION' || early?.status === 'POSSIBLE_ACCUMULATION') {
    rating = 4;
    detail = ad?.label || early?.label || 'Whale accumulation bias.';
  } else if (ad?.status === 'DISTRIBUTION' || sm?.status === 'BEARISH') {
    rating = (whale?.score ?? 50) < 40 ? 1 : 2;
    detail = ad?.label || sm?.label || 'Distribution / weak whale activity.';
  } else if ((whale?.score ?? 50) >= 65 && sm?.status === 'BULLISH') {
    rating = 4;
    detail = whale?.label || 'Elevated whale alert with bullish smart money.';
  } else if ((whale?.score ?? 50) >= 55) {
    rating = 3;
    detail = whale?.label || 'Moderate whale activity.';
  } else if ((whale?.score ?? 50) < 40) {
    rating = 2;
    detail = whale?.label || 'Quiet whale footprint.';
  }

  return { key: 'whaleAccumulation', ...FACTOR_META.whaleAccumulation, rating, detail };
}

function rateInstitutional(tech: TechnicalBreakdown): SuggestFactorRating {
  const flow = tech.indicators?.institutionalFlow;
  const buying = tech.quantumRefinement?.institutionalBuying;
  const smart = tech.masterScores?.smartMoneyScore;
  const status = flow?.status;

  let rating: SuggestRating = 3;
  let detail = 'Neutral institutional flow.';

  if (status === 'LARGE_INFLOW' || status === 'STEALTH_ACCUMULATION') {
    rating = (buying?.score ?? 60) >= 70 ? 5 : 4;
    detail = buying?.label || flow?.status || 'Institutional / fund inflow.';
  } else if (status === 'LARGE_OUTFLOW' || status === 'STEALTH_DISTRIBUTION') {
    rating = 1;
    detail = buying?.label || 'Institutional / fund outflow.';
  } else if ((buying?.score ?? 50) >= 75 || (buying?.netCapitalInflow ?? 0) > 1.2) {
    rating = 5;
    detail = buying?.label || `Strong institutional buying (${Math.round(buying?.score ?? 0)}).`;
  } else if ((buying?.score ?? 50) >= 62 || (buying?.netCapitalInflow ?? 0) > 0.4) {
    rating = 4;
    detail = buying?.label || 'Constructive fund inflow.';
  } else if ((buying?.score ?? 50) <= 35 || (flow?.netFlowPct ?? 0) < -2) {
    rating = 2;
    detail = buying?.label || 'Soft institutional demand.';
  } else if ((smart ?? 50) >= 65) {
    rating = 4;
    detail = `Smart money score ${Math.round(smart ?? 0)} supports inflow.`;
  } else if ((smart ?? 50) <= 40) {
    rating = 2;
    detail = `Smart money score ${Math.round(smart ?? 0)} is soft.`;
  }

  return { key: 'institutionalInflow', ...FACTOR_META.institutionalInflow, rating, detail };
}

function rateMomentumStructure(tech: TechnicalBreakdown, price: number): SuggestFactorRating {
  const trend = tech.quantumRefinement?.trendStrength;
  const sr = tech.quantumRefinement?.supportResistance;
  const macd = tech.indicators?.macd;
  const ema20 = tech.indicators?.ema20;
  const rs = tech.quantumRefinement?.relativeStrength?.score ?? 50;
  const breakout = tech.quantumRefinement?.breakout;

  const macdBull =
    macd != null ? macd.macdLine > macd.signalLine : null;
  const nearestSupport = sr?.supports?.length ? Math.max(...sr.supports.filter((s) => s <= price * 1.01)) : null;
  const holdSupport =
    nearestSupport != null && Number.isFinite(nearestSupport)
      ? price >= nearestSupport * 0.985
      : ema20 != null
        ? price >= ema20 * 0.98
        : true;

  let pts = 0;
  if (trend?.status === 'BULLISH') pts += 2;
  else if (trend?.status === 'CONSOLIDATING') pts += 1;
  if (macdBull === true) pts += 1;
  if (holdSupport) pts += 1;
  if (rs >= 65) pts += 1;
  if (breakout?.is20Breakout || breakout?.is50Breakout) pts += 1;
  if (ema20 != null && price > ema20) pts += 1;

  let rating: SuggestRating = 3;
  if (trend?.status === 'BEARISH' && !holdSupport) rating = 1;
  else if (trend?.status === 'BEARISH') rating = 2;
  else if (pts >= 6) rating = 5;
  else if (pts >= 4) rating = 4;
  else if (pts >= 2) rating = 3;
  else rating = 2;

  const detailParts = [
    trend?.status ? `Trend ${trend.status.toLowerCase()}` : null,
    holdSupport ? 'holding support' : 'support lost',
    macdBull === true ? 'MACD bullish' : macdBull === false ? 'MACD soft' : null,
    rs >= 65 ? `RS ${Math.round(rs)}` : null,
  ].filter(Boolean);

  return {
    key: 'momentumStructure',
    ...FACTOR_META.momentumStructure,
    rating,
    detail: detailParts.join(' · ') || trend?.label || 'Mixed momentum structure.',
  };
}

function rateFundamentals(
  tech: TechnicalBreakdown,
  quote?: { trailingPE?: number | null; marketCap?: number | null } | null
): SuggestFactorRating {
  const value = tech.masterScores?.valueScore ?? 50;
  const fund = tech.institutionalDecision?.fundamentalScore;
  const earnings = tech.institutionalDecision?.earningsScore;
  const pe = quote?.trailingPE != null && Number.isFinite(Number(quote.trailingPE)) ? Number(quote.trailingPE) : null;

  let blended = value;
  if (typeof fund === 'number') blended = blended * 0.55 + fund * 0.45;
  if (typeof earnings === 'number') blended = blended * 0.75 + earnings * 0.25;

  // Gentle PE adjustment when quote supplies it
  if (pe != null && pe > 0) {
    if (pe < 14) blended += 8;
    else if (pe < 22) blended += 4;
    else if (pe > 55) blended -= 10;
    else if (pe > 40) blended -= 5;
  }

  const rating = scoreToRating(Math.max(5, Math.min(99, blended)));
  const detailBits = [
    `Value ${Math.round(value)}`,
    typeof fund === 'number' ? `Fund ${Math.round(fund)}` : null,
    pe != null ? `P/E ${pe.toFixed(1)}` : null,
  ].filter(Boolean);

  return {
    key: 'fundamentalStrength',
    ...FACTOR_META.fundamentalStrength,
    rating,
    detail: detailBits.join(' · ') || 'Fundamental proxy from value/earnings blend.',
  };
}

/** Higher rating = cooler / less overheated (safer for new buys). */
function rateRsiHeat(tech: TechnicalBreakdown): SuggestFactorRating {
  const rsi = tech.indicators?.rsi;
  let rating: SuggestRating = 3;
  let detail = 'RSI unavailable — treated as neutral heat.';

  if (rsi != null && Number.isFinite(rsi)) {
    if (rsi >= 78) {
      rating = 1;
      detail = `RSI ${rsi.toFixed(0)} — severe overheat warning.`;
    } else if (rsi >= 70) {
      rating = 2;
      detail = `RSI ${rsi.toFixed(0)} — overheat warning.`;
    } else if (rsi >= 62) {
      rating = 3;
      detail = `RSI ${rsi.toFixed(0)} — warming; watch extensions.`;
    } else if (rsi >= 45) {
      rating = 4;
      detail = `RSI ${rsi.toFixed(0)} — healthy momentum heat.`;
    } else if (rsi >= 30) {
      rating = 5;
      detail = `RSI ${rsi.toFixed(0)} — cool; room before overheat.`;
    } else {
      rating = 4;
      detail = `RSI ${rsi.toFixed(0)} — washed out (cool), confirm support.`;
    }
  }

  return { key: 'rsiHeat', ...FACTOR_META.rsiHeat, rating, detail };
}

/** Higher rating = less upside overstretch (safer). */
function rateBollingerStretch(tech: TechnicalBreakdown): SuggestFactorRating {
  const pct = tech.indicators?.bollinger?.percent;
  let rating: SuggestRating = 3;
  let detail = 'Bollinger %B unavailable — treated as mid-band.';

  if (pct != null && Number.isFinite(pct)) {
    if (pct >= 1.05) {
      rating = 1;
      detail = `%B ${pct.toFixed(2)} — severe upper-band overstretch.`;
    } else if (pct >= 0.92) {
      rating = 2;
      detail = `%B ${pct.toFixed(2)} — upper-band stretch warning.`;
    } else if (pct >= 0.78) {
      rating = 3;
      detail = `%B ${pct.toFixed(2)} — approaching upper band.`;
    } else if (pct >= 0.35) {
      rating = 4;
      detail = `%B ${pct.toFixed(2)} — mid-band structure.`;
    } else if (pct >= 0.08) {
      rating = 5;
      detail = `%B ${pct.toFixed(2)} — lower/mid; not overstretched.`;
    } else {
      rating = 5;
      detail = `%B ${pct.toFixed(2)} — lower-band washout (not stretched up).`;
    }
  }

  return { key: 'bollingerStretch', ...FACTOR_META.bollingerStretch, rating, detail };
}

function weightedComposite(factors: SuggestFactorRating[]): number {
  let wSum = 0;
  let s = 0;
  for (const f of factors) {
    const w = SUGGEST_FACTOR_WEIGHTS[f.key] ?? 0;
    wSum += w;
    // Map 1–5 → 0–100
    s += w * ((f.rating - 1) / 4) * 100;
  }
  if (wSum <= 0) return 0;
  return Math.round(Math.max(0, Math.min(100, s / wSum)));
}

/**
 * Score one ticker for Suggest a Trade using the priority factor engine.
 */
export function scoreSuggestTrade(opts: {
  technical: TechnicalBreakdown;
  price: number;
  quote?: { trailingPE?: number | null; marketCap?: number | null } | null;
}): SuggestEngineResult {
  const { technical: tech, price, quote } = opts;

  const factors: SuggestFactorRating[] = [
    rateWhale(tech),
    rateInstitutional(tech),
    rateMomentumStructure(tech, price),
    rateFundamentals(tech, quote),
    rateRsiHeat(tech),
    rateBollingerStretch(tech),
  ];

  const byKey = Object.fromEntries(factors.map((f) => [f.key, f])) as Record<
    SuggestFactorKey,
    SuggestFactorRating
  >;

  const priorityKeys: SuggestFactorKey[] = [
    'whaleAccumulation',
    'institutionalInflow',
    'momentumStructure',
    'fundamentalStrength',
  ];
  const priorityAvg =
    priorityKeys.reduce((s, k) => s + byKey[k].rating, 0) / priorityKeys.length;

  const compositeScore = weightedComposite(factors);

  const warnings: string[] = [];
  if (byKey.rsiHeat.rating <= 2) warnings.push(byKey.rsiHeat.detail);
  if (byKey.bollingerStretch.rating <= 2) warnings.push(byKey.bollingerStretch.detail);

  const gateFails: string[] = [];
  // Core money + structure must not be weak
  if (byKey.whaleAccumulation.rating < 3 && byKey.institutionalInflow.rating < 3) {
    gateFails.push('Need whale or institutional inflow ≥ 3');
  }
  if (byKey.momentumStructure.rating < 3) {
    gateFails.push('Momentum / support structure below 3');
  }
  if (priorityAvg < 3.0) {
    gateFails.push(`Priority avg ${priorityAvg.toFixed(1)} < 3.0`);
  }
  // Hard overheat / stretch blocks unless money flow is elite
  const moneyElite =
    byKey.whaleAccumulation.rating >= 4 && byKey.institutionalInflow.rating >= 4;
  if (byKey.rsiHeat.rating === 1 && !moneyElite) {
    gateFails.push('RSI severe overheat (rating 1)');
  }
  if (byKey.bollingerStretch.rating === 1 && !moneyElite) {
    gateFails.push('Bollinger severe overstretch (rating 1)');
  }
  if (compositeScore < 52) {
    gateFails.push(`Composite ${compositeScore} < 52`);
  }

  const isSuggestCandidate = gateFails.length === 0;

  const topBits = factors
    .slice(0, 4)
    .map((f) => `${f.shortLabel} ${f.rating}/5`)
    .join(' · ');
  const warnBits =
    warnings.length > 0 ? ` Warnings: ${warnings.map((w) => w.split('—')[0].trim()).join('; ')}.` : '';

  const summary = isSuggestCandidate
    ? `Cleared Suggest factor gates (${topBits}). Composite ${compositeScore}.${warnBits}`
    : `Did not clear Suggest gates (${gateFails[0]}). ${topBits}.`;

  return {
    factors,
    compositeScore,
    priorityAvg: Math.round(priorityAvg * 10) / 10,
    isSuggestCandidate,
    gateFails,
    warnings,
    summary,
  };
}

export function formatFactorStrip(factors: SuggestFactorRating[]): string {
  return SUGGEST_FACTOR_ORDER.map((k) => {
    const f = factors.find((x) => x.key === k);
    return f ? `${f.shortLabel}:${f.rating}` : '';
  })
    .filter(Boolean)
    .join(' ');
}

export type SuggestBuyBand = {
  lo: number;
  hi: number;
  /** 1 = first/highest entry, 3 = deepest value entry */
  level: 1 | 2 | 3;
  label: string;
  /** Suggested share of planned size, e.g. 30 */
  sizePct: number;
  /** Structural anchor for this tranche */
  anchor: string;
};

export type SuggestEntryPlan = {
  /** Preferred / core band (usually Buy Zone 2). */
  buyZone: { lo: number; hi: number };
  /** Three scale-in chances: BZ1 (closest) → BZ3 (deepest). */
  buyZones: SuggestBuyBand[];
  stopLoss: number;
  takeProfit: number;
  /** Human-readable primary anchor. */
  anchorLabel: string;
  /** Approximate ATR used for sizing. */
  atr: number;
  /** Combined BZ1→BZ3 width as % of price. */
  widthPct: number;
  /** No-position live action vs any buy zone. */
  liveAction: 'BUY' | 'WAIT';
  liveReason: string;
  /** Which zone live price is in, if any. */
  activeLevel: 1 | 2 | 3 | null;
};

function roundPx(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n >= 10) return Math.round(n * 100) / 100;
  return Math.round(n * 1000) / 1000;
}

function estimateAtr(tech: TechnicalBreakdown, price: number): number {
  const atr = tech.indicators?.atr;
  if (atr != null && Number.isFinite(atr) && atr > 0) return atr;
  const vol = tech.indicators?.volatility;
  if (vol != null && Number.isFinite(vol) && vol > 0) {
    return Math.max(price * 0.004, price * Math.min(0.04, vol) * 1.2);
  }
  return price * 0.012;
}

function bandAround(center: number, halfWidth: number, price: number, allowAboveSpot: boolean): { lo: number; hi: number } {
  let lo = center - halfWidth;
  let hi = center + halfWidth;
  const maxHi = allowAboveSpot ? price * 1.004 : price * 0.998;
  hi = Math.min(hi, maxHi);
  lo = Math.min(lo, hi - halfWidth * 1.4);
  lo = Math.max(lo, price * 0.88);
  if (hi - lo < price * 0.008) {
    lo = hi - price * 0.01;
  }
  if (!(lo < hi)) {
    hi = lo + price * 0.01;
  }
  return { lo: roundPx(lo), hi: roundPx(hi) };
}

function dedupeDescending(levels: { level: number; label: string }[], minGap: number): { level: number; label: string }[] {
  const sorted = [...levels].sort((a, b) => b.level - a.level);
  const out: { level: number; label: string }[] = [];
  for (const c of sorted) {
    if (out.some((o) => Math.abs(o.level - c.level) < minGap)) continue;
    out.push(c);
  }
  return out;
}

/**
 * Realistic Suggest entry plan with 3 scale-in buy zones:
 * - Buy Zone 1: nearest pullback (first chance)
 * - Buy Zone 2: core support (primary)
 * - Buy Zone 3: deep value support (best average if filled)
 * Each band ~0.7–1.1 ATR wide (capped ~1–2.2% of price).
 */
export function buildRealisticSuggestEntry(opts: {
  technical: TechnicalBreakdown;
  price: number;
  targetHint?: number | null;
}): SuggestEntryPlan {
  const price = opts.price;
  const tech = opts.technical;
  const atr = estimateAtr(tech, price);
  const minGap = Math.max(atr * 0.55, price * 0.008);

  const supports = (tech.quantumRefinement?.supportResistance?.supports || [])
    .filter((s) => Number.isFinite(s) && s > 0 && s < price * 1.002)
    .sort((a, b) => b - a);
  const resistances = (tech.quantumRefinement?.supportResistance?.resistances || [])
    .filter((r) => Number.isFinite(r) && r > price)
    .sort((a, b) => a - b);

  const ema20 = tech.indicators?.ema20;
  const sma50 = tech.indicators?.sma50;
  const sma200 = tech.indicators?.sma200;
  const bbMid = tech.indicators?.bollinger?.middle;
  const bbLower = tech.indicators?.bollinger?.lower;
  const ma20 = tech.quantumRefinement?.trendStrength?.ma20;
  const ma50 = tech.quantumRefinement?.trendStrength?.ma50;

  const pool: { level: number; label: string }[] = [];
  if (supports[0] != null) pool.push({ level: supports[0], label: 'nearest volume support' });
  if (supports[1] != null) pool.push({ level: supports[1], label: 'secondary support' });
  if (supports[2] != null) pool.push({ level: supports[2], label: 'deeper support' });
  if (ema20 != null && ema20 < price * 1.001) pool.push({ level: ema20, label: 'EMA20 pullback' });
  if (ma20 != null && ma20 < price * 1.001) pool.push({ level: ma20, label: 'MA20 pullback' });
  if (bbMid != null && bbMid < price) pool.push({ level: bbMid, label: 'Bollinger mid' });
  if (sma50 != null && sma50 < price) pool.push({ level: sma50, label: 'SMA50 pullback' });
  if (ma50 != null && ma50 < price) pool.push({ level: ma50, label: 'MA50 pullback' });
  if (bbLower != null && bbLower < price) pool.push({ level: bbLower, label: 'Bollinger lower' });
  if (sma200 != null && sma200 < price && sma200 > price * 0.88) {
    pool.push({ level: sma200, label: 'SMA200 support' });
  }
  // Structural fallbacks so we always have 3 spaced levels
  pool.push({ level: price * 0.988, label: '≈1.2% pullback' });
  pool.push({ level: price * 0.975, label: '≈2.5% pullback' });
  pool.push({ level: price * 0.955, label: '≈4.5% pullback' });

  const unique = dedupeDescending(
    pool.filter((c) => c.level > price * 0.88 && c.level < price * 1.002),
    minGap
  );

  // Need 3 descending anchors: z1 highest (closest to spot), z3 deepest
  let a1 = unique[0] || { level: price * 0.988, label: 'near pullback' };
  let a2 = unique[1] || { level: a1.level - minGap * 1.15, label: 'core pullback' };
  let a3 = unique[2] || { level: a2.level - minGap * 1.15, label: 'deep pullback' };

  // Enforce spacing BZ1 > BZ2 > BZ3
  if (a2.level >= a1.level - minGap * 0.85) {
    a2 = { level: a1.level - minGap * 1.1, label: a2.label };
  }
  if (a3.level >= a2.level - minGap * 0.85) {
    a3 = { level: a2.level - minGap * 1.1, label: a3.label };
  }
  a3.level = Math.max(a3.level, price * 0.9);

  const trancheHalf = Math.min(
    Math.max(atr * 0.45, price * 0.005),
    price * 0.011,
    atr * 0.7
  );

  const nearSpot = price - a1.level <= atr * 0.4;
  const z1 = bandAround(a1.level, trancheHalf, price, nearSpot);
  const z2 = bandAround(a2.level, trancheHalf * 1.05, price, false);
  const z3 = bandAround(a3.level, trancheHalf * 1.1, price, false);

  // Keep non-overlapping descending bands: z1 above z2 above z3
  const sep = Math.max(price * 0.002, atr * 0.12);
  if (z2.hi >= z1.lo - sep) {
    z2.hi = roundPx(z1.lo - sep);
    z2.lo = roundPx(Math.min(z2.lo, z2.hi - trancheHalf * 1.2));
  }
  if (z3.hi >= z2.lo - sep) {
    z3.hi = roundPx(z2.lo - sep);
    z3.lo = roundPx(Math.min(z3.lo, z3.hi - trancheHalf * 1.2));
  }
  if (!(z2.lo < z2.hi)) {
    z2.lo = roundPx(z2.hi - price * 0.01);
  }
  if (!(z3.lo < z3.hi)) {
    z3.lo = roundPx(z3.hi - price * 0.01);
  }

  const buyZones: SuggestBuyBand[] = [
    {
      level: 1,
      label: 'Buy Zone 1',
      sizePct: 30,
      anchor: a1.label,
      lo: z1.lo,
      hi: z1.hi,
    },
    {
      level: 2,
      label: 'Buy Zone 2',
      sizePct: 40,
      anchor: a2.label,
      lo: z2.lo,
      hi: z2.hi,
    },
    {
      level: 3,
      label: 'Buy Zone 3',
      sizePct: 30,
      anchor: a3.label,
      lo: z3.lo,
      hi: z3.hi,
    },
  ];

  // Preferred display band = core (zone 2); combined envelope for width stats
  const buyZone = { lo: z2.lo, hi: z2.hi };
  const envelopeLo = z3.lo;
  const envelopeHi = z1.hi;

  // Stop under deepest zone
  const nextSupport = supports.find((s) => s < envelopeLo - atr * 0.15) ?? envelopeLo - atr;
  let stopLoss = Math.min(envelopeLo - Math.max(atr * 0.9, price * 0.01), nextSupport * 0.995);
  if (envelopeLo - stopLoss > price * 0.06) stopLoss = envelopeLo - price * 0.05;
  if (!(stopLoss < envelopeLo)) stopLoss = envelopeLo - Math.max(atr * 0.8, price * 0.01);

  const midCore = (z2.lo + z2.hi) / 2;
  const riskFromMid = midCore - stopLoss;
  const r1 = resistances[0];
  const targetHint =
    opts.targetHint != null && Number.isFinite(opts.targetHint) && opts.targetHint > price
      ? opts.targetHint
      : null;

  let takeProfit = midCore + Math.max(riskFromMid, atr) * 1.85;
  if (r1 != null) {
    if (r1 > midCore + riskFromMid * 1.4) takeProfit = Math.min(r1 * 0.995, takeProfit * 1.08);
    else takeProfit = Math.max(takeProfit, r1);
  }
  if (targetHint != null) takeProfit = takeProfit * 0.65 + targetHint * 0.35;
  if (takeProfit <= envelopeHi * 1.01) takeProfit = envelopeHi + Math.max(riskFromMid * 1.6, price * 0.02);

  stopLoss = roundPx(stopLoss);
  takeProfit = roundPx(takeProfit);
  if (!(takeProfit > envelopeHi)) takeProfit = roundPx(envelopeHi + price * 0.025);

  const active =
    buyZones.find((z) => price >= z.lo && price <= z.hi) ?? null;
  const liveAction: 'BUY' | 'WAIT' = active ? 'BUY' : 'WAIT';
  const liveReason = active
    ? `Live price is inside ${active.label} (${active.anchor}) — scale-in tranche ~${active.sizePct}%.`
    : price > envelopeHi
      ? `Wait for pullback into Buy Zone 1–3 (${z1.lo.toFixed(2)} → ${z3.lo.toFixed(2)}).`
      : `Price under Buy Zone 3 — confirm hold above stop ${stopLoss.toFixed(2)}.`;

  const widthPct = ((envelopeHi - envelopeLo) / price) * 100;

  return {
    buyZone,
    buyZones,
    stopLoss,
    takeProfit,
    anchorLabel: `${a1.label} → ${a3.label}`,
    atr: roundPx(atr),
    widthPct: Math.round(widthPct * 10) / 10,
    liveAction,
    liveReason,
    activeLevel: active?.level ?? null,
  };
}


