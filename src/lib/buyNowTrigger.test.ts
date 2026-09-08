import { describe, it, expect } from 'vitest';
import { checkBuyNow, type BuyZone, type BuyNowSnapshot } from './buyNowTrigger';

const ZONE: BuyZone = { low: 100, high: 105 };

function sample(overrides: Partial<BuyNowSnapshot> = {}): BuyNowSnapshot {
  return { price: 102, rvol: 1.8, marketState: 'REGULAR', ...overrides };
}

describe('zone anchor — the core overshoot guard', () => {
  it('does not qualify when price has already run past the zone (the overshoot case)', () => {
    const out = checkBuyNow(sample({ price: 112 }), ZONE);
    expect(out.qualifies).toBe(false);
    expect(out.reason).toMatch(/past the buy zone/i);
  });

  it('does not qualify when price has not yet reached the zone', () => {
    const out = checkBuyNow(sample({ price: 90 }), ZONE);
    expect(out.qualifies).toBe(false);
    expect(out.reason).toMatch(/not yet reached/i);
  });

  it('price exactly at either zone boundary counts as inside', () => {
    expect(checkBuyNow(sample({ price: ZONE.low }), ZONE).qualifies).toBe(true);
    expect(checkBuyNow(sample({ price: ZONE.high }), ZONE).qualifies).toBe(true);
  });
});

describe('volume confirmation band', () => {
  it('does not qualify when volume is too quiet to confirm the move', () => {
    const out = checkBuyNow(sample({ rvol: 0.9 }), ZONE);
    expect(out.qualifies).toBe(false);
    expect(out.reason).toMatch(/not yet confirming/i);
  });

  it('does not qualify when volume looks climactic — the blow-off, not the entry', () => {
    const out = checkBuyNow(sample({ rvol: 5 }), ZONE);
    expect(out.qualifies).toBe(false);
    expect(out.reason).toMatch(/climactic/i);
  });

  it('qualifies when volume is within the confirming band', () => {
    expect(checkBuyNow(sample({ rvol: 1.3 }), ZONE).qualifies).toBe(true);
    expect(checkBuyNow(sample({ rvol: 2.5 }), ZONE).qualifies).toBe(true);
    expect(checkBuyNow(sample({ rvol: 1.8 }), ZONE).qualifies).toBe(true);
  });
});

describe('session gating', () => {
  it('does not qualify pre-market even if price/volume otherwise qualify', () => {
    const out = checkBuyNow(sample({ marketState: 'PRE' }), ZONE);
    expect(out.qualifies).toBe(false);
    expect(out.reason).toMatch(/outside regular/i);
  });

  it('does not qualify post-market', () => {
    const out = checkBuyNow(sample({ marketState: 'POST' }), ZONE);
    expect(out.qualifies).toBe(false);
    expect(out.reason).toMatch(/outside regular/i);
  });

  it('treats a missing marketState as regular session (server did not provide it)', () => {
    const out = checkBuyNow(sample({ marketState: null }), ZONE);
    expect(out.qualifies).toBe(true);
  });
});

describe('all conditions together', () => {
  it('qualifies only when zone, volume, and session all pass at once', () => {
    expect(checkBuyNow(sample(), ZONE).qualifies).toBe(true);
  });
});
