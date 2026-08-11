/**
 * QuantumNode Consensus AI — Institutional Investment Decision Engine
 * Mission: most consistent, transparent, explainable, professionally defensible recommendation.
 * NOT maximize BUY. Never display contradictory conclusions on the same horizon.
 */

import type { HorizonKey } from '../components/analysis/analysisTheme';
import { HORIZON_OPTIONS } from '../components/analysis/analysisTheme';
import {
  resolveBuyZoneDecision,
  sanitizeBuyZoneCopy,
  splitBuyEnvelope,
  type BuyBand,
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

/** Live price maps to exactly one of these actions */
export type ZoneAction =
  | 'BUY'
  | 'ADD POSITION'
  | 'HOLD'
  | 'WAIT'
  | 'TAKE PROFIT'
  | 'REDUCE'
  | 'EXIT'
  | 'AVOID NEW POSITION'
  | 'STOP LOSS';

export type LiveActionBrief = {
  action: ZoneAction;
  reason: string;
  confidence: number;
  zoneKey: string;
  /** Precise status e.g. BUY NOW — BUY ZONE 1 (preferred for UI) */
  displayLabel?: string;
  priceLocation?: import('./buyZoneDecision').PriceLocation;
  confirmationStatus?: import('./buyZoneDecision').ConfirmationStatus;
  activeBuyZoneLevel?: 1 | 2 | 3 | null;
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

/** Consensus weights (Step 3) */
export const COMMITTEE_WEIGHTS: Record<CommitteeSeat, number> = {
  Technical: 0.2,
  Fundamental: 0.25,
  Whale: 0.2,
  Risk: 0.15,
  Momentum: 0.1,
  Sentiment: 0.1,
};

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
  /** Scale-in Buy Zone 1/2/3 — SSOT for location + live action messaging */
  buyZones: Array<{
    level: 1 | 2 | 3;
    label: string;
    lo: number;
    hi: number;
    sizePct?: number;
    anchor?: string;
  }>;
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

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
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

  if (input.technical?.obvBias === 'bull') {
    bullish.push({ label: 'OBV / volume accumulation', weight: 0.4, polarity: 'bull' });
  } else if (input.technical?.obvBias === 'bear') {
    bearish.push({ label: 'OBV / volume distribution', weight: 0.4, polarity: 'bear' });
  }

  if (input.technical?.volumeBias === 'high') {
    neutral.push({ label: 'Elevated volume — confirmation required', weight: 0.15, polarity: 'neutral' });
  }

  // --- Money flow ---
  if (input.institutionalScore != null) {
    if (input.institutionalScore >= 60) {
      bullish.push({ label: 'Institutional accumulation detected', weight: 0.9, polarity: 'bull' });
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
      bearish.push({ label: 'Institutional selling / distribution', weight: 0.85, polarity: 'bear' });
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
      bullish.push({ label: 'Whale accumulation detected', weight: 0.85, polarity: 'bull' });
    } else if (input.whaleScore < 40) {
      whale = Math.min(whale, input.whaleScore);
      bearish.push({ label: 'Whale distribution', weight: 0.8, polarity: 'bear' });
    }
  }

  if (input.smartMoneyScore != null) {
    if (input.smartMoneyScore >= 65) {
      whale = Math.max(whale, input.smartMoneyScore * 0.9);
      bullish.push({ label: 'Smart money index constructive', weight: 0.7, polarity: 'bull' });
    } else if (input.smartMoneyScore < 40) {
      bearish.push({ label: 'Smart money index weak', weight: 0.65, polarity: 'bear' });
    }
  }

  if (input.fundFlowBias === 'inflow') {
    bullish.push({ label: 'Fund / capital inflow', weight: 0.5, polarity: 'bull' });
  } else if (input.fundFlowBias === 'outflow') {
    bearish.push({ label: 'Fund / capital outflow', weight: 0.5, polarity: 'bear' });
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
      bullish.push({ label: 'Price above resistance (breakout)', weight: 0.55, polarity: 'bull' });
    } else {
      resistanceBreakProbability = clamp(40 + (1 - Math.min(distToR1, 0.1) / 0.1) * 20, 30, 65);
    }
  }

  const supportFailureProbability = 100 - Math.round(supportHoldProbability);
  const resistanceRejectionProbability = 100 - Math.round(resistanceBreakProbability);

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

  const committee: CommitteeMember[] = [
    {
      seat: 'Technical',
      score: Math.round(technical),
      recommendation: recFromScore(technical),
      confidence: Math.round(clamp(55 + Math.abs(technical - 50) * 0.7, 45, 92)),
      reason: techReason,
      weight: COMMITTEE_WEIGHTS.Technical,
    },
    {
      seat: 'Fundamental',
      score: Math.round(fundamental),
      recommendation: recFromScore(fundamental),
      confidence: Math.round(clamp(55 + Math.abs(fundamental - 50) * 0.7, 45, 92)),
      reason: fundReason,
      weight: COMMITTEE_WEIGHTS.Fundamental,
    },
    {
      seat: 'Whale',
      score: Math.round(whale),
      recommendation: recFromScore(whale),
      confidence: Math.round(clamp(55 + Math.abs(whale - 50) * 0.7, 45, 92)),
      reason: whaleReason,
      weight: COMMITTEE_WEIGHTS.Whale,
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
      weight: COMMITTEE_WEIGHTS.Risk,
    },
    {
      seat: 'Momentum',
      score: Math.round(momentum),
      recommendation: recFromScore(momentum),
      confidence: Math.round(clamp(55 + Math.abs(momentum - 50) * 0.7, 45, 92)),
      reason: momReason,
      weight: COMMITTEE_WEIGHTS.Momentum,
    },
    {
      seat: 'Sentiment',
      score: Math.round(news),
      recommendation: recFromScore(news),
      confidence: Math.round(clamp(52 + Math.abs(news - 50) * 0.7, 45, 90)),
      reason: sentReason,
      weight: COMMITTEE_WEIGHTS.Sentiment,
    },
  ];

  // STEP 3 — weighted overall (Risk inverted into quality score for blend)
  const overall = Math.round(
    clamp(
      technical * COMMITTEE_WEIGHTS.Technical +
        fundamental * COMMITTEE_WEIGHTS.Fundamental +
        whale * COMMITTEE_WEIGHTS.Whale +
        (100 - risk) * COMMITTEE_WEIGHTS.Risk +
        momentum * COMMITTEE_WEIGHTS.Momentum +
        news * COMMITTEE_WEIGHTS.Sentiment,
      1,
      99
    )
  );

  const bullishScore = Math.round(clamp((bullWeight / total) * 100, 0, 100));
  const bearishScore = Math.round(clamp((bearWeight / total) * 100, 0, 100));

  // STEP 8 — BUY / SELL gates
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
  const buyGatePass = buyGateFails.length === 0 && netWeight > 0.12;

  const sellGateFails: string[] = [];
  const supportBroken = px > 0 && s1 != null && px < s1;
  const instSelling = input.institutionalScore != null && input.institutionalScore < 40;
  const momCollapsed = input.momentumScore != null && input.momentumScore < 35;
  const trendReversed = trend.includes('BEAR');
  if (!supportBroken && !instSelling && !momCollapsed && !trendReversed && netWeight > -0.35) {
    sellGateFails.push('No confirmed support break, institutional selling, momentum collapse, or trend reversal');
  }
  if (netWeight > -0.12) sellGateFails.push('Bearish evidence not dominant');
  const sellGatePass = sellGateFails.length === 0 && netWeight < -0.12;

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
  };
}

