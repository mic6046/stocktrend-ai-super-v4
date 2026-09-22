import { describe, it, expect } from 'vitest';
import { checkPeakAnalogWarning } from './peakAnalogWarningTrigger';
import type { PeakAnalogResult } from './peakAnalog';

function result(overrides: Partial<PeakAnalogResult> = {}): PeakAnalogResult {
  return {
    peaks: [],
    breakoutFingerprint: null,
    pullbackFingerprint: { count: 11, avgRsi: 64, avgVolRatio: 1.4, avgVolTrendPct: 10, avgPctAboveMA50: 8 },
    current: {
      date: '2026-09-22',
      price: 400,
      rsi: 68,
      volRatio: 1.5,
      volTrendIntoPeakPct: 20,
      pctAboveMA50: 9,
      isNearRecentHigh: true,
    },
    ...overrides,
  };
}

describe('checkPeakAnalogWarning', () => {
  it('fires when near a high, with a dominant historical pullback pattern, and current RSI/extension match', () => {
    const out = checkPeakAnalogWarning('0388.HK', result());
    expect(out.fire).toBe(true);
    expect(out.reason).toMatch(/0388\.HK is reaching a zone/);
    expect(out.reason).toMatch(/11 of 11 past instances/);
  });

  it('does not fire when not currently near a recent high', () => {
    const out = checkPeakAnalogWarning('TEST', result({ current: { ...result().current, isNearRecentHigh: false } }));
    expect(out.fire).toBe(false);
  });

  it('does not fire when there is no pullback fingerprint at all', () => {
    const out = checkPeakAnalogWarning('TEST', result({ pullbackFingerprint: null }));
    expect(out.fire).toBe(false);
  });

  it('does not fire when the sample size is too thin to trust', () => {
    const out = checkPeakAnalogWarning(
      'TEST',
      result({ pullbackFingerprint: { count: 3, avgRsi: 64, avgVolRatio: 1.4, avgVolTrendPct: 10, avgPctAboveMA50: 8 } })
    );
    expect(out.fire).toBe(false);
  });

  it('does not fire when breakouts are common enough that the pattern is not dominant', () => {
    // 6 pullbacks vs 4 breakouts = 60% pullback rate, below the 70% bar.
    const out = checkPeakAnalogWarning(
      'TEST',
      result({
        pullbackFingerprint: { count: 6, avgRsi: 64, avgVolRatio: 1.4, avgVolTrendPct: 10, avgPctAboveMA50: 8 },
        breakoutFingerprint: { count: 4, avgRsi: 70, avgVolRatio: 1.2, avgVolTrendPct: 5, avgPctAboveMA50: 20 },
      })
    );
    expect(out.fire).toBe(false);
  });

  it('does not fire when current RSI/extension are well below the historical topping zone', () => {
    const out = checkPeakAnalogWarning(
      'TEST',
      result({ current: { ...result().current, rsi: 45, pctAboveMA50: 1 } })
    );
    expect(out.fire).toBe(false);
  });

  it('fires on RSI match alone even if extension is below the ratio threshold', () => {
    const out = checkPeakAnalogWarning(
      'TEST',
      result({ current: { ...result().current, rsi: 63, pctAboveMA50: 0.5 } }) // RSI 63 within 5 of avg 64; extension 0.5 << 75% of 8
    );
    expect(out.fire).toBe(true);
  });

  it('fires on extension match alone even if RSI is below the tolerance', () => {
    const out = checkPeakAnalogWarning(
      'TEST',
      result({ current: { ...result().current, rsi: 50, pctAboveMA50: 7 } }) // RSI 50 far below 64-5=59; extension 7 >= 75% of 8 = 6
    );
    expect(out.fire).toBe(true);
  });

  it('does not fire when analyzePeakAnalogs itself returned null (not enough history)', () => {
    expect(checkPeakAnalogWarning('TEST', null).fire).toBe(false);
  });
});
