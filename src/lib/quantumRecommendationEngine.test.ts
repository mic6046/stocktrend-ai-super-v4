import { describe, it, expect } from 'vitest';
import { runQuantumRecommendationEngine } from './quantumRecommendationEngine';
import type { QuantumEngineInput } from './quantumRecommendationEngine';

/**
 * Regression suite for the user-specified methodology rules added to the
 * Quantum recommendation engine. Each rule below was originally verified with
 * a throwaway synthetic script against a live session; these tests encode the
 * same synthetic cases permanently so a future, unrelated change can't
 * silently break one of them.
 *
 * These are synthetic-input tests (not live market data) — they isolate one
 * condition at a time to prove a specific rule, not to validate real-ticker
 * behavior. Real-ticker verification still belongs in a throwaway `_tmp_*.ts`
 * script run against live data before shipping an engine change.
 */

function baseInput(overrides: Partial<QuantumEngineInput> = {}): QuantumEngineInput {
  return {
    horizon: '1M',
    currentPrice: 100.5, // just above s1=100 -> nearSupport by default
    baseScore: 55,
    baseConfidence: 55,
    technical: {
      rsi: 45,
      macdBullish: false,
      trend: 'SIDEWAYS',
      volatility: 20, // Medium risk
      adx: 18,
      emaBias: 'neutral',
      smaBias: 'neutral',
      bollingerBias: 'mid',
      volumeBias: 'normal',
    },
    levels: { s1: 100, s2: 95, r1: 110, r2: 118 },
    whaleScore: 35,
    institutionalScore: 35,
    sentimentScore: 45,
    momentumScore: 40,
    smartMoneyScore: 35,
    userHasPosition: true,
    ...overrides,
  } as QuantumEngineInput;
}

function bullishSignalInput(overrides: Partial<QuantumEngineInput> = {}): QuantumEngineInput {
  return baseInput({
    currentPrice: 107, // above r1=105 -> breakout
    baseScore: 45, // deliberately weak fundamentals — these signals must dominate on their own
    levels: { s1: 95, s2: 90, r1: 105, r2: 112 },
    technical: {
      rsi: 58,
      macdBullish: true,
      trend: 'BULLISH',
      volatility: 18,
      adx: 22,
      emaBias: 'bull',
      smaBias: 'neutral',
      bollingerBias: 'mid',
      volumeBias: 'high',
    },
    whaleScore: 82,
    institutionalScore: 82,
    smartMoneyScore: 82,
    sentimentScore: 40,
    momentumScore: 60,
    userHasPosition: false,
    ...overrides,
  });
}

function run(input: QuantumEngineInput) {
  return runQuantumRecommendationEngine(input) as any;
}

function bullishLabels(out: any): string[] {
  return (out.bullishFactors || []).map((f: any) => f.label as string);
}

function bearishLabels(out: any): string[] {
  return (out.bearishFactors || []).map((f: any) => f.label as string);
}

