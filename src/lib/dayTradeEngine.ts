/**
 * Day Trade scout engine.
 *
 * Ranks popular names for same-session tradeability using:
 * liquidity / RVOL, ATR range potential, momentum bias, volatility structure,
 * and RSI heat (all rated 1–5). Cleared names are day-trade candidates — not
 * investment BUY recommendations.
 */

import type { TechnicalBreakdown } from './technical';

export type DayTradeBias = 'LONG' | 'SHORT' | 'FADE' | 'WAIT';

export type DayTradeFactorKey =
  | 'liquidity'
  | 'rangePotential'
  | 'momentumBias'
  | 'volatilityStructure'
  | 'rsiHeat';

export type DayTradeRating = 1 | 2 | 3 | 4 | 5;

export type DayTradeFactor = {
  key: DayTradeFactorKey;
  shortLabel: string;
  label: string;
  rating: DayTradeRating;
  detail: string;
};

export const DAY_TRADE_FACTOR_ORDER: DayTradeFactorKey[] = [
  'liquidity',
  'rangePotential',
  'momentumBias',
  'volatilityStructure',
  'rsiHeat',
];

export const DAY_TRADE_FACTOR_WEIGHTS: Record<DayTradeFactorKey, number> = {
  liquidity: 28,
  rangePotential: 24,
  momentumBias: 22,
  volatilityStructure: 14,
  rsiHeat: 12,
};

export type DayTradeScoreResult = {
  factors: DayTradeFactor[];
  compositeScore: number;
  bias: DayTradeBias;
  biasDetail: string;
  isDayTradeCandidate: boolean;
  gateFails: string[];
  atrPct: number;
  rvol: number;
  summary: string;
};

function clampRating(n: number): DayTradeRating {
  return Math.max(1, Math.min(5, Math.round(n))) as DayTradeRating;
}

function atrPercent(tech: TechnicalBreakdown, price: number): number {
  const atr = tech.indicators?.atr;
  if (atr != null && Number.isFinite(atr) && price > 0) return (atr / price) * 100;
  const vol = tech.indicators?.volatility;
  if (vol != null && Number.isFinite(vol)) return Math.min(12, Math.max(0.2, vol * 100));
  return 1.2;
}

function minPriceForTicker(ticker: string): number {
  const t = ticker.toUpperCase();
  if (t.endsWith('.HK')) return 8; // avoid illiquid penny HK names
  if (t.endsWith('.T')) return 500; // ¥ floor for liquid JP day trades
  if (/\.(AS|DE|PA|L|SW|MC)$/.test(t)) return 5;
  return 8; // US / default
}

function rateLiquidity(tech: TechnicalBreakdown): DayTradeFactor {
  const rvol = tech.quantumRefinement?.rvol?.ratio ?? tech.indicators?.relativeVolume ?? 1;
  let rating: DayTradeRating = 3;
  let detail = `RVOL ${rvol.toFixed(2)}× — average participation.`;
  if (rvol >= 2.0) {
    rating = 5;
    detail = `RVOL ${rvol.toFixed(2)}× — strong day-trade liquidity surge.`;
  } else if (rvol >= 1.4) {
    rating = 4;
    detail = `RVOL ${rvol.toFixed(2)}× — elevated volume for entries/exits.`;
  } else if (rvol >= 1.0) {
    rating = 3;
    detail = `RVOL ${rvol.toFixed(2)}× — usable liquidity.`;
  } else if (rvol >= 0.75) {
    rating = 2;
    detail = `RVOL ${rvol.toFixed(2)}× — soft volume; fills may slip.`;
  } else {
    rating = 1;
    detail = `RVOL ${rvol.toFixed(2)}× — too quiet for day trade.`;
  }
  return {
    key: 'liquidity',
    shortLabel: 'Liq',
    label: 'Liquidity / RVOL',
    rating,
    detail,
  };
}