function fairTargetPrice(input: QuantumEngineInput, netWeight: number): number {
  const px = input.currentPrice;
  const days = HORIZON_DAYS[input.horizon];
  const api = mapApiRow(input.forecastHorizons, input.horizon);
  const candidates: number[] = [];

  if (api.price != null && api.price > 0) candidates.push(api.price);
  if (api.ret != null) candidates.push(px * (1 + api.ret / 100));

  if (input.baseTarget != null && Number.isFinite(input.baseTarget)) {
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
  if (input.baseReturn != null) {
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
 * STEP 9–10: Map live price to exactly ONE action, position-aware.
 * Flat accounts: PRICE LOCATION (Buy Zone 1–3) → CONFIRMATION → FINAL ACTION.
 * Never claim "outside BUY zone" when price is inside any Buy Zone.
 */
function resolveLiveAction(
  px: number,
  zones: ReturnType<typeof buildZones>,
  buyZones: BuyBand[],
  rec: RecommendationLabel,
  userHasPosition: boolean,
  confidence: number,
  confirmationExtras?: {
    score?: number | null;
    rsi?: number | null;
    macdBullish?: boolean | null;
    trend?: string | null;
  }
): LiveActionBrief {
  const conf = Math.round(clamp(confidence, 40, 94));

  if (px <= zones.stopLoss) {
    if (userHasPosition) {
      return {
        action: 'STOP LOSS',
        reason: `Live price is at/below stop ${zones.stopLoss.toFixed(2)} — capital protection exit.`,
        confidence: conf,
        zoneKey: 'stop',
        displayLabel: 'STOP LOSS',
      };
    }
    return {
      action: 'AVOID NEW POSITION',
      reason: `Live price is below the entry structure/stop — do not open a new long here.`,
      confidence: conf,
      zoneKey: 'stop',
      displayLabel: 'AVOID NEW POSITION',
    };
  }

  if (userHasPosition) {
    // Owned: keep ladder management actions (ADD / HOLD / TP / …)
    if (inBand(px, zones.exitZone) || px > zones.exitZone.hi) {
      return {
        action: 'EXIT',
        reason: 'Price is in/above the EXIT zone — close remaining exposure.',
        confidence: conf,
        zoneKey: 'exit',
        displayLabel: 'EXIT',
      };
    }
    if (inBand(px, zones.reduceZone)) {
      return {
        action: 'REDUCE',
        reason: 'Price is in the REDUCE zone — trim exposure after take-profit stretch.',
        confidence: conf,
        zoneKey: 'reduce',
        displayLabel: 'REDUCE',
      };
    }
    if (inBand(px, zones.takeProfitZone)) {
      return {
        action: 'TAKE PROFIT',
        reason: 'Price is in TAKE PROFIT — consider partial profits; keep core if thesis intact.',
        confidence: conf,
        zoneKey: 'takeProfit',
        displayLabel: 'TAKE PROFIT',
      };
    }
    if (inBand(px, zones.addZone) || inBand(px, zones.buyZone)) {
      return {
        action: 'ADD POSITION',
        reason: 'Price is in the entry/scale-in structure — ADD POSITION because you already own the stock.',
        confidence: conf,
        zoneKey: 'add',
        displayLabel: 'ADD POSITION',
      };
    }
    if (inBand(px, zones.holdZone)) {
      return {
        action: 'HOLD',
        reason: 'Price is above Add zone and below Take Profit — risk/reward balanced; no action required.',
        confidence: conf,
        zoneKey: 'hold',
        displayLabel: 'HOLD',
      };
    }
    return {
      action: 'HOLD',
      reason: 'Price sits between defined management bands — maintain position until a zone is reached.',
      confidence: Math.max(40, conf - 6),
      zoneKey: 'hold',
      displayLabel: 'HOLD',
    };
  }

  // Flat: Buy Zone 1/2/3 location SSOT first — never contradict displayed bands
  const decision = sanitizeBuyZoneCopy(
    resolveBuyZoneDecision({
      currentPrice: px,
      buyZones,
      baseConfidence: conf,
      confirmation: {
        recommendation: rec,
        confidence: conf,
        score: confirmationExtras?.score,
        rsi: confirmationExtras?.rsi,
        macdBullish: confirmationExtras?.macdBullish,
        trend: confirmationExtras?.trend,
        userHasPosition: false,
      },
    })
  );

  return {
    action: decision.action,
    reason: decision.reason,
    confidence: decision.confidence,
    zoneKey: decision.zoneKey,
    displayLabel: decision.displayLabel,
    priceLocation: decision.priceLocation,
    confirmationStatus: decision.confirmationStatus,
    activeBuyZoneLevel: decision.activeBuyZoneLevel,
  };
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
  // Prefer live price action when it is specific
  if (live.action === 'BUY') return 'Buy';
  if (live.action === 'ADD POSITION') return 'Accumulate';
  if (live.action === 'HOLD' || live.action === 'WAIT') return 'Hold';
  if (live.action === 'TAKE PROFIT') return 'Take Partial Profit';
  if (live.action === 'REDUCE' || live.action === 'STOP LOSS') return 'Reduce';
  if (live.action === 'EXIT' || live.action === 'AVOID NEW POSITION') return 'Exit';

  if (!userHasPosition) {
    if (rec === 'STRONG BUY' || rec === 'BUY') return 'Buy';
    if (rec === 'AVOID NEW POSITION' || rec === 'SELL') return 'Exit';
    return 'Hold';
  }
  if (rec === 'STRONG BUY' || rec === 'BUY') {
    return evidence.bearish.some((b) => /overbought|resistance/i.test(b.label)) ? 'Accumulate' : 'Accumulate';
  }
  if (rec === 'HOLD') return 'Hold';
  if (rec === 'REDUCE') return 'Take Partial Profit';
  if (rec === 'SELL') return 'Reduce';
  return 'Exit';
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
  if (rec === 'STRONG BUY' || rec === 'BUY') {
    const winners = topBull.map((f) => f.label).join(', ');
    const outweighed = topBear.length ? topBear.map((f) => f.label).join(', ') : 'no dominant bearish blockers';
    return `Although opposing signals existed (${outweighed}), the committee weighted ${winners || 'bullish evidence'} higher — especially whale/institutional and support-hold odds (${evidence.supportHoldProbability}%). Therefore ${rec}.`;
  }
  if (rec === 'SELL' || rec === 'AVOID NEW POSITION' || rec === 'REDUCE') {
    const winners = topBear.map((f) => f.label).join(', ');
    const outweighed = topBull.length ? topBull.map((f) => f.label).join(', ') : 'no dominant bullish confirmation';
    return `Although ${outweighed} appeared constructive, ${winners || 'bearish evidence'} carried higher committee weight with failed BUY gates / passed defensive gates. Therefore ${rec}.`;
  }
  return 'Committee votes are split and neither BUY nor SELL validation cleared — HOLD is the professionally defensible stance.';
}

function buildRejectedOpposite(rec: RecommendationLabel, evidence: EvidenceBag): string {
  if (rec === 'STRONG BUY' || rec === 'BUY') {
    const rejected = evidence.bearish.slice(0, 5).map((f) => `• ${f.label}`);
    if (!rejected.length) return 'No material opposite (bearish) signals required rejection.';
    return `Although bearish signals existed:\n${rejected.join('\n')}\nConsensus did not issue SELL because institutional/whale weight and support-hold probability outweighed short-term technical caution, and SELL gates were not met.`;
  }
  if (rec === 'SELL' || rec === 'AVOID NEW POSITION' || rec === 'REDUCE') {
    const rejected = evidence.bullish.slice(0, 5).map((f) => `• ${f.label}`);
    if (!rejected.length) return 'No material opposite (bullish) signals required rejection.';
    return `Although bullish signals existed:\n${rejected.join('\n')}\nConsensus did not issue BUY because distribution/support-failure/momentum risks dominated and BUY gates failed.`;
  }
  return 'Neither side cleared a decisive BUY or SELL gate — HOLD avoids forcing a directional call.';
}

function invalidationFor(
  rec: RecommendationLabel,
  px: number,
  zones: ReturnType<typeof buildZones>,
  evidence: EvidenceBag
): string {
  if (rec === 'STRONG BUY' || rec === 'BUY') {
    return `Daily close below ${zones.stopLoss.toFixed(2)} (stop / support failure ≈ ${evidence.supportFailureProbability}%) or clear institutional distribution.`;
  }
  if (rec === 'SELL' || rec === 'AVOID NEW POSITION' || rec === 'REDUCE') {
    return `Reclaim and hold above ${(px * 1.03).toFixed(2)} with renewed whale/institutional accumulation (support hold > ${Math.max(70, evidence.supportHoldProbability)}%).`;
  }
  return `Breakout above resistance with accumulation, or breakdown below ${zones.stopLoss.toFixed(2)}.`;
}

function nextReviewFor(horizonLabel: string, evidence: EvidenceBag): string {
  return `Reassess on next earnings, decisive S/R break, or whale/institutional flow shift. Horizon: ${horizonLabel}. Support-hold ${evidence.supportHoldProbability}% · Support-fail ${evidence.supportFailureProbability}% · Resist-break ${evidence.resistanceBreakProbability}% · Resist-reject ${evidence.resistanceRejectionProbability}%.`;
}

function consensusNote(committee: CommitteeMember[], rec: RecommendationLabel): string {
  const agree = committee.filter((c) => {
    const s = chartStanceFromRecommendation(c.recommendation);
    const t = chartStanceFromRecommendation(rec);
    if (t === 'neutral') return c.recommendation === 'HOLD' || c.recommendation === 'REDUCE';
    return s === t || (t === 'bull' && c.recommendation === 'HOLD' && c.score >= 55);
  }).length;
  return `Consensus from AI Investment Committee (${agree}/${committee.length} aligned or non-blocking). Weights: Tech 20% · Fund 25% · Whale 20% · Risk 15% · Mom 10% · Sent 10%.`;
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
  // Position-aware: no contradictory action labels for non-owners
  if (!out.userHasPosition) {
    if (['ADD POSITION', 'TAKE PROFIT', 'REDUCE', 'EXIT', 'STOP LOSS'].includes(out.currentAction.action)) {
      return false;
    }
    if (out.visibleZoneKeys.includes('add') || out.visibleZoneKeys.includes('takeProfit')) return false;
    if (out.visibleZoneKeys.includes('reduce') || out.visibleZoneKeys.includes('exit')) return false;
  } else if (out.currentAction.action === 'BUY' || out.currentAction.action === 'WAIT') {
    return false;
  } else if (out.visibleZoneKeys.includes('buy')) {
    return false;
  }
  // Hard rule: BUY ZONE and ADD POSITION must never both be active
  if (out.visibleZoneKeys.includes('buy') && out.visibleZoneKeys.includes('add')) return false;
  return true;
}

function decideRecommendation(evidence: EvidenceBag, rawReturn: number): RecommendationLabel {
  const fromReturn = recommendationFromReturn(rawReturn);
  const fromCommittee = recFromScore(evidence.scores.overall);

  // Blend return-implied and committee-implied, then gate
  let candidate = fromReturn;
  if (chartStanceFromRecommendation(fromReturn) !== chartStanceFromRecommendation(fromCommittee)) {
    // Prefer committee overall when conflict — transparency over return chase
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

  if ((candidate === 'BUY' || candidate === 'STRONG BUY') && !evidence.buyGatePass) {
    if (evidence.netWeight > 0.05) return 'HOLD';
    if (evidence.netWeight < -0.05) return evidence.sellGatePass ? 'REDUCE' : 'HOLD';
    return 'HOLD';
  }

  if ((candidate === 'SELL' || candidate === 'AVOID NEW POSITION') && !evidence.sellGatePass) {
    if (evidence.netWeight < -0.2) return 'REDUCE';
    return 'HOLD';
  }

  if (candidate === 'BUY' && evidence.netWeight > 0.55 && evidence.buyGatePass && evidence.scores.overall >= 85) {
    return 'STRONG BUY';
  }
  if (candidate === 'SELL' && evidence.netWeight < -0.55 && evidence.sellGatePass) {
    return evidence.scores.overall < 35 ? 'AVOID NEW POSITION' : 'SELL';
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
        target = round2(px * (1 + expectedReturn / 100));
      }
    }
    expectedReturn = round2(((target - px) / px) * 100);

    let rec = decideRecommendation(evidence, expectedReturn);

    if ((rec === 'BUY' || rec === 'STRONG BUY') && expectedReturn < 3) {
      expectedReturn = round2(clamp(Math.max(3.2, Math.abs(expectedReturn) || 5), 3.2, 18));
      target = round2(px * (1 + expectedReturn / 100));
    }
    if ((rec === 'SELL' || rec === 'AVOID NEW POSITION') && expectedReturn > -3) {
      expectedReturn = round2(-clamp(Math.max(3.2, Math.abs(expectedReturn) || 6), 3.2, 22));
      target = round2(px * (1 + expectedReturn / 100));
    }
    if (rec === 'HOLD') {
      expectedReturn = round2(clamp(expectedReturn, -2.9, 2.9));
      target = round2(px * (1 + expectedReturn / 100));
    }
    if (rec === 'REDUCE' && expectedReturn > -3) {
      expectedReturn = round2(-clamp(Math.max(3.5, Math.abs(expectedReturn) || 5), 3.5, 9.5));
      target = round2(px * (1 + expectedReturn / 100));
    }

    expectedReturn = round2(((target - px) / px) * 100);
    rec = decideRecommendation(evidence, expectedReturn);
    if ((rec === 'BUY' || rec === 'STRONG BUY') && !evidence.buyGatePass) rec = 'HOLD';
    if ((rec === 'SELL' || rec === 'AVOID NEW POSITION') && !evidence.sellGatePass) {
      rec = evidence.netWeight < -0.2 ? 'REDUCE' : 'HOLD';
      if (rec === 'HOLD') {
        expectedReturn = round2(clamp(expectedReturn, -2.9, 2.9));
        target = round2(px * (1 + expectedReturn / 100));
      }
    }

    // Positive R/R gate for BUY
    if ((rec === 'BUY' || rec === 'STRONG BUY') && expectedReturn <= 0) {
      rec = 'HOLD';
      expectedReturn = round2(clamp(expectedReturn, -2.9, 2.9));
      target = round2(px * (1 + expectedReturn / 100));
    }

    const score = scoreFromRecommendation(rec, expectedReturn, evidence.netWeight * 10);
    const baseConf =
      input.baseConfidence != null && Number.isFinite(input.baseConfidence) ? input.baseConfidence : 62;
    const decisive = Math.abs(evidence.bullishScore - evidence.bearishScore) / 100;
    const confidence = Math.round(
      clamp(
        baseConf * 0.2 +
          Math.abs(evidence.netWeight) * 40 +
          evidence.scores.overall * 0.28 +
          (evidence.buyGatePass || evidence.sellGatePass ? 8 : 0) +
          decisive * 12,
        38,
        94
      )
    );

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
    const buyZones = buildBuyZones123(
      px,
      zones.buyZone,
      input.technicalBreakdown,
      target
    );
    // Preferred envelope = Buy Zone 1; HOLD starts above all BZ1–3 (no chase)
    const z1 = buyZones.find((z) => z.level === 1) ?? buyZones[0];
    const envelopeHi = Math.max(...buyZones.map((z) => Math.max(z.lo, z.hi)));
    const envelopeLo = Math.min(...buyZones.map((z) => Math.min(z.lo, z.hi)));
    const eps = Math.max(px * 0.0008, 0.01);
    if (z1 && buyZones.length >= 1) {
      const holdLo = envelopeHi + eps;
      zones = {
        ...zones,
        buyZone: { lo: z1.lo, hi: z1.hi },
        holdZone: {
          lo: round2(holdLo),
          hi: round2(Math.max(holdLo + px * 0.012, zones.holdZone.hi, zones.takeProfitZone.lo - eps)),
        },
        stopLoss:
          zones.stopLoss < envelopeLo - eps * 0.5
            ? zones.stopLoss
            : round2(envelopeLo - Math.max(eps, px * 0.01)),
      };
    }
    const zonesConsistent = zonesAreConsistent(zones);
    const targets = buildTargets(px, target, rec, input.levels);
    const userHasPosition = !!input.userHasPosition;
    const currentAction = resolveLiveAction(px, zones, buyZones, rec, userHasPosition, confidence, {
      score: evidence.scores.overall,
      rsi: input.technical?.rsi ?? null,
      macdBullish: input.technical?.macdBullish ?? null,
      trend: input.technical?.trend ?? null,
    });
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

    const whyWins = buildWhyWins(rec, evidence);
    const rejectedOpposite = buildRejectedOpposite(rec, evidence);
    const suggestedAction = positionAwareSuggestedAction(rec, currentAction, userHasPosition, evidence);
    const note = consensusNote(evidence.committee, rec);
    const explainedSignals = positionAwareSignals(evidence.explainedSignals, userHasPosition);
    const actionLabel = currentAction.displayLabel || currentAction.action;
    const summaryLead = `Horizon recommendation: ${rec} (${confidence}% confidence). Do now: ${actionLabel}. Expected return ${expectedReturn >= 0 ? '+' : ''}${expectedReturn.toFixed(1)}%. ${whyWins}`;

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
      summaryLead,
      explanation: `Consensus process for ${horizonLabel}: committee votes weighed, conflicts shown, gates enforced, zones non-overlapping. Live action = ${actionLabel}. ${note}`,
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
