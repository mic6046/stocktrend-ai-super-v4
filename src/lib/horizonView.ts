/**
 * Horizon view adapter — Investment Horizon remains the analysis SSOT surface.
 * Delegates ONLY to AI Quantum Score (runQuantumRecommendationEngine).
 * Screens must read verdict/score/confidence/ER/action from this output — never recalculate.
 */
import type { HorizonKey } from '../components/analysis/analysisTheme';
import {
  runQuantumRecommendationEngine,
  type QuantumEngineInput,
  type QuantumEngineOutput,
} from './quantumRecommendationEngine';
import { toStockRecommendation, type StockRecommendation } from './recommendation';

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
  companyName?: string;
  technical?: QuantumEngineInput['technical'];
  levels?: QuantumEngineInput['levels'];
  whaleScore?: number | null;
  institutionalScore?: number | null;
  sentimentScore?: number | null;
  momentumScore?: number | null;
  newsBias?: QuantumEngineInput['newsBias'];
  smartMoneyScore?: number | null;
  fundFlowBias?: QuantumEngineInput['fundFlowBias'];
  sectorBias?: QuantumEngineInput['sectorBias'];
  userHasPosition?: boolean;
};

export type HorizonView = QuantumEngineOutput;

export function buildHorizonView(input: HorizonViewInput): HorizonView {
  return runQuantumRecommendationEngine({
    horizon: input.horizon,
    currentPrice: input.lastClose,
    baseScore: input.baseScore,
    baseConfidence: input.baseConfidence,
    baseTarget: input.baseTarget,
    bullTarget: input.bullTarget,
    bearTarget: input.bearTarget,
    baseReturn: input.baseReturn,
    forecastHorizons: input.forecastHorizons,
    technical: {
      ...(input.technical || {}),
      volatility: input.technical?.volatility ?? input.baseVolatility,
    },
    levels: input.levels,
    whaleScore: input.whaleScore,
    institutionalScore: input.institutionalScore,
    sentimentScore: input.sentimentScore,
    momentumScore: input.momentumScore,
    newsBias: input.newsBias,
    smartMoneyScore: input.smartMoneyScore,
    fundFlowBias: input.fundFlowBias,
    sectorBias: input.sectorBias,
    stopLossHint: input.stopLoss,
    ticker: input.ticker,
    userHasPosition: input.userHasPosition,
  });
}

/** Shared Recommendation object for every screen — Quantum Score only. */
export function buildStockRecommendation(input: HorizonViewInput): StockRecommendation {
  const engine = buildHorizonView(input);
  return toStockRecommendation(engine, {
    ticker: input.ticker || '—',
    companyName: input.companyName || input.ticker || '—',
  });
}
