import { apiUrl, loggedFetch } from './api';
import type { HorizonKey } from '../components/analysis/analysisTheme';
import type { RecommendationLabel } from './quantumRecommendationEngine';

export type OutcomeEngine = 'quantum' | 'suggest' | 'dayTrade';

export type RecommendationSnapshot = {
  ticker: string;
  engine: OutcomeEngine;
  horizon: HorizonKey;
  action: RecommendationLabel | string;
  confidence: number;
  entryPrice: number;
  targetPrice: number;
  expectedReturn: number;
};

// One log attempt per (ticker, engine, horizon) per browser session — the
// server also dedupes per calendar day, this just avoids firing the request
// again on every re-render (horizon toggle, background refresh, etc).
const loggedThisSession = new Set<string>();

export function logRecommendationOutcome(snap: RecommendationSnapshot): void {
  if (!snap.ticker || !Number.isFinite(snap.entryPrice) || snap.entryPrice <= 0) return;
  const key = `${snap.engine}|${snap.ticker}|${snap.horizon}`;
  if (loggedThisSession.has(key)) return;
  loggedThisSession.add(key);

  loggedFetch(apiUrl('/api/log-recommendation'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snap),
    __qnMeta: { reason: 'recommendation-outcome-log', userAction: 'background' },
  }).catch(() => {
    // Best-effort telemetry — never surface a failure to the user.
    loggedThisSession.delete(key);
  });
}
