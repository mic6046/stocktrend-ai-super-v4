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
