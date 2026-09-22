/**
 * Pullback-Buy-on-RECLAIM evaluator.
 *
 * This is deliberately NOT the same thing as the engine's existing
 * "PULLBACK BUY" setupTag (quantumRecommendationEngine.ts's
 * pullbackToSupportInUptrend + strongAccumulation), which is anticipatory —
 * it fires as soon as price is near support in an uptrend, before any
 * confirmation that the pullback has actually stopped falling.
 *
 * This module is confirmatory: it waits for the pullback's low to form, then
 * requires price to have RECLAIMED the short-term MA cluster (MA5/10/30)
 * with 2+ consecutive closes and volume expansion — the setup is only
 * "actionable" once stabilization is confirmed, trading a slightly worse
 * entry price for a much lower false-positive rate.
 *
 * USER RULE (the single most important guardrail here): a lone close back
 * above the MA cluster is NEVER enough on its own — it must hold for a
 * second consecutive close before the reclaim trigger can PASS.
 */

export type DailyBar = { date: Date | string | number; open: number; high: number; low: number; close: number; volume: number };

export type CriterionResult = 'PASS' | 'PARTIAL' | 'FAIL' | 'NOT_YET_AVAILABLE';

export type ReclaimStatus = 'Not yet attempted' | 'Unconfirmed (1 close)' | 'Confirmed (2+ closes)' | 'Failed';

export type Verdict = 'Actionable' | 'Wait for confirmation' | 'Invalidated' | 'Developing';

export type PullbackReclaimEvaluation = {
  criteria: {
    priorTrend: CriterionResult;
    pullbackIdentified: CriterionResult;
    higherLow: CriterionResult;
    reclaimTrigger: CriterionResult;
    volumeConfirmation: CriterionResult;
    momentumConfirmation: CriterionResult;
  };
  reclaimStatus: ReclaimStatus;
  reclaimCloseStreak: number;
  score: number;
  adjustedMax: number;
  verdict: Verdict;
  swingLow: number;
  swingHigh: number;
  pullbackLow: number;
  currentClose: number;
  maCluster: { ma5: number | null; ma10: number | null; ma30: number | null };
  entryLogic: string;
  invalidationLevel: number;
  target: number;
  riskReward: number | null;
  eventRisk: { tradingDaysAway: number; withinHoldingWindow: boolean } | null;
};

const LOOKBACK_BARS = 60;
const MA_PERIODS = [5, 10, 30] as const;
const RSI_PERIOD = 14;
const VOLUME_EXPANSION_PASS = 1.2;
const VOLUME_EXPANSION_PARTIAL = 0.8;
const RALLY_PASS_PCT = 8;
const RALLY_PARTIAL_PCT = 3;
const PULLBACK_PASS_PCT = 3;
const PULLBACK_PARTIAL_PCT = 1;
/** Holding window assumed for the event-risk check — this setup targets a swing back to the prior high, not a long hold. */
const ASSUMED_HOLDING_TRADING_DAYS = 15;

function sma(closes: number[], uptoIdxInclusive: number, period: number): number | null {
  if (uptoIdxInclusive + 1 < period) return null;
  let sum = 0;
  for (let i = uptoIdxInclusive - period + 1; i <= uptoIdxInclusive; i++) sum += closes[i];
  return sum / period;
}

function rsiSeries(closes: number[], period = RSI_PERIOD): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function scoreOf(r: CriterionResult): number {
  return r === 'PASS' ? 1 : r === 'PARTIAL' ? 0.5 : 0;
}

function tradingDaysBetween(from: Date, to: Date): number {
  let days = 0;
  const cur = new Date(from);
  const dir = to > from ? 1 : -1;
  while (cur.toDateString() !== to.toDateString() && days < 3650) {
    cur.setDate(cur.getDate() + dir);
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) days += dir;
  }
  return days;
}

