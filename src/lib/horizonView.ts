import { getRecommendationTheme } from '../utils/recommendationTheme';
import type { HorizonKey } from '../components/analysis/analysisTheme';
import { HORIZON_OPTIONS } from '../components/analysis/analysisTheme';

export type ForecastHorizonRow = {
  label?: string;
  horizon?: string;
  expectedReturn?: number;
  returnPct?: number;
  expectedPrice?: number;
  expectedDrawdown?: number;
  expectedVolatility?: number;
  bullishProbability?: number;
};

export type HorizonViewInput = {
  horizon: HorizonKey;
  lastClose: number;
  baseScore: number;
  baseConfidence: number | null;
  baseTarget: number | null;
  bullTarget: number | null;
  bearTarget: number | null;
  baseReturn: number | null;
  bullReturn: number | null;
  baseDrawdown: number | null;
  baseVolatility: number | null;
  baseRiskScore: number;
  baseSharpe: number | null;
  stopLoss: number | null;
  forecastHorizons?: ForecastHorizonRow[];
  ticker?: string;
};

export type HorizonView = {
  horizon: HorizonKey;
  horizonLabel: string;
  score: number;
  ratingLabel: string;
  confidence: number;
  targetPrice: number | null;
  expectedReturn: number | null;
  lastClose: number;
  bullCase: number | null;
  bearCase: number | null;
  stopLoss: number | null;
  zoneScale: number;
  riskScore: number;
  riskLabel: string;
  volatility: number | null;
  liquidityLabel: string;
  drawdown: number | null;
  sharpe: number | null;
  summaryLead: string;
  explanation: string;
};

type Profile = {
  returnScale: number;
  riskBoost: number;
  scorePullToNeutral: number;
  convictionBoost: number;
  confidenceDelta: number;
  zoneScale: number;
  volScale: number;
  drawdownScale: number;
  sharpeScale: number;
  stopTighten: number;
  timeframePhrase: string;
};

