import { describe, it, expect } from 'vitest';
import { computeReclaimBuyTag } from './reclaimBuyTag';
import type { DailyBar } from './pullbackReclaim';

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
const decline = [134, 126, 118, 112, 108];
const confirmedReclaim = buildBars([...base, ...rally, ...decline, 130, 138]);

describe('computeReclaimBuyTag', () => {
  it('fires when recommendation is BUY, trend is bullish, accumulation is strong, and the reclaim is confirmed', () => {
    const tag = computeReclaimBuyTag('BUY', 'BULLISH', 85, 40, 40, confirmedReclaim);
    expect(tag).toBe('RECLAIM BUY');
  });

  it('does not fire on HOLD/REDUCE even if the price/accumulation pattern otherwise qualifies', () => {
    expect(computeReclaimBuyTag('HOLD', 'BULLISH', 85, 40, 40, confirmedReclaim)).toBeNull();
    expect(computeReclaimBuyTag('REDUCE', 'BULLISH', 85, 40, 40, confirmedReclaim)).toBeNull();
  });

  it('does not fire without a bullish trend, even with strong accumulation and a confirmed reclaim', () => {
    expect(computeReclaimBuyTag('BUY', 'BEARISH', 85, 40, 40, confirmedReclaim)).toBeNull();
    expect(computeReclaimBuyTag('BUY', null, 85, 40, 40, confirmedReclaim)).toBeNull();
  });

  it('does not fire without strong accumulation on any of the three measures', () => {
    expect(computeReclaimBuyTag('BUY', 'BULLISH', 50, 40, 40, confirmedReclaim)).toBeNull();
  });

  it('fires if ANY of the three accumulation measures clears 80, not all three', () => {
    expect(computeReclaimBuyTag('BUY', 'BULLISH', 40, 82, 40, confirmedReclaim)).toBe('RECLAIM BUY');
    expect(computeReclaimBuyTag('BUY', 'BULLISH', 40, 40, 81, confirmedReclaim)).toBe('RECLAIM BUY');
  });

  it('does not fire when the reclaim itself is only unconfirmed (1 close)', () => {
    const oneClose = buildBars([...base, ...rally, ...decline, 130]);
    expect(computeReclaimBuyTag('BUY', 'BULLISH', 85, 40, 40, oneClose)).toBeNull();
  });

  it('does not fire when the pullback made a confirmed lower low (structure broken)', () => {
    const lowerLow = buildBars([...base, ...rally, 134, 126, 110, 95, 88, 92]);
    expect(computeReclaimBuyTag('BUY', 'BULLISH', 85, 40, 40, lowerLow)).toBeNull();
  });
});
