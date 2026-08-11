/**
 * Shared Quantum Score input builder.
 * Find a Trade and Individual Analysis MUST call this with the same history lookback
 * (1y daily) and must NOT override baseScore/baseConfidence with /api/predict totals.
 * Optional enrich is limited to non-score overlays; score SSOT is chart master score.
 */

import type { HorizonKey } from '../components/analysis/analysisTheme';
import { computeTechnicalIndicators } from './technical';
import type { QuantumEngineInput } from './quantumRecommendationEngine';

export type QuantumInputEnrich = {
  /** @deprecated Ignored — chart master score is SSOT; do not pass predict totalScore. */
  baseScore?: number | null;
  /** @deprecated Ignored — chart confidence is SSOT. */
  baseConfidence?: number | null;
  baseTarget?: number | null;
  bullTarget?: number | null;
  bearTarget?: number | null;
  baseReturn?: number | null;
  forecastHorizons?: QuantumEngineInput['forecastHorizons'];
  whaleScore?: number | null;
  institutionalScore?: number | null;
  sentimentScore?: number | null;
  momentumScore?: number | null;
  newsBias?: QuantumEngineInput['newsBias'];
  smartMoneyScore?: number | null;
  levels?: QuantumEngineInput['levels'];
  stopLossHint?: number | null;
};

function pivotLevels(history: any[], px: number) {
  const sliced = history.slice(-60);
  if (sliced.length < 5) {
    return { s1: px * 0.97, s2: px * 0.94, r1: px * 1.03, r2: px * 1.06 };
  }
  const highs = sliced.map((h) => Number(h.high)).filter((n) => Number.isFinite(n));
  const lows = sliced.map((h) => Number(h.low)).filter((n) => Number.isFinite(n));
  const closes = sliced.map((h) => Number(h.close)).filter((n) => Number.isFinite(n));
  const high = highs.length ? Math.max(...highs) : px * 1.05;
  const low = lows.length ? Math.min(...lows) : px * 0.95;
  const close = closes.length ? closes[closes.length - 1] : px;
  const pp = (high + low + close) / 3;
  return {
    r1: 2 * pp - low,
    s1: 2 * pp - high,
    r2: pp + (high - low),
    s2: pp - (high - low),
  };
}

