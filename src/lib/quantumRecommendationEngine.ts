/**
 * QuantumNode Consensus AI — Institutional Investment Decision Engine
 * Mission: most consistent, transparent, explainable, professionally defensible recommendation.
 * NOT maximize BUY. Never display contradictory conclusions on the same horizon.
 */

import type { HorizonKey } from '../components/analysis/analysisTheme';
import { HORIZON_OPTIONS } from '../components/analysis/analysisTheme';
import {
  resolvePrimaryAction,
  sanitizePrimaryDecision,
  toZoneAction,
  splitBuyEnvelope,
  type BuyBand,
  type PrimaryDecision,
} from './buyZoneDecision';
import { buildRealisticSuggestEntry } from './suggestTradeEngine';
import type { TechnicalBreakdown } from './technical';

export type RecommendationLabel =
  | 'STRONG BUY'
  | 'BUY'
  | 'HOLD'
  | 'REDUCE'
  | 'SELL'
  | 'AVOID NEW POSITION';

export type SuggestedAction =
  | 'Buy'
  | 'Accumulate'
  | 'Hold'
  | 'Take Partial Profit'
  | 'Reduce'
  | 'Exit';

export type SignalClass =
  | 'BUY SIGNAL'
  | 'ACCUMULATION'
  | 'ADD POSITION'
  | 'HOLD'
  | 'TAKE PARTIAL PROFIT'
  | 'REDUCE POSITION'
  | 'EXIT POSITION'
  | 'CAUTION SIGNAL';

export type RiskLevel = 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';
export type ChartStance = 'bull' | 'bear' | 'neutral';
export type CommitteeSeat = 'Technical' | 'Fundamental' | 'Whale' | 'Risk' | 'Momentum' | 'Sentiment';

export type EngineZoneBand = { lo: number; hi: number };

export type FactorItem = {
  label: string;
  weight: number;
  polarity: 'bull' | 'bear' | 'neutral';
};

export type ExplainedSignal = {
  title: string;
  signalClass: SignalClass;
  confidence: number;
  reasons: string[];
  suggestedAction: string;
  expectedProbability: number;
  polarity: 'bull' | 'bear' | 'neutral';
  trigger: string;
  risk: string;
  maxDownside: string;
  potentialUpside: string;
  holdingPeriod: string;
};

export type CommitteeMember = {
  seat: CommitteeSeat;
  score: number;
  recommendation: RecommendationLabel;
  confidence: number;
  reason: string;
  weight: number;
};

/** Live price maps to exactly ONE of these primary actions */
export type ZoneAction =
  | 'BUY'
  | 'ADD POSITION'
  | 'HOLD'
  | 'WAIT'
  | 'TAKE PROFIT'
  | 'PARTIAL TAKE PROFIT'
  | 'REDUCE'
  | 'EXIT'
  | 'RE-ENTRY'
  | 'REASSESS'
  | 'INDECISION'
  | 'AVOID NEW POSITION'
  | 'STOP LOSS';

export type LiveActionBrief = {
  action: ZoneAction;
  reason: string;
  confidence: number;
  zoneKey: string;
  /** Precise status e.g. TAKE PROFIT / BUY NOW — BUY ZONE 1 / INDECISION */
  displayLabel?: string;
  why?: string;
  nextOpportunity?: string;
  conflictingFactors?: string[];
  whatToWatch?: string;
  confidenceBand?: 'Very Low' | 'Low' | 'Moderate' | 'High';
  futureReEntryZone?: { lo: number; hi: number } | null;
  futureTakeProfitZone?: { lo: number; hi: number } | null;
  priceLocation?: import('./buyZoneDecision').PriceLocation;
  confirmationStatus?: import('./buyZoneDecision').ConfirmationStatus;
  activeBuyZoneLevel?: 1 | 2 | 3 | null;
  validated?: boolean;
};

export type ComponentScores = {
  technical: number;
  fundamental: number;
  whale: number;
  news: number;
  risk: number;
  momentum: number;
  overall: number;
};

/** Consensus weights (Step 3) — used when no market regime is known. */
export const COMMITTEE_WEIGHTS: Record<CommitteeSeat, number> = {
  Technical: 0.2,
  Fundamental: 0.25,
  Whale: 0.2,
  Risk: 0.15,
  Momentum: 0.1,
  Sentiment: 0.1,
};

/**
 * technical.ts already detects a market regime (Bull/Bear/Sideways/High
 * Volatility/Crisis) and computes regime-adjusted weights for its own internal
 * buyIndexScore — but that score was never read by this engine, so every stock
 * got the same fixed committee weights regardless of regime. This mirrors the
 * same regime-adaptation logic technical.ts already validated, applied to the
 * committee that actually drives BUY/SELL. All sets sum to 1.0.
 */
const REGIME_COMMITTEE_WEIGHTS: Record<string, Record<CommitteeSeat, number>> = {
  'Crisis Market': { Technical: 0.12, Fundamental: 0.3, Whale: 0.2, Risk: 0.25, Momentum: 0.05, Sentiment: 0.08 },
  'High Volatility Market': { Technical: 0.15, Fundamental: 0.25, Whale: 0.22, Risk: 0.2, Momentum: 0.08, Sentiment: 0.1 },
  'Bull Market': { Technical: 0.25, Fundamental: 0.18, Whale: 0.2, Risk: 0.12, Momentum: 0.15, Sentiment: 0.1 },
  'Bear Market': { Technical: 0.2, Fundamental: 0.22, Whale: 0.18, Risk: 0.22, Momentum: 0.08, Sentiment: 0.1 },
};

function getCommitteeWeights(marketRegime?: string | null): Record<CommitteeSeat, number> {
  if (marketRegime && REGIME_COMMITTEE_WEIGHTS[marketRegime]) return REGIME_COMMITTEE_WEIGHTS[marketRegime];
  return COMMITTEE_WEIGHTS;
}

export type QuantumEngineInput = {
  horizon: HorizonKey;
  currentPrice: number;
  baseScore?: number | null;
  baseConfidence?: number | null;
  baseTarget?: number | null;
  bullTarget?: number | null;
  bearTarget?: number | null;
  baseReturn?: number | null;
  forecastHorizons?: Array<{
    label?: string;
    horizon?: string;
    expectedReturn?: number;
    returnPct?: number;
    expectedPrice?: number;
    expectedVolatility?: number;
  }>;
  technical?: {
    rsi?: number | null;
    macdBullish?: boolean | null;
    trend?: string | null;
    volatility?: number | null;
    adx?: number | null;
    emaBias?: 'bull' | 'bear' | 'neutral' | null;
    smaBias?: 'bull' | 'bear' | 'neutral' | null;
    bollingerBias?: 'oversold' | 'overbought' | 'mid' | null;
    atrPct?: number | null;
    volumeBias?: 'high' | 'low' | 'normal' | null;
    obvBias?: 'bull' | 'bear' | 'neutral' | null;
  };
  levels?: { s1?: number; s2?: number; r1?: number; r2?: number } | null;
  whaleScore?: number | null;
  institutionalScore?: number | null;
  sentimentScore?: number | null;
  momentumScore?: number | null;
  newsBias?: 'bull' | 'bear' | 'neutral' | null;
  smartMoneyScore?: number | null;
  fundFlowBias?: 'inflow' | 'outflow' | 'neutral' | null;
  sectorBias?: 'leader' | 'laggard' | 'neutral' | null;
  stopLossHint?: number | null;
  ticker?: string;
  /** Whether the user already owns the name — changes displayed actions */
  userHasPosition?: boolean;
  /** Full technical breakdown for Buy Zone 1/2/3 SSOT (optional). */
  technicalBreakdown?: import('./technical').TechnicalBreakdown | null;
  /** Detected market regime — shifts committee weights (see getCommitteeWeights). */
  marketRegime?: string | null;
  /** 0..1 — how much of the input rests on real data vs. silent fallback defaults. */
  dataCompleteness?: number | null;
};

export type QuantumEngineOutput = {
  horizon: HorizonKey;
  horizonLabel: string;
  score: number;
  ratingLabel: RecommendationLabel;
  confidence: number;
  currentPrice: number;
  targetPrice: number;
  expectedReturn: number;
  riskLevel: RiskLevel;
  riskScore: number;
  riskLabel: RiskLevel;
  volatility: number | null;
  liquidityLabel: string;
  drawdown: number;
  sharpe: number;
  buyZone: EngineZoneBand;
  addZone: EngineZoneBand;
  holdZone: EngineZoneBand;
  takeProfitZone: EngineZoneBand;
  reduceZone: EngineZoneBand;
  exitZone: EngineZoneBand;
  /** Scale-in Buy Zone 1/2/3 — FUTURE entry opportunities unless primary says BUY/ADD */
  buyZones: Array<{
    level: 1 | 2 | 3;
    label: string;
    lo: number;
    hi: number;
    sizePct?: number;
    anchor?: string;
    status?: string;
    reason?: string;
    confirmationRequirement?: string;
    riskLevel?: string;
    invalidation?: number | null;
  }>;
  reEntryZone: EngineZoneBand | null;
  stopLoss: number;
  takeProfit: number;
  bullCase: number;
  bearCase: number;
  zoneScale: number;
  userHasPosition: boolean;
  currentAction: LiveActionBrief;
  /** Zones shown for this position state (no contradictory actions) */
  visibleZoneKeys: Array<'buy' | 'add' | 'hold' | 'takeProfit' | 'reduce' | 'exit' | 'stop'>;
  zonesConsistent: boolean;
  keyReasons: string[];
  /** Must be surfaced prominently: BUY within ~2.5% of resistance, SELL/REDUCE
   * triggered by a support breakdown/proximity, or a REDUCE call whose clamped
   * expected return can look inconsistent with the label. Null otherwise. */
  criticalCaveat: string | null;
  summaryLead: string;
  explanation: string;
  chartStance: ChartStance;
  finalVerdict: RecommendationLabel;
  validationStatus: '✓ Internal Consistency Passed' | '✗ Recalculate';

  componentScores: ComponentScores;
  bullishFactors: FactorItem[];
  bearishFactors: FactorItem[];
  neutralFactors: FactorItem[];
  whyWins: string;
  rejectedOpposite: string;
  suggestedAction: SuggestedAction;
  invalidationLevel: string;
  nextReviewTrigger: string;
  supportHoldProbability: number;
  resistanceBreakProbability: number;
  explainedSignals: ExplainedSignal[];
  decisionWeightNote: string;

  /** Consensus AI extensions */
  committee: CommitteeMember[];
  bullishScore: number;
  bearishScore: number;
  supportFailureProbability: number;
  resistanceRejectionProbability: number;
  entryZone: EngineZoneBand;
  supportLevels: number[];
  resistanceLevels: number[];
  target1: number;
  target2: number;
  target3: number;
  consensusNote: string;
};

const HORIZON_DAYS: Record<HorizonKey, number> = {
  '1W': 5,
  '1M': 21,
  '3M': 63,
  '1Y': 252,
};

/**
 * Confidence previously depended only on the committee's read of *current*
 * technical/fundamental conditions (netWeight/overall/decisive), which don't
 * change based on which horizon is selected — so the same evidence produced
 * identical confidence at 1W and 1Y. That's inconsistent with the rest of the
 * engine: fairTargetPrice's own maxAbs bound widens 12% -> 28% -> 55% -> 110%
 * across 1W/1M/3M/1Y (correctly acknowledging more can happen the further out
 * you look), yet confidence in the point estimate stayed flat regardless. This
 * model is also technical/flow-heavy (Technical+Whale+Momentum = ~50% of
 * committee weight), and those signals are inherently more predictive for
 * near-term price action than for a 1-year outlook, where fundamentals/macro
 * dominate more than this week's RSI reading. 1M is the anchor (0 adjustment,
 * matching its role as the reference horizon elsewhere — see `scale = days/21`
 * in fairTargetPrice); modest on either side, not dramatic.
 */
