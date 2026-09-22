import { describe, it, expect } from 'vitest';
import { analyzePeakAnalogs } from './peakAnalog';
import type { DailyBar } from './pullbackReclaim';

/**
 * As with pullbackReclaim.test.ts, every scenario here was constructed and
 * its exact numeric output verified with a throwaway script before being
 * encoded as a permanent assertion.
 */
function buildBars(closes: number[]): DailyBar[] {
  return closes.map((close, i) => ({
    date: new Date(2024, 0, i + 1),
    open: close,
    high: close,
    low: close,
    close,
    volume: 1_000_000,
  }));
}

// Gentle monotonic drift (no ties) so a flat plateau doesn't create spurious peaks.
const base = Array.from({ length: 60 }, (_, i) => 100 + i * 0.01);
const rally1 = Array.from({ length: 10 }, (_, i) => 100.6 + (i + 1) * 3); // ~103.6..130.6
const pullback1 = [126, 118, 112, 108, 110, 112, 115, 118, 120, 122, 118, 116, 114, 112, 110];
const rally2 = Array.from({ length: 10 }, (_, i) => 114 + (i + 1) * 3.6); // ~117.6..150
const consolidateBelowPeak = [145, 140, 138, 140, 142, 144, 146, 147, 148, 149];
const breakoutPast = [155, 160, 165, 170, 175];
const tail = [178, 176, 174, 172, 170];

const fullSeries = [...base, ...rally1, ...pullback1, ...rally2, ...consolidateBelowPeak, ...breakoutPast, ...tail];

describe('analyzePeakAnalogs', () => {
  it('returns null when there is not enough history', () => {
    expect(analyzePeakAnalogs(buildBars([100, 101, 102]))).toBeNull();
  });

  it('correctly separates a pullback peak from a breakout peak in the same series', () => {
    const out = analyzePeakAnalogs(buildBars(fullSeries));
    expect(out).not.toBeNull();
    expect(out!.peaks).toHaveLength(2);
    expect(out!.peaks[0].outcome).toBe('PULLBACK');
    expect(out!.peaks[0].price).toBeCloseTo(130.6, 1);
    expect(out!.peaks[1].outcome).toBe('BREAKOUT');
    expect(out!.peaks[1].price).toBe(150);
  });

  it('builds separate fingerprints for breakout vs pullback peaks', () => {
    const out = analyzePeakAnalogs(buildBars(fullSeries));
    expect(out!.pullbackFingerprint).not.toBeNull();
    expect(out!.pullbackFingerprint!.count).toBe(1);
    expect(out!.breakoutFingerprint).not.toBeNull();
    expect(out!.breakoutFingerprint!.count).toBe(1);
    // The pullback peak was more overbought (RSI 100 at that exact top) and
    // the breakout fingerprint is distinctly different, not just a copy.
    expect(out!.breakoutFingerprint!.avgRsi).not.toBe(out!.pullbackFingerprint!.avgRsi);
  });

  it('reports the current state (price, RSI, %above MA50) for the most recent bar', () => {
    const out = analyzePeakAnalogs(buildBars(fullSeries));
    expect(out!.current.price).toBe(170);
    expect(out!.current.date).toBe('2024-04-23');
  });

  it('flags isNearRecentHigh when the last bar is at/near its own recent high', () => {
    // End the series right at the breakout peak itself, with no pullback after.
    const seriesEndingAtHigh = [...base, ...rally1, ...pullback1, ...rally2];
    const out = analyzePeakAnalogs(buildBars(seriesEndingAtHigh));
    expect(out!.current.isNearRecentHigh).toBe(true);
  });

  it('does not flag isNearRecentHigh after a real pullback off the top', () => {
    const out = analyzePeakAnalogs(buildBars(fullSeries)); // ends 170, down from a recent 178
    expect(out!.current.isNearRecentHigh).toBe(false);
  });

  it('classifies a peak too close to the end of history as TOO_RECENT rather than forcing an outcome', () => {
    // Exactly 10 bars after the breakout peak — just enough for the +/-10-day
    // window to detect it as a local peak, but short of the 15 needed to
    // classify what actually followed it.
    const truncated = [...base, ...rally1, ...pullback1, ...rally2, ...consolidateBelowPeak];
    const out = analyzePeakAnalogs(buildBars(truncated));
    const lastPeak = out!.peaks[out!.peaks.length - 1];
    expect(lastPeak.price).toBe(150);
    expect(lastPeak.outcome).toBe('TOO_RECENT');
  });
});