function scenarioTarget(inst: any, name: 'Base Case' | 'Bull Case' | 'Bear Case'): number | null {
  const row = inst?.scenarios?.find((s: any) => s?.name === name);
  const n = Number(row?.targetPrice);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Build QuantumEngineInput from OHLCV + optional full-analysis enrichments.
 * Chart-derived fields are identical for Find a Trade and App; enrich only upgrades inputs.
 */
export function buildQuantumInputFromMarketData(opts: {
  horizon: HorizonKey;
  ticker: string;
  quote?: any;
  history: any[];
  userHasPosition?: boolean;
  enrich?: QuantumInputEnrich;
}): QuantumEngineInput {
  const history = (opts.history || []).filter(
    (h: any) => h?.close != null && Number.isFinite(Number(h.close))
  );
  const px =
    Number(opts.quote?.regularMarketPrice) ||
    Number(opts.quote?.price) ||
    Number(history[history.length - 1]?.close) ||
    0;

  const tech = computeTechnicalIndicators(history, opts.quote);
  const levels = opts.enrich?.levels ?? pivotLevels(history, px);

  const instFlow = tech?.indicators?.institutionalFlow?.status;
  const ad = tech?.quantumRefinement?.accumulationDistribution?.status;
  const sm = tech?.quantumRefinement?.smartMoneyIndex?.status;
  const sector = tech?.quantumRefinement?.sectorRotation?.status;

  const chartWhale =
    ad === 'ACCUMULATION' ? 78 : ad === 'DISTRIBUTION' ? 32 : 52;
  const chartInst =
    instFlow === 'LARGE_INFLOW' || instFlow === 'STEALTH_ACCUMULATION'
      ? 80
      : instFlow === 'LARGE_OUTFLOW' || instFlow === 'STEALTH_DISTRIBUTION'
        ? 30
        : 55;
  const chartSmart = sm === 'BULLISH' ? 85 : sm === 'BEARISH' ? 35 : 50;

  const inst = tech?.institutionalDecision;
  const chartScore = Number(tech?.masterScores?.aiBuyScore);
  const chartConfidence = Number.isFinite(Number(inst?.confidence))
    ? Number(inst.confidence)
    : Number.isFinite(Number(tech?.compositeConfidence))
      ? Number(tech.compositeConfidence)
      : Number.isFinite(chartScore)
        ? Math.max(68, Math.min(99, 65 + Math.abs(chartScore - 50) * 0.9))
        : 65;
  const chartSentiment = Number(
    tech?.masterScores?.sentimentScore ?? inst?.sentimentScore
  );
  const chartSmartMaster = Number(tech?.masterScores?.smartMoneyScore);

  const baseTarget =
    Number(inst?.baseTarget) > 0
      ? Number(inst.baseTarget)
      : scenarioTarget(inst, 'Base Case') ?? (px > 0 ? px * 1.06 : null);
  const bullTarget =
    Number(inst?.bullTarget) > 0
      ? Number(inst.bullTarget)
      : scenarioTarget(inst, 'Bull Case') ?? (px > 0 ? px * 1.12 : null);
  const bearTarget =
    Number(inst?.stopLoss) > 0
      ? Number(inst.stopLoss)
      : scenarioTarget(inst, 'Bear Case') ?? (px > 0 ? px * 0.92 : null);
  const baseReturn =
    baseTarget != null && px > 0 ? ((baseTarget - px) / px) * 100 : null;
  const stopFromTech = Number(inst?.stopLoss);

  const enrich = opts.enrich || {};

  return {
    horizon: opts.horizon,
    currentPrice: px,
    // Chart master score is SSOT for Find a Trade + Individual Analysis.
    // enrich.baseScore/baseConfidence must NOT be used for predict totalScore —
    // that broke ranking parity (analysis BUY vs scout HOLD).
    baseScore: Number.isFinite(chartScore) ? chartScore : 65,
    baseConfidence: chartConfidence,
    baseTarget: enrich.baseTarget ?? baseTarget,
    bullTarget: enrich.bullTarget ?? bullTarget,
    bearTarget: enrich.bearTarget ?? bearTarget,
    baseReturn: enrich.baseReturn ?? baseReturn,
    forecastHorizons: enrich.forecastHorizons,
    technical: {
      rsi: tech?.indicators?.rsi ?? null,
      macdBullish:
        tech?.indicators?.macd != null
          ? tech.indicators.macd.macdLine > tech.indicators.macd.signalLine
          : null,
      trend: tech?.quantumRefinement?.trendStrength?.status ?? null,
      volatility: tech?.indicators?.volatility ?? null,
      emaBias:
        tech?.indicators?.ema20 != null && px > 0
          ? px > tech.indicators.ema20
            ? 'bull'
            : 'bear'
          : null,
      smaBias:
        tech?.indicators?.sma50 != null && px > 0
          ? px > tech.indicators.sma50
            ? 'bull'
            : 'bear'
          : null,
      bollingerBias:
        tech?.indicators?.bollinger?.percent != null
          ? tech.indicators.bollinger.percent <= 0.2
            ? 'oversold'
            : tech.indicators.bollinger.percent >= 0.8
              ? 'overbought'
              : 'mid'
          : null,
      atrPct:
        tech?.indicators?.atr != null && px > 0
          ? (tech.indicators.atr / px) * 100
          : null,
      volumeBias:
        (tech?.quantumRefinement?.rvol?.ratio ?? 1) >= 1.4
          ? 'high'
          : (tech?.quantumRefinement?.rvol?.ratio ?? 1) <= 0.7
            ? 'low'
            : 'normal',
      obvBias:
        ad === 'ACCUMULATION' ? 'bull' : ad === 'DISTRIBUTION' ? 'bear' : 'neutral',
    },
    levels,
    whaleScore: enrich.whaleScore ?? chartWhale,
    institutionalScore: enrich.institutionalScore ?? chartInst,
    sentimentScore:
      enrich.sentimentScore ??
      (Number.isFinite(chartSentiment) ? chartSentiment : 58),
    momentumScore:
      enrich.momentumScore ??
      (tech?.indicators?.rsi != null ? Math.round(tech.indicators.rsi) : 55),
    newsBias: enrich.newsBias ?? null,
    smartMoneyScore:
      enrich.smartMoneyScore ??
      (Number.isFinite(chartSmartMaster) ? chartSmartMaster : chartSmart),
    fundFlowBias:
      ad === 'ACCUMULATION' ? 'inflow' : ad === 'DISTRIBUTION' ? 'outflow' : 'neutral',
    sectorBias: sector === 'LEADER' ? 'leader' : sector === 'LAGGARD' ? 'laggard' : 'neutral',
    stopLossHint:
      enrich.stopLossHint ??
      (Number.isFinite(stopFromTech) && stopFromTech > 0 ? stopFromTech : null),
    ticker: opts.ticker,
    userHasPosition: Boolean(opts.userHasPosition),
    technicalBreakdown: tech ?? null,
  };
}
