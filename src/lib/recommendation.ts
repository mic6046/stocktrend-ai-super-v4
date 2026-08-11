/**
 * Stock Recommendation — SINGLE SOURCE OF TRUTH.
 * Built only from AI Quantum Score (runQuantumRecommendationEngine).
 * No module may invent BUY/HOLD/SELL, score, confidence, ER, or ranking independently.
 */

import type { HorizonKey } from '../components/analysis/analysisTheme';
import {
  runQuantumRecommendationEngine,
  type ComponentScores,
  type EngineZoneBand,
  type LiveActionBrief,
  type QuantumEngineInput,
  type QuantumEngineOutput,
  type RecommendationLabel,
  type ZoneAction,
} from './quantumRecommendationEngine';

/** Canonical recommendation object consumed by every screen. */
export type StockRecommendation = {
  ticker: string;
  companyName: string;
  overallScore: number;
  confidence: number;
  recommendation: RecommendationLabel;
  currentAction: ZoneAction;
  currentActionReason: string;
  entryZone: EngineZoneBand;
  targetPrice: number;
  stopLoss: number;
  expectedReturn: number;
  riskScore: number;
  riskLabel: string;
  aiExplanation: string;
  indicatorScores: ComponentScores;
  /** Rank among a scout set (1 = best). 0 if unset. */
  ranking: number;
  dataTimestamp: number;
  /** True when Quantum Score is BUY or STRONG BUY (independent of live WAIT/HOLD action). */
  isBuyCandidate: boolean;
  /** Full engine payload for panels that need zones / committee / factors. Absent on scout errors. */
  engine: QuantumEngineOutput | null;
  error?: string;
};

export type DisplayRecommendationSlice = {
  recommendation?: string | null;
  score?: number | null;
  confidence?: number | null;
  expectedReturn?: number | null;
  currentAction?: string | null;
  explanation?: string | null;
};

/** BUY / STRONG BUY from Quantum Score only — never remapped by callers. */
export function isQuantumBuy(rec: RecommendationLabel): boolean {
  return rec === 'BUY' || rec === 'STRONG BUY';
}

/**
 * User-facing stance line.
 * Prefer precise buy-zone displayLabel when live action is WAIT/HOLD —
 * never invent "outside BUY zone" copy that contradicts location SSOT.
 */
export function formatRecommendationDisplay(rec: StockRecommendation): string {
  const label = rec.recommendation;
  const display = rec.engine?.currentAction?.displayLabel;
  if (isQuantumBuy(label) && (rec.currentAction === 'WAIT' || rec.currentAction === 'HOLD')) {
    if (display) return `${label} · ${display}`;
    return `${label} · WAIT — WAIT FOR BUY ZONE`;
  }
  return label;
}

export function formatActionNote(rec: StockRecommendation): string {
  const display = rec.engine?.currentAction?.displayLabel;
  if (display) return display;
  if (isQuantumBuy(rec.recommendation) && (rec.currentAction === 'WAIT' || rec.currentAction === 'HOLD')) {
    return 'WAIT — WAIT FOR BUY ZONE';
  }
  return `Do now: ${rec.currentAction}`;
}

/** Build SSOT object from one Quantum Score evaluation. */
export function toStockRecommendation(
  engine: QuantumEngineOutput,
  meta: { ticker: string; companyName?: string; dataTimestamp?: number; ranking?: number }
): StockRecommendation {
  const recommendation = engine.finalVerdict;
  return {
    ticker: String(meta.ticker || '').toUpperCase() || '—',
    companyName: meta.companyName || String(meta.ticker || '').toUpperCase(),
    overallScore: engine.score,
    confidence: engine.confidence,
    recommendation,
    currentAction: engine.currentAction.action,
    currentActionReason: engine.currentAction.reason,
    entryZone: engine.entryZone,
    targetPrice: engine.targetPrice,
    stopLoss: engine.stopLoss,
    expectedReturn: engine.expectedReturn,
    riskScore: engine.riskScore,
    riskLabel: engine.riskLabel,
    aiExplanation: engine.whyWins || engine.explanation,
    indicatorScores: engine.componentScores,
    ranking: meta.ranking ?? 0,
    dataTimestamp: meta.dataTimestamp ?? Date.now(),
    isBuyCandidate: isQuantumBuy(recommendation),
    engine,
  };
}