describe('reaching support should never surface as REDUCE', () => {
  it('weak flow at support -> HOLD, never REDUCE', () => {
    const out = run(baseInput({}));
    expect(out.finalVerdict).not.toBe('REDUCE');
    expect(out.finalVerdict).toBe('HOLD');
    expect(out.validationStatus).toBe('✓ Internal Consistency Passed');
  });

  it('accumulation present at support, no confirmed bullish structure -> HOLD', () => {
    const out = run(baseInput({
      whaleScore: 60,
      institutionalScore: 60,
      smartMoneyScore: 60,
    }));
    expect(out.finalVerdict).toBe('HOLD');
    expect(out.validationStatus).toBe('✓ Internal Consistency Passed');
  });

  it('accumulation + rising price/volume at support -> escalates to a BUY-side call', () => {
    const out = run(baseInput({
      whaleScore: 60,
      institutionalScore: 60,
      smartMoneyScore: 60,
      technical: {
        rsi: 55,
        macdBullish: true,
        trend: 'BULLISH',
        volatility: 18,
        adx: 22,
        emaBias: 'bull',
        smaBias: 'neutral',
        bollingerBias: 'mid',
        volumeBias: 'high',
      },
    }));
    expect(['BUY', 'STRONG BUY']).toContain(out.finalVerdict);
    expect(out.expectedReturn).toBeGreaterThan(0);
    expect(out.validationStatus).toBe('✓ Internal Consistency Passed');
  });

  it('accumulation + affirmatively bullish foundation (even without a volume surge) -> scale in BUY', () => {
    const out = run(baseInput({
      whaleScore: 60,
      institutionalScore: 60,
      smartMoneyScore: 60,
      technical: {
        rsi: 48,
        macdBullish: true,
        trend: 'BULLISH',
        volatility: 18,
        adx: 22,
        emaBias: 'bull',
        smaBias: 'neutral',
        bollingerBias: 'mid',
        volumeBias: 'normal', // no volume surge — foundation alone should still be enough
      },
    }));
    expect(['BUY', 'STRONG BUY']).toContain(out.finalVerdict);
  });

  it('control: near support + accumulation, but no good foundation (sideways, neutral EMA) -> HOLD only', () => {
    const out = run(baseInput({
      whaleScore: 60,
      institutionalScore: 60,
      smartMoneyScore: 60,
      technical: {
        rsi: 45,
        macdBullish: false,
        trend: 'SIDEWAYS',
        volatility: 20,
        adx: 18,
        emaBias: 'neutral',
        smaBias: 'neutral',
        bollingerBias: 'mid',
        volumeBias: 'normal',
      },
    }));
    expect(out.finalVerdict).toBe('HOLD');
  });

  it('control: normal risk/RSI away from support -> REDUCE is still allowed', () => {
    const out = run(baseInput({ currentPrice: 105 })); // 5% above s1=100 -> not nearSupport
    expect(out.finalVerdict).toBe('REDUCE');
  });
});

describe('very-low risk and genuinely oversold RSI should not surface as REDUCE', () => {
  it('very-low volatility risk, mid-range price, weak flow -> HOLD not REDUCE', () => {
    const out = run(baseInput({
      currentPrice: 105, // not near support, isolates the risk-level rule specifically
      technical: {
        rsi: 45,
        macdBullish: false,
        trend: 'SIDEWAYS',
        volatility: 8, // -> riskLevel 'Very Low'
        adx: 18,
        emaBias: 'neutral',
        smaBias: 'neutral',
        bollingerBias: 'mid',
        volumeBias: 'normal',
      },
    }));
    expect(out.riskLevel).toBe('Very Low');
    expect(out.finalVerdict).toBe('HOLD');
  });

  it('genuinely oversold RSI (<30), mid-range price, weak flow -> HOLD not REDUCE', () => {
    const out = run(baseInput({
      currentPrice: 105, // not near support, isolates the oversold rule specifically
      technical: {
        rsi: 24,
        macdBullish: false,
        trend: 'SIDEWAYS',
        volatility: 20,
        adx: 18,
        emaBias: 'neutral',
        smaBias: 'neutral',
        bollingerBias: 'oversold',
        volumeBias: 'normal',
      },
    }));
    expect(out.finalVerdict).toBe('HOLD');
  });

  it('control: normal risk, RSI 45 (not oversold), mid-range -> REDUCE still allowed', () => {
    const out = run(baseInput({ currentPrice: 105 }));
    expect(out.finalVerdict).toBe('REDUCE');
    expect(out.riskLevel).not.toBe('Very Low');
  });
});