function rateRange(atrPct: number): DayTradeFactor {
  let rating: DayTradeRating = 3;
  let detail = `ATR ~${atrPct.toFixed(1)}% — moderate session range.`;
  if (atrPct >= 1.6 && atrPct <= 4.5) {
    rating = 5;
    detail = `ATR ~${atrPct.toFixed(1)}% — ideal day-trade range.`;
  } else if ((atrPct >= 1.1 && atrPct < 1.6) || (atrPct > 4.5 && atrPct <= 6.5)) {
    rating = 4;
    detail = `ATR ~${atrPct.toFixed(1)}% — tradeable range.`;
  } else if (atrPct >= 0.8 && atrPct < 1.1) {
    rating = 3;
    detail = `ATR ~${atrPct.toFixed(1)}% — tight but usable.`;
  } else if (atrPct > 6.5 && atrPct <= 9) {
    rating = 2;
    detail = `ATR ~${atrPct.toFixed(1)}% — wide / choppy risk.`;
  } else {
    rating = 1;
    detail =
      atrPct < 0.8
        ? `ATR ~${atrPct.toFixed(1)}% — too flat for day trade.`
        : `ATR ~${atrPct.toFixed(1)}% — extreme volatility.`;
  }
  return {
    key: 'rangePotential',
    shortLabel: 'Range',
    label: 'Range potential (ATR%)',
    rating,
    detail,
  };
}

function rateMomentum(tech: TechnicalBreakdown, price: number): DayTradeFactor {
  const trend = tech.quantumRefinement?.trendStrength?.status;
  const macd = tech.indicators?.macd;
  const macdBull =
    macd != null ? macd.macdLine > macd.signalLine : null;
  const ema20 = tech.indicators?.ema20;
  const aboveEma = ema20 != null ? price > ema20 : null;

  let pts = 0;
  if (trend === 'BULLISH' || trend === 'BEARISH') pts += 2;
  else if (trend === 'CONSOLIDATING') pts += 1;
  if (macdBull === true || macdBull === false) pts += 1;
  if (aboveEma === true || aboveEma === false) pts += 1;

  let rating = clampRating(pts + 1);
  if (trend === 'CONSOLIDATING' && macdBull == null) rating = 2;

  const detail = [
    trend ? `Trend ${trend.toLowerCase()}` : null,
    macdBull === true ? 'MACD bullish' : macdBull === false ? 'MACD bearish' : null,
    aboveEma === true ? 'above EMA20' : aboveEma === false ? 'below EMA20' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    key: 'momentumBias',
    shortLabel: 'Mom',
    label: 'Momentum bias',
    rating,
    detail: detail || 'Mixed momentum — wait for open drive.',
  };
}

function rateVolStructure(tech: TechnicalBreakdown): DayTradeFactor {
  const pct = tech.indicators?.bollinger?.percent;
  const squeeze = tech.advancedIndicators?.volatilityCompression?.isBBSqueeze;
  let rating: DayTradeRating = 3;
  let detail = 'Mid-band structure.';

  if (squeeze) {
    rating = 2;
    detail = 'BB squeeze — wait for expansion before sizing up.';
  } else if (pct != null && Number.isFinite(pct)) {
    if (pct >= 0.25 && pct <= 0.75) {
      rating = 5;
      detail = `%B ${pct.toFixed(2)} — room to move either side.`;
    } else if (pct > 0.75 && pct < 0.95) {
      rating = 3;
      detail = `%B ${pct.toFixed(2)} — extended; prefer fade or break-and-go.`;
    } else if (pct < 0.25 && pct > 0.05) {
      rating = 3;
      detail = `%B ${pct.toFixed(2)} — washed; bounce or continuation watch.`;
    } else {
      rating = 2;
      detail = `%B ${pct.toFixed(2)} — band extreme; high reversal risk.`;
    }
  }

  return {
    key: 'volatilityStructure',
    shortLabel: 'Vol',
    label: 'Volatility structure',
    rating,
    detail,
  };
}

function rateRsiHeat(tech: TechnicalBreakdown): DayTradeFactor {
  const rsi = tech.indicators?.rsi;
  let rating: DayTradeRating = 3;
  let detail = 'RSI unavailable — neutral.';
  if (rsi != null && Number.isFinite(rsi)) {
    if (rsi >= 35 && rsi <= 65) {
      rating = 5;
      detail = `RSI ${rsi.toFixed(0)} — room for both long and short day trades.`;
    } else if ((rsi > 65 && rsi < 75) || (rsi < 35 && rsi > 25)) {
      rating = 3;
      detail = `RSI ${rsi.toFixed(0)} — directional but nearing heat.`;
    } else if (rsi >= 75 || rsi <= 25) {
      rating = 1;
      detail = `RSI ${rsi.toFixed(0)} — extreme; fade-only or skip.`;
    } else {
      rating = 2;
      detail = `RSI ${rsi.toFixed(0)} — stretched.`;
    }
  }
  return {
    key: 'rsiHeat',
    shortLabel: 'RSI',
    label: 'RSI heat',
    rating,
    detail,
  };
}

