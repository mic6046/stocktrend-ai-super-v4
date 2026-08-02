/**
 * QuantumNode Recommendation Change Log Engine
 * Transparent history of every recommendation change — always explains WHY.
 */

import type { HorizonKey } from '../components/analysis/analysisTheme';
import type {
  ComponentScores,
  QuantumEngineOutput,
  RecommendationLabel,
  RiskLevel,
} from './quantumRecommendationEngine';

export type ChangeLogRecommendation =
  | 'STRONG BUY'
  | 'BUY'
  | 'ACCUMULATE'
  | 'HOLD'
  | 'TAKE PARTIAL PROFIT'
  | 'REDUCE POSITION'
  | 'EXIT POSITION'
  | 'AVOID NEW POSITION';

export type ChangeDirection = 'upgrade' | 'mild_downgrade' | 'major_downgrade' | 'neutral' | 'no_change';

export type RecommendationSnapshot = {
  ticker: string;
  horizon: HorizonKey;
  horizonLabel: string;
  recommendation: ChangeLogRecommendation;
  confidence: number;
  expectedReturn: number;
  risk: RiskLevel;
  bullishFactors: string[];
  bearishFactors: string[];
  neutralFactors: string[];
  scores: ComponentScores;
  supportHoldProbability: number;
  supportFailureProbability: number;
  resistanceBreakProbability: number;
  currentAction: string;
  suggestedAction: string;
  timestamp: number;
};

export type RecommendationChangeEntry = {
  id: string;
  timestamp: number;
  ticker: string;
  horizon: HorizonKey;
  horizonLabel: string;
  oldRecommendation: ChangeLogRecommendation;
  newRecommendation: ChangeLogRecommendation;
  confidenceBefore: number;
  confidenceAfter: number;
  expectedReturnBefore: number;
  expectedReturnAfter: number;
  riskBefore: RiskLevel;
  riskAfter: RiskLevel;
  direction: ChangeDirection;
  whatChanged: string;
  whyChanged: string;
  primaryReason: string;
  secondaryReasons: string[];
  unchangedFactors: string[];
  greatestInfluence: string;
  riskImpact: string;
  expectedReturnImpact: string;
  confidenceImpact: string;
  suggestedAction: string;
  triggeredIndicators: string[];
};

export type ChangeLogState = {
  lastSnapshot: RecommendationSnapshot | null;
  history: RecommendationChangeEntry[];
  latestStatus: RecommendationChangeEntry | null;
};

const MAX_HISTORY = 20;
const STORAGE_PREFIX = 'qn-reclog-v1';

const RANK: Record<ChangeLogRecommendation, number> = {
  'STRONG BUY': 8,
  BUY: 7,
  ACCUMULATE: 6,
  HOLD: 5,
  'TAKE PARTIAL PROFIT': 4,
  'REDUCE POSITION': 3,
  'EXIT POSITION': 2,
  'AVOID NEW POSITION': 1,
};

function storageKey(ticker: string, horizon: HorizonKey) {
  return `${STORAGE_PREFIX}:${ticker.toUpperCase()}:${horizon}`;
}

/** Map engine stance + live action into change-log vocabulary */
export function mapToChangeLogRecommendation(out: QuantumEngineOutput): ChangeLogRecommendation {
  const action = out.currentAction?.action;
  const suggested = out.suggestedAction;
  const rec = out.ratingLabel;

  if (action === 'AVOID NEW POSITION' || rec === 'AVOID NEW POSITION') return 'AVOID NEW POSITION';
  if (action === 'EXIT' || action === 'STOP LOSS' || rec === 'SELL') return 'EXIT POSITION';
  if (action === 'REDUCE' || rec === 'REDUCE') return 'REDUCE POSITION';
  if (action === 'TAKE PROFIT' || suggested === 'Take Partial Profit') return 'TAKE PARTIAL PROFIT';
  if (action === 'ADD POSITION' || suggested === 'Accumulate') return 'ACCUMULATE';
  if (rec === 'STRONG BUY') return 'STRONG BUY';
  if (rec === 'BUY' || action === 'BUY') return 'BUY';
  return 'HOLD';
}