describe('reaching resistance', () => {
  const resistanceInput = (overrides: Partial<QuantumEngineInput> = {}) =>
    baseInput({
      currentPrice: 109, // near r1=110 -> nearResistance
      technical: {
        rsi: 62,
        macdBullish: false,
        trend: 'SIDEWAYS',
        volatility: 20,
        adx: 18,
        emaBias: 'neutral',
        smaBias: 'neutral',
        bollingerBias: 'mid',
        volumeBias: 'normal',
      },
      whaleScore: 50,
      institutionalScore: 50,
      smartMoneyScore: 50,
      ...overrides,
    });

  it('funds reducing at resistance (holder) -> REDUCE framed as "take partial profit"', () => {
    const out = run(resistanceInput({
      whaleScore: 30,
      institutionalScore: 30,
      smartMoneyScore: 30,
      userHasPosition: true,
    }));
    expect(out.finalVerdict).toBe('REDUCE');
    expect(out.currentAction.displayLabel).toContain('TAKE PARTIAL PROFIT');
    expect(out.criticalCaveat).toMatch(/take partial profit/i);
  });

  it('control: funds neutral at resistance (holder) -> HOLD, not pushed into REDUCE', () => {
    const out = run(resistanceInput({ userHasPosition: true }));
    expect(out.finalVerdict).toBe('HOLD');
  });

  it('every recommendation near resistance gets an explicit warning, holder or flat', () => {
    const holder = run(resistanceInput({ userHasPosition: true }));
    const flat = run(resistanceInput({ userHasPosition: false }));
    expect(holder.criticalCaveat).toBeTruthy();
    expect(flat.criticalCaveat).toBeTruthy();
  });

  it('control: funds reducing away from resistance (mid-range) -> generic REDUCE wording, not the resistance framing', () => {
    const out = run(baseInput({
      currentPrice: 104, // mid-range: >1.2% above s1=100, >2.5% below r1=110 — not near either
      whaleScore: 30,
      institutionalScore: 30,
      smartMoneyScore: 30,
      userHasPosition: true,
    }));
    expect(out.finalVerdict).toBe('REDUCE');
    expect(out.currentAction.displayLabel).not.toContain('TAKE PARTIAL PROFIT');
  });

  it('BUY/STRONG BUY near resistance warns to buy with care, pullback, or a real breakout', () => {
    const out = run(bullishSignalInput({
      currentPrice: 104, // near r1=105 -> nearResistance (not yet broken out)
    }));
    expect(['BUY', 'STRONG BUY']).toContain(out.finalVerdict);
    expect(out.criticalCaveat).toMatch(/buy with care/i);
    expect(out.criticalCaveat).toMatch(/pullback/i);
    expect(out.criticalCaveat).toMatch(/real breakout/i);
  });

  it('BUY/STRONG BUY with RSI overbought or bearish MACD gets a momentum-exhaustion warning', () => {
    const out = run(baseInput({
      currentPrice: 100,
      levels: { s1: 90, s2: 85, r1: 130, r2: 140 }, // resistance far away — isolates this rule from the resistance one
      whaleScore: 85,
      institutionalScore: 85,
      smartMoneyScore: 85,
      technical: {
        rsi: 71,
        macdBullish: false,
        trend: 'BULLISH',
        volatility: 18,
        adx: 22,
        emaBias: 'bull',
        smaBias: 'bull',
        bollingerBias: 'mid',
        volumeBias: 'normal',
      },
      userHasPosition: false,
    }));
    expect(['BUY', 'STRONG BUY']).toContain(out.finalVerdict);
    expect(out.criticalCaveat).toMatch(/overbought|bearish/i);
  });
});