const PROFILES: Record<HorizonKey, Profile> = {
  '1W': {
    returnScale: 0.32,
    riskBoost: 16,
    scorePullToNeutral: 0.28,
    convictionBoost: 0,
    confidenceDelta: -14,
    zoneScale: 0.55,
    volScale: 1.4,
    drawdownScale: 0.5,
    sharpeScale: 0.65,
    stopTighten: 0.55,
    timeframePhrase: '1-week',
  },
  '1M': {
    returnScale: 1,
    riskBoost: 0,
    scorePullToNeutral: 0,
    convictionBoost: 0,
    confidenceDelta: 0,
    zoneScale: 1,
    volScale: 1,
    drawdownScale: 1,
    sharpeScale: 1,
    stopTighten: 1,
    timeframePhrase: '1-month',
  },
  '3M': {
    returnScale: 1.85,
    riskBoost: -6,
    scorePullToNeutral: 0,
    convictionBoost: 0.12,
    confidenceDelta: 5,
    zoneScale: 1.35,
    volScale: 0.92,
    drawdownScale: 1.45,
    sharpeScale: 1.15,
    stopTighten: 1.35,
    timeframePhrase: '3-month',
  },
  '1Y': {
    returnScale: 3.25,
    riskBoost: -10,
    scorePullToNeutral: 0,
    convictionBoost: 0.22,
    confidenceDelta: 8,
    zoneScale: 1.85,
    volScale: 0.85,
    drawdownScale: 1.9,
    sharpeScale: 1.35,
    stopTighten: 1.75,
    timeframePhrase: '1-year',
  },
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function mapApiReturn(rows: ForecastHorizonRow[] | undefined, horizon: HorizonKey): number | null {
  if (!rows?.length) return null;
  const needles: Record<HorizonKey, RegExp> = {
    '1W': /^(5|7)\s*day|1\s*w|week/i,
    '1M': /^(20|21|30)\s*day|1\s*m(?!in)|month/i,
    '3M': /^(60|90)\s*day|3\s*m|quarter/i,
    '1Y': /^(90)\s*day|1\s*y|12\s*m|year/i,
  };
  const hit = rows.find((h) => needles[horizon].test(String(h.label || h.horizon || '')));
  if (!hit) return null;
  const v = hit.expectedReturn ?? hit.returnPct;
  return v != null && Number.isFinite(Number(v)) ? Number(v) : null;
}

function mapApiPrice(rows: ForecastHorizonRow[] | undefined, horizon: HorizonKey): number | null {
  if (!rows?.length) return null;
  const needles: Record<HorizonKey, RegExp> = {
    '1W': /^(5|7)\s*day|1\s*w|week/i,
    '1M': /^(20|21|30)\s*day|1\s*m(?!in)|month/i,
    '3M': /^(60|90)\s*day|3\s*m|quarter/i,
    '1Y': /^(90)\s*day|1\s*y|12\s*m|year/i,
  };
  const hit = rows.find((h) => needles[horizon].test(String(h.label || h.horizon || '')));
  const p = hit?.expectedPrice;
  return p != null && Number.isFinite(Number(p)) ? Number(p) : null;
}

function ratingFromScore(score: number): string {
  return getRecommendationTheme(score).label;
}

function riskLabelFromScore(riskScore: number): string {
  if (riskScore >= 70) return 'High';
  if (riskScore >= 40) return 'Medium';
  return 'Low';
}

function liquidityForHorizon(horizon: HorizonKey, baseScore: number): string {
  if (horizon === '1W') return baseScore >= 75 ? 'Moderate' : 'Tight';
  if (horizon === '1Y') return baseScore >= 55 ? 'High' : 'Moderate';
  return baseScore >= 70 ? 'High' : 'Moderate';
}

/**
 * Single source of truth: every analysis metric for the selected Investment Horizon.
 */
export function buildHorizonView(input: HorizonViewInput): HorizonView {
  const profile = PROFILES[input.horizon];
  const horizonLabel =
    HORIZON_OPTIONS.find((o) => o.key === input.horizon)?.label ?? input.horizon;
  const last = input.lastClose > 0 ? input.lastClose : 0;

  // Score: short horizons pull toward neutral; longer horizons amplify conviction.
  const base = clamp(input.baseScore || 60, 0, 100);
  const towardNeutral = base + (50 - base) * profile.scorePullToNeutral;
  const amplified = 50 + (towardNeutral - 50) * (1 + profile.convictionBoost);
  const score = Math.round(clamp(amplified, 1, 99));
  const ratingLabel = ratingFromScore(score);

  const baseConf =
    input.baseConfidence != null && Number.isFinite(input.baseConfidence)
      ? input.baseConfidence
      : 70;
  const confidence = Math.round(clamp(baseConf + profile.confidenceDelta, 28, 96));

  // Target / return — prefer API horizon row, else scale from base/bull cases.
  const apiPrice = mapApiPrice(input.forecastHorizons, input.horizon);
  const apiReturn = mapApiReturn(input.forecastHorizons, input.horizon);

  const baseTarget =
    input.baseTarget != null && Number.isFinite(input.baseTarget)
      ? input.baseTarget
      : last > 0
        ? last * 1.05
        : null;
  const bullTarget =
    input.bullTarget != null && Number.isFinite(input.bullTarget)
      ? input.bullTarget
      : baseTarget != null && last > 0
        ? last + (baseTarget - last) * 1.65
        : null;
  const bearTarget =
    input.bearTarget != null && Number.isFinite(input.bearTarget)
      ? input.bearTarget
      : last > 0
        ? last * 0.94
        : null;

  let targetPrice: number | null = apiPrice;
  if (targetPrice == null && baseTarget != null && last > 0) {
    if (input.horizon === '1W') {
      targetPrice = last + (baseTarget - last) * profile.returnScale;
    } else if (input.horizon === '1M') {
      targetPrice = baseTarget;
    } else if (bullTarget != null) {
      const mix = input.horizon === '3M' ? 0.55 : 0.85;
      targetPrice = baseTarget + (bullTarget - baseTarget) * mix;
    } else {
      targetPrice = last + (baseTarget - last) * profile.returnScale;
    }
  }

  let expectedReturn: number | null = apiReturn;
  if (expectedReturn == null) {
    if (targetPrice != null && last > 0) {
      expectedReturn = ((targetPrice - last) / last) * 100;
    } else if (input.baseReturn != null) {
      expectedReturn = Number(input.baseReturn) * profile.returnScale;
    }
  }

  // Horizon-scaled bull/bear for trade zones
  const bullCase =
    bullTarget != null && last > 0
      ? last + (bullTarget - last) * (input.horizon === '1W' ? 0.4 : input.horizon === '1M' ? 1 : input.horizon === '3M' ? 1.35 : 1.85)
      : bullTarget;
  const bearCase =
    bearTarget != null && last > 0
      ? last + (bearTarget - last) * (input.horizon === '1W' ? 0.45 : input.horizon === '1M' ? 1 : input.horizon === '3M' ? 1.25 : 1.6)
      : bearTarget;

  const baseStop =
    input.stopLoss != null && Number.isFinite(input.stopLoss)
      ? input.stopLoss
      : bearCase != null
        ? bearCase
        : last > 0
          ? last * 0.92
          : null;
  let stopLoss: number | null = null;
  if (baseStop != null && last > 0) {
    const dist = last - baseStop;
    stopLoss = last - dist * profile.stopTighten;
  }

  const riskScore = Math.round(clamp(input.baseRiskScore + profile.riskBoost, 5, 95));
  const riskLabel = riskLabelFromScore(riskScore);

  const volatility =
    input.baseVolatility != null && Number.isFinite(input.baseVolatility)
      ? Number((input.baseVolatility * profile.volScale).toFixed(1))
      : null;

  const drawdown =
    input.baseDrawdown != null && Number.isFinite(input.baseDrawdown)
      ? Number((input.baseDrawdown * profile.drawdownScale).toFixed(1))
      : expectedReturn != null
        ? Number((-Math.abs(expectedReturn) * 0.55 * profile.drawdownScale).toFixed(1))
        : null;

  const sharpe =
    input.baseSharpe != null && Number.isFinite(input.baseSharpe)
      ? Number((input.baseSharpe * profile.sharpeScale).toFixed(2))
      : expectedReturn != null && volatility != null && volatility > 0
        ? Number(((expectedReturn / volatility) * profile.sharpeScale * 0.35).toFixed(2))
        : null;

  const retTxt =
    expectedReturn != null
      ? `${expectedReturn >= 0 ? '+' : ''}${expectedReturn.toFixed(1)}%`
      : 'n/a';
  const tgtTxt =
    targetPrice != null ? targetPrice.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'n/a';

  const summaryLead = `${horizonLabel} outlook: AI stance is ${ratingLabel} with ${confidence}% confidence. Target ≈ ${tgtTxt} (${retTxt} expected). Risk profile: ${riskLabel}.`;

  const explanation = `All scores, targets, trade zones, and risk metrics on this page are calibrated exclusively for the ${profile.timeframePhrase} investment horizon. Switching horizon recalculates the full dashboard — no mixed timeframes.`;

  return {
    horizon: input.horizon,
    horizonLabel,
    score,
    ratingLabel,
    confidence,
    targetPrice,
    expectedReturn,
    lastClose: last,
    bullCase,
    bearCase,
    stopLoss,
    zoneScale: profile.zoneScale,
    riskScore,
    riskLabel,
    volatility,
    liquidityLabel: liquidityForHorizon(input.horizon, base),
    drawdown,
    sharpe,
    summaryLead,
    explanation,
  };
}