export function snapshotFromEngine(
  out: QuantumEngineOutput,
  ticker: string
): RecommendationSnapshot {
  return {
    ticker: ticker.toUpperCase(),
    horizon: out.horizon,
    horizonLabel: out.horizonLabel,
    recommendation: mapToChangeLogRecommendation(out),
    confidence: out.confidence,
    expectedReturn: out.expectedReturn,
    risk: out.riskLevel,
    bullishFactors: out.bullishFactors.map((f) => f.label).slice(0, 8),
    bearishFactors: out.bearishFactors.map((f) => f.label).slice(0, 8),
    neutralFactors: out.neutralFactors.map((f) => f.label).slice(0, 6),
    scores: { ...out.componentScores },
    supportHoldProbability: out.supportHoldProbability,
    supportFailureProbability: out.supportFailureProbability,
    resistanceBreakProbability: out.resistanceBreakProbability,
    currentAction: out.currentAction.action,
    suggestedAction: out.suggestedAction,
    timestamp: Date.now(),
  };
}

function directionOf(
  oldRec: ChangeLogRecommendation,
  newRec: ChangeLogRecommendation
): ChangeDirection {
  if (oldRec === newRec) return 'no_change';
  const delta = RANK[newRec] - RANK[oldRec];
  if (delta >= 2) return 'upgrade';
  if (delta === 1) return 'upgrade';
  if (delta === -1) return 'mild_downgrade';
  if (delta <= -2) return 'major_downgrade';
  return 'neutral';
}