const HORIZON_CONFIDENCE_ADJUSTMENT: Record<HorizonKey, number> = {
  '1W': 4,
  '1M': 0,
  '3M': -4,
  '1Y': -8,
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Rounding a price to cents is fine for most tickers, but for a low-priced
 * stock one cent can be a large fraction of the price — e.g. $0.01 on a $2.59
 * stock is ~0.39%, well past the 0.15-point consistency tolerance validate()
 * checks between a target price and its implied expectedReturn %. That
 * mismatch showed up as "✗ Recalculate" on real sub-$20 tickers (observed on
 * AMC) even though nothing about the recommendation itself was wrong — only
 * the price rounding was too coarse. Scale precision with price so the
 * rounding error always stays well under that tolerance.
 */
function roundPrice(n: number): number {
  if (!Number.isFinite(n)) return n;
  const abs = Math.abs(n);
  if (abs > 0 && abs < 2) return Math.round(n * 10000) / 10000;
  if (abs < 20) return Math.round(n * 1000) / 1000;
  return round2(n);
}

/**
 * Applies a minimum-conviction floor without collapsing distinct raw values
 * to the same number. Plain Math.max(floor, raw) maps every raw value below
 * the floor to the identical floor value — e.g. two different horizons whose
 * fairTargetPrice-derived returns were 0.98% and 2.46% (both below a 3.2%
 * floor) both landed on exactly 3.2%, erasing the horizon-scaling that was
 * computed correctly upstream. Values already at/above the floor pass
 * through unchanged; only the sub-floor range gets compressed instead of
 * flattened.
 */
function floorWithSignal(raw: number, floor: number, fallback: number): number {
  const abs = Math.abs(raw) || fallback;
  return abs >= floor ? abs : floor + abs * 0.3;
}

function mapApiRow(
  rows: QuantumEngineInput['forecastHorizons'],
  horizon: HorizonKey
): { price: number | null; ret: number | null; vol: number | null } {
  if (!rows?.length) return { price: null, ret: null, vol: null };
  const needles: Record<HorizonKey, RegExp> = {
    '1W': /^(5|7)\s*day|1\s*w|week/i,
    '1M': /^(20|21|30)\s*day|1\s*m(?!in)|month/i,
    '3M': /^(60|90)\s*day|3\s*m|quarter/i,
    '1Y': /^(90)\s*day|1\s*y|12\s*m|year/i,
  };
  const hit = rows.find((h) => needles[horizon].test(String(h.label || h.horizon || '')));
  if (!hit) return { price: null, ret: null, vol: null };
  const price = hit.expectedPrice != null && Number.isFinite(hit.expectedPrice) ? Number(hit.expectedPrice) : null;
  const retRaw = hit.expectedReturn ?? hit.returnPct;
  const ret = retRaw != null && Number.isFinite(Number(retRaw)) ? Number(retRaw) : null;
  const vol =
    hit.expectedVolatility != null && Number.isFinite(hit.expectedVolatility)
      ? Number(hit.expectedVolatility)
      : null;
  return { price, ret, vol };
}

export function recommendationFromReturn(expectedReturn: number): RecommendationLabel {
  if (expectedReturn >= 20) return 'STRONG BUY';
  if (expectedReturn >= 10) return 'BUY';
  if (expectedReturn >= 3) return 'BUY';
  if (expectedReturn > -3) return 'HOLD';
  if (expectedReturn > -10) return 'REDUCE';
  if (expectedReturn > -20) return 'SELL';
  return 'AVOID NEW POSITION';
}

export function chartStanceFromRecommendation(rec: RecommendationLabel): ChartStance {
  if (rec === 'STRONG BUY' || rec === 'BUY') return 'bull';
  if (rec === 'SELL' || rec === 'AVOID NEW POSITION' || rec === 'REDUCE') return 'bear';
  return 'neutral';
}

export function isBullishRecommendation(rec: RecommendationLabel): boolean {
  return chartStanceFromRecommendation(rec) === 'bull';
}

export function isBearishRecommendation(rec: RecommendationLabel): boolean {
  return chartStanceFromRecommendation(rec) === 'bear';
}

function recFromScore(score: number): RecommendationLabel {
  if (score >= 85) return 'STRONG BUY';
  if (score >= 68) return 'BUY';
  if (score >= 48) return 'HOLD';
  if (score >= 38) return 'REDUCE';
  if (score >= 28) return 'SELL';
  return 'AVOID NEW POSITION';
}

/** Risk AI: high risk score → defensive recommendation */
function recFromRiskScore(riskScore: number): RecommendationLabel {
  if (riskScore >= 80) return 'AVOID NEW POSITION';
  if (riskScore >= 68) return 'SELL';
  if (riskScore >= 55) return 'REDUCE';
  if (riskScore >= 40) return 'HOLD';
  if (riskScore >= 25) return 'BUY';
  return 'STRONG BUY';
}

function scoreFromRecommendation(rec: RecommendationLabel, expectedReturn: number, bias: number): number {
  const baseByRec: Record<RecommendationLabel, number> = {
    'STRONG BUY': 92,
    BUY: 78,
    HOLD: 55,
    REDUCE: 45,
    SELL: 38,
    'AVOID NEW POSITION': 25,
  };
  const fine = clamp(expectedReturn * 0.35, -8, 8);
  return Math.round(clamp(baseByRec[rec] + fine + bias * 0.15, 1, 99));
}

function riskFromVolatility(vol: number | null, horizon: HorizonKey): { level: RiskLevel; score: number } {
  const v = vol ?? (horizon === '1W' ? 28 : horizon === '1Y' ? 18 : 22);
  if (v < 12) return { level: 'Very Low', score: 18 };
  if (v < 18) return { level: 'Low', score: 32 };
  if (v < 28) return { level: 'Medium', score: 48 };
  if (v < 40) return { level: 'High', score: 68 };
  return { level: 'Very High', score: 84 };
}

function liquidityLabel(score: number, whale: number | null): string {
  if (whale != null && whale < 35) return 'Tight';
  if (score >= 75) return 'High';
  if (score >= 55) return 'Moderate';
  return 'Tight';
}

function holdingPeriodFor(horizon: HorizonKey): string {
  return (
    {
      '1W': '3–7 trading days',
      '1M': '2–6 weeks',
      '3M': '1–3 months',
      '1Y': '3–12 months',
    } as const
  )[horizon];
}

type EvidenceBag = {
  bullish: FactorItem[];
  bearish: FactorItem[];
  neutral: FactorItem[];
  netWeight: number;
  bullWeight: number;
  bearWeight: number;
  scores: ComponentScores;
  supportHoldProbability: number;
  supportFailureProbability: number;
  resistanceBreakProbability: number;
  resistanceRejectionProbability: number;
  explainedSignals: ExplainedSignal[];
  buyGatePass: boolean;
  sellGatePass: boolean;
  buyGateFails: string[];
  sellGateFails: string[];
  committee: CommitteeMember[];
  bullishScore: number;
  bearishScore: number;
  /** Price is still above key support (not a confirmed breakdown). */
  supportHolding: boolean;
  /** Live price is through S1 (structure break). */
  supportBroken: boolean;
  /** Independent bearish confirmations (volume, RSI, momentum, flow, trend). */
  bearConfirmCount: number;
  /** Uptrend / EMA structure still constructive. */
  structureIntact: boolean;
  /** Whale / institutional / smart-money softening without a breakdown. */
  flowWeakening: boolean;
  nearSupport: boolean;
  nearResistance: boolean;
  volumeSelling: boolean;
  supportLevel: number | null;
  resistanceLevel: number | null;
  majorResistance: number | null;
  /** Price rising with confirming volume — user-prioritized "very strong buy" pattern. */
  priceVolumeSurge: boolean;
  /** Price above resistance AND volume confirms the breakout. */
  breakoutWithVolume: boolean;
  /** Whale/institutional/smart-money accumulation at a high-conviction threshold (80+). */
  strongAccumulation: boolean;
  /** Uptrend structure intact with price pulled back into the support zone. */
  pullbackToSupportInUptrend: boolean;
};

function pushSignal(
  list: ExplainedSignal[],
  partial: Omit<ExplainedSignal, 'holdingPeriod'> & { holdingPeriod?: string },
  horizon: HorizonKey
) {
  list.push({
    ...partial,
    holdingPeriod: partial.holdingPeriod ?? holdingPeriodFor(horizon),
  });
}

/**
 * STEP 1–2: Collect evidence and form AI Investment Committee votes.
 * Conflicting signals are retained — never forced to agree.
 */
function collectEvidence(input: QuantumEngineInput): EvidenceBag {
  const bullish: FactorItem[] = [];
  const bearish: FactorItem[] = [];
  const neutral: FactorItem[] = [];
  const explainedSignals: ExplainedSignal[] = [];
  const horizon = input.horizon;

  const px = input.currentPrice;
  const rsi = input.technical?.rsi;
  const vol = input.technical?.volatility ?? 22;
  const s1 = input.levels?.s1;
  const s2 = input.levels?.s2;
  const r1 = input.levels?.r1;
  const r2 = input.levels?.r2;

  let technical = 55;
  let fundamental = input.baseScore != null ? clamp(input.baseScore, 1, 99) : 60;
  let whale = input.whaleScore != null ? clamp(input.whaleScore, 1, 99) : 50;
  let news = input.sentimentScore != null ? clamp(input.sentimentScore, 1, 99) : 55;
  let momentum = input.momentumScore != null ? clamp(input.momentumScore, 1, 99) : 55;
  let risk = 50;

  // --- Technical stack ---
  if (rsi != null && Number.isFinite(rsi)) {
    if (rsi < 35) {
      technical = Math.max(technical, 72);
      bullish.push({ label: 'RSI recovering from oversold', weight: 0.55, polarity: 'bull' });
      pushSignal(
        explainedSignals,
        {
          title: 'BUY SIGNAL · RSI Oversold Recovery',
          signalClass: 'BUY SIGNAL',
          confidence: Math.round(clamp(70 + (35 - rsi), 60, 92)),
          reasons: [`RSI at ${Math.round(rsi)}`, 'Mean-reversion setup forming'],
          suggestedAction: 'Accumulate near support — not chase',
          expectedProbability: Math.round(clamp(58 + (35 - rsi), 55, 78)),
          polarity: 'bull',
          trigger: `RSI ${Math.round(rsi)} < 35`,
          risk: 'Failed bounce / continued downtrend',
          maxDownside: '3–6% if support fails',
          potentialUpside: '4–9% mean reversion',
        },
        horizon
      );
    } else if (rsi > 70) {
      technical = Math.min(technical, 38);
      bearish.push({ label: 'RSI overbought', weight: 0.5, polarity: 'bear' });
      pushSignal(
        explainedSignals,
        {
          title: 'TAKE PARTIAL PROFIT · RSI Overbought',
          signalClass: 'TAKE PARTIAL PROFIT',
          confidence: Math.round(clamp(68 + (rsi - 70), 60, 90)),
          reasons: [`RSI at ${Math.round(rsi)}`, 'Short-term exhaustion risk'],
          suggestedAction: 'Take partial profit (~30%) — not full exit by default',
          expectedProbability: Math.round(clamp(55 + (rsi - 70), 52, 75)),
          polarity: 'bear',
          trigger: `RSI ${Math.round(rsi)} > 70`,
          risk: 'Trend continuation squeezes shorts',
          maxDownside: 'Opportunity cost if breakout continues',
          potentialUpside: 'Lock 30% gains; keep core if trend intact',
        },
        horizon
      );
    } else if (rsi >= 45 && rsi <= 60) {
      technical = Math.max(technical, 62);
      bullish.push({ label: 'RSI in constructive mid-range', weight: 0.25, polarity: 'bull' });
    } else {
      neutral.push({ label: `RSI neutral (${Math.round(rsi)})`, weight: 0.15, polarity: 'neutral' });
    }
  }

  if (input.technical?.macdBullish === true) {
    technical = Math.max(technical, 75);
    momentum = Math.max(momentum, 72);
    bullish.push({ label: 'MACD bullish crossover', weight: 0.6, polarity: 'bull' });
  } else if (input.technical?.macdBullish === false) {
    technical = Math.min(technical, 40);
    momentum = Math.min(momentum, 38);
    bearish.push({ label: 'MACD bearish crossover', weight: 0.6, polarity: 'bear' });
  }

  const trend = String(input.technical?.trend || '').toUpperCase();
  if (trend.includes('BULL')) {
    technical = Math.max(technical, 80);
    bullish.push({ label: 'Uptrend structure intact', weight: 0.7, polarity: 'bull' });
  } else if (trend.includes('BEAR')) {
    technical = Math.min(technical, 35);
    bearish.push({ label: 'Downtrend pressure', weight: 0.7, polarity: 'bear' });
  } else {
    neutral.push({ label: 'Trend lacks decisive breakout', weight: 0.2, polarity: 'neutral' });
  }

  if (input.technical?.emaBias === 'bull') {
    technical = Math.max(technical, 70);
    bullish.push({ label: 'Price above key EMAs', weight: 0.45, polarity: 'bull' });
  } else if (input.technical?.emaBias === 'bear') {
    technical = Math.min(technical, 42);
    bearish.push({ label: 'Price below key EMAs', weight: 0.45, polarity: 'bear' });
  }

  if (input.technical?.smaBias === 'bull') {
    bullish.push({ label: 'SMA structure supportive', weight: 0.35, polarity: 'bull' });
  } else if (input.technical?.smaBias === 'bear') {
    bearish.push({ label: 'SMA structure pressuring price', weight: 0.35, polarity: 'bear' });
  }

  if (input.technical?.bollingerBias === 'oversold') {
    technical = Math.max(technical, 68);
    bullish.push({ label: 'Bollinger oversold pierce', weight: 0.4, polarity: 'bull' });
  } else if (input.technical?.bollingerBias === 'overbought') {
    technical = Math.min(technical, 42);
    bearish.push({ label: 'Bollinger upper-band stretch', weight: 0.4, polarity: 'bear' });
  }

  if (input.technical?.adx != null && input.technical.adx >= 25) {
    if (trend.includes('BULL')) {
      bullish.push({ label: `ADX trend strength (${Math.round(input.technical.adx)})`, weight: 0.4, polarity: 'bull' });
    } else if (trend.includes('BEAR')) {
      bearish.push({ label: `ADX confirms bearish trend (${Math.round(input.technical.adx)})`, weight: 0.4, polarity: 'bear' });
    } else {
      neutral.push({ label: `ADX elevated (${Math.round(input.technical.adx)}) without clear direction`, weight: 0.2, polarity: 'neutral' });
    }
  }

  // obvBias is not derived from real On-Balance-Volume data — both builder call
  // sites set it from the same accumulation/distribution status already voted
  // below as "Whale accumulation/distribution". Casting a second additive vote
  // from identical source data isn't a confirmation, so it's used only for the
  // (non-additive, OR-based) sell-confirmation gate further down, not here.

  if (input.technical?.volumeBias === 'high') {
    neutral.push({ label: 'Elevated volume — confirmation required', weight: 0.15, polarity: 'neutral' });
  }

  // --- Money flow ---
  // institutionalScore, whaleScore, and smartMoneyScore are three independently
  // *coded* but not independently *sourced* proxies — all three are volume/price-
  // weighted flow estimates over overlapping ~10-14 day windows of the same
  // OHLCV data (no real trade-level institutional data feed is wired up). They
  // were previously weighted as if each were a separate confirmation (0.9/0.85/
  // 0.7 — the single largest weights in the whole model), which let one noisy
  // flow read, once it happened to agree across all three formulas, dominate
  // more specific technical signals. fundFlowBias was a fourth, literal
  // duplicate of whaleScore's own source status and has been removed entirely
  // rather than re-weighted. Weights below are reduced to reflect "several
  // correlated reads of the same underlying signal" rather than "three
  // independent confirmations".
  if (input.institutionalScore != null) {
    if (input.institutionalScore >= 60) {
      bullish.push({ label: 'Institutional accumulation detected', weight: 0.55, polarity: 'bull' });
      pushSignal(
        explainedSignals,
        {
          title: 'ACCUMULATION · Institutional Buying',
          signalClass: 'ACCUMULATION',
          confidence: Math.round(clamp(input.institutionalScore, 60, 95)),
          reasons: ['Smart-money flow constructive', 'Institutional buying detected'],
          suggestedAction: 'Accumulate gradually',
          expectedProbability: Math.round(clamp(input.institutionalScore * 0.85, 55, 88)),
          polarity: 'bull',
          trigger: `Institutional score ${Math.round(input.institutionalScore)}`,
          risk: 'False accumulation / delayed reaction',
          maxDownside: '2–5% noise risk while building',
          potentialUpside: 'Aligned with horizon target',
        },
        horizon
      );
    } else if (input.institutionalScore < 40) {
      bearish.push({ label: 'Institutional selling / distribution', weight: 0.5, polarity: 'bear' });
      pushSignal(
        explainedSignals,
        {
          title: 'REDUCE POSITION · Institutional Distribution',
          signalClass: 'REDUCE POSITION',
          confidence: Math.round(clamp(100 - input.institutionalScore, 60, 92)),
          reasons: ['Institutional selling pressure', 'Smart money de-risking'],
          suggestedAction: 'Reduce exposure',
          expectedProbability: Math.round(clamp(100 - input.institutionalScore, 55, 85)),
          polarity: 'bear',
          trigger: `Institutional score ${Math.round(input.institutionalScore)} < 40`,
          risk: 'Short squeeze if news flips',
          maxDownside: 'Full position risk if distribution continues',
          potentialUpside: 'Preserve capital for better entry',
        },
        horizon
      );
    }
  }

  if (input.whaleScore != null) {
    if (input.whaleScore >= 60) {
      whale = Math.max(whale, input.whaleScore);
      bullish.push({ label: 'Whale accumulation detected', weight: 0.5, polarity: 'bull' });
    } else if (input.whaleScore < 40) {
      whale = Math.min(whale, input.whaleScore);
      bearish.push({ label: 'Whale distribution', weight: 0.45, polarity: 'bear' });
    }
  }

  if (input.smartMoneyScore != null) {
    if (input.smartMoneyScore >= 65) {
      whale = Math.max(whale, input.smartMoneyScore * 0.9);
      bullish.push({ label: 'Smart money index constructive', weight: 0.4, polarity: 'bull' });
    } else if (input.smartMoneyScore < 40) {
      bearish.push({ label: 'Smart money index weak', weight: 0.35, polarity: 'bear' });
    }
  }

  if (input.momentumScore != null) {
    if (input.momentumScore >= 60) {
      momentum = Math.max(momentum, input.momentumScore);
      bullish.push({ label: 'Positive momentum', weight: 0.45, polarity: 'bull' });
    } else if (input.momentumScore < 40) {
      momentum = Math.min(momentum, input.momentumScore);
      bearish.push({ label: 'Weak short-term momentum', weight: 0.45, polarity: 'bear' });
    }
  }

  if (input.sentimentScore != null) {
    if (input.sentimentScore >= 65) {
      news = Math.max(news, input.sentimentScore);
      bullish.push({ label: 'Positive news / sentiment flow', weight: 0.4, polarity: 'bull' });
    } else if (input.sentimentScore < 40) {
      news = Math.min(news, input.sentimentScore);
      bearish.push({ label: 'Negative news sentiment', weight: 0.4, polarity: 'bear' });
    }
  }

  if (input.newsBias === 'bull') {
    bullish.push({ label: 'News bias constructive', weight: 0.3, polarity: 'bull' });
  } else if (input.newsBias === 'bear') {
    bearish.push({ label: 'News bias defensive', weight: 0.3, polarity: 'bear' });
  }

  if (input.sectorBias === 'leader') {
    bullish.push({ label: 'Sector leadership / rotation favor', weight: 0.35, polarity: 'bull' });
  } else if (input.sectorBias === 'laggard') {
    bearish.push({ label: 'Sector lagging rotation', weight: 0.35, polarity: 'bear' });
  }

  if (input.baseScore != null && input.baseScore >= 75) {
    fundamental = Math.max(fundamental, input.baseScore);
    bullish.push({ label: 'Composite fundamentals constructive', weight: 0.55, polarity: 'bull' });
  } else if (input.baseScore != null && input.baseScore < 50) {
    fundamental = Math.min(fundamental, input.baseScore);
    bearish.push({ label: 'Composite fundamentals weak', weight: 0.55, polarity: 'bear' });
  }

  // --- Support / Resistance probabilities (Step 5) ---
  let supportHoldProbability = 55;
  let resistanceBreakProbability = 45;
  if (px > 0 && s1 != null && Number.isFinite(s1)) {
    const distToS1 = (px - s1) / px;
    if (distToS1 >= 0 && distToS1 < 0.03) {
      supportHoldProbability = clamp(
        78 + (input.whaleScore ?? 50) * 0.08 + (input.institutionalScore ?? 50) * 0.08,
        55,
        92
      );
      bullish.push({ label: 'Price near support (S1)', weight: 0.65, polarity: 'bull' });
      pushSignal(
        explainedSignals,
        {
          title: 'ADD POSITION · Near Support',
          signalClass: 'ADD POSITION',
          confidence: Math.round(supportHoldProbability),
          reasons: ['Price near S1', `Support holding probability ~${Math.round(supportHoldProbability)}%`],
          suggestedAction: 'Accumulate slowly',
          expectedProbability: Math.round(supportHoldProbability),
          polarity: 'bull',
          trigger: 'Spot within 3% of S1',
          risk: 'Support failure / breakdown',
          maxDownside: `To S2 ~${s2 != null ? round2(s2) : 'lower structure'}`,
          potentialUpside: 'Bounce toward mid-range / R1',
        },
        horizon
      );
    } else if (distToS1 < 0) {
      supportHoldProbability = clamp(28 - Math.abs(distToS1) * 200, 12, 45);
      bearish.push({ label: 'Support broken / price below S1', weight: 0.75, polarity: 'bear' });
    } else {
      supportHoldProbability = clamp(60 + (1 - Math.min(distToS1, 0.08) / 0.08) * 15, 45, 80);
      neutral.push({ label: 'Support cushion below spot', weight: 0.2, polarity: 'neutral' });
    }
  }
  if (px > 0 && r1 != null && Number.isFinite(r1)) {
    const distToR1 = (r1 - px) / px;
    if (distToR1 >= 0 && distToR1 < 0.025) {
      resistanceBreakProbability = clamp(35 + momentum * 0.25, 25, 70);
      bearish.push({ label: 'Resistance nearby (R1)', weight: 0.45, polarity: 'bear' });
      pushSignal(
        explainedSignals,
        {
          title: 'CAUTION SIGNAL · Resistance Nearby',
          signalClass: 'CAUTION SIGNAL',
          confidence: Math.round(100 - resistanceBreakProbability),
          reasons: [
            'Price approaching R1',
            `Resistance break probability ~${Math.round(resistanceBreakProbability)}%`,
            'Resistance is NOT automatic SELL',
          ],
          suggestedAction: 'Wait for breakout confirmation or trim if extended',
          expectedProbability: Math.round(100 - resistanceBreakProbability),
          polarity: 'bear',
          trigger: 'Spot within 2.5% of R1',
          risk: 'Rejection pullback',
          maxDownside: '3–7% if rejected',
          potentialUpside: 'Continuation if resistance breaks with volume',
        },
        horizon
      );
    } else if (distToR1 < 0) {
      resistanceBreakProbability = clamp(72 + Math.abs(distToR1) * 100, 60, 90);
      // A breakout confirmed by volume is a materially stronger signal than price
      // alone clearing resistance — weighted up per the user's explicit priority.
      const volConfirmed = input.technical?.volumeBias === 'high';
      bullish.push({
        label: volConfirmed
          ? 'Breakout above resistance confirmed by volume'
          : 'Price above resistance (breakout)',
        weight: volConfirmed ? 0.85 : 0.55,
        polarity: 'bull',
      });
    } else {
      resistanceBreakProbability = clamp(40 + (1 - Math.min(distToR1, 0.1) / 0.1) * 20, 30, 65);
    }
  }

  const supportFailureProbability = 100 - Math.round(supportHoldProbability);
  const resistanceRejectionProbability = 100 - Math.round(resistanceBreakProbability);

  // --- USER-PRIORITIZED SIGNALS ---
  // Price rising with confirming volume, a volume-confirmed breakout, strong
  // (80+) accumulation, and an uptrend pullback into support are treated as the
  // primary drivers of a BUY/STRONG BUY call — weighted heavily here, and able to
  // override a lukewarm fundamentals/sentiment read via the escalation in
  // decideRecommendation() (these never override a genuine, gated SELL).
  const priceAboveResistanceNow = px > 0 && r1 != null && Number.isFinite(r1) && px > r1;
  const volumeHigh = input.technical?.volumeBias === 'high';
  const priceRisingConfirmed =
    trend.includes('BULL') ||
    input.technical?.emaBias === 'bull' ||
    (input.momentumScore != null && input.momentumScore >= 60);

  const priceVolumeSurge = volumeHigh && priceRisingConfirmed && input.technical?.macdBullish !== false;
  const breakoutWithVolume = priceAboveResistanceNow && volumeHigh;
  // A single 80+ flow reading isn't "strong accumulation" if the OTHER two flow
  // measures are both actively bearish (<40) — that's whale/institutional flow
  // disagreeing with itself, not conviction. Require at least one of the other
  // two measures to not be bearish before the 80+ reading counts.
  const isFlowBearish = (v: number | null | undefined) => v != null && v < 40;
  const whaleHigh = input.whaleScore != null && input.whaleScore >= 80;
  const instHigh = input.institutionalScore != null && input.institutionalScore >= 80;
  const smartHigh = input.smartMoneyScore != null && input.smartMoneyScore >= 80;
  const strongAccumulation =
    (whaleHigh && (!isFlowBearish(input.institutionalScore) || !isFlowBearish(input.smartMoneyScore))) ||
    (instHigh && (!isFlowBearish(input.whaleScore) || !isFlowBearish(input.smartMoneyScore))) ||
    (smartHigh && (!isFlowBearish(input.whaleScore) || !isFlowBearish(input.institutionalScore)));
  const pullbackToSupportInUptrend =
    trend.includes('BULL') &&
    px > 0 &&
    s1 != null &&
    Number.isFinite(s1) &&
    px >= s1 * 0.995 &&
    (px - s1) / px <= 0.03;

  if (priceVolumeSurge) {
    bullish.push({
      label: 'Price rising with confirming volume — high-conviction buy signal',
      weight: 0.65,
      polarity: 'bull',
    });
  }
  if (strongAccumulation) {
    bullish.push({
      label: 'Accumulation conviction very high (80+)',
      weight: 0.35,
      polarity: 'bull',
    });
  }
  if (pullbackToSupportInUptrend) {
    bullish.push({
      label: 'Uptrend pullback to support — classic high-quality entry',
      weight: 0.35,
      polarity: 'bull',
    });
  }

  if (vol > 35) {
    risk = clamp(70 + (vol - 35), 70, 92);
    bearish.push({ label: 'Elevated volatility / market risk', weight: 0.35, polarity: 'bear' });
  } else if (vol < 15) {
    risk = clamp(30, 20, 40);
    neutral.push({ label: 'Volatility contained', weight: 0.2, polarity: 'neutral' });
  } else {
    risk = clamp(45 + vol * 0.4, 35, 65);
  }

  const bullWeight = bullish.reduce((a, f) => a + f.weight, 0);
  const bearWeight = bearish.reduce((a, f) => a + f.weight, 0);
  const total = bullWeight + bearWeight || 1;
  const netWeight = clamp((bullWeight - bearWeight) / total, -1, 1);

  // --- STEP 2: AI Committee ---
  const techReason =
    bullish.find((f) => /RSI|MACD|Uptrend|EMA|SMA|Bollinger|ADX|OBV|Trend/i.test(f.label))?.label ||
    bearish.find((f) => /RSI|MACD|Downtrend|EMA|SMA|Bollinger|ADX|OBV/i.test(f.label))?.label ||
    'Mixed technical tape';
  const fundReason =
    bullish.find((f) => /fundamental/i.test(f.label))?.label ||
    bearish.find((f) => /fundamental/i.test(f.label))?.label ||
    'Composite fundamental posture';
  const whaleReason =
    bullish.find((f) => /Whale|Institutional|Smart money|Fund/i.test(f.label))?.label ||
    bearish.find((f) => /Whale|Institutional|Smart money|Fund/i.test(f.label))?.label ||
    'Neutral money-flow posture';
  const momReason =
    bullish.find((f) => /momentum|MACD/i.test(f.label))?.label ||
    bearish.find((f) => /momentum|MACD/i.test(f.label))?.label ||
    'Momentum neither extreme';
  const sentReason =
    bullish.find((f) => /news|sentiment|Sector/i.test(f.label))?.label ||
    bearish.find((f) => /news|sentiment|Sector/i.test(f.label))?.label ||
    'Sentiment balanced';

  const weights = getCommitteeWeights(input.marketRegime);

  const committee: CommitteeMember[] = [
    {
      seat: 'Technical',
      score: Math.round(technical),
      recommendation: recFromScore(technical),
      confidence: Math.round(clamp(55 + Math.abs(technical - 50) * 0.7, 45, 92)),
      reason: techReason,
      weight: weights.Technical,
    },
    {
      seat: 'Fundamental',
      score: Math.round(fundamental),
      recommendation: recFromScore(fundamental),
      confidence: Math.round(clamp(55 + Math.abs(fundamental - 50) * 0.7, 45, 92)),
      reason: fundReason,
      weight: weights.Fundamental,
    },
    {
      seat: 'Whale',
      score: Math.round(whale),
      recommendation: recFromScore(whale),
      confidence: Math.round(clamp(55 + Math.abs(whale - 50) * 0.7, 45, 92)),
      reason: whaleReason,
      weight: weights.Whale,
    },
    {
      seat: 'Risk',
      score: Math.round(risk),
      recommendation: recFromRiskScore(risk),
      confidence: Math.round(clamp(58 + Math.abs(risk - 50) * 0.65, 45, 92)),
      reason:
        risk >= 68
          ? 'Elevated risk warrants defensive sizing'
          : risk <= 35
            ? 'Risk contained — room for constructive stance'
            : 'Risk moderate — require confirmation',
      weight: weights.Risk,
    },
    {
      seat: 'Momentum',
      score: Math.round(momentum),
      recommendation: recFromScore(momentum),
      confidence: Math.round(clamp(55 + Math.abs(momentum - 50) * 0.7, 45, 92)),
      reason: momReason,
      weight: weights.Momentum,
    },
    {
      seat: 'Sentiment',
      score: Math.round(news),
      recommendation: recFromScore(news),
      confidence: Math.round(clamp(52 + Math.abs(news - 50) * 0.7, 45, 90)),
      reason: sentReason,
      weight: weights.Sentiment,
    },
  ];

  // STEP 3 — weighted overall (Risk inverted into quality score for blend)
  const overall = Math.round(
    clamp(
      technical * weights.Technical +
        fundamental * weights.Fundamental +
        whale * weights.Whale +
        (100 - risk) * weights.Risk +
        momentum * weights.Momentum +
        news * weights.Sentiment,
      1,
      99
    )
  );

  const bullishScore = Math.round(clamp((bullWeight / total) * 100, 0, 100));
  const bearishScore = Math.round(clamp((bearWeight / total) * 100, 0, 100));

  // STEP 8 — BUY / SELL gates
  // SELL is structure-first: never fire on whale / institutional / MACD softening alone.
  const supportBroken = px > 0 && s1 != null && Number.isFinite(s1) && px < s1 * 0.998;
  const supportHolding = px > 0 && !supportBroken && (s1 == null || px >= s1);
  const nearSupport =
    px > 0 && s1 != null && Number.isFinite(s1) && px >= s1 && (px - s1) / px <= 0.012;
  const nearResistance =
    px > 0 && r1 != null && Number.isFinite(r1) && r1 >= px && (r1 - px) / px <= 0.025;
  const trendReversed = trend.includes('BEAR') || trend.includes('DOWNTREND');
  const structureIntact =
    supportHolding && !trendReversed && (input.technical?.emaBias !== 'bear' || trend.includes('BULL'));
  const instWeak = input.institutionalScore != null && input.institutionalScore < 42;
  const whaleWeak =
    (input.whaleScore != null && input.whaleScore < 42) ||
    (input.smartMoneyScore != null && input.smartMoneyScore < 42);
  const flowWeakening = instWeak || whaleWeak || input.fundFlowBias === 'outflow';
  const flowSelling = instWeak && whaleWeak;
  const momCollapsed =
    (input.momentumScore != null && input.momentumScore < 35) || input.technical?.macdBullish === false;
  const rsiWeak = rsi != null && Number.isFinite(rsi) && rsi < 40;
  const volumeSelling =
    input.technical?.volumeBias === 'high' &&
    (input.technical?.obvBias === 'bear' || input.fundFlowBias === 'outflow' || momCollapsed);

  const bearFlags = [
    supportBroken,
    volumeSelling,
    momCollapsed,
    rsiWeak,
    flowSelling,
    trendReversed,
  ];
  const bearConfirmCount = bearFlags.filter(Boolean).length;

  const buyGateFails: string[] = [];
  if (supportHoldProbability < 45 && !(input.institutionalScore != null && input.institutionalScore >= 65)) {
    buyGateFails.push('Support hold probability too low');
  }
  const hasAccum =
    (input.whaleScore != null && input.whaleScore >= 55) ||
    (input.institutionalScore != null && input.institutionalScore >= 55) ||
    (input.smartMoneyScore != null && input.smartMoneyScore >= 60);
  if (!hasAccum && netWeight < 0.35) {
    buyGateFails.push('No clear whale/institutional accumulation');
  }
  if (netWeight < 0.08) buyGateFails.push('Bullish evidence not stronger than bearish');
  if (!trend.includes('BULL') && !trend.includes('BEAR') && netWeight < 0.25 && technical < 60) {
    buyGateFails.push('Trend not acceptable for aggressive BUY');
  }
  if (nearResistance && !hasAccum && (input.technical?.macdBullish === false || rsiWeak)) {
    buyGateFails.push('Weak momentum into resistance — do not chase');
  }
  const buyGatePass = buyGateFails.length === 0 && netWeight > 0.12;

  const sellGateFails: string[] = [];
  if (!supportBroken) {
    sellGateFails.push('Price still holding above key support — weakening flow is not a SELL');
  }
  const extraConfirms = bearConfirmCount - (supportBroken ? 1 : 0);
  if (supportBroken && extraConfirms < 2) {
    sellGateFails.push('Support break needs 2–3 independent confirmations (volume, momentum, RSI, or flow)');
  }
  if (!supportBroken && extraConfirms < 3) {
    sellGateFails.push('Need a confirmed close below support plus multiple bearish confirmations');
  }
  if (netWeight > -0.18) sellGateFails.push('Bearish evidence not dominant versus structure');
  if (structureIntact && nearResistance && !supportBroken) {
    sellGateFails.push('Approaching resistance is not an automatic SELL');
  }
  const sellGatePass = sellGateFails.length === 0 && supportBroken && extraConfirms >= 2 && netWeight < -0.18;

  return {
    bullish,
    bearish,
    neutral,
    netWeight,
    bullWeight,
    bearWeight,
    scores: {
      technical: Math.round(technical),
      fundamental: Math.round(fundamental),
      whale: Math.round(whale),
      news: Math.round(news),
      risk: Math.round(risk),
      momentum: Math.round(momentum),
      overall,
    },
    supportHoldProbability: Math.round(supportHoldProbability),
    supportFailureProbability,
    resistanceBreakProbability: Math.round(resistanceBreakProbability),
    resistanceRejectionProbability,
    explainedSignals,
    buyGatePass,
    sellGatePass,
    buyGateFails,
    sellGateFails,
    committee,
    bullishScore,
    bearishScore,
    supportHolding,
    supportBroken,
    bearConfirmCount,
    structureIntact,
    flowWeakening,
    nearSupport,
    nearResistance,
    volumeSelling,
    supportLevel: s1 != null && Number.isFinite(s1) ? s1 : null,
    resistanceLevel: r1 != null && Number.isFinite(r1) ? r1 : null,
    majorResistance: r2 != null && Number.isFinite(r2) ? r2 : null,
    priceVolumeSurge,
    breakoutWithVolume,
    strongAccumulation,
    pullbackToSupportInUptrend,
  };
}

function fairTargetPrice(input: QuantumEngineInput, netWeight: number): number {
  const px = input.currentPrice;
  const days = HORIZON_DAYS[input.horizon];
  const api = mapApiRow(input.forecastHorizons, input.horizon);
  const candidates: number[] = [];

  if (api.price != null && api.price > 0) candidates.push(api.price);
  if (api.ret != null) candidates.push(px * (1 + api.ret / 100));

  // baseTarget/baseReturn are derived from a long-biased risk/reward helper (always priced
  // above current price) — they only represent a plausible "expected case" when evidence
  // isn't dominantly bearish. Skip them once netWeight is clearly negative so they don't
  // drag the blended target upward for stocks the evidence says are bearish.
  const baseCaseIsBullBiased = netWeight < -0.15;
  if (!baseCaseIsBullBiased && input.baseTarget != null && Number.isFinite(input.baseTarget)) {
    const monthMove = (input.baseTarget - px) / px;
    const scale = days / 21;
    candidates.push(
      px * (1 + monthMove * Math.sqrt(scale) * (scale >= 1 ? 0.85 + (0.15 * Math.min(scale, 4)) / 4 : scale))
    );
  }
  if (input.bullTarget != null && netWeight > 0.15) {
    const mix = input.horizon === '1W' ? 0.25 : input.horizon === '1M' ? 0.45 : input.horizon === '3M' ? 0.65 : 0.8;
    candidates.push(px + (input.bullTarget - px) * mix);
  }
  if (input.bearTarget != null && netWeight < -0.15) {
    const mix = input.horizon === '1W' ? 0.3 : input.horizon === '1M' ? 0.5 : input.horizon === '3M' ? 0.7 : 0.85;
    candidates.push(px + (input.bearTarget - px) * mix);
  }
  if (!baseCaseIsBullBiased && input.baseReturn != null) {
    const scale = days / 21;
    candidates.push(px * (1 + (input.baseReturn / 100) * Math.sqrt(Math.max(0.25, scale))));
  }

  const vol = input.technical?.volatility ?? 22;
  const drift = netWeight * (vol / 100) * Math.sqrt(days / 252) * 1.8;
  candidates.push(px * (1 + drift));

  const avg = candidates.reduce((a, b) => a + b, 0) / candidates.length;
  const blended = avg * 0.75 + px * (1 + drift) * 0.25;
  const maxAbs =
    input.horizon === '1W' ? 0.12 : input.horizon === '1M' ? 0.28 : input.horizon === '3M' ? 0.55 : 1.1;
  const move = clamp((blended - px) / px, -maxAbs, maxAbs);
  return round2(px * (1 + move));
}

function atrAbsolute(
  px: number,
  atrPct: number | null | undefined,
  vol: number | null | undefined
): number {
  if (atrPct != null && Number.isFinite(atrPct) && atrPct > 0) {
    return Math.max(px * 0.004, (atrPct / 100) * px);
  }
  // Annualized vol → approximate daily ATR as % of price
  const v = vol != null && Number.isFinite(vol) && vol > 0 ? vol : 22;
  return Math.max(px * 0.004, px * (v / 100) / Math.sqrt(252));
}

function buyWidthBounds(horizon: HorizonKey): { minPct: number; maxPct: number; atrMult: number } {
  switch (horizon) {
    case '1W':
      return { minPct: 0.03, maxPct: 0.05, atrMult: 1.15 };
    case '1M':
      return { minPct: 0.03, maxPct: 0.08, atrMult: 1.55 };
    case '3M':
      return { minPct: 0.04, maxPct: 0.08, atrMult: 1.85 };
    case '1Y':
    default:
      return { minPct: 0.05, maxPct: 0.08, atrMult: 2.1 };
  }
}

type ZoneBuildOpts = {
  px: number;
  target: number;
  rec: RecommendationLabel;
  levels: QuantumEngineInput['levels'];
  stopHint?: number | null;
  vol?: number | null;
  horizon?: HorizonKey;
  atrPct?: number | null;
  institutionalScore?: number | null;
  whaleScore?: number | null;
  smartMoneyScore?: number | null;
  trend?: string | null;
  emaBias?: 'bull' | 'bear' | 'neutral' | null;
  bollingerBias?: 'oversold' | 'overbought' | 'mid' | null;
};

/**
 * Trade Management Zones — Buy Zone is the optimal accumulation pocket
 * (support + ATR + structure), typically 3–8% wide for 1M.
 * NOT a broad band from stop-loss up to spot.
 */
function buildZones(opts: ZoneBuildOpts) {
  const {
    px,
    target,
    rec,
    levels,
    stopHint,
    vol,
    horizon = '1M',
    atrPct,
    institutionalScore,
    whaleScore,
    smartMoneyScore,
    trend,
    emaBias,
    bollingerBias,
  } = opts;

  /**
   * Strict non-overlapping ascending ladder:
   * STOP < BUY.max < ADD.min < ADD.max < WAIT/HOLD.min < … < TP < REDUCE < EXIT
   */
  const eps = Math.max(round2(px * 0.0008), 0.01);
  const atr = atrAbsolute(px, atrPct, vol);
  const { minPct, maxPct, atrMult } = buyWidthBounds(horizon);

  const s2Raw = levels?.s2 && Number.isFinite(levels.s2) ? Number(levels.s2) : null;
  const s1Raw = levels?.s1 && Number.isFinite(levels.s1) ? Number(levels.s1) : null;
  const r1 = levels?.r1 && Number.isFinite(levels.r1) ? Number(levels.r1) : px * 1.03;
  const r2 = levels?.r2 && Number.isFinite(levels.r2) ? Number(levels.r2) : px * 1.07;

  const s1 =
    s1Raw != null && s1Raw > px * 0.88 && s1Raw < px * 0.998 ? s1Raw : null;
  const s2 =
    s2Raw != null && s2Raw > px * 0.8 && s2Raw < px * 0.98 ? s2Raw : null;

  const bullish = rec === 'STRONG BUY' || rec === 'BUY';
  const bearish = rec === 'SELL' || rec === 'AVOID NEW POSITION' || rec === 'REDUCE';

  // Accumulation bias from institutional / whale / smart money (0–100 → −0.5…+0.5)
  const flowScore = meanFinite([
    institutionalScore,
    whaleScore,
    smartMoneyScore,
  ]);
  const accumBias = clamp(((flowScore ?? 55) - 50) / 100, -0.45, 0.45);

  // --- Buy zone width: ATR-based, clamped to 3–8% (horizon-aware) ---
  let buyWidth = atr * atrMult;
  // Higher vol → slightly wider, but never beyond maxPct
  const volFactor = clamp((vol ?? 22) / 22, 0.85, 1.25);
  buyWidth *= volFactor;
  buyWidth = clamp(buyWidth, px * minPct, px * maxPct);

  // --- Structure anchor: recent support / pullback pocket (not the stop) ---
  // Strong inflow / oversold → shallower dip OK; weak flow → deeper support.
  const pullbackAtrs = clamp(1.05 - accumBias * 0.55, 0.55, 1.45);
  let structureAnchor = px - atr * pullbackAtrs;
  if (s1 != null) {
    // Blend chart support with ATR pullback — prefer s1 when it is a real nearby shelf
    structureAnchor = s1 * 0.72 + structureAnchor * 0.28;
  }
  if (bollingerBias === 'oversold') structureAnchor = Math.max(structureAnchor, px - atr * 0.7);
  if (bollingerBias === 'overbought') structureAnchor = Math.min(structureAnchor, px - atr * 1.15);
  if (emaBias === 'bull' && trend && /STRONG|UPTREND|BULL/i.test(String(trend))) {
    structureAnchor = Math.max(structureAnchor, px - atr * (0.85 - accumBias * 0.2));
  }
  // Keep anchor below spot — buy zone is accumulation, not chase
  structureAnchor = clamp(structureAnchor, px * 0.9, px - eps * 2);

  // Place narrow band around structure: mostly below spot, hi capped under last
  let buyHi = Math.min(structureAnchor + buyWidth * 0.4, px * 0.992, px - eps);
  let buyLo = buyHi - buyWidth;
  if (buyLo >= buyHi) {
    buyHi = round2(px * 0.99);
    buyLo = round2(buyHi - buyWidth);
  }
  // If still too close to spot on a deep selloff name, pin to support shelf
  if (s1 != null && buyHi < s1 * 0.97) {
    buyHi = Math.min(s1 + buyWidth * 0.35, px * 0.992);
    buyLo = buyHi - buyWidth;
  }
  buyLo = round2(Math.max(buyLo, px * 0.88));
  buyHi = round2(Math.max(buyHi, buyLo + px * minPct * 0.85));
  // Re-clamp width to max after repairs
  if (buyHi - buyLo > px * maxPct) {
    buyLo = round2(buyHi - px * maxPct);
  }
  if (buyHi - buyLo < px * minPct * 0.9) {
    buyLo = round2(buyHi - px * minPct);
  }

  // --- Stop: outside Buy Zone (structure failure / ATR), never inside ---
  const stopCushion = Math.max(eps, atr * 0.4, px * 0.008);
  let stop =
    stopHint != null && Number.isFinite(stopHint)
      ? Number(stopHint)
      : s2 != null
        ? Math.min(s2, buyLo - stopCushion)
        : buyLo - atr * 1.05;
  stop = Math.min(stop, buyLo - stopCushion);
  if (!(stop < buyLo)) stop = buyLo - stopCushion;
  // Floor: don't place absurd stops for 1M (beyond ~12% unless s2 demands)
  const stopFloor = px * (horizon === '1W' ? 0.94 : horizon === '1M' ? 0.9 : 0.86);
  if (stop < stopFloor && (s2 == null || s2 >= stopFloor)) {
    stop = Math.min(stopFloor, buyLo - stopCushion);
  }
  stop = round2(stop);

  // Ensure buy still above stop after stop floor adjustments
  if (!(stop < buyLo)) {
    buyLo = round2(stop + stopCushion);
    buyHi = round2(Math.max(buyHi, buyLo + px * minPct));
    if (buyHi - buyLo > px * maxPct) buyHi = round2(buyLo + px * maxPct);
    if (buyHi >= px) {
      buyHi = round2(px - eps);
      buyLo = round2(Math.min(buyLo, buyHi - px * minPct));
      stop = round2(Math.min(stop, buyLo - stopCushion));
    }
  }

  // Primary target for take-profit midpoint
  let tpAnchor = bullish
    ? Math.max(target, r1, px * 1.02)
    : bearish
      ? Math.min(Math.max(target, px * 0.99), r1)
      : Math.max(target, px * 1.015);
  if (!(tpAnchor > px)) tpAnchor = px * (bullish ? 1.04 : 1.02);

  // Step band for non-buy zones (smaller than old "band from stop")
  const step = Math.max(px * 0.008, atr * 0.65, (buyHi - buyLo) * 0.35);

  // ADD: thin scale-in shelf just above Buy — not a second wide buy band
  let addLo = round2(buyHi + eps);
  let addHi = round2(addLo + clamp(buyWidth * 0.4, px * 0.012, px * 0.028));
  if (addHi <= addLo) addHi = round2(addLo + step * 0.5);

  // WAIT / HOLD: clearly separated — begins above ADD (chase region / hold region)
  let holdLo = round2(addHi + eps);
  let holdHi = round2(
    Math.max(holdLo + step, Math.min(Math.max(r1, px * 1.008), tpAnchor * 0.97))
  );
  if (holdHi <= holdLo) holdHi = round2(holdLo + step);

  let tpLo = round2(holdHi + eps);
  let tpHi = round2(Math.max(tpLo + step, tpAnchor));
  if (tpHi <= tpLo) tpHi = round2(tpLo + step);

  let reduceLo = round2(tpHi + eps);
  let reduceHi = round2(Math.max(reduceLo + step * 0.6, Math.max(r2, tpHi * 1.015)));
  if (reduceHi <= reduceLo) reduceHi = round2(reduceLo + step * 0.6);

  let exitLo = round2(reduceHi + eps);
  let exitHi = round2(exitLo + step);

  // Soft repair pass if any inversion slipped through
  const steps = [
    { lo: buyLo, hi: buyHi },
    { lo: addLo, hi: addHi },
    { lo: holdLo, hi: holdHi },
    { lo: tpLo, hi: tpHi },
    { lo: reduceLo, hi: reduceHi },
    { lo: exitLo, hi: exitHi },
  ];
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].hi <= steps[i].lo) steps[i].hi = round2(steps[i].lo + step * 0.5);
    if (i > 0 && !(steps[i - 1].hi + eps <= steps[i].lo + 1e-9)) {
      steps[i].lo = round2(steps[i - 1].hi + eps);
      if (steps[i].hi <= steps[i].lo) steps[i].hi = round2(steps[i].lo + step * 0.5);
    }
  }
  [buyLo, buyHi] = [steps[0].lo, steps[0].hi];
  [addLo, addHi] = [steps[1].lo, steps[1].hi];
  [holdLo, holdHi] = [steps[2].lo, steps[2].hi];
  [tpLo, tpHi] = [steps[3].lo, steps[3].hi];
  [reduceLo, reduceHi] = [steps[4].lo, steps[4].hi];
  [exitLo, exitHi] = [steps[5].lo, steps[5].hi];
  stop = round2(Math.min(stop, buyLo - stopCushion));
  if (!(stop < buyLo)) stop = round2(buyLo - stopCushion);

  return {
    buyZone: { lo: round2(buyLo), hi: round2(buyHi) },
    addZone: { lo: round2(addLo), hi: round2(addHi) },
    holdZone: { lo: round2(holdLo), hi: round2(holdHi) },
    takeProfitZone: { lo: round2(tpLo), hi: round2(tpHi) },
    reduceZone: { lo: round2(reduceLo), hi: round2(reduceHi) },
    exitZone: { lo: round2(exitLo), hi: round2(exitHi) },
    stopLoss: round2(stop),
    takeProfit: round2(tpHi),
  };
}

