import { describe, it, expect } from 'vitest';
import {
  evaluateBuyNowTrigger,
  createBuyNowArmedState,
  DEFAULT_BUY_NOW_CONFIG,
  type BuyZone,
  type QuoteSample,
  type BuyNowArmedState,
} from './buyNowTrigger';

const ZONE: BuyZone = { low: 100, high: 105 };
const T0 = 1_700_000_000_000;
const MINUTE = 60_000;

function sample(overrides: Partial<QuoteSample> = {}, at = T0): QuoteSample {
  return { price: 102, rvol: 1.8, at, marketState: 'REGULAR', ...overrides };
}

/** Feed a sequence of samples through, threading state — mirrors how the watcher hook will call this in a loop. */
function run(samples: QuoteSample[], initial: BuyNowArmedState = createBuyNowArmedState()) {
  let state = initial;
  let last;
  for (const s of samples) {
    last = evaluateBuyNowTrigger(s, ZONE, state);
    state = last.state;
  }
  return last!;
}

/** Like run(), but returns every intermediate evaluation — for asserting a fire happened at some point mid-sequence, not just on the final poll (a fire mid-burst correctly re-engages cooldown for the polls right after it). */
function runAll(samples: QuoteSample[], initial: BuyNowArmedState = createBuyNowArmedState()) {
  let state = initial;
  const results = [];
  for (const s of samples) {
    const out = evaluateBuyNowTrigger(s, ZONE, state);
    results.push(out);
    state = out.state;
  }
  return results;
}

describe('zone anchor — the core overshoot guard', () => {
  it('does not fire when price has already run past the zone (the overshoot case)', () => {
    const out = evaluateBuyNowTrigger(sample({ price: 112 }), ZONE, createBuyNowArmedState());
    expect(out.fire).toBe(false);
    expect(out.reason).toMatch(/past the buy zone/i);
  });

  it('does not fire when price has not yet reached the zone', () => {
    const out = evaluateBuyNowTrigger(sample({ price: 90 }), ZONE, createBuyNowArmedState());
    expect(out.fire).toBe(false);
    expect(out.reason).toMatch(/below the buy zone/i);
  });

  it('price exactly at the zone boundary counts as inside', () => {
    const out = evaluateBuyNowTrigger(sample({ price: ZONE.low }), ZONE, createBuyNowArmedState());
    expect(out.reason).not.toMatch(/below|past/i);
  });
});

describe('volume confirmation band', () => {
  it('does not fire when volume is too quiet to confirm the move', () => {
    const out = evaluateBuyNowTrigger(sample({ rvol: 0.9 }), ZONE, createBuyNowArmedState());
    expect(out.fire).toBe(false);
    expect(out.reason).toMatch(/not yet confirming/i);
  });

  it('does not fire when volume looks climactic — the blow-off, not the entry', () => {
    const out = evaluateBuyNowTrigger(sample({ rvol: 5 }), ZONE, createBuyNowArmedState());
    expect(out.fire).toBe(false);
    expect(out.reason).toMatch(/climactic/i);
  });
});

describe('persistence — no firing on a single noisy tick', () => {
  it('a single qualifying poll only reports "confirming 1/3", does not fire', () => {
    const out = evaluateBuyNowTrigger(sample(), ZONE, createBuyNowArmedState());
    expect(out.fire).toBe(false);
    expect(out.confirmingCount).toBe(1);
    expect(out.reason).toMatch(/confirming — 1\/3/i);
  });

  it('fires only once 3 consecutive qualifying polls have been seen', () => {
    const samples = [0, 1, 2].map((i) => sample({ price: 102 + i * 0.2 }, T0 + i * MINUTE));
    const out = run(samples);
    expect(out.fire).toBe(true);
    expect(out.confirmingCount).toBe(3);
  });

  it('a disqualifying poll in between resets the streak', () => {
    const samples = [
      sample({ price: 102 }, T0),
      sample({ price: 102 }, T0 + MINUTE),
      sample({ rvol: 5 }, T0 + 2 * MINUTE), // climactic spike breaks the streak
      sample({ price: 102 }, T0 + 3 * MINUTE),
    ];
    const out = run(samples);
    expect(out.fire).toBe(false);
    expect(out.confirmingCount).toBe(1);
  });
});

describe('direction guard — do not fire while the move is rolling over', () => {
  it('does not fire when price is drifting down across the confirming window, even while still in-zone', () => {
    const samples = [0, 1, 2].map((i) => sample({ price: 104 - i * 0.5 }, T0 + i * MINUTE));
    const out = run(samples);
    expect(out.fire).toBe(false);
    expect(out.reason).toMatch(/rolling over/i);
  });

  it('fires when price is flat-to-rising across the confirming window', () => {
    const samples = [0, 1, 2].map((i) => sample({ price: 102 + i * 0.1 }, T0 + i * MINUTE));
    const out = run(samples);
    expect(out.fire).toBe(true);
  });
});

describe('session gating', () => {
  it('does not fire pre-market even if every other condition qualifies', () => {
    const samples = [0, 1, 2].map((i) => sample({ marketState: 'PRE' }, T0 + i * MINUTE));
    const out = run(samples);
    expect(out.fire).toBe(false);
    expect(out.reason).toMatch(/outside regular/i);
  });

  it('does not fire post-market', () => {
    const out = evaluateBuyNowTrigger(sample({ marketState: 'POST' }), ZONE, createBuyNowArmedState());
    expect(out.fire).toBe(false);
    expect(out.reason).toMatch(/outside regular/i);
  });
});

describe('cooldown — do not spam the same alert every poll', () => {
  it('does not re-fire immediately after firing, even while still qualifying', () => {
    const firstBurst = [0, 1, 2].map((i) => sample({ price: 102 }, T0 + i * MINUTE));
    const fired = run(firstBurst);
    expect(fired.fire).toBe(true);

    const again = evaluateBuyNowTrigger(sample({ price: 102 }, T0 + 4 * MINUTE), ZONE, fired.state);
    expect(again.fire).toBe(false);
    expect(again.reason).toMatch(/cooldown/i);
  });

  it('bypasses the cooldown once price exits the zone and re-enters (a genuinely new setup)', () => {
    const firstBurst = [0, 1, 2].map((i) => sample({ price: 102 }, T0 + i * MINUTE));
    const fired = run(firstBurst);
    expect(fired.fire).toBe(true);

    const exit = evaluateBuyNowTrigger(sample({ price: 112 }, T0 + 4 * MINUTE), ZONE, fired.state);
    expect(exit.state.wasInZone).toBe(false);

    const reentrySamples = [0, 1, 2].map((i) => sample({ price: 102 }, T0 + (5 + i) * MINUTE));
    const reentryFired = run(reentrySamples, exit.state);
    expect(reentryFired.fire).toBe(true);
  });

  it('fires again after the cooldown window elapses without ever leaving the zone', () => {
    const firstBurst = [0, 1, 2].map((i) => sample({ price: 102 }, T0 + i * MINUTE));
    const fired = run(firstBurst);
    expect(fired.fire).toBe(true);

    const laterSamples = [0, 1, 2].map((i) =>
      sample({ price: 102 }, fired.state.lastFiredAt! + DEFAULT_BUY_NOW_CONFIG.cooldownMs + i * MINUTE)
    );
    const results = runAll(laterSamples, fired.state);
    expect(results.some((r) => r.fire)).toBe(true);
  });
});