describe('STRONG BUY signal priority (price/volume/breakout/accumulation/pullback > fundamentals)', () => {
  it('price rising with confirming volume alone -> STRONG BUY', () => {
    const out = run(baseInput({
      currentPrice: 100,
      baseScore: 45,
      levels: { s1: 95, s2: 90, r1: 105, r2: 110 },
      technical: {
        rsi: 58,
        macdBullish: true,
        trend: 'BULLISH',
        volatility: 18,
        adx: 22,
        emaBias: 'bull',
        smaBias: 'neutral',
        bollingerBias: 'mid',
        volumeBias: 'high',
      },
      whaleScore: 50,
      institutionalScore: 50,
      smartMoneyScore: 50,
      sentimentScore: 40,
      userHasPosition: false,
    }));
    expect(out.finalVerdict).toBe('STRONG BUY');
    expect(bullishLabels(out)).toEqual(
      expect.arrayContaining(['Price rising with confirming volume — high-conviction buy signal'])
    );
  });

  it('breakout confirmed by volume alone -> STRONG BUY', () => {
    const out = run(baseInput({
      currentPrice: 107,
      baseScore: 45,
      levels: { s1: 95, s2: 90, r1: 105, r2: 112 },
      technical: {
        rsi: 60,
        macdBullish: null as any,
        trend: 'SIDEWAYS',
        volatility: 20,
        adx: 20,
        emaBias: 'neutral',
        smaBias: 'neutral',
        bollingerBias: 'mid',
        volumeBias: 'high',
      },
      whaleScore: 50,
      institutionalScore: 50,
      smartMoneyScore: 50,
      userHasPosition: false,
    }));
    expect(out.finalVerdict).toBe('STRONG BUY');
    expect(bullishLabels(out)).toEqual(
      expect.arrayContaining(['Breakout above resistance confirmed by volume'])
    );
  });

  it('strong (80+) accumulation alone -> STRONG BUY', () => {
    const out = run(baseInput({
      currentPrice: 100,
      baseScore: 45,
      levels: { s1: 95, s2: 90, r1: 105, r2: 110 },
      whaleScore: 82,
      institutionalScore: 82,
      smartMoneyScore: 82,
      userHasPosition: false,
    }));
    expect(out.finalVerdict).toBe('STRONG BUY');
  });

  it('uptrend pullback to support alone -> STRONG BUY', () => {
    const out = run(baseInput({
      currentPrice: 96, // within 3% of s1=95, at/above it
      baseScore: 45,
      levels: { s1: 95, s2: 90, r1: 105, r2: 110 },
      technical: {
        rsi: 50,
        macdBullish: null as any,
        trend: 'BULLISH',
        volatility: 20,
        adx: 20,
        emaBias: 'bull',
        smaBias: 'neutral',
        bollingerBias: 'mid',
        volumeBias: 'normal',
      },
      whaleScore: 50,
      institutionalScore: 50,
      smartMoneyScore: 50,
      userHasPosition: false,
    }));
    expect(out.finalVerdict).toBe('STRONG BUY');
  });

  it('control: none of the four patterns, weak fundamentals -> stays HOLD', () => {
    const out = run(baseInput({
      currentPrice: 100,
      baseScore: 45,
      levels: { s1: 95, s2: 90, r1: 105, r2: 110 },
      whaleScore: 50,
      institutionalScore: 50,
      smartMoneyScore: 50,
      sentimentScore: 40,
      userHasPosition: false,
    }));
    expect(out.finalVerdict).toBe('HOLD');
  });

  it('safety: strong accumulation never forces a BUY when support is genuinely broken', () => {
    const out = run(baseInput({
      currentPrice: 92, // below s1=95*0.998 -> supportBroken
      whaleScore: 80,
      institutionalScore: 80,
      smartMoneyScore: 80,
      levels: { s1: 95, s2: 90, r1: 105, r2: 110 },
      technical: {
        rsi: 30,
        macdBullish: false,
        trend: 'BEARISH',
        volatility: 25,
        adx: 25,
        emaBias: 'bear',
        smaBias: 'bear',
        bollingerBias: 'mid',
        volumeBias: 'high',
      },
      userHasPosition: false,
    }));
    expect(out.finalVerdict).not.toBe('BUY');
    expect(out.finalVerdict).not.toBe('STRONG BUY');
  });

  it('a single 80+ flow reading contradicted by both other flow measures does not trigger the override', () => {
    // Regression for the SOFI case: institutional=80 alone, while whale and
    // smart-money are both clearly bearish, must not force STRONG BUY.
    const out = run(baseInput({
      currentPrice: 100,
      baseScore: 50,
      levels: { s1: 90, s2: 85, r1: 115, r2: 125 },
      whaleScore: 32,
      institutionalScore: 80,
      smartMoneyScore: 32,
      technical: {
        rsi: 45,
        macdBullish: false,
        trend: 'SIDEWAYS',
        volatility: 20,
        adx: 18,
        emaBias: 'neutral',
        smaBias: 'neutral',
        bollingerBias: 'mid',
        volumeBias: 'normal',
      },
      userHasPosition: false,
    }));
    expect(out.finalVerdict).not.toBe('STRONG BUY');
  });

  it('a single 80+ flow reading with at least one other measure not bearish still triggers the override', () => {
    const out = run(baseInput({
      currentPrice: 100,
      baseScore: 50,
      levels: { s1: 90, s2: 85, r1: 115, r2: 125 },
      whaleScore: 32,
      institutionalScore: 80,
      smartMoneyScore: 83, // not bearish — qualifies the 80+ institutional reading
      technical: {
        rsi: 45,
        macdBullish: false,
        trend: 'SIDEWAYS',
        volatility: 20,
        adx: 18,
        emaBias: 'neutral',
        smaBias: 'neutral',
        bollingerBias: 'mid',
        volumeBias: 'normal',
      },
      userHasPosition: false,
    }));
    expect(out.finalVerdict).toBe('STRONG BUY');
  });

  it('combined breakout + price/volume + accumulation -> STRONG BUY (all three signals present at once)', () => {
    const out = run(bullishSignalInput({}));
    expect(out.finalVerdict).toBe('STRONG BUY');
    const bull = bullishLabels(out);
    expect(bull).toEqual(
      expect.arrayContaining([
        'Breakout above resistance confirmed by volume',
        'Price rising with confirming volume — high-conviction buy signal',
        'Accumulation conviction very high (80+)',
      ])
    );
  });
});

