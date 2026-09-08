import { describe, it, expect } from 'vitest';
import { computeTechnicalIndicators } from './technical';

/**
 * Regression test for the institutionalBuying.score scale bug: netCapitalInflow
 * is a raw $-millions figure that, for any stock with normal (let alone
 * mega-cap) liquidity, is large enough to blow past the score's [5, 98] clamp
 * regardless of the real signal strength — pinning every real ticker to
 * exactly 5 or 98 with no gradation. The fix normalizes it to a fraction of
 * the window's own total dollar volume before scoring.
 */

const BASE_PRICE = 200; // large-cap-scale price so dollarValue is realistically large
const BASE_VOLUME = 5_000_000; // large-cap-scale volume

function buildHistory(days: number, spikeDayVolumeMultiplier: number, spikeDayDirection: 1 | -1 | 0): any[] {
  const history: any[] = [];
  let price = BASE_PRICE;
  for (let i = 0; i < days; i++) {
    const isSpike = i === days - 3 || i === days - 5; // a couple of anomalous-volume days within the 10-day window
    const volume = isSpike ? BASE_VOLUME * spikeDayVolumeMultiplier : BASE_VOLUME;
    const open = price;
    const move = isSpike ? spikeDayDirection * price * 0.02 : (Math.random() - 0.5) * price * 0.001;
    price = open + move;
    history.push({ date: new Date(2024, 0, i + 1), open, high: Math.max(open, price) + 0.01, low: Math.min(open, price) - 0.01, close: price, volume });
  }
  return history;
}

function score(history: any[]): number {
  const tech = computeTechnicalIndicators(history, { regularMarketPrice: history[history.length - 1].close });
  if (!tech) throw new Error('computeTechnicalIndicators returned null for a valid fixture');
  return tech.quantumRefinement.institutionalBuying.score;
}

describe('institutionalBuying.score is scaled to the stock\'s own dollar volume, not pinned to the clamp', () => {
  it('a large-cap-scale stock with buying-day volume spikes does not pin to the 98 ceiling', () => {
    const s = score(buildHistory(30, 3, 1));
    expect(s).toBeLessThan(98);
    expect(s).toBeGreaterThan(50); // still meaningfully bullish
  });

  it('a large-cap-scale stock with selling-day volume spikes does not pin to the 5 floor', () => {
    const s = score(buildHistory(30, 3, -1));
    expect(s).toBeGreaterThan(5);
    expect(s).toBeLessThan(50); // still meaningfully bearish
  });

  it('no volume anomalies at all resolves close to neutral (50)', () => {
    const s = score(buildHistory(30, 1, 0));
    expect(Math.abs(s - 50)).toBeLessThan(10);
  });

  it('a bigger buying-side volume spike scores higher than a smaller one — real gradation, not a binary flip', () => {
    const small = score(buildHistory(30, 1.6, 1));
    const large = score(buildHistory(30, 4, 1));
    expect(large).toBeGreaterThan(small);
  });
});