export function evaluatePullbackReclaim(historyIn: DailyBar[], opts?: { earningsDate?: Date }): PullbackReclaimEvaluation | null {
  const history = historyIn.filter((h) => h?.close != null && Number.isFinite(Number(h.close)));
  if (history.length < 20) return null;

  const window = history.slice(-LOOKBACK_BARS);
  const closes = window.map((h) => h.close);
  const volumes = window.map((h) => h.volume);
  const lastIdx = closes.length - 1;

  // --- Criterion 1 & swing points: find the prior high (excluding "now"). ---
  let highIdx = 0;
  for (let i = 0; i < lastIdx; i++) if (closes[i] >= closes[highIdx]) highIdx = i;

  const noPriorHigh = closes[highIdx] <= closes[lastIdx]; // price is at/above that "high" right now -> no pullback exists yet
  let swingLowIdx = 0;
  for (let i = 0; i <= highIdx; i++) if (closes[i] <= closes[swingLowIdx]) swingLowIdx = i;

  const swingLow = closes[swingLowIdx];
  const swingHigh = closes[highIdx];
  const rallyPct = swingLow > 0 ? ((swingHigh - swingLow) / swingLow) * 100 : 0;
  const priorTrend: CriterionResult = noPriorHigh
    ? 'FAIL'
    : rallyPct >= RALLY_PASS_PCT
      ? 'PASS'
      : rallyPct >= RALLY_PARTIAL_PCT
        ? 'PARTIAL'
        : 'FAIL';

  // --- Criterion 2: pullback identified (decline off the high). ---
  let pullbackLowIdx = highIdx;
  for (let i = highIdx; i <= lastIdx; i++) if (closes[i] <= closes[pullbackLowIdx]) pullbackLowIdx = i;
  const pullbackLow = closes[pullbackLowIdx];
  const declinePct = swingHigh > 0 ? ((swingHigh - pullbackLow) / swingHigh) * 100 : 0;
  const pullbackIdentified: CriterionResult = noPriorHigh
    ? 'FAIL'
    : declinePct >= PULLBACK_PASS_PCT
      ? 'PASS'
      : declinePct >= PULLBACK_PARTIAL_PCT
        ? 'PARTIAL'
        : 'FAIL';

  // --- Criterion 3: higher low check. ---
  const lowStillForming = pullbackLowIdx === lastIdx; // price is making a new low as of the latest bar
  const higherLow: CriterionResult = noPriorHigh
    ? 'FAIL'
    : lowStillForming
      ? 'NOT_YET_AVAILABLE'
      : pullbackLow > swingLow
        ? 'PASS'
        : 'FAIL';

  // --- Criterion 4: reclaim trigger (2+ consecutive closes above the MA cluster). ---
  let reclaimTrigger: CriterionResult = 'NOT_YET_AVAILABLE';
  let reclaimCloseStreak = 0;
  const ma5Last = sma(closes, lastIdx, MA_PERIODS[0]);
  const ma10Last = sma(closes, lastIdx, MA_PERIODS[1]);
  const ma30Last = sma(closes, lastIdx, MA_PERIODS[2]);

  if (!noPriorHigh && !lowStillForming) {
    for (let i = lastIdx; i > pullbackLowIdx; i--) {
      const m5 = sma(closes, i, MA_PERIODS[0]);
      const m10 = sma(closes, i, MA_PERIODS[1]);
      const m30 = sma(closes, i, MA_PERIODS[2]);
      const above = m5 != null && m10 != null && m30 != null && closes[i] > m5 && closes[i] > m10 && closes[i] > m30;
      if (!above) break;
      reclaimCloseStreak++;
    }
    reclaimTrigger = reclaimCloseStreak >= 2 ? 'PASS' : reclaimCloseStreak === 1 ? 'PARTIAL' : 'FAIL';
  }

  // --- Criterion 5: volume confirmation on the reclaim. ---
  let volumeConfirmation: CriterionResult = 'NOT_YET_AVAILABLE';
  if (reclaimTrigger !== 'NOT_YET_AVAILABLE') {
    const declineBars = volumes.slice(highIdx, pullbackLowIdx + 1);
    const declineAvgVol = declineBars.length ? declineBars.reduce((a, b) => a + b, 0) / declineBars.length : 0;
    const reclaimBarCount = Math.max(1, reclaimCloseStreak);
    const reclaimBars = volumes.slice(lastIdx - reclaimBarCount + 1, lastIdx + 1);
    const reclaimAvgVol = reclaimBars.length ? reclaimBars.reduce((a, b) => a + b, 0) / reclaimBars.length : 0;
    const ratio = declineAvgVol > 0 ? reclaimAvgVol / declineAvgVol : 0;
    volumeConfirmation = ratio >= VOLUME_EXPANSION_PASS ? 'PASS' : ratio >= VOLUME_EXPANSION_PARTIAL ? 'PARTIAL' : 'FAIL';
  }

  // --- Criterion 6: momentum confirmation (RSI turning up alongside the reclaim). ---
  let momentumConfirmation: CriterionResult = 'NOT_YET_AVAILABLE';
  if (reclaimTrigger !== 'NOT_YET_AVAILABLE') {
    const rsi = rsiSeries(closes);
    const rsiNow = rsi[lastIdx];
    const rsiAtLow = rsi[pullbackLowIdx];
    if (rsiNow == null || rsiAtLow == null) {
      momentumConfirmation = 'NOT_YET_AVAILABLE';
    } else {
      momentumConfirmation = rsiNow > rsiAtLow ? 'PASS' : 'FAIL';
    }
  }

  // --- Scoring. ---
  const determinate: CriterionResult[] = [priorTrend, pullbackIdentified, higherLow, reclaimTrigger, volumeConfirmation, momentumConfirmation].filter(
    (r) => r !== 'NOT_YET_AVAILABLE'
  );
  const adjustedMax = determinate.length;
  const score = determinate.reduce((sum, r) => sum + scoreOf(r), 0);
  const pct = adjustedMax > 0 ? (score / adjustedMax) * 100 : 0;

  const reclaimStatus: ReclaimStatus =
    reclaimTrigger === 'NOT_YET_AVAILABLE'
      ? 'Not yet attempted'
      : reclaimTrigger === 'PARTIAL'
        ? 'Unconfirmed (1 close)'
        : reclaimTrigger === 'PASS'
          ? 'Confirmed (2+ closes)'
          : 'Failed';

  let verdict: Verdict;
  if (higherLow === 'FAIL') verdict = 'Invalidated';
  else if (reclaimTrigger === 'NOT_YET_AVAILABLE') verdict = 'Developing';
  else if (reclaimTrigger === 'PARTIAL') verdict = 'Wait for confirmation';
  else if (reclaimTrigger === 'PASS' && pct >= 80) verdict = 'Actionable';
  else if (pct < 50) verdict = 'Invalidated';
  else verdict = 'Wait for confirmation';

  const clusterTop = ma5Last != null && ma10Last != null && ma30Last != null ? Math.max(ma5Last, ma10Last, ma30Last) : null;
  const entryLogic =
    reclaimTrigger === 'PASS'
      ? `Reclaim already confirmed: ${reclaimCloseStreak} consecutive closes above the MA5/10/30 cluster (last close ${closes[lastIdx].toFixed(2)}).`
      : reclaimTrigger === 'PARTIAL'
        ? `One close above the cluster so far (${closes[lastIdx].toFixed(2)} vs cluster top ~${clusterTop?.toFixed(2) ?? 'n/a'}) — needs one more confirming close above it.`
        : reclaimTrigger === 'FAIL'
          ? `Still below the MA cluster (top ~${clusterTop?.toFixed(2) ?? 'n/a'}) — no reclaim attempt currently holding.`
          : `Pullback still forming — no low confirmed yet, so no reclaim level to evaluate.`;

  let eventRisk: PullbackReclaimEvaluation['eventRisk'] = null;
  if (opts?.earningsDate) {
    const asOf = new Date(window[lastIdx].date);
    const days = tradingDaysBetween(asOf, opts.earningsDate);
    eventRisk = { tradingDaysAway: days, withinHoldingWindow: days >= 0 && days <= ASSUMED_HOLDING_TRADING_DAYS };
  }

  const entry = reclaimTrigger === 'PASS' || reclaimTrigger === 'PARTIAL' ? closes[lastIdx] : clusterTop ?? closes[lastIdx];
  const risk = entry - pullbackLow;
  const reward = swingHigh - entry;
  const riskReward = risk > 0 ? reward / risk : null;

  return {
    criteria: {
      priorTrend,
      pullbackIdentified,
      higherLow,
      reclaimTrigger,
      volumeConfirmation,
      momentumConfirmation,
    },
    reclaimStatus,
    reclaimCloseStreak,
    score,
    adjustedMax,
    verdict,
    swingLow,
    swingHigh,
    pullbackLow,
    currentClose: closes[lastIdx],
    maCluster: { ma5: ma5Last, ma10: ma10Last, ma30: ma30Last },
    entryLogic,
    invalidationLevel: pullbackLow,
    target: swingHigh,
    riskReward,
    eventRisk,
  };
}

