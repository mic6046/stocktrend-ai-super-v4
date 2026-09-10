import { describe, it, expect } from 'vitest';
import { checkSuggestedBuyFade } from './suggestedBuyFadeTrigger';
import type { SuggestedBuySnapshot } from './suggestedBuysStore';
import type { StockRecommendation } from './recommendation';

function snapshot(overrides: Partial<SuggestedBuySnapshot> = {}): SuggestedBuySnapshot {
  return {
    ticker: 'TEST',
    companyName: 'Test Co',
    suggestedAt: Date.now(),
    verdict: 'STRONG BUY',
    confidence: 80,
    setupTag: null,
    price: 100,
    fundFlow: 'Inflow',
    ...overrides,
  };
}

function freshRec(overrides: Partial<StockRecommendation> = {}, engineOverrides: any = {}): StockRecommendation {
  return {
    ticker: 'TEST',
    companyName: 'Test Co',
    recommendation: 'STRONG BUY',
    confidence: 80,
    boardMetrics: { fundFlow: 'Inflow' },
    engine: { currentPrice: 100, setupTag: null, ...engineOverrides },
    ...overrides,
  } as any;
}

describe('checkSuggestedBuyFade — leading signals only, never waits for a broken stop', () => {
  it('does not fire when nothing has changed', () => {
    const out = checkSuggestedBuyFade(snapshot(), freshRec());
    expect(out.fire).toBe(false);
  });

  it('fires on a verdict downgrade out of BUY/STRONG BUY', () => {
    const out = checkSuggestedBuyFade(snapshot(), freshRec({ recommendation: 'HOLD' as any }));
    expect(out.fire).toBe(true);
    expect(out.reason).toMatch(/Downgraded from STRONG BUY to HOLD/);
  });

  it('fires on a big confidence drop even while the label is unchanged', () => {
    const out = checkSuggestedBuyFade(snapshot({ confidence: 82 }), freshRec({ confidence: 60 }));
    expect(out.fire).toBe(true);
    expect(out.reason).toMatch(/Conviction is fading/);
  });

  it('does not fire on a small confidence dip below the threshold', () => {
    const out = checkSuggestedBuyFade(snapshot({ confidence: 80 }), freshRec({ confidence: 70 }));
    expect(out.fire).toBe(false);
  });

  it('fires when fund flow flips from non-outflow to outflow', () => {
    const out = checkSuggestedBuyFade(
      snapshot({ fundFlow: 'Inflow' }),
      freshRec({ boardMetrics: { fundFlow: 'Outflow' } } as any)
    );
    expect(out.fire).toBe(true);
    expect(out.reason).toMatch(/net outflow/i);
  });

  it('does not fire on fund flow when it was already outflow at suggestion time', () => {
    const out = checkSuggestedBuyFade(
      snapshot({ fundFlow: 'Outflow' }),
      freshRec({ boardMetrics: { fundFlow: 'Outflow' } } as any)
    );
    expect(out.fire).toBe(false);
  });

  it('fires when the setup tag that justified the pick is gone', () => {
    const out = checkSuggestedBuyFade(
      snapshot({ setupTag: 'PULLBACK BUY' }),
      freshRec({}, { setupTag: null })
    );
    expect(out.fire).toBe(true);
    expect(out.reason).toMatch(/Pullback Buy setup that justified this pick is gone/);
  });

  it('does not fire when there was no setup tag to begin with', () => {
    const out = checkSuggestedBuyFade(snapshot({ setupTag: null }), freshRec({}, { setupTag: null }));
    expect(out.fire).toBe(false);
  });

  it('includes the price move in the reason, not as its own trigger', () => {
    const out = checkSuggestedBuyFade(
      snapshot({ price: 100 }),
      freshRec({ recommendation: 'HOLD' as any }, { currentPrice: 105 })
    );
    expect(out.reason).toMatch(/up 5\.0% from 100\.00/);
  });

  it('never fires purely because price fell — that would be the "too late" stop-loss check we deliberately avoid', () => {
    // Price collapsed but everything else (label, confidence, flow, setup) is unchanged.
    const out = checkSuggestedBuyFade(snapshot({ price: 100 }), freshRec({}, { currentPrice: 60 }));
    expect(out.fire).toBe(false);
  });
});
