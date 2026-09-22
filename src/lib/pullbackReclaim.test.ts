import { describe, it, expect } from 'vitest';
import { evaluatePullbackReclaim, type DailyBar } from './pullbackReclaim';

/**
 * Every scenario here was constructed and its exact numeric output verified
 * with a throwaway script before being encoded as a permanent assertion —
 * moving-average reclaim math isn't something to hand-compute and hope is
 * right (see AMD/quantumRecommendationEngine.test.ts for the same
 * methodology applied to the main engine).
 */
function buildBars(closes: number[], volumes?: number[]): DailyBar[] {
  return closes.map((close, i) => ({
    date: new Date(2024, 0, i + 1),
    open: close,
    high: close,
    low: close,
    close,
    volume: volumes?.[i] ?? 1_000_000,
  }));
}

const base = Array(30).fill(95);
const rally = Array.from({ length: 15 }, (_, i) => 95 + (i + 1) * 3); // 98..140
const decline = [134, 126, 118, 112, 108]; // pullback low = 108, prior swing low = 95

describe('evaluatePullbackReclaim', () => {
  it('returns null when there is not enough history', () => {
    expect(evaluatePullbackReclaim(buildBars([100, 101, 102]))).toBeNull();
  });

  it('confirms a full reclaim (2+ closes, volume expansion, RSI rising) as Actionable', () => {
    const closes = [...base, ...rally, ...decline, 130, 138];
    const volumes = [
      ...Array(30).fill(1_000_000),
      ...Array(15).fill(1_200_000),
      1_500_000, 1_400_000, 1_300_000, 1_200_000, 1_100_000,
      1_800_000, 2_000_000,
    ];
    const out = evaluatePullbackReclaim(buildBars(closes, volumes));
    expect(out).not.toBeNull();
    expect(out!.criteria.reclaimTrigger).toBe('PASS');
    expect(out!.reclaimCloseStreak).toBe(2);
    expect(out!.reclaimStatus).toBe('Confirmed (2+ closes)');
    expect(out!.criteria.volumeConfirmation).toBe('PASS');
    expect(out!.criteria.momentumConfirmation).toBe('PASS');
    expect(out!.verdict).toBe('Actionable');
    expect(out!.invalidationLevel).toBe(108);
    expect(out!.target).toBe(140);
  });

  it('never marks the reclaim trigger PASS on a single close — the core guardrail', () => {
    const closes = [...base, ...rally, ...decline, 130];
    const out = evaluatePullbackReclaim(buildBars(closes));
    expect(out!.criteria.reclaimTrigger).toBe('PARTIAL');
    expect(out!.reclaimCloseStreak).toBe(1);
    expect(out!.reclaimStatus).toBe('Unconfirmed (1 close)');
    expect(out!.verdict).toBe('Wait for confirmation');
  });

  it('flags a confirmed lower low (structure broken) as Invalidated, overriding everything else', () => {
    // Pullback breaks below the prior swing low of 95, then bounces — so the
    // low counts as "formed" (not still actively falling) and criterion 3
    // can actually be evaluated rather than deferred.
    const closes = [...base, ...rally, 134, 126, 110, 95, 88, 92];
    const out = evaluatePullbackReclaim(buildBars(closes));
    expect(out!.criteria.higherLow).toBe('FAIL');
    expect(out!.verdict).toBe('Invalidated');
  });

  it('reports "Developing" (not a forced verdict) while the pullback low is still actively forming', () => {
    // Last bar (105) is itself the lowest close so far -> no confirmed low yet.
    const closes = [...base, ...rally, 134, 126, 118, 112, 105];
    const out = evaluatePullbackReclaim(buildBars(closes));
    expect(out!.criteria.higherLow).toBe('NOT_YET_AVAILABLE');
    expect(out!.criteria.reclaimTrigger).toBe('NOT_YET_AVAILABLE');
    expect(out!.criteria.volumeConfirmation).toBe('NOT_YET_AVAILABLE');
    expect(out!.criteria.momentumConfirmation).toBe('NOT_YET_AVAILABLE');
    expect(out!.verdict).toBe('Developing');
  });

  it('invalidates when there is no prior rally/pullback pattern at all (still making new highs)', () => {
    const out = evaluatePullbackReclaim(buildBars([...base, ...rally]));
    expect(out!.criteria.priorTrend).toBe('FAIL');
    expect(out!.criteria.pullbackIdentified).toBe('FAIL');
    expect(out!.verdict).toBe('Invalidated');
  });

  it('confirms the reclaim on price/RSI but flags weak volume separately, without hiding it in the verdict', () => {
    const closes = [...base, ...rally, ...decline, 130, 138];
    const volumes = [
      ...Array(30).fill(1_000_000),
      ...Array(15).fill(1_200_000),
      1_500_000, 1_400_000, 1_300_000, 1_200_000, 1_100_000,
      700_000, 650_000, // thin/fading reclaim volume
    ];
    const out = evaluatePullbackReclaim(buildBars(closes, volumes));
    expect(out!.criteria.reclaimTrigger).toBe('PASS');
    expect(out!.criteria.volumeConfirmation).toBe('FAIL');
    // Per the user's own scoring rule, a full reclaim trigger + >=80% overall
    // still reads Actionable even with one weak criterion — the volume FAIL
    // is visible in criteria, not silently dropped.
    expect(out!.verdict).toBe('Actionable');
  });

  it('computes risk/reward from entry near the reclaim level, stop at the pullback low, target at the prior high', () => {
    const closes = [...base, ...rally, ...decline, 130, 138];
    const out = evaluatePullbackReclaim(buildBars(closes));
    const entry = 138;
    const expectedRR = (140 - entry) / (entry - 108);
    expect(out!.riskReward).toBeCloseTo(expectedRR, 5);
  });

  it('flags an earnings date that falls inside the assumed holding window', () => {
    const closes = [...base, ...rally, ...decline, 130, 138];
    const bars = buildBars(closes);
    const asOfDate = bars[bars.length - 1].date as Date;
    const earningsDate = new Date(asOfDate);
    earningsDate.setDate(earningsDate.getDate() + 7); // ~5 trading days out
    const out = evaluatePullbackReclaim(bars, { earningsDate });
    expect(out!.eventRisk).not.toBeNull();
    expect(out!.eventRisk!.withinHoldingWindow).toBe(true);
  });
});