describe('low P/E is extra-high conviction only when confirmed by flow, not on its own', () => {
  const peInput = (overrides: Partial<QuantumEngineInput> = {}) =>
    baseInput({
      currentPrice: 100,
      levels: { s1: 90, s2: 85, r1: 115, r2: 125 },
      technical: {
        rsi: 55,
        macdBullish: true,
        trend: 'BULLISH',
        volatility: 18,
        adx: 22,
        emaBias: 'bull',
        smaBias: 'neutral',
        bollingerBias: 'mid',
        volumeBias: 'high',
      },
      whaleScore: 82,
      institutionalScore: 82,
      smartMoneyScore: 82,
      sentimentScore: 50,
      momentumScore: 60,
      userHasPosition: false,
      ...overrides,
    });

  it('low P/E + strong accumulation + rising price/volume -> confidence boosted', () => {
    const withPE = run(peInput({ peRatio: 12 }));
    const withoutConfirmedPE = run(peInput({ peRatio: 30 })); // same accum/volume, P/E not low
    expect(withPE.finalVerdict).toBe('STRONG BUY');
    expect(bullishLabels(withPE)).toEqual(
      expect.arrayContaining(['Undervalued (P/E < 15) confirmed by accumulation and rising price/volume'])
    );
    expect(withPE.confidence).toBeGreaterThan(withoutConfirmedPE.confidence);
  });

  it('control: low P/E alone (no accumulation or rising volume) does not trigger the bonus — avoids value-trap false positives', () => {
    const out = run(peInput({
      peRatio: 10,
      whaleScore: 40,
      institutionalScore: 40,
      smartMoneyScore: 40,
      technical: {
        rsi: 45,
        macdBullish: false,
        trend: 'SIDEWAYS',
        volatility: 20,
        adx: 18,
        emaBias: 'neutral',
        smaBias: 'neutral',
        bollingerBias: 'mid',
        volumeBias: 'normal',
      },
    }));
    expect(bullishLabels(out)).not.toEqual(
      expect.arrayContaining(['Undervalued (P/E < 15) confirmed by accumulation and rising price/volume'])
    );
  });

  it('control: missing P/E data does not crash and does not trigger the bonus', () => {
    const out = run(peInput({ peRatio: null }));
    expect(out.validationStatus).toBe('✓ Internal Consistency Passed');
    expect(bullishLabels(out)).not.toEqual(
      expect.arrayContaining(['Undervalued (P/E < 15) confirmed by accumulation and rising price/volume'])
    );
  });
});