/** Evaluate a stock once via AI Quantum Score → StockRecommendation. */
export function evaluateStockRecommendation(
  input: QuantumEngineInput,
  meta: { ticker: string; companyName?: string; dataTimestamp?: number }
): StockRecommendation {
  const engine = runQuantumRecommendationEngine({
    ...input,
    ticker: meta.ticker || input.ticker,
  });
  return toStockRecommendation(engine, meta);
}

/**
 * Rank recommendations by Quantum Overall Score only (confidence as tiebreaker).
 * Mutates ranking field 1..n for the sorted order of the full list.
 */
export function rankByQuantumScore(recs: StockRecommendation[]): StockRecommendation[] {
  const sorted = [...recs].sort((a, b) => {
    if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.ticker.localeCompare(b.ticker);
  });
  return sorted.map((r, i) => ({ ...r, ranking: i + 1 }));
}

/** Buy candidates = Quantum BUY / STRONG BUY only, already ranked by score. */
export function selectBuyCandidates(ranked: StockRecommendation[]): StockRecommendation[] {
  return ranked.filter((r) => r.isBuyCandidate);
}

/**
 * Validate that a UI slice matches the SSOT Recommendation.
 * Logs "Recommendation mismatch detected." on any disagreement.
 */
export function assertMatchesQuantumRecommendation(
  source: StockRecommendation,
  displayed: DisplayRecommendationSlice,
  moduleName: string
): boolean {
  const mismatches: string[] = [];
  const norm = (s: string | null | undefined) =>
    String(s || '')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();

  if (displayed.recommendation != null) {
    const d = norm(displayed.recommendation);
    const expected = norm(source.recommendation);
    const waitForm = norm(formatRecommendationDisplay(source));
    // Allow either raw label or "BUY - WAIT..." display form
    if (d && d !== expected && d !== waitForm && !d.startsWith(expected)) {
      mismatches.push(`recommendation displayed="${displayed.recommendation}" expected="${source.recommendation}"`);
    }
  }
  if (displayed.score != null && Number.isFinite(displayed.score) && Math.abs(Number(displayed.score) - source.overallScore) > 0.51) {
    mismatches.push(`score displayed=${displayed.score} expected=${source.overallScore}`);
  }
  if (
    displayed.confidence != null &&
    Number.isFinite(displayed.confidence) &&
    Math.abs(Number(displayed.confidence) - source.confidence) > 0.51
  ) {
    mismatches.push(`confidence displayed=${displayed.confidence} expected=${source.confidence}`);
  }
  if (
    displayed.expectedReturn != null &&
    Number.isFinite(displayed.expectedReturn) &&
    Math.abs(Number(displayed.expectedReturn) - source.expectedReturn) > 0.15
  ) {
    mismatches.push(
      `expectedReturn displayed=${displayed.expectedReturn} expected=${source.expectedReturn}`
    );
  }
  if (displayed.currentAction != null) {
    const d = norm(displayed.currentAction);
    const expected = norm(source.currentAction);
    if (d && d !== expected && !d.includes(expected)) {
      mismatches.push(`currentAction displayed="${displayed.currentAction}" expected="${source.currentAction}"`);
    }
  }

  if (mismatches.length) {
    console.error('Recommendation mismatch detected.', {
      module: moduleName,
      ticker: source.ticker,
      quantum: {
        recommendation: source.recommendation,
        score: source.overallScore,
        confidence: source.confidence,
        expectedReturn: source.expectedReturn,
        currentAction: source.currentAction,
      },
      displayed,
      mismatches,
    });
    return false;
  }
  return true;
}

export type { HorizonKey, QuantumEngineInput, QuantumEngineOutput, RecommendationLabel, ZoneAction, LiveActionBrief };
