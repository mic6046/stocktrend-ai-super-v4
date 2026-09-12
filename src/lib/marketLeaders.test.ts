import { describe, it, expect } from 'vitest';
import { findMarketLeaders, INDEX_DOWN_THRESHOLD } from './marketLeaders';
import type { StockRecommendation } from './recommendation';

function stock(overrides: Partial<StockRecommendation> = {}): StockRecommendation {
  return {
    ticker: 'TEST',
    companyName: 'Test Co',
    recommendation: 'BUY',
    boardMetrics: { rsi: 55, smartMoney: 'Bull', fundFlow: 'Inflow', momentum: 'Bull', technicalTrend: 'BULLISH', change2dPct: 2 },
    ...overrides,
  } as any;
}

describe('findMarketLeaders — relative strength while the index is down', () => {
  it('returns nothing when the index is not meaningfully down', () => {
    const out = findMarketLeaders([stock()], INDEX_DOWN_THRESHOLD + 0.1);
    expect(out).toEqual([]);
  });

  it('returns nothing when the index change is unknown', () => {
    const out = findMarketLeaders([stock()], null);
    expect(out).toEqual([]);
  });

  it('picks up a stock clearly outperforming a falling index', () => {
    const out = findMarketLeaders([stock({ ticker: 'ACME', boardMetrics: { ...stock().boardMetrics, change2dPct: 2 } as any })], -2);
    expect(out.map((l) => l.ticker)).toContain('ACME');
    expect(out[0].outperformancePts).toBeCloseTo(4, 5);
  });

  it('excludes a stock that is also dropping too much, even if it beats the index', () => {
    // Index down 5%, stock down 2% — technically "outperforming" by 3pts, but
    // the user's own framing was "remaining stable... not dropping too much".
    const out = findMarketLeaders(
      [stock({ boardMetrics: { ...stock().boardMetrics, change2dPct: -2 } as any })],
      -5
    );
    expect(out).toEqual([]);
  });

  it('excludes a stock that is stable but not meaningfully beating the index', () => {
    // Index down 0.6% (just past the threshold), stock flat at 0% — only
    // 0.6pts of outperformance, below the 1.5pt margin.
    const out = findMarketLeaders(
      [stock({ boardMetrics: { ...stock().boardMetrics, change2dPct: 0 } as any })],
      -0.6
    );
    expect(out).toEqual([]);
  });

  it('excludes HOLD/REDUCE candidates even if their price action qualifies', () => {
    const out = findMarketLeaders([stock({ recommendation: 'HOLD' as any })], -2);
    expect(out).toEqual([]);
  });

  it('excludes a candidate with no 2-day change data rather than guessing', () => {
    const out = findMarketLeaders([stock({ boardMetrics: { ...stock().boardMetrics, change2dPct: null } as any })], -2);
    expect(out).toEqual([]);
  });

  it('flags a leader that is also near/above resistance', () => {
    const out = findMarketLeaders(
      [stock({ boardMetrics: { ...stock().boardMetrics, change2dPct: 3, srSignal: 'Near Resistance' } as any })],
      -2
    );
    expect(out[0].nearResistance).toBe(true);
  });

  it('does not flag resistance for a leader in mid-range', () => {
    const out = findMarketLeaders(
      [stock({ boardMetrics: { ...stock().boardMetrics, change2dPct: 3, srSignal: 'Mid Range' } as any })],
      -2
    );
    expect(out[0].nearResistance).toBe(false);
  });

  it('sorts by outperformance, strongest leader first', () => {
    const out = findMarketLeaders(
      [
        stock({ ticker: 'WEAK', boardMetrics: { ...stock().boardMetrics, change2dPct: 0 } as any }),
        stock({ ticker: 'STRONG', boardMetrics: { ...stock().boardMetrics, change2dPct: 5 } as any }),
      ],
      -3
    );
    expect(out.map((l) => l.ticker)).toEqual(['STRONG', 'WEAK']);
  });

  it('dedupes by ticker if the same candidate appears in multiple lists', () => {
    const s = stock({ boardMetrics: { ...stock().boardMetrics, change2dPct: 3 } as any });
    const out = findMarketLeaders([s, { ...s }], -2);
    expect(out.length).toBe(1);
  });
});
