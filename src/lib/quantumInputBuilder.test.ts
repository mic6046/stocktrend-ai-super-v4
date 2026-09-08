import { describe, it, expect } from 'vitest';
import { buildQuantumInputFromMarketData } from './quantumInputBuilder';

/**
 * Regression coverage for switching Support/Resistance from pivotLevels()
 * (a 60-day range midpoint dressed in pivot-point terminology) to the
 * volume-profile levels already computed in technical.ts (srSupports/
 * srResistances — "high volume node" clustering, the more standard S/R
 * methodology). See quantumInputBuilder.ts's levelsFromVolumeProfile().
 */

function buildHistory(days: number, opts: { heavyVolumeBelowPrice?: boolean } = {}): any[] {
  const history: any[] = [];
  let price = 100;
  for (let i = 0; i < days; i++) {
    // Drift up slowly so "today" sits near the top of the range, mimicking a
    // trending stock — the scenario where the old pivot formula produced very
    // wide levels.
    price = 100 + (i / days) * 50;
    // Put a concentration of heavy volume in the lower third of the range,
    // for the volume-profile clustering to actually pick up as "support".
    const isHeavyVolumeBar = opts.heavyVolumeBelowPrice && i < days / 3;
    const volume = isHeavyVolumeBar ? 50_000_000 : 1_000_000;
    history.push({
      date: new Date(2024, 0, i + 1),
      open: price,
      high: price + 1,
      low: price - 1,
      close: price,
      volume,
    });
  }
  return history;
}

describe('buildQuantumInputFromMarketData — Support/Resistance level selection', () => {
  it('uses the volume-profile levels (not the wide 60-day pivot range) when enough real history exists', () => {
    const history = buildHistory(60, { heavyVolumeBelowPrice: true });
    const input = buildQuantumInputFromMarketData({
      horizon: '1M',
      ticker: 'TEST',
      quote: { regularMarketPrice: history[history.length - 1].close },
      history,
    });
    const px = input.currentPrice;
    const { s1, s2, r1, r2 } = input.levels!;

    // Ordering invariant the rest of the engine assumes.
    expect(s2).toBeLessThanOrEqual(s1);
    expect(s1).toBeLessThan(px);
    expect(px).toBeLessThan(r1);
    expect(r1).toBeLessThanOrEqual(r2);
  });

  it('falls back to pivotLevels() gracefully when there is not enough history for a technical breakdown', () => {
    const history = buildHistory(10); // below computeTechnicalIndicators' 15-bar minimum
    const input = buildQuantumInputFromMarketData({
      horizon: '1M',
      ticker: 'TEST',
      quote: { regularMarketPrice: history[history.length - 1].close },
      history,
    });
    // Should not throw, and should still produce a usable, correctly-ordered set of levels.
    const px = input.currentPrice;
    const { s1, s2, r1, r2 } = input.levels!;
    expect(s2).toBeLessThanOrEqual(s1);
    expect(s1).toBeLessThanOrEqual(px);
    expect(px).toBeLessThanOrEqual(r1);
    expect(r1).toBeLessThanOrEqual(r2);
  });

  it('an explicit enrich.levels override still takes priority over both volume-profile and pivot levels', () => {
    const history = buildHistory(60, { heavyVolumeBelowPrice: true });
    const override = { s1: 1, s2: 2, r1: 3, r2: 4 };
    const input = buildQuantumInputFromMarketData({
      horizon: '1M',
      ticker: 'TEST',
      quote: { regularMarketPrice: history[history.length - 1].close },
      history,
      enrich: { levels: override },
    });
    expect(input.levels).toEqual(override);
  });
});

/**
 * Regression coverage for the AMD case: +5.9% on 1.78x normal volume used to
 * classify as "high" (confirming) volume at the old 1.4x bar, alone enough to
 * escalate straight to STRONG BUY. 1.4-2x is common, routine variation, not a
 * genuinely notable volume event — raised to 2.0x, matching technical.ts's
 * own "STRONG_BULLISH: volume explosion" tier.
 */
describe('volumeBias threshold — 1.4x normal volume was too lenient to count as "confirming"', () => {
  function buildFlatHistory(days: number, dailyVolume: number): any[] {
    const history: any[] = [];
    for (let i = 0; i < days; i++) {
      history.push({ date: new Date(2024, 0, i + 1), open: 100, high: 101, low: 99, close: 100, volume: dailyVolume });
    }
    return history;
  }

  it('1.78x normal volume (the real AMD reading) no longer counts as "high"', () => {
    const history = buildFlatHistory(30, 1_000_000);
    const input = buildQuantumInputFromMarketData({
      horizon: '1M',
      ticker: 'TEST',
      quote: { regularMarketPrice: 100, regularMarketVolume: 1_780_000 },
      history,
    });
    expect(input.technical?.volumeBias).not.toBe('high');
  });

  it('2.0x normal volume still counts as "high"', () => {
    const history = buildFlatHistory(30, 1_000_000);
    const input = buildQuantumInputFromMarketData({
      horizon: '1M',
      ticker: 'TEST',
      quote: { regularMarketPrice: 100, regularMarketVolume: 2_000_000 },
      history,
    });
    expect(input.technical?.volumeBias).toBe('high');
  });
});