function deriveBias(tech: TechnicalBreakdown, price: number): { bias: DayTradeBias; detail: string } {
  const trend = tech.quantumRefinement?.trendStrength?.status;
  const macd = tech.indicators?.macd;
  const macdBull = macd != null ? macd.macdLine > macd.signalLine : null;
  const rsi = tech.indicators?.rsi;
  const ema20 = tech.indicators?.ema20;
  const pct = tech.indicators?.bollinger?.percent;

  // Extreme RSI → fade setup
  if (rsi != null && rsi >= 75 && (pct == null || pct >= 0.85)) {
    return { bias: 'FADE', detail: 'Overbought stretch — fade short / wait for reclaim failure.' };
  }
  if (rsi != null && rsi <= 25 && (pct == null || pct <= 0.15)) {
    return { bias: 'FADE', detail: 'Oversold wash — fade long / wait for reclaim.' };
  }

  const bullish =
    (trend === 'BULLISH' ? 1 : 0) +
    (macdBull === true ? 1 : 0) +
    (ema20 != null && price > ema20 ? 1 : 0);
  const bearish =
    (trend === 'BEARISH' ? 1 : 0) +
    (macdBull === false ? 1 : 0) +
    (ema20 != null && price < ema20 ? 1 : 0);

  if (bullish >= 2 && bullish > bearish) {
    return { bias: 'LONG', detail: 'Bullish day-trade bias — buy dips / breakouts with volume.' };
  }
  if (bearish >= 2 && bearish > bullish) {
    return { bias: 'SHORT', detail: 'Bearish day-trade bias — short rips / breakdowns with volume.' };
  }
  return { bias: 'WAIT', detail: 'No clean day-trade bias yet — wait for open drive / VWAP hold.' };
}

function weightedComposite(factors: DayTradeFactor[]): number {
  let wSum = 0;
  let s = 0;
  for (const f of factors) {
    const w = DAY_TRADE_FACTOR_WEIGHTS[f.key] ?? 0;
    wSum += w;
    s += w * ((f.rating - 1) / 4) * 100;
  }
  if (wSum <= 0) return 0;
  return Math.round(Math.max(0, Math.min(100, s / wSum)));
}

export function scoreDayTrade(opts: {
  technical: TechnicalBreakdown;
  price: number;
  ticker: string;
}): DayTradeScoreResult {
  const { technical: tech, price, ticker } = opts;
  const atrPct = atrPercent(tech, price);
  const rvol = tech.quantumRefinement?.rvol?.ratio ?? tech.indicators?.relativeVolume ?? 1;

  const factors: DayTradeFactor[] = [
    rateLiquidity(tech),
    rateRange(atrPct),
    rateMomentum(tech, price),
    rateVolStructure(tech),
    rateRsiHeat(tech),
  ];

  const compositeScore = weightedComposite(factors);
  const { bias, detail: biasDetail } = deriveBias(tech, price);

  const gateFails: string[] = [];
  const floor = minPriceForTicker(ticker);
  if (!(price >= floor)) gateFails.push(`Price below day-trade floor (${floor})`);
  if (rvol < 0.85) gateFails.push(`RVOL ${rvol.toFixed(2)}× too low`);
  if (atrPct < 0.75) gateFails.push(`ATR ${atrPct.toFixed(1)}% too flat`);
  if (atrPct > 9) gateFails.push(`ATR ${atrPct.toFixed(1)}% too extreme`);
  if (compositeScore < 52) gateFails.push(`Composite ${compositeScore} < 52`);
  if (bias === 'WAIT' && compositeScore < 62) {
    gateFails.push('No clear LONG/SHORT/FADE bias');
  }

  const isDayTradeCandidate = gateFails.length === 0;
  const strip = factors.map((f) => `${f.shortLabel}:${f.rating}`).join(' ');
  const summary = isDayTradeCandidate
    ? `Cleared day-trade gates · ${bias} · ${strip} · score ${compositeScore}`
    : `Did not clear day-trade gates (${gateFails[0]}) · ${strip}`;

  return {
    factors,
    compositeScore,
    bias,
    biasDetail,
    isDayTradeCandidate,
    gateFails,
    atrPct: Math.round(atrPct * 10) / 10,
    rvol: Math.round(rvol * 100) / 100,
    summary,
  };
}

export function formatDayTradeStrip(factors: DayTradeFactor[]): string {
  return DAY_TRADE_FACTOR_ORDER.map((k) => {
    const f = factors.find((x) => x.key === k);
    return f ? `${f.shortLabel}:${f.rating}` : '';
  })
    .filter(Boolean)
    .join(' ');
}
