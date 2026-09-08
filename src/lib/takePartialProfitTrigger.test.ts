import { describe, it, expect } from 'vitest';
import { checkTakePartialProfit } from './takePartialProfitTrigger';
import type { StockRecommendation } from './recommendation';

function rec(displayLabel: string, why = 'Reaching resistance with reducing flow.'): StockRecommendation {
  return {
    ticker: 'TEST',
    companyName: 'Test Co',
    currentActionReason: why,
    engine: { currentAction: { displayLabel, why } },
  } as any;
}

describe('checkTakePartialProfit — reads the engine\'s own position-aware headline, detects nothing new', () => {
  it('fires on the exact "TAKE PARTIAL PROFIT" headline', () => {
    const out = checkTakePartialProfit(rec('TAKE PARTIAL PROFIT'));
    expect(out.fire).toBe(true);
  });

  it('fires on the conviction-tagged variant', () => {
    const out = checkTakePartialProfit(rec('TAKE PARTIAL PROFIT — LOW CONVICTION'));
    expect(out.fire).toBe(true);
  });

  it('carries the engine\'s own explanation as the reason', () => {
    const out = checkTakePartialProfit(rec('TAKE PARTIAL PROFIT', 'Price is 1.2% below resistance while flow is reducing.'));
    expect(out.reason).toBe('Price is 1.2% below resistance while flow is reducing.');
  });

  it('does not fire on the generic "REDUCE PARTIAL" headline (a different call, not near resistance)', () => {
    const out = checkTakePartialProfit(rec('REDUCE PARTIAL'));
    expect(out.fire).toBe(false);
  });

  it('does not fire on HOLD, BUY, STRONG SELL, or WAIT headlines', () => {
    for (const label of ['HOLD', 'BUY', 'STRONG SELL', 'WAIT — NO NEW POSITION']) {
      expect(checkTakePartialProfit(rec(label)).fire).toBe(false);
    }
  });
});