describe('price rounding precision for low-priced tickers (AMC-style regression)', () => {
  it('target price and expected return stay consistent for a sub-$3 stock (no cent-rounding drift)', () => {
    // AMC bug: rounding the target price to cents on a low-priced stock (1 cent
    // is ~0.4% of a $2.59 price) could push the target/expectedReturn pair out
    // of sync with each other and past the HOLD band, failing validation even
    // though the underlying call was correct. Checks the invariant directly
    // rather than pinning to one verdict, since which verdict a given price
    // resolves to can shift with unrelated evidence changes.
    const out = run(baseInput({
      currentPrice: 2.59,
      levels: { s1: 1.86, s2: 1.01, r1: 3.29, r2: 3.87 },
    }));
    const impliedReturn = ((out.targetPrice - out.currentPrice) / out.currentPrice) * 100;
    expect(Math.abs(impliedReturn - out.expectedReturn)).toBeLessThan(0.15);
    expect(out.validationStatus).toBe('✓ Internal Consistency Passed');
  });

  it('a HOLD call at a low price near its own support stays inside the +/-2.9% band', () => {
    const out = run(baseInput({
      currentPrice: 2.59,
      levels: { s1: 2.56, s2: 2.4, r1: 3.29, r2: 3.87 }, // price within 1.2% of support -> nearSupport
    }));
    expect(out.finalVerdict).toBe('HOLD');
    expect(Math.abs(out.expectedReturn)).toBeLessThan(3);
    expect(out.validationStatus).toBe('✓ Internal Consistency Passed');
  });
});

describe('risk level uses downside volatility, not just the blended average (Sortino-style)', () => {
  // baseInput()'s technical.volatility defaults to 20 (-> Medium on its own).
  it('a negatively-skewed stock (choppy overall, sharp-drop-prone) reads at least as risky as its downside volatility', () => {
    const out = run(baseInput({
      technical: {
        rsi: 45,
        macdBullish: false,
        trend: 'SIDEWAYS',
        volatility: 15, // Low on its own
        downsideVolatility: 35, // but High on the downside — this should win
        adx: 18,
        emaBias: 'neutral',
        smaBias: 'neutral',
        bollingerBias: 'mid',
        volumeBias: 'normal',
      } as any,
    }));
    expect(out.riskLabel).toBe('High');
  });

  it('a symmetric stock (downside volatility no worse than the average) is not penalized beyond its blended volatility', () => {
    const out = run(baseInput({
      technical: {
        rsi: 45,
        macdBullish: false,
        trend: 'SIDEWAYS',
        volatility: 15, // Low
        downsideVolatility: 10, // better than the average — should not raise the bucket
        adx: 18,
        emaBias: 'neutral',
        smaBias: 'neutral',
        bollingerBias: 'mid',
        volumeBias: 'normal',
      } as any,
    }));
    expect(out.riskLabel).toBe('Low');
  });

  it('missing downside volatility data falls back to the blended average alone (no crash, no phantom penalty)', () => {
    const out = run(baseInput({
      technical: {
        rsi: 45,
        macdBullish: false,
        trend: 'SIDEWAYS',
        volatility: 15,
        adx: 18,
        emaBias: 'neutral',
        smaBias: 'neutral',
        bollingerBias: 'mid',
        volumeBias: 'normal',
      },
    }));
    expect(out.riskLabel).toBe('Low');
  });
});