function fmtPct(n: number) {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function scoreDeltas(prev: RecommendationSnapshot, next: RecommendationSnapshot) {
  const keys: (keyof ComponentScores)[] = [
    'technical',
    'fundamental',
    'whale',
    'news',
    'risk',
    'momentum',
    'overall',
  ];
  return keys
    .map((k) => ({
      key: k,
      label:
        k === 'news'
          ? 'Sentiment'
          : k === 'overall'
            ? 'Overall AI Score'
            : k.charAt(0).toUpperCase() + k.slice(1),
      before: prev.scores[k],
      after: next.scores[k],
      delta: next.scores[k] - prev.scores[k],
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function factorDiff(prev: string[], next: string[]) {
  const p = new Set(prev);
  const n = new Set(next);
  const added = next.filter((x) => !p.has(x));
  const removed = prev.filter((x) => !n.has(x));
  const unchanged = next.filter((x) => p.has(x));
  return { added, removed, unchanged };
}

function buildNoChangeEntry(
  snap: RecommendationSnapshot,
  prev: RecommendationSnapshot | null
): RecommendationChangeEntry {
  const confDelta = prev ? Math.abs(snap.confidence - prev.confidence) : 0;
  return {
    id: `nc-${snap.ticker}-${snap.horizon}-${snap.timestamp}`,
    timestamp: snap.timestamp,
    ticker: snap.ticker,
    horizon: snap.horizon,
    horizonLabel: snap.horizonLabel,
    oldRecommendation: snap.recommendation,
    newRecommendation: snap.recommendation,
    confidenceBefore: prev?.confidence ?? snap.confidence,
    confidenceAfter: snap.confidence,
    expectedReturnBefore: prev?.expectedReturn ?? snap.expectedReturn,
    expectedReturnAfter: snap.expectedReturn,
    riskBefore: prev?.risk ?? snap.risk,
    riskAfter: snap.risk,
    direction: 'no_change',
    whatChanged: 'No material change in the investment recommendation.',
    whyChanged:
      'Market conditions remain consistent with the prior stance for this Investment Horizon.',
    primaryReason: 'No Recommendation Change',
    secondaryReasons: [
      'Market conditions remain consistent.',
      confDelta < 3
        ? 'Confidence changed by less than 3%.'
        : `Confidence moved ${confDelta.toFixed(0)} pts but stance unchanged.`,
      'No major technical or fundamental events forced a new stance.',
    ],
    unchangedFactors: [...snap.bullishFactors.slice(0, 3), ...snap.bearishFactors.slice(0, 2)],
    greatestInfluence: 'Stable multi-factor consensus',
    riskImpact: prev && prev.risk !== snap.risk ? `${prev.risk} → ${snap.risk}` : 'Unchanged',
    expectedReturnImpact:
      prev && Math.abs(prev.expectedReturn - snap.expectedReturn) >= 0.3
        ? `${fmtPct(prev.expectedReturn)} → ${fmtPct(snap.expectedReturn)}`
        : 'Unchanged / immaterial',
    confidenceImpact:
      prev && Math.abs(prev.confidence - snap.confidence) >= 1
        ? `${prev.confidence}% → ${snap.confidence}%`
        : 'Stable',
    suggestedAction: snap.suggestedAction,
    triggeredIndicators: [],
  };
}

function buildChangeEntry(
  prev: RecommendationSnapshot,
  next: RecommendationSnapshot
): RecommendationChangeEntry {
  const direction = directionOf(prev.recommendation, next.recommendation);
  const deltas = scoreDeltas(prev, next);
  const top = deltas[0];
  const bull = factorDiff(prev.bullishFactors, next.bullishFactors);
  const bear = factorDiff(prev.bearishFactors, next.bearishFactors);

  const triggered: string[] = [];
  if (Math.abs((next.supportHoldProbability || 0) - (prev.supportHoldProbability || 0)) >= 8) {
    triggered.push(
      `Support holding probability ${prev.supportHoldProbability}% → ${next.supportHoldProbability}%`
    );
  }
  if (Math.abs((next.resistanceBreakProbability || 0) - (prev.resistanceBreakProbability || 0)) >= 8) {
    triggered.push(
      `Resistance break probability ${prev.resistanceBreakProbability}% → ${next.resistanceBreakProbability}%`
    );
  }
  for (const d of deltas.slice(0, 3)) {
    if (Math.abs(d.delta) >= 4) {
      triggered.push(`${d.label} score ${d.before} → ${d.after}`);
    }
  }
  for (const a of bull.added.slice(0, 3)) triggered.push(`New bullish factor: ${a}`);
  for (const a of bear.added.slice(0, 3)) triggered.push(`New bearish factor: ${a}`);
  for (const r of bull.removed.slice(0, 2)) triggered.push(`Bullish factor faded: ${r}`);
  for (const r of bear.removed.slice(0, 2)) triggered.push(`Bearish factor faded: ${r}`);

  if (!triggered.length) {
    triggered.push(
      `Consensus stance shifted from ${prev.recommendation} to ${next.recommendation} on ${next.horizonLabel}`
    );
  }

  const secondary = [
    ...triggered.slice(1, 5),
    ...bull.unchanged.slice(0, 2).map((f) => `Still constructive: ${f}`),
    ...bear.unchanged.slice(0, 2).map((f) => `Still cautionary: ${f}`),
  ].slice(0, 6);

  const confDelta = next.confidence - prev.confidence;
  const erDelta = next.expectedReturn - prev.expectedReturn;

  const primaryReason = triggered[0];
  const whatChanged = `Recommendation moved from ${prev.recommendation} to ${next.recommendation} on the ${next.horizonLabel} horizon.`;
  const whyChanged = [
    primaryReason,
    top && Math.abs(top.delta) >= 3
      ? `Greatest score influence: ${top.label} (${top.before} → ${top.after}).`
      : null,
    next.risk !== prev.risk ? `Risk profile shifted ${prev.risk} → ${next.risk}.` : null,
    Math.abs(erDelta) >= 0.5
      ? `Expected return moved ${fmtPct(prev.expectedReturn)} → ${fmtPct(next.expectedReturn)}.`
      : null,
  ]
    .filter(Boolean)
    .join(' ');

  let suggestedAction = next.suggestedAction;
  if (direction === 'upgrade') {
    suggestedAction =
      next.recommendation === 'STRONG BUY' || next.recommendation === 'BUY'
        ? 'Consider initiating or adding on weakness within the BUY zone.'
        : next.suggestedAction;
  } else if (direction === 'mild_downgrade') {
    suggestedAction =
      next.recommendation === 'HOLD' || next.recommendation === 'TAKE PARTIAL PROFIT'
        ? 'Continue holding core exposure. Do not open aggressive new positions until another buy signal appears.'
        : next.suggestedAction;
  } else if (direction === 'major_downgrade') {
    suggestedAction =
      next.recommendation === 'REDUCE POSITION' || next.recommendation === 'EXIT POSITION'
        ? 'Reduce exposure and respect stop / invalidation levels.'
        : next.suggestedAction;
  }

  return {
    id: `chg-${next.ticker}-${next.horizon}-${next.timestamp}-${prev.recommendation}-${next.recommendation}`,
    timestamp: next.timestamp,
    ticker: next.ticker,
    horizon: next.horizon,
    horizonLabel: next.horizonLabel,
    oldRecommendation: prev.recommendation,
    newRecommendation: next.recommendation,
    confidenceBefore: prev.confidence,
    confidenceAfter: next.confidence,
    expectedReturnBefore: prev.expectedReturn,
    expectedReturnAfter: next.expectedReturn,
    riskBefore: prev.risk,
    riskAfter: next.risk,
    direction,
    whatChanged,
    whyChanged,
    primaryReason,
    secondaryReasons: secondary,
    unchangedFactors: [...bull.unchanged, ...bear.unchanged].slice(0, 6),
    greatestInfluence: top
      ? `${top.label} (${top.delta >= 0 ? '+' : ''}${top.delta.toFixed(0)} pts)`
      : 'Multi-factor consensus shift',
    riskImpact:
      prev.risk === next.risk ? `Risk steady at ${next.risk}` : `${prev.risk} → ${next.risk}`,
    expectedReturnImpact: `${fmtPct(prev.expectedReturn)} → ${fmtPct(next.expectedReturn)} (${erDelta >= 0 ? '+' : ''}${erDelta.toFixed(1)} pts)`,
    confidenceImpact: `${prev.confidence}% → ${next.confidence}% (${confDelta >= 0 ? '+' : ''}${confDelta} pts)`,
    suggestedAction,
    triggeredIndicators: triggered,
  };
}

export function shouldRecordHistoryChange(
  prev: RecommendationSnapshot,
  next: RecommendationSnapshot
): boolean {
  if (prev.recommendation !== next.recommendation) return true;
  if (prev.risk !== next.risk) return true;
  if (Math.abs(prev.confidence - next.confidence) >= 3) return true;
  if (Math.abs(prev.expectedReturn - next.expectedReturn) >= 1.5) return true;
  return false;
}

export function loadChangeLog(ticker: string, horizon: HorizonKey): ChangeLogState {
  try {
    const raw = localStorage.getItem(storageKey(ticker, horizon));
    if (!raw) return { lastSnapshot: null, history: [], latestStatus: null };
    const parsed = JSON.parse(raw) as ChangeLogState;
    return {
      lastSnapshot: parsed.lastSnapshot ?? null,
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, MAX_HISTORY) : [],
      latestStatus: parsed.latestStatus ?? null,
    };
  } catch {
    return { lastSnapshot: null, history: [], latestStatus: null };
  }
}

export function saveChangeLog(ticker: string, horizon: HorizonKey, state: ChangeLogState) {
  try {
    localStorage.setItem(
      storageKey(ticker, horizon),
      JSON.stringify({
        lastSnapshot: state.lastSnapshot,
        history: state.history.slice(0, MAX_HISTORY),
        latestStatus: state.latestStatus,
      })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Ingest a new engine output. Returns updated state + whether a history row was appended.
 */
export function ingestRecommendationSnapshot(
  out: QuantumEngineOutput,
  ticker: string,
  prior?: ChangeLogState | null
): { state: ChangeLogState; recordedHistory: boolean } {
  const next = snapshotFromEngine(out, ticker);
  const existing = prior ?? loadChangeLog(ticker, out.horizon);
  const prev = existing.lastSnapshot;

  if (!prev || prev.ticker !== next.ticker || prev.horizon !== next.horizon) {
    const status = buildNoChangeEntry(next, null);
    const state: ChangeLogState = {
      lastSnapshot: next,
      history: existing.history.filter((h) => h.ticker === next.ticker && h.horizon === next.horizon),
      latestStatus: status,
    };
    saveChangeLog(ticker, out.horizon, state);
    return { state, recordedHistory: false };
  }

  // Debounce identical spam within 30s with no material move
  const ageMs = next.timestamp - prev.timestamp;
  if (
    ageMs < 30_000 &&
    prev.recommendation === next.recommendation &&
    Math.abs(prev.confidence - next.confidence) < 1 &&
    prev.risk === next.risk
  ) {
    const status = buildNoChangeEntry(next, prev);
    const state: ChangeLogState = { ...existing, lastSnapshot: next, latestStatus: status };
    saveChangeLog(ticker, out.horizon, state);
    return { state, recordedHistory: false };
  }

  // Same recommendation → status card only (never hide; always explain)
  if (prev.recommendation === next.recommendation) {
    const status = buildNoChangeEntry(next, prev);
    const state: ChangeLogState = { ...existing, lastSnapshot: next, latestStatus: status };
    saveChangeLog(ticker, out.horizon, state);
    return { state, recordedHistory: false };
  }

  // Recommendation changed — always log WHY
  const entry = buildChangeEntry(prev, next);
  const history = [entry, ...existing.history].slice(0, MAX_HISTORY);
  const state: ChangeLogState = {
    lastSnapshot: next,
    history,
    latestStatus: entry,
  };
  saveChangeLog(ticker, out.horizon, state);
  return { state, recordedHistory: true };
}

export function confidenceTrend(history: RecommendationChangeEntry[], latestConfidence: number): number[] {
  const fromHistory = [...history]
    .reverse()
    .map((h) => h.confidenceAfter)
    .slice(-8);
  if (!fromHistory.length) return [latestConfidence];
  if (fromHistory[fromHistory.length - 1] !== latestConfidence) fromHistory.push(latestConfidence);
  return fromHistory.slice(-8);
}

export function directionMeta(direction: ChangeDirection): {
  arrow: string;
  label: string;
  tone: 'upgrade' | 'neutral' | 'mild' | 'major' | 'none';
} {
  switch (direction) {
    case 'upgrade':
      return { arrow: '↑', label: 'Upgrade', tone: 'upgrade' };
    case 'mild_downgrade':
      return { arrow: '↓', label: 'Mild Downgrade', tone: 'mild' };
    case 'major_downgrade':
      return { arrow: '↓', label: 'Major Downgrade', tone: 'major' };
    case 'no_change':
      return { arrow: '→', label: 'No Change', tone: 'none' };
    default:
      return { arrow: '→', label: 'Neutral', tone: 'neutral' };
  }
}

/** Pure helper for tests — compare two snapshots without storage */
export function explainRecommendationChange(
  prev: RecommendationSnapshot,
  next: RecommendationSnapshot
): RecommendationChangeEntry {
  if (prev.recommendation === next.recommendation) return buildNoChangeEntry(next, prev);
  return buildChangeEntry(prev, next);
}

// Re-export unused import guard for RecommendationLabel if needed by callers
export type { RecommendationLabel };