function meanFinite(vals: Array<number | null | undefined>): number | null {
  const xs = vals.filter((v): v is number => v != null && Number.isFinite(v));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function zonesAreConsistent(z: ReturnType<typeof buildZones>): boolean {
  const ordered = [z.buyZone, z.addZone, z.holdZone, z.takeProfitZone, z.reduceZone, z.exitZone];
  for (const band of ordered) {
    if (!(band.lo < band.hi)) return false;
  }
  for (let i = 1; i < ordered.length; i++) {
    if (!(ordered[i - 1].hi < ordered[i].lo)) return false;
  }
  if (!(z.stopLoss < z.buyZone.lo)) return false;
  return true;
}

function inBand(px: number, band: EngineZoneBand): boolean {
  const lo = Math.min(band.lo, band.hi);
  const hi = Math.max(band.lo, band.hi);
  return px >= lo - 1e-9 && px <= hi + 1e-9;
}

/**
 * STEP 9–10: Exactly ONE primary action from price + position + priority hierarchy.
 * Buy Zones are future opportunities unless location + confirmation select BUY/ADD/RE-ENTRY.
 * Take-Profit for owners always beats a nearby overlapping Buy Zone.
 */
function resolveLiveAction(
  px: number,
  zones: ReturnType<typeof buildZones>,
  buyZones: BuyBand[],
  rec: RecommendationLabel,
  userHasPosition: boolean,
  confidence: number,
  targetPrice: number,
  expectedReturn: number,
  confirmationExtras?: {
    score?: number | null;
    rsi?: number | null;
    macdBullish?: boolean | null;
    trend?: string | null;
    institutionalScore?: number | null;
    whaleScore?: number | null;
    smartMoneyScore?: number | null;
    fundFlowBias?: 'inflow' | 'outflow' | 'neutral' | null;
    volumeBias?: 'high' | 'low' | 'normal' | null;
    bollingerBias?: 'oversold' | 'overbought' | 'mid' | null;
    emaBias?: 'bull' | 'bear' | 'neutral' | null;
    newsBias?: 'bull' | 'bear' | 'neutral' | null;
    technicalScore?: number | null;
    fundamentalScore?: number | null;
    momentumScore?: number | null;
    resistanceNearby?: boolean | null;
    supportNearby?: boolean | null;
    dataQuality?: 'good' | 'stale' | 'missing' | 'unreliable' | null;
    supportHolding?: boolean | null;
    supportBroken?: boolean | null;
    supportLevel?: number | null;
    resistanceLevel?: number | null;
    majorResistance?: number | null;
  }
): { brief: LiveActionBrief; decision: PrimaryDecision; zones: ReturnType<typeof buildZones>; buyZones: BuyBand[] } {
  const conf = Math.round(clamp(confidence, 40, 94));
  const primary = sanitizePrimaryDecision(
    resolvePrimaryAction({
      currentPrice: px,
      userHasPosition,
      buyZones,
      takeProfitZone: zones.takeProfitZone,
      reduceZone: zones.reduceZone,
      exitZone: zones.exitZone,
      stopLoss: zones.stopLoss,
      targetPrice,
      expectedReturn,
      baseConfidence: conf,
      confirmation: {
        recommendation: rec,
        confidence: conf,
        score: confirmationExtras?.score,
        rsi: confirmationExtras?.rsi,
        macdBullish: confirmationExtras?.macdBullish,
        trend: confirmationExtras?.trend,
        userHasPosition,
        institutionalScore: confirmationExtras?.institutionalScore,
        whaleScore: confirmationExtras?.whaleScore,
        smartMoneyScore: confirmationExtras?.smartMoneyScore,
        fundFlowBias: confirmationExtras?.fundFlowBias,
        volumeBias: confirmationExtras?.volumeBias,
        bollingerBias: confirmationExtras?.bollingerBias,
        emaBias: confirmationExtras?.emaBias,
        newsBias: confirmationExtras?.newsBias,
        technicalScore: confirmationExtras?.technicalScore,
        fundamentalScore: confirmationExtras?.fundamentalScore,
        momentumScore: confirmationExtras?.momentumScore,
        resistanceNearby: confirmationExtras?.resistanceNearby,
        supportNearby: confirmationExtras?.supportNearby,
        dataQuality: confirmationExtras?.dataQuality,
        supportHolding: confirmationExtras?.supportHolding,
        supportBroken: confirmationExtras?.supportBroken,
        supportLevel: confirmationExtras?.supportLevel,
        resistanceLevel: confirmationExtras?.resistanceLevel,
        majorResistance: confirmationExtras?.majorResistance,
      },
    })
  );

  // Sync engine bands with reconciled SSOT (no overlapping BUY↔TP)
  const syncedZones = {
    ...zones,
    buyZone: primary.buyZones[0]
      ? { lo: primary.buyZones[0].lo, hi: primary.buyZones[0].hi }
      : zones.buyZone,
    takeProfitZone: primary.takeProfitZone,
    takeProfit: primary.takeProfitZone.hi,
    stopLoss: primary.stopLoss,
  };
  // Keep hold between buy envelope and TP
  const envelopeHi = primary.buyZones.length
    ? Math.max(...primary.buyZones.map((z) => Math.max(z.lo, z.hi)))
    : syncedZones.buyZone.hi;
  const eps = Math.max(px * 0.0008, 0.01);
  // holdLo must also leave room for a non-degenerate addZone right below it
  // (addZone.lo = buyZone.hi + eps) — previously this only considered
  // envelopeHi, so whenever envelopeHi === buyZone.hi (the common single-
  // buy-zone case) holdLo landed exactly at addZone.lo with zero room between
  // them. The addZone fallback below then built a hi past that point,
  // guaranteeing addZone.hi > holdZone.lo — an overlap that zonesAreConsistent
  // correctly flagged, showing "Recalculate" on effectively every real ticker.
  const minAddZoneWidth = eps;
  const holdLo = Math.max(envelopeHi + eps, syncedZones.buyZone.hi + eps + minAddZoneWidth + eps);
  const tpLo = Math.min(primary.takeProfitZone.lo, primary.takeProfitZone.hi);
  // tpLo is a hard ceiling, not one option in a max() with the preferred width —
  // the previous Math.max(minWidth, Math.min(ceiling, preferredWidth)) could
  // pick minWidth even when it exceeded the ceiling (whenever tpLo sat close
  // to holdLo, common when the buy envelope and take-profit zone are both
  // anchored near a tight recent range), letting holdZone reach into
  // takeProfitZone. Only fall back past the ceiling when respecting it would
  // make the zone degenerate (lo >= hi) — and even then, push takeProfitZone
  // up afterward so the two never actually overlap.
  const cappedHoldHi = Math.min(tpLo - eps, holdLo + px * 0.04);
  syncedZones.holdZone = {
    lo: round2(holdLo),
    hi: round2(cappedHoldHi > holdLo ? cappedHoldHi : holdLo + px * 0.008),
  };
  if (!(syncedZones.holdZone.lo < syncedZones.holdZone.hi)) {
    syncedZones.holdZone = { lo: round2(holdLo), hi: round2(holdLo + px * 0.008) };
  }
  if (syncedZones.takeProfitZone.lo <= syncedZones.holdZone.hi) {
    const shift = round2(syncedZones.holdZone.hi + eps - syncedZones.takeProfitZone.lo);
    syncedZones.takeProfitZone = {
      lo: round2(syncedZones.takeProfitZone.lo + shift),
      hi: round2(syncedZones.takeProfitZone.hi + shift),
    };
    syncedZones.takeProfit = syncedZones.takeProfitZone.hi;
  }
  syncedZones.addZone = {
    lo: syncedZones.buyZone.hi + eps,
    hi: round2(Math.min(syncedZones.holdZone.lo - eps, syncedZones.buyZone.hi + eps + px * 0.012)),
  };
  if (!(syncedZones.addZone.lo < syncedZones.addZone.hi)) {
    syncedZones.addZone = {
      lo: round2(syncedZones.buyZone.hi + eps),
      hi: round2(Math.min(syncedZones.holdZone.lo - eps, syncedZones.buyZone.hi + eps * 2)),
    };
  }
  // Keep reduce/exit above TP — anchor to the (possibly shifted) synced zone,
  // not the original primary.takeProfitZone, or reduceZone could start below
  // a takeProfitZone that was just pushed up to clear holdZone.
  const tpHi = Math.max(syncedZones.takeProfitZone.lo, syncedZones.takeProfitZone.hi);
  syncedZones.reduceZone = {
    lo: round2(tpHi + eps),
    hi: round2(tpHi + eps + px * 0.012),
  };
  syncedZones.exitZone = {
    lo: round2(syncedZones.reduceZone.hi + eps),
    hi: round2(syncedZones.reduceZone.hi + eps + px * 0.012),
  };

  const mapped = toZoneAction(primary.action) as ZoneAction;
  const brief: LiveActionBrief = {
    action: mapped,
    reason: primary.reason,
    confidence: primary.confidence,
    zoneKey: primary.zoneKey,
    displayLabel: primary.displayLabel,
    why: primary.why,
    nextOpportunity: primary.nextOpportunity,
    conflictingFactors: primary.conflictingFactors,
    whatToWatch: primary.whatToWatch,
    confidenceBand: primary.confidenceBand,
    futureReEntryZone: primary.reEntryZone,
    futureTakeProfitZone: primary.takeProfitZone,
    priceLocation: primary.priceLocation,
    confirmationStatus: primary.confirmationStatus,
    activeBuyZoneLevel: primary.activeBuyZoneLevel,
    validated: primary.validated,
  };

  return { brief, decision: primary, zones: syncedZones, buyZones: primary.buyZones };
}

function buildBuyZones123(
  px: number,
  buyZone: EngineZoneBand,
  technicalBreakdown?: TechnicalBreakdown | null,
  targetHint?: number | null
): BuyBand[] {
  if (technicalBreakdown && px > 0) {
    try {
      const entry = buildRealisticSuggestEntry({
        technical: technicalBreakdown,
        price: px,
        targetHint: targetHint ?? null,
      });
      if (entry?.buyZones?.length >= 3) {
        return entry.buyZones.map((z) => ({
          level: z.level,
          label: z.label,
          lo: z.lo,
          hi: z.hi,
          sizePct: z.sizePct,
          anchor: z.anchor,
        }));
      }
    } catch {
      /* fall through */
    }
  }
  return splitBuyEnvelope(buyZone, px);
}

function visibleZonesFor(userHasPosition: boolean): QuantumEngineOutput['visibleZoneKeys'] {
  // Hard rule: BUY ZONE and ADD POSITION must never both be active/visible
  if (userHasPosition) {
    return ['add', 'hold', 'takeProfit', 'reduce', 'exit', 'stop'];
  }
  // Flat: Buy Zones (future entry) + hold/wait band + stop. TP shown as FUTURE via action.nextOpportunity / panel metadata — not as a current action card competing with BUY.
  return ['buy', 'hold', 'stop'];
}

/** Rewrite signal labels so position state cannot contradict zone visibility */
function positionAwareSignals(
  signals: ExplainedSignal[],
  userHasPosition: boolean
): ExplainedSignal[] {
  return signals
    .map((sig) => {
      if (!userHasPosition) {
        if (sig.signalClass === 'ADD POSITION' || /ADD POSITION/i.test(sig.title)) {
          return {
            ...sig,
            title: sig.title.replace(/ADD POSITION/gi, 'BUY SIGNAL'),
            signalClass: 'BUY SIGNAL' as SignalClass,
            suggestedAction: 'Buy / open new position if thesis holds',
          };
        }
        if (
          sig.signalClass === 'TAKE PARTIAL PROFIT' ||
          sig.signalClass === 'REDUCE POSITION' ||
          sig.signalClass === 'EXIT POSITION'
        ) {
          return {
            ...sig,
            title: `WAIT / AVOID · ${sig.title.replace(/^(TAKE PARTIAL PROFIT|REDUCE POSITION|EXIT POSITION)[·\s]*/i, '')}`,
            signalClass: 'HOLD' as SignalClass,
            suggestedAction: 'Do not open — wait or avoid new position',
          };
        }
      } else {
        if (sig.signalClass === 'BUY SIGNAL' || /^BUY SIGNAL/i.test(sig.title)) {
          return {
            ...sig,
            title: sig.title.replace(/BUY SIGNAL/gi, 'ADD POSITION'),
            signalClass: 'ADD POSITION' as SignalClass,
            suggestedAction: 'Add to existing position gradually',
          };
        }
      }
      return sig;
    })
    .filter((sig) => {
      if (!userHasPosition) {
        return !['TAKE PARTIAL PROFIT', 'REDUCE POSITION', 'EXIT POSITION', 'ADD POSITION'].includes(
          sig.signalClass
        );
      }
      return sig.signalClass !== 'BUY SIGNAL';
    });
}

function positionAwareSuggestedAction(
  rec: RecommendationLabel,
  live: LiveActionBrief,
  userHasPosition: boolean,
  evidence: EvidenceBag
): SuggestedAction {
  if (!userHasPosition) {
    if (live.action === 'BUY' || live.action === 'RE-ENTRY') return 'Buy';
    return 'Hold';
  }
  if (live.action === 'ADD POSITION') return 'Accumulate';
  if (
    live.action === 'HOLD' ||
    live.action === 'WAIT' ||
    live.action === 'REASSESS' ||
    live.action === 'INDECISION'
  )
    return 'Hold';
  if (live.action === 'TAKE PROFIT' || live.action === 'PARTIAL TAKE PROFIT' || live.action === 'REDUCE') {
    return 'Take Partial Profit';
  }
  if (live.action === 'STOP LOSS' || live.action === 'EXIT') return 'Exit';
  if (live.action === 'AVOID NEW POSITION') return 'Hold';

  if (rec === 'STRONG BUY' || rec === 'BUY') return 'Accumulate';
  if (rec === 'HOLD') return 'Hold';
  if (rec === 'REDUCE') return 'Take Partial Profit';
  if (rec === 'SELL' && evidence.sellGatePass && evidence.supportBroken) return 'Exit';
  if (rec === 'SELL') return 'Reduce';
  return evidence.supportBroken ? 'Exit' : 'Hold';
}

function fmtLevel(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return n.toFixed(2);
}

function convictionTag(confidence: number): string {
  if (confidence < 50) return ' — VERY LOW CONVICTION';
  if (confidence < 65) return ' — LOW CONVICTION';
  return '';
}

function convictionBand(confidence: number): NonNullable<LiveActionBrief['confidenceBand']> {
  if (confidence >= 80) return 'High';
  if (confidence >= 65) return 'Moderate';
  if (confidence >= 50) return 'Low';
  return 'Very Low';
}

/**
 * One primary headline. Holders vs no-position never share contradictory labels.
 */
function positionAwareHeadline(
  rec: RecommendationLabel,
  live: LiveActionBrief,
  userHasPosition: boolean,
  confidence: number,
  evidence: EvidenceBag
): { headline: string; action: ZoneAction } {
  const tag = convictionTag(confidence);

  if (userHasPosition) {
    if (
      live.action === 'STOP LOSS' ||
      live.action === 'EXIT' ||
      (evidence.sellGatePass && evidence.supportBroken)
    ) {
      const strong = evidence.bearConfirmCount >= 4 || rec === 'AVOID NEW POSITION';
      return {
        headline: strong ? 'STRONG SELL' : 'SELL',
        action: live.action === 'STOP LOSS' ? 'STOP LOSS' : 'EXIT',
      };
    }
    if (
      rec === 'REDUCE' ||
      live.action === 'REDUCE' ||
      ((live.action === 'TAKE PROFIT' || live.action === 'PARTIAL TAKE PROFIT') && rec !== 'HOLD')
    ) {
      return { headline: `REDUCE PARTIAL${tag}`, action: 'REDUCE' };
    }
    return { headline: `HOLD${tag}`, action: 'HOLD' };
  }

  if ((rec === 'BUY' || rec === 'STRONG BUY') && evidence.buyGatePass && (live.action === 'BUY' || live.action === 'RE-ENTRY')) {
    return { headline: 'BUY', action: live.action };
  }
  if (evidence.supportBroken && evidence.sellGatePass) {
    return { headline: 'NO NEW POSITION', action: 'AVOID NEW POSITION' };
  }
  if (evidence.nearSupport && evidence.structureIntact && !evidence.supportBroken) {
    return { headline: `BUY WATCH${tag}`, action: 'WAIT' };
  }
  if (rec === 'AVOID NEW POSITION' || rec === 'SELL') {
    return { headline: 'NO NEW POSITION', action: 'AVOID NEW POSITION' };
  }
  return { headline: 'WAIT — NO NEW POSITION', action: 'WAIT' };
}

function structureTriggers(evidence: EvidenceBag): { bear: string; bull: string } {
  const s = fmtLevel(evidence.supportLevel);
  const r = fmtLevel(evidence.resistanceLevel);
  const r2 = fmtLevel(evidence.majorResistance);
  return {
    bear: s
      ? `Bearish trigger: confirmed close below ${s} with volume.`
      : 'Bearish trigger: confirmed close below key support with rising selling volume.',
    bull: r
      ? `Bullish trigger: reclaim ${r}${r2 ? `, followed by confirmation above ${r2}` : ' with volume'}.`
      : 'Bullish trigger: confirmed breakout above resistance with volume.',
  };
}

function buildTargets(px: number, primary: number, rec: RecommendationLabel, levels: QuantumEngineInput['levels']) {
  const r1 = levels?.r1 && Number.isFinite(levels.r1) ? levels.r1 : px * 1.03;
  const r2 = levels?.r2 && Number.isFinite(levels.r2) ? levels.r2 : px * 1.06;
  const bullish = rec === 'STRONG BUY' || rec === 'BUY';
  const bearish = rec === 'SELL' || rec === 'AVOID NEW POSITION' || rec === 'REDUCE';

  if (bullish) {
    const t1 = round2(Math.min(primary, Math.max(px * 1.02, (px + primary) / 2)));
    const t2 = round2(Math.max(primary, r1));
    const t3 = round2(Math.max(t2 * 1.03, r2, primary * 1.04));
    return { target1: t1, target2: t2, target3: t3 };
  }
  if (bearish) {
    const t1 = round2(Math.max(primary, Math.min(px * 0.98, (px + primary) / 2)));
    const t2 = round2(Math.min(primary, px * 0.95));
    const t3 = round2(Math.min(t2 * 0.97, primary * 0.96));
    return { target1: t1, target2: t2, target3: t3 };
  }
  return {
    target1: round2(px * 1.015),
    target2: round2(Math.max(r1, px * 1.03)),
    target3: round2(Math.max(r2, px * 1.05)),
  };
}

function buildWhyWins(rec: RecommendationLabel, evidence: EvidenceBag): string {
  const topBull = [...evidence.bullish].sort((a, b) => b.weight - a.weight).slice(0, 4);
  const topBear = [...evidence.bearish].sort((a, b) => b.weight - a.weight).slice(0, 3);
  const { bear, bull } = structureTriggers(evidence);
  const s = fmtLevel(evidence.supportLevel);
  if (rec === 'STRONG BUY' || rec === 'BUY') {
    const winners = topBull.map((f) => f.label).join(', ');
    const outweighed = topBear.length ? topBear.map((f) => f.label).join(', ') : 'no dominant bearish blockers';
    return `Although opposing signals existed (${outweighed}), price structure plus ${winners || 'bullish evidence'} cleared the BUY gate (support-hold ${evidence.supportHoldProbability}%). ${bear}`;
  }
  if (rec === 'SELL' || rec === 'AVOID NEW POSITION') {
    const winners = topBear.map((f) => f.label).join(', ');
    return `SELL is justified because support broke with independent confirmation (${winners || 'volume / momentum / flow'}). ${bull}`;
  }
  if (rec === 'REDUCE') {
    const winners = topBear.map((f) => f.label).join(', ');
    return `Price is still holding${s ? ` above ${s}` : ' above key support'} so this is not a SELL. Weakening ${winners || 'institutional / smart-money flow'} supports REDUCE PARTIAL. ${bear} ${bull}`;
  }
  return `Price structure remains intact${s ? ` above ${s}` : ''} and neither the BUY nor SELL gate cleared. Mixed indicators are decision support — HOLD / WAIT, not a forced trade. ${bear} ${bull}`;
}

function buildRejectedOpposite(rec: RecommendationLabel, evidence: EvidenceBag): string {
  const { bear, bull } = structureTriggers(evidence);
  if (rec === 'STRONG BUY' || rec === 'BUY') {
    const rejected = evidence.bearish.slice(0, 5).map((f) => `• ${f.label}`);
    if (!rejected.length) return `No material opposite (bearish) signals required rejection. ${bear}`;
    return `Although bearish signals existed:\n${rejected.join('\n')}\nConsensus did not issue SELL because price still holds support and SELL confirmation (close + volume + 2–3 independent signals) was not met. ${bear}`;
  }
  if (rec === 'SELL' || rec === 'AVOID NEW POSITION') {
    const rejected = evidence.bullish.slice(0, 5).map((f) => `• ${f.label}`);
    if (!rejected.length) return `No material opposite (bullish) signals required rejection. ${bull}`;
    return `Although bullish signals existed:\n${rejected.join('\n')}\nConsensus issued SELL because support broke with confirmation. ${bull}`;
  }
  if (rec === 'REDUCE') {
    return `SELL was rejected because price has not confirmed a close below support with volume. Weakening flow alone is not a full exit. ${bear} ${bull}`;
  }
  return `Neither side cleared a decisive BUY or SELL gate — HOLD / WAIT avoids manufacturing a trade from mixed evidence. ${bear} ${bull}`;
}

function invalidationFor(
  rec: RecommendationLabel,
  px: number,
  zones: ReturnType<typeof buildZones>,
  evidence: EvidenceBag
): string {
  const { bear, bull } = structureTriggers(evidence);
  const s = fmtLevel(evidence.supportLevel) ?? zones.stopLoss.toFixed(2);
  if (rec === 'STRONG BUY' || rec === 'BUY') {
    return `${bear} Thesis invalid if daily close below ${s} (stop ${zones.stopLoss.toFixed(2)}).`;
  }
  if (rec === 'SELL' || rec === 'AVOID NEW POSITION') {
    return `${bull} Thesis invalid if price reclaims and holds the broken support with volume.`;
  }
  return `${bear} ${bull} Current thesis (price holding structure at ${px.toFixed(2)}) is invalid on a confirmed close below ${s} with volume, or a confirmed breakout above resistance with volume.`;
}

function nextReviewFor(horizonLabel: string, evidence: EvidenceBag): string {
  const { bear, bull } = structureTriggers(evidence);
  return `Reassess on a decisive S/R event, not on a single softening indicator. ${bear} ${bull} Horizon: ${horizonLabel}. Support-hold ${evidence.supportHoldProbability}% · Support-fail ${evidence.supportFailureProbability}% · Resist-break ${evidence.resistanceBreakProbability}% · Resist-reject ${evidence.resistanceRejectionProbability}%.`;
}

function consensusNote(committee: CommitteeMember[], rec: RecommendationLabel): string {
  const agree = committee.filter((c) => {
    const s = chartStanceFromRecommendation(c.recommendation);
    const t = chartStanceFromRecommendation(rec);
    if (t === 'neutral') return c.recommendation === 'HOLD' || c.recommendation === 'REDUCE';
    return s === t || (t === 'bull' && c.recommendation === 'HOLD' && c.score >= 55);
  }).length;
  const seatAbbrev: Partial<Record<CommitteeSeat, string>> = {
    Technical: 'Tech',
    Fundamental: 'Fund',
    Whale: 'Whale',
    Risk: 'Risk',
    Momentum: 'Mom',
    Sentiment: 'Sent',
  };
  const weightsText = committee
    .map((c) => `${seatAbbrev[c.seat] || c.seat} ${Math.round(c.weight * 100)}%`)
    .join(' · ');
  return `Consensus from AI Investment Committee (${agree}/${committee.length} aligned or non-blocking). Weights: ${weightsText}.`;
}

function validate(out: QuantumEngineOutput): boolean {
  const { currentPrice: px, targetPrice: tp, expectedReturn: er, ratingLabel: rec, buyZone, stopLoss, takeProfit } =
    out;
  const calcEr = ((tp - px) / px) * 100;
  if (Math.abs(calcEr - er) > 0.15) return false;
  if (tp > px && er <= 0) return false;
  if (tp < px && er >= 0) return false;
  if (er > 0 && (rec === 'SELL' || rec === 'AVOID NEW POSITION')) return false;
  if (er < 0 && (rec === 'BUY' || rec === 'STRONG BUY')) return false;
  if (er >= 3 && rec === 'HOLD') return false;
  if (er <= -3 && rec === 'HOLD') return false;
  if (buyZone.hi >= tp && (rec === 'STRONG BUY' || rec === 'BUY')) return false;
  if (!(stopLoss < buyZone.lo) && (rec === 'STRONG BUY' || rec === 'BUY' || rec === 'HOLD' || rec === 'REDUCE')) {
    return false;
  }
  if ((rec === 'STRONG BUY' || rec === 'BUY') && takeProfit < tp * 0.98) return false;
  if (out.finalVerdict !== rec) return false;
  if (out.chartStance !== chartStanceFromRecommendation(rec)) return false;
  if (!out.whyWins || !out.suggestedAction) return false;
  if (!out.committee?.length) return false;
  if (out.target1 <= 0 || out.entryZone.hi <= 0) return false;
  if (Math.abs(out.supportHoldProbability + out.supportFailureProbability - 100) > 1) return false;
  if (Math.abs(out.resistanceBreakProbability + out.resistanceRejectionProbability - 100) > 1) return false;
  if (!out.zonesConsistent) return false;
  if (!out.currentAction?.action) return false;
  if (!zonesAreConsistent({
    buyZone: out.buyZone,
    addZone: out.addZone,
    holdZone: out.holdZone,
    takeProfitZone: out.takeProfitZone,
    reduceZone: out.reduceZone,
    exitZone: out.exitZone,
    stopLoss: out.stopLoss,
    takeProfit: out.takeProfit,
  })) {
    return false;
  }
  // Position-aware: no contradictory action labels
  if (!out.userHasPosition) {
    if (
      ['ADD POSITION', 'TAKE PROFIT', 'PARTIAL TAKE PROFIT', 'REDUCE', 'EXIT', 'STOP LOSS'].includes(
        out.currentAction.action
      )
    ) {
      return false;
    }
    if (out.visibleZoneKeys.includes('add') || out.visibleZoneKeys.includes('takeProfit')) return false;
    if (out.visibleZoneKeys.includes('reduce') || out.visibleZoneKeys.includes('exit')) return false;
  } else if (out.currentAction.action === 'BUY') {
    return false;
  } else if (out.visibleZoneKeys.includes('buy')) {
    return false;
  }
  // Hard rule: BUY ZONE and ADD POSITION must never both be active
  if (out.visibleZoneKeys.includes('buy') && out.visibleZoneKeys.includes('add')) return false;

  const act = out.currentAction.action;
  const tpLo = Math.min(out.takeProfitZone.lo, out.takeProfitZone.hi);
  const tpHi = Math.max(out.takeProfitZone.lo, out.takeProfitZone.hi);
  const inTp = out.currentPrice >= tpLo - 1e-9 && out.currentPrice <= tpHi + 1e-9;
  if (inTp && (act === 'BUY' || act === 'RE-ENTRY')) return false;
  if (!out.userHasPosition && (act === 'TAKE PROFIT' || act === 'PARTIAL TAKE PROFIT')) return false;
  if (out.currentAction.validated === false) return false;
  // INDECISION is a valid primary action for both owned and flat accounts
  if (act === 'INDECISION' && (out.currentAction.conflictingFactors?.length ?? 0) === 0) {
    // Allow empty conflicts when confidence alone drove indecision
  }
  const buyHi = Math.max(
    out.buyZone.hi,
    ...((out.buyZones || []).map((z) => Math.max(z.lo, z.hi)) as number[])
  );
  if (Number.isFinite(buyHi) && buyHi >= tpLo - 1e-6) return false;
  return true;
}

function decideRecommendation(evidence: EvidenceBag, rawReturn: number): RecommendationLabel {
  const fromReturn = recommendationFromReturn(rawReturn);
  const fromCommittee = recFromScore(evidence.scores.overall);
  const mixed = Math.abs(evidence.netWeight) < 0.28 || Math.abs(evidence.bullishScore - evidence.bearishScore) < 18;

  // Blend return-implied and committee-implied, then gate
  let candidate = fromReturn;
  if (chartStanceFromRecommendation(fromReturn) !== chartStanceFromRecommendation(fromCommittee)) {
    if (Math.abs(evidence.netWeight) > 0.25) {
      candidate = evidence.netWeight > 0 ? (fromReturn === 'STRONG BUY' ? 'STRONG BUY' : fromCommittee) : fromCommittee;
      if (evidence.netWeight > 0 && (fromCommittee === 'BUY' || fromCommittee === 'STRONG BUY')) {
        candidate = fromCommittee === 'STRONG BUY' ? 'STRONG BUY' : 'BUY';
      }
      if (evidence.netWeight < 0 && (fromCommittee === 'SELL' || fromCommittee === 'REDUCE' || fromCommittee === 'AVOID NEW POSITION')) {
        candidate = fromCommittee;
      }
      if (Math.abs(evidence.netWeight) < 0.35 && fromReturn === 'HOLD') candidate = 'HOLD';
    } else {
      candidate = 'HOLD';
    }
  }

  // CORE RULE: intact support + trend is never a SELL on flow/MACD softening alone
  if (evidence.supportHolding && !evidence.sellGatePass) {
    if (candidate === 'SELL' || candidate === 'AVOID NEW POSITION') {
      candidate = evidence.flowWeakening ? 'REDUCE' : 'HOLD';
    }
    if (candidate === 'HOLD' && evidence.flowWeakening && evidence.netWeight < -0.12) {
      candidate = 'REDUCE';
    }
    if (candidate === 'REDUCE' && !evidence.flowWeakening) {
      candidate = 'HOLD';
    }
  }

  if (mixed && !evidence.buyGatePass && !evidence.sellGatePass) {
    if (candidate === 'BUY' || candidate === 'STRONG BUY' || candidate === 'SELL' || candidate === 'AVOID NEW POSITION') {
      candidate = evidence.flowWeakening && evidence.netWeight < -0.22 && evidence.supportHolding ? 'REDUCE' : 'HOLD';
    }
  }

  // USER-PRIORITIZED SIGNALS: price rising with confirming volume, a
  // volume-confirmed breakout, strong (80+) accumulation, or an uptrend pullback
  // to support are treated as the primary drivers of a BUY/STRONG BUY call —
  // other factors (fundamentals, sentiment) matter less for this decision, so
  // these can lift a HOLD/BUY candidate to BUY/STRONG BUY even when the
  // fundamentals-heavy committee score or buy gate is lukewarm. They never flip a
  // genuine, gated SELL/REDUCE/AVOID call — a confirmed support break, or an
  // active sell gate, stays a hard block.
  const hardBearishBlock = evidence.sellGatePass || evidence.supportBroken;
  if (
    !hardBearishBlock &&
    (candidate === 'HOLD' || candidate === 'BUY' || candidate === 'STRONG BUY') &&
    (evidence.priceVolumeSurge ||
      evidence.breakoutWithVolume ||
      evidence.strongAccumulation ||
      evidence.pullbackToSupportInUptrend)
  ) {
    return 'STRONG BUY';
  }

  if ((candidate === 'BUY' || candidate === 'STRONG BUY') && !evidence.buyGatePass) {
    if (evidence.nearSupport && evidence.structureIntact && evidence.netWeight > 0) return 'HOLD';
    if (evidence.netWeight > 0.05) return 'HOLD';
    if (evidence.netWeight < -0.05) {
      return evidence.sellGatePass ? (evidence.bearConfirmCount >= 4 ? 'SELL' : 'REDUCE') : 'HOLD';
    }
    return 'HOLD';
  }

  if ((candidate === 'SELL' || candidate === 'AVOID NEW POSITION') && !evidence.sellGatePass) {
    if (evidence.supportHolding) return evidence.flowWeakening && evidence.netWeight < -0.22 ? 'REDUCE' : 'HOLD';
    if (evidence.netWeight < -0.25) return 'REDUCE';
    return 'HOLD';
  }

  if (candidate === 'BUY' && evidence.netWeight > 0.55 && evidence.buyGatePass && evidence.scores.overall >= 85) {
    return 'STRONG BUY';
  }
  if (evidence.sellGatePass && evidence.supportBroken && evidence.bearConfirmCount >= 4 && evidence.netWeight < -0.45) {
    return 'AVOID NEW POSITION';
  }
  if (candidate === 'SELL' && evidence.sellGatePass && evidence.supportBroken) {
    return 'SELL';
  }

  return candidate;
}

function emptyOutput(horizon: HorizonKey, horizonLabel: string, input: QuantumEngineInput): QuantumEngineOutput {
  const emptyScores: ComponentScores = {
    technical: 50,
    fundamental: 50,
    whale: 50,
    news: 50,
    risk: 50,
    momentum: 50,
    overall: 50,
  };
  const emptyCommittee: CommitteeMember[] = (Object.keys(COMMITTEE_WEIGHTS) as CommitteeSeat[]).map((seat) => ({
    seat,
    score: 50,
    recommendation: 'HOLD',
    confidence: 40,
    reason: 'Awaiting price data',
    weight: COMMITTEE_WEIGHTS[seat],
  }));
  const hasPos = !!input.userHasPosition;
  return {
    horizon,
    horizonLabel,
    score: 50,
    ratingLabel: 'HOLD',
    confidence: 40,
    currentPrice: 0,
    targetPrice: 0,
    expectedReturn: 0,
    riskLevel: 'Medium',
    riskScore: 50,
    riskLabel: 'Medium',
    volatility: input.technical?.volatility ?? null,
    liquidityLabel: 'Moderate',
    drawdown: -5,
    sharpe: 0,
    buyZone: { lo: 0, hi: 0 },
    addZone: { lo: 0, hi: 0 },
    holdZone: { lo: 0, hi: 0 },
    takeProfitZone: { lo: 0, hi: 0 },
    reduceZone: { lo: 0, hi: 0 },
    exitZone: { lo: 0, hi: 0 },
    buyZones: [],
    reEntryZone: null,
    stopLoss: 0,
    takeProfit: 0,
    bullCase: 0,
    bearCase: 0,
    zoneScale: 1,
    userHasPosition: hasPos,
    currentAction: {
      action: hasPos ? 'HOLD' : 'WAIT',
      reason: 'Awaiting price data',
      confidence: 40,
      zoneKey: 'hold',
    },
    visibleZoneKeys: visibleZonesFor(hasPos),
    zonesConsistent: false,
    keyReasons: ['Awaiting price data'],
    criticalCaveat: null,
    summaryLead: 'Awaiting price data to generate a QuantumNode Consensus recommendation.',
    explanation: `All metrics are locked to the ${horizonLabel} Investment Horizon.`,
    chartStance: 'neutral',
    finalVerdict: 'HOLD',
    validationStatus: '✗ Recalculate',
    componentScores: emptyScores,
    bullishFactors: [],
    bearishFactors: [],
    neutralFactors: [],
    whyWins: 'Insufficient price data.',
    rejectedOpposite: '',
    suggestedAction: 'Hold',
    invalidationLevel: 'N/A',
    nextReviewTrigger: `Reassess when live price data is available (${horizonLabel}).`,
    supportHoldProbability: 50,
    resistanceBreakProbability: 50,
    explainedSignals: [],
    decisionWeightNote: 'No decision weight available.',
    committee: emptyCommittee,
    bullishScore: 50,
    bearishScore: 50,
    supportFailureProbability: 50,
    resistanceRejectionProbability: 50,
    entryZone: { lo: 0, hi: 0 },
    supportLevels: [],
    resistanceLevels: [],
    target1: 0,
    target2: 0,
    target3: 0,
    consensusNote: 'Committee inactive — no price.',
  };
}

export function runQuantumRecommendationEngine(input: QuantumEngineInput): QuantumEngineOutput {
  const horizonLabel = HORIZON_OPTIONS.find((o) => o.key === input.horizon)?.label ?? input.horizon;
  const px = input.currentPrice > 0 ? input.currentPrice : 0;

  if (!(px > 0)) return emptyOutput(input.horizon, horizonLabel, input);

  let attempt = 0;
  let last: QuantumEngineOutput | null = null;
  const evidence = collectEvidence(input);

  while (attempt < 5) {
    attempt += 1;
    let net = evidence.netWeight;
    if (last && attempt > 1) {
      if (last.expectedReturn > 0 && net < 0) net = Math.abs(net) * 0.35;
      if (last.expectedReturn < 0 && net > 0) net = -Math.abs(net) * 0.35;
    }

    let target = fairTargetPrice(input, net);
    let expectedReturn = round2(((target - px) / px) * 100);
    const api = mapApiRow(input.forecastHorizons, input.horizon);
    if (api.ret != null && Math.abs(api.ret) > 0.2) {
      if (Math.sign(api.ret) === Math.sign(net) || Math.abs(net) < 0.1) {
        expectedReturn = round2(expectedReturn * 0.55 + api.ret * 0.45);
        target = roundPrice(px * (1 + expectedReturn / 100));
      }
    }
    expectedReturn = round2(((target - px) / px) * 100);

    let rec = decideRecommendation(evidence, expectedReturn);

    if ((rec === 'BUY' || rec === 'STRONG BUY') && expectedReturn < 3) {
      expectedReturn = round2(clamp(floorWithSignal(expectedReturn, 3.2, 5), 3.2, 18));
      target = roundPrice(px * (1 + expectedReturn / 100));
    }
    if ((rec === 'SELL' || rec === 'AVOID NEW POSITION') && expectedReturn > -3) {
      expectedReturn = round2(-clamp(floorWithSignal(expectedReturn, 3.2, 6), 3.2, 22));
      target = roundPrice(px * (1 + expectedReturn / 100));
    }
    if (rec === 'HOLD') {
      expectedReturn = round2(clamp(expectedReturn, -2.9, 2.9));
      target = roundPrice(px * (1 + expectedReturn / 100));
    }
    if (rec === 'REDUCE' && evidence.supportHolding) {
      expectedReturn = round2(clamp(expectedReturn, -2.9, 2.9));
      target = roundPrice(px * (1 + expectedReturn / 100));
    } else if (rec === 'REDUCE' && expectedReturn > -3) {
      expectedReturn = round2(-clamp(floorWithSignal(expectedReturn, 3.5, 5), 3.5, 9.5));
      target = roundPrice(px * (1 + expectedReturn / 100));
    }

    expectedReturn = round2(((target - px) / px) * 100);
    rec = decideRecommendation(evidence, expectedReturn);
    // Mirrors the user-prioritized override inside decideRecommendation(): a
    // strong price+volume/breakout/accumulation/pullback pattern can carry a
    // BUY/STRONG BUY call even when the fundamentals-heavy buy gate is lukewarm.
    const hasStrongTechnicalPattern =
      evidence.priceVolumeSurge ||
      evidence.breakoutWithVolume ||
      evidence.strongAccumulation ||
      evidence.pullbackToSupportInUptrend;
    if (
      (rec === 'BUY' || rec === 'STRONG BUY') &&
      !evidence.buyGatePass &&
      !(hasStrongTechnicalPattern && !evidence.sellGatePass && !evidence.supportBroken)
    ) {
      rec = 'HOLD';
    }
    if ((rec === 'SELL' || rec === 'AVOID NEW POSITION') && !evidence.sellGatePass) {
      rec =
        evidence.supportHolding && evidence.flowWeakening
          ? 'REDUCE'
          : evidence.supportHolding
            ? 'HOLD'
            : evidence.netWeight < -0.25
              ? 'REDUCE'
              : 'HOLD';
    }
    if (rec === 'HOLD' || (rec === 'REDUCE' && evidence.supportHolding)) {
      expectedReturn = round2(clamp(expectedReturn, -2.9, 2.9));
      target = roundPrice(px * (1 + expectedReturn / 100));
    }

    // Positive R/R gate for BUY
    if ((rec === 'BUY' || rec === 'STRONG BUY') && expectedReturn <= 0) {
      rec = 'HOLD';
      expectedReturn = round2(clamp(expectedReturn, -2.9, 2.9));
      target = roundPrice(px * (1 + expectedReturn / 100));
    }

    const baseConf =
      input.baseConfidence != null && Number.isFinite(input.baseConfidence) ? input.baseConfidence : 62;
    const mixedSignals =
      Math.abs(evidence.netWeight) < 0.28 || Math.abs(evidence.bullishScore - evidence.bearishScore) < 18;
    // Confidence was previously a pure function of the same aggregate score
    // that produces the call (netWeight/overall) — so two calls with an
    // identical aggregate score got identical confidence even when one
    // committee unanimously agreed and the other was split down the middle.
    // Penalize confidence directly for seats whose own score meaningfully
    // opposes the call's direction, independent of the aggregate magnitude.
    // (This is not the same thing as calibration against real outcomes — the
    // recommendationOutcomes tracker has no data yet to calibrate against —
    // but it does make confidence track genuine internal disagreement, which
    // it previously ignored entirely.)
    const callDirection = evidence.netWeight >= 0 ? 1 : -1;
    const disagreeingSeats = evidence.committee.filter((c) => {
      const lean = c.score - 50;
      return Math.sign(lean) === -callDirection && Math.abs(lean) > 8;
    }).length;
    const dispersionPenalty = Math.min(20, disagreeingSeats * 5);
    // Short price history, missing P/E, and missing/zero volume all made
    // technical.ts's flow indicators (accumulation/distribution, institutional
    // flow, smart money) fall back to placeholder defaults — silently, with no
    // effect on confidence. A ticker with almost no usable data produced a
    // full-strength recommendation indistinguishable from one backed by solid
    // data. Unknown (caller didn't supply it) defaults to fully complete —
    // never penalize on the absence of the signal itself.
    const completeness =
      input.dataCompleteness != null && Number.isFinite(input.dataCompleteness)
        ? clamp(input.dataCompleteness, 0, 1)
        : 1;
    const completenessPenalty = Math.round((1 - completeness) * 20);
    // Buying within ~2.5% of resistance carries real, elevated rejection risk
    // (a very common outcome: price stalls or reverses right at the level)
    // regardless of how strong the other evidence looks — the buy gate
    // (line ~950) only blocks this outright when momentum is also weak, so a
    // bullish call with decent momentum could otherwise sail through at full
    // confidence right at a ceiling. Temper confidence directly instead.
    const resistanceProximityPenalty = evidence.nearResistance && evidence.netWeight >= 0 ? 10 : 0;
    const horizonAdjustment = HORIZON_CONFIDENCE_ADJUSTMENT[input.horizon] ?? 0;
    // netWeight = (bullWeight-bearWeight)/total; bullishScore/bearishScore are
    // the same bullWeight/bearWeight as rounded percentages of that same
    // total, so |bullishScore-bearishScore|/100 (the "decisive" term this
    // formula used to add here, weight 12) is mathematically the same
    // quantity as |netWeight| to within rounding — verified empirically
    // (max observed difference 0.009 across a range of test inputs). It was
    // effectively a second, disguised vote for the same signal already
    // weighted at 40, on top of overall (0.28) which is correlated with it
    // too but computed from an entirely different aggregation (committee
    // seat scores, not the bull/bear factor-weight split) and so isn't a
    // duplicate in the same provable sense. Removed the duplicate term
    // rather than just relabeling it.
    let confidence = Math.round(
      clamp(
        baseConf * 0.2 +
          Math.abs(evidence.netWeight) * 40 +
          evidence.scores.overall * 0.28 +
          (evidence.buyGatePass || evidence.sellGatePass ? 8 : 0) -
          dispersionPenalty -
          completenessPenalty -
          resistanceProximityPenalty +
          horizonAdjustment,
        30,
        94
      )
    );
    // Confidence = conviction in THIS recommendation, not bullishness of indicators.
    if (!evidence.buyGatePass && !evidence.sellGatePass) {
      confidence = Math.min(confidence, mixedSignals ? 62 : 68);
    }
    if ((rec === 'HOLD' || rec === 'REDUCE') && mixedSignals) {
      confidence = Math.min(confidence, 62);
    }
    if (evidence.supportHolding && !evidence.sellGatePass && (rec === 'HOLD' || rec === 'REDUCE')) {
      confidence = Math.max(confidence, 52);
      confidence = Math.min(confidence, 64);
    }
    if (rec === 'SELL' && evidence.sellGatePass && evidence.bearConfirmCount >= 4) {
      confidence = Math.max(confidence, 80);
    }
    if (
      confidence < 65 &&
      mixedSignals &&
      (rec === 'BUY' || rec === 'STRONG BUY' || rec === 'SELL' || rec === 'AVOID NEW POSITION') &&
      !((rec === 'BUY' || rec === 'STRONG BUY') && hasStrongTechnicalPattern && !evidence.sellGatePass && !evidence.supportBroken)
    ) {
      rec = evidence.flowWeakening && evidence.supportHolding && evidence.netWeight < -0.22 ? 'REDUCE' : 'HOLD';
      if (rec === 'HOLD') {
        expectedReturn = round2(clamp(expectedReturn, -2.9, 2.9));
        target = roundPrice(px * (1 + expectedReturn / 100));
      }
    }
    const score = scoreFromRecommendation(rec, expectedReturn, evidence.netWeight * 10);

    const vol =
      input.technical?.volatility ??
      api.vol ??
      (input.horizon === '1W' ? 26 : input.horizon === '1Y' ? 17 : 21);
    const risk = riskFromVolatility(vol, input.horizon);
    const zoneOpts = {
      px,
      target,
      rec,
      levels: input.levels,
      stopHint: input.stopLossHint,
      vol,
      horizon: input.horizon,
      atrPct: input.technical?.atrPct,
      institutionalScore: input.institutionalScore,
      whaleScore: input.whaleScore,
      smartMoneyScore: input.smartMoneyScore,
      trend: input.technical?.trend,
      emaBias: input.technical?.emaBias,
      bollingerBias: input.technical?.bollingerBias,
    };
    let zones = buildZones(zoneOpts);
    // Auto-repair overlapping zones up to 3 times (nudge target / stop, keep Buy width logic)
    for (let zAttempt = 0; zAttempt < 3 && !zonesAreConsistent(zones); zAttempt++) {
      const widen = 1 + zAttempt * 0.015;
      zones = buildZones({
        ...zoneOpts,
        target: target * widen,
        stopHint: zones.stopLoss * (1 - zAttempt * 0.002),
        vol: (vol ?? 22) * widen,
      });
    }
    const buyZonesRaw = buildBuyZones123(
      px,
      zones.buyZone,
      input.technicalBreakdown,
      target
    );
    const userHasPosition = !!input.userHasPosition;
    const resolved = resolveLiveAction(
      px,
      zones,
      buyZonesRaw,
      rec,
      userHasPosition,
      confidence,
      target,
      expectedReturn,
      {
        score: evidence.scores.overall,
        rsi: input.technical?.rsi ?? null,
        macdBullish: input.technical?.macdBullish ?? null,
        trend: input.technical?.trend ?? null,
        institutionalScore: input.institutionalScore ?? null,
        whaleScore: input.whaleScore ?? null,
        smartMoneyScore: input.smartMoneyScore ?? null,
        fundFlowBias: input.fundFlowBias ?? null,
        volumeBias: input.technical?.volumeBias ?? null,
        bollingerBias: input.technical?.bollingerBias ?? null,
        emaBias: input.technical?.emaBias ?? null,
        newsBias: input.newsBias ?? null,
        technicalScore: evidence.scores.technical,
        fundamentalScore: evidence.scores.fundamental,
        momentumScore: evidence.scores.momentum,
        resistanceNearby:
          input.levels?.r1 != null && px > 0
            ? Math.abs(input.levels.r1 - px) / px <= 0.025
            : null,
        supportNearby:
          input.levels?.s1 != null && px > 0
            ? Math.abs(input.levels.s1 - px) / px <= 0.025
            : null,
        dataQuality: px > 0 ? 'good' : 'missing',
        supportHolding: evidence.supportHolding,
        supportBroken: evidence.supportBroken,
        supportLevel: evidence.supportLevel,
        resistanceLevel: evidence.resistanceLevel,
        majorResistance: evidence.majorResistance,
      }
    );
    zones = resolved.zones;
    const buyZones = resolved.buyZones;
    const currentAction = resolved.brief;
    const stance = positionAwareHeadline(rec, currentAction, userHasPosition, confidence, evidence);
    currentAction.displayLabel = stance.headline;
    currentAction.action = stance.action;
    currentAction.confidence = confidence;
    currentAction.confidenceBand = convictionBand(confidence);
    if (!currentAction.whatToWatch) {
      const trig = structureTriggers(evidence);
      currentAction.whatToWatch = `${trig.bear} ${trig.bull}`;
    }
    // Keep expected return aligned with target vs live price (never positive if target < px)
    expectedReturn = round2(((target - px) / px) * 100);
    // HOLD and REDUCE-while-support-holds were deliberately clamped to a
    // narrow +/-2.9% band earlier (a HOLD/mild-REDUCE shouldn't imply a big
    // directional move) — but resolveLiveAction's own buy-zone-based target
    // isn't bound by that clamp, so letting it override here silently blew
    // the band back open (observed on real tickers: HOLD calls reporting
    // 5-8% expected return). That mismatch is exactly what validate() checks
    // for, so every affected call showed "Recalculate" to the user. Preserve
    // the clamp for these two labels instead of letting it get overridden.
    const clampedLabel = rec === 'HOLD' || (rec === 'REDUCE' && evidence.supportHolding);
    if (!clampedLabel && resolved.decision.expectedReturn !== expectedReturn) {
      // resolved.decision.targetPrice comes from buyZoneDecision.ts's own
      // take-profit-zone target, which isn't horizon-aware — it doesn't scale
      // with input.horizon the way fairTargetPrice's blend deliberately does
      // (verified: fairTargetPrice went 0.98% -> 2.46% -> 4.16% -> 7.57% across
      // 1W/1M/3M/1Y for one ticker, all correctly increasing with horizon).
      // The old ">0.25 points apart" branch treated that expected numeric gap
      // between two genuinely different targets as an "inconsistency to
      // repair", so it fired on every single call and silently overwrote the
      // horizon-scaled value with the same constant number regardless of
      // horizon. Only override on an actual contradiction (opposite signs —
      // e.g. fairTargetPrice implying downside while the zone system's own
      // take-profit sits above price), not a mere magnitude difference.
      if (Math.sign(resolved.decision.expectedReturn) !== Math.sign(expectedReturn)) {
        expectedReturn = resolved.decision.expectedReturn;
        target = resolved.decision.targetPrice;
      }
    }
    // If price already at/above target, force non-positive ER
    if (px >= target && expectedReturn > 0) {
      expectedReturn = round2(((target - px) / px) * 100);
    }
    const zonesConsistent = zonesAreConsistent(zones);
    const targets = buildTargets(px, target, rec, input.levels);
    const visibleZoneKeys = visibleZonesFor(userHasPosition);

    const topFactors =
      rec === 'STRONG BUY' || rec === 'BUY'
        ? evidence.bullish
        : rec === 'SELL' || rec === 'AVOID NEW POSITION' || rec === 'REDUCE'
          ? evidence.bearish
          : [...evidence.bullish.slice(0, 2), ...evidence.bearish.slice(0, 2), ...evidence.neutral.slice(0, 2)];
    const keyReasons = topFactors
      .sort((a, b) => b.weight - a.weight)
      .map((f) => f.label)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 6);
    while (keyReasons.length < 3) keyReasons.push('Mixed evidence — position sizing discipline preferred');

    // nearResistance/nearSupport/supportBroken were previously only used as
    // silent gate conditions — a BUY near resistance with decent momentum, or
    // a SELL/REDUCE at support, never explained *why* despite the level being
    // the single most relevant fact. This must be surfaced, not buried.
    //
    // REDUCE is a position-management concept — positionAwareHeadline only
    // ever displays a REDUCE-flavored primary action when userHasPosition is
    // true; for a flat account, rec === 'REDUCE' resolves to something
    // unrelated (WAIT/HOLD/etc, since you can't reduce a position you don't
    // own). The caveat box sits inside the Primary Action UI context, so
    // firing it off the raw horizon-level rec regardless of position produced
    // a caveat talking about "REDUCE" next to a primary action that was never
    // REDUCE at all — confusing, not clarifying. Gate every REDUCE-specific
    // branch on userHasPosition; SELL/AVOID/BUY don't need this guard since
    // they still map to a semantically-aligned flat-account action (e.g.
    // "NO NEW POSITION" for SELL) even when the exact label text differs.
    let criticalCaveat: string | null = null;
    if ((rec === 'BUY' || rec === 'STRONG BUY') && evidence.nearResistance && evidence.resistanceLevel != null && px > 0) {
      const distPct = (((evidence.resistanceLevel - px) / px) * 100).toFixed(1);
      criticalCaveat = `Price is only ${distPct}% below resistance (~${evidence.resistanceLevel.toFixed(2)}). Rejection at this level is common — this ${rec} call assumes the level breaks with confirmation, not that it already has. Consider a smaller entry or waiting for a confirmed close above resistance.`;
    } else if (
      (rec === 'BUY' || rec === 'STRONG BUY') &&
      input.technical?.rsi != null &&
      (input.technical.rsi >= 70 || input.technical?.macdBullish === false)
    ) {
      // A BUY/STRONG BUY driven by strong accumulation/flow can still coincide
      // with RSI overbought and/or a fresh bearish MACD crossover — a genuine
      // short-term exhaustion warning the accumulation evidence doesn't cancel
      // out. Same principle as the resistance caveat: the call stays valid, the
      // risk gets surfaced instead of buried.
      const overbought = input.technical.rsi >= 70;
      const macdBear = input.technical?.macdBullish === false;
      const warnParts: string[] = [];
      if (overbought) warnParts.push(`RSI is at ${input.technical.rsi.toFixed(0)} (overbought)`);
      if (macdBear) warnParts.push('MACD has just turned bearish');
      const driver = evidence.strongAccumulation
        ? 'strong whale/institutional accumulation'
        : 'the underlying technical and flow evidence';
      criticalCaveat = `This ${rec} call is supported by ${driver}, but ${warnParts.join(' and ')} — a short-term pullback or stall is common here even inside a longer uptrend. Consider scaling in rather than a full entry, or waiting for momentum to reset before adding size.`;
    } else if (
      (rec === 'SELL' || rec === 'AVOID NEW POSITION' || (rec === 'REDUCE' && userHasPosition)) &&
      (evidence.supportBroken || evidence.nearSupport) &&
      evidence.supportLevel != null &&
      px > 0
    ) {
      criticalCaveat = evidence.supportBroken
        ? `This ${rec} call is driven by a confirmed break below support (~${evidence.supportLevel.toFixed(2)}) plus independent confirmation (${evidence.bearConfirmCount} bearish signals) — not a single softening indicator.`
        : `Price is only ${(((px - evidence.supportLevel) / px) * 100).toFixed(1)}% above support (~${evidence.supportLevel.toFixed(2)}). A bounce here is common — this call is based on weakening evidence beyond just proximity to the level.`;
    } else if (rec === 'REDUCE' && userHasPosition && evidence.supportHolding) {
      // REDUCE while support still holds gets its expected-return clamped to
      // a narrow +/-2.9% band (line ~2068) — which can render as a positive
      // number/target next to a "REDUCE" label and look self-contradictory.
      // It isn't: REDUCE here means trim size on softening flow/momentum, a
      // different and less severe call than SELL (structural breakdown).
      criticalCaveat = `REDUCE means trim position size on weakening momentum or flow — not a bearish price call. Support is still holding, so the near-term target stays in a narrow range instead of projecting a decline; that's why it can look mild or even slightly positive next to "REDUCE".`;
    }

    const whyWins = buildWhyWins(rec, evidence);
    const rejectedOpposite = buildRejectedOpposite(rec, evidence);
    const suggestedAction = positionAwareSuggestedAction(rec, currentAction, userHasPosition, evidence);
    const note = consensusNote(evidence.committee, rec);
    const explainedSignals = positionAwareSignals(evidence.explainedSignals, userHasPosition);
    const actionLabel = currentAction.displayLabel || currentAction.action;
    const whyLine = currentAction.why || currentAction.reason;
    const nextLine = currentAction.nextOpportunity ? ` Next: ${currentAction.nextOpportunity}` : '';
    const summaryLead = `PRIMARY ACTION: ${actionLabel}. ${whyLine}${nextLine} Conviction ${confidence}% (${convictionBand(confidence)}). Expected return ${expectedReturn >= 0 ? '+' : ''}${expectedReturn.toFixed(1)}%.`;

    const drawdown = round2(-Math.max(2, Math.abs(expectedReturn) * 0.55 + (vol ?? 20) * 0.12));
    const sharpe =
      vol > 0
        ? round2((expectedReturn / vol) * (input.horizon === '1Y' ? 1.1 : input.horizon === '1W' ? 0.45 : 0.75))
        : 0;
    const zoneScale =
      input.horizon === '1W' ? 0.55 : input.horizon === '1M' ? 1 : input.horizon === '3M' ? 1.35 : 1.85;

    const supportLevels = [input.levels?.s1, input.levels?.s2]
      .filter((v): v is number => v != null && Number.isFinite(v))
      .map(round2);
    const resistanceLevels = [input.levels?.r1, input.levels?.r2]
      .filter((v): v is number => v != null && Number.isFinite(v))
      .map(round2);

    last = {
      horizon: input.horizon,
      horizonLabel,
      score: Math.round((score + evidence.scores.overall) / 2),
      ratingLabel: rec,
      confidence,
      currentPrice: round2(px),
      targetPrice: target,
      expectedReturn,
      riskLevel: risk.level,
      riskScore: risk.score,
      riskLabel: risk.level,
      volatility: round2(vol),
      liquidityLabel: liquidityLabel(score, input.whaleScore ?? null),
      drawdown,
      sharpe,
      buyZone: zones.buyZone,
      addZone: zones.addZone,
      holdZone: zones.holdZone,
      takeProfitZone: zones.takeProfitZone,
      reduceZone: zones.reduceZone,
      exitZone: zones.exitZone,
      buyZones,
      reEntryZone: resolved.decision.reEntryZone
        ? {
            lo: resolved.decision.reEntryZone.lo,
            hi: resolved.decision.reEntryZone.hi,
          }
        : null,
      stopLoss: zones.stopLoss,
      takeProfit: zones.takeProfit,
      bullCase: zones.takeProfit,
      bearCase: zones.stopLoss,
      zoneScale,
      userHasPosition,
      currentAction,
      visibleZoneKeys,
      zonesConsistent,
      keyReasons,
      criticalCaveat,
      summaryLead,
      explanation: `PRIMARY ACTION ${actionLabel}. ${whyLine}${nextLine} Consensus for ${horizonLabel}: ${note}`,
      chartStance: chartStanceFromRecommendation(rec),
      finalVerdict: rec,
      validationStatus: '✗ Recalculate',
      componentScores: evidence.scores,
      bullishFactors: evidence.bullish.sort((a, b) => b.weight - a.weight),
      bearishFactors: evidence.bearish.sort((a, b) => b.weight - a.weight),
      neutralFactors: evidence.neutral,
      whyWins,
      rejectedOpposite,
      suggestedAction,
      invalidationLevel: invalidationFor(rec, px, zones, evidence),
      nextReviewTrigger: nextReviewFor(horizonLabel, evidence),
      supportHoldProbability: evidence.supportHoldProbability,
      resistanceBreakProbability: evidence.resistanceBreakProbability,
      explainedSignals,
      decisionWeightNote: note,
      committee: evidence.committee,
      bullishScore: evidence.bullishScore,
      bearishScore: evidence.bearishScore,
      supportFailureProbability: evidence.supportFailureProbability,
      resistanceRejectionProbability: evidence.resistanceRejectionProbability,
      entryZone: zones.buyZone,
      supportLevels,
      resistanceLevels,
      target1: targets.target1,
      target2: targets.target2,
      target3: targets.target3,
      consensusNote: note,
    };

    if (validate(last)) {
      last.validationStatus = '✓ Internal Consistency Passed';
      return last;
    }
  }

  if (last) {
    last.expectedReturn = round2(((last.targetPrice - last.currentPrice) / last.currentPrice) * 100);
    last.finalVerdict = last.ratingLabel;
    last.chartStance = chartStanceFromRecommendation(last.ratingLabel);
    last.supportFailureProbability = 100 - last.supportHoldProbability;
    last.resistanceRejectionProbability = 100 - last.resistanceBreakProbability;
    last.validationStatus = validate(last) ? '✓ Internal Consistency Passed' : '✗ Recalculate';
    return last;
  }

  throw new Error('QuantumNode Consensus engine failed to produce output');
}