export function formatPullbackReclaimReport(evalResult: PullbackReclaimEvaluation): string {
  const c = evalResult.criteria;
  const lines = [
    `Reclaim status: ${evalResult.reclaimStatus}`,
    `Score: ${evalResult.score}/${evalResult.adjustedMax}`,
    `Verdict: ${evalResult.verdict}`,
    `1. Prior trend context: ${c.priorTrend} (swing low ${evalResult.swingLow.toFixed(2)} -> swing high ${evalResult.swingHigh.toFixed(2)})`,
    `2. Pullback/rejection identified: ${c.pullbackIdentified} (pullback low so far ${evalResult.pullbackLow.toFixed(2)})`,
    `3. Higher low check: ${c.higherLow} (pullback low ${evalResult.pullbackLow.toFixed(2)} vs prior swing low ${evalResult.swingLow.toFixed(2)})`,
    `4. Reclaim trigger: ${c.reclaimTrigger} (${evalResult.reclaimCloseStreak} consecutive close(s) above MA5/10/30)`,
    `5. Volume confirmation: ${c.volumeConfirmation}`,
    `6. Momentum confirmation: ${c.momentumConfirmation}`,
    `Entry logic: ${evalResult.entryLogic}`,
    `Invalidation level: ${evalResult.invalidationLevel.toFixed(2)}`,
    `Target: ${evalResult.target.toFixed(2)}`,
    `Risk/reward: ${evalResult.riskReward != null ? evalResult.riskReward.toFixed(2) + ':1' : 'n/a'}`,
    `Event-risk flag: ${
      evalResult.eventRisk
        ? evalResult.eventRisk.withinHoldingWindow
          ? `Earnings/catalyst in ${evalResult.eventRisk.tradingDaysAway} trading days — factor into holding-period decision`
          : `Earnings/catalyst ${evalResult.eventRisk.tradingDaysAway} trading days away — outside the assumed holding window`
        : 'None noted'
    }`,
    `Disclaimer: This is a structured technical read based only on the price/volume data shown, not a recommendation or financial advice — it does not account for fundamentals, broader market conditions, or your own risk tolerance/position sizing.`,
  ];
  return lines.join('\n');
}
