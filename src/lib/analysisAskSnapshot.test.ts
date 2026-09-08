import { describe, it, expect } from 'vitest';
import { buildAnalysisAskSnapshot } from './analysisAskSnapshot';
import type { StockRecommendation } from './recommendation';

function rec(overrides: Partial<StockRecommendation> = {}): StockRecommendation {
  return {
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
    overallScore: 81,
    confidence: 78,
    recommendation: 'BUY',
    currentAction: 'BUY',
    currentActionReason: 'Reason text',
    entryZone: { lo: 220, hi: 225 },
    targetPrice: 245,
    stopLoss: 210,
    expectedReturn: 10,
    riskScore: 68,
    riskLabel: 'High',
    aiExplanation: 'Strong momentum with confirming volume.',
    indicatorScores: {} as any,
    ranking: 0,
    dataTimestamp: Date.now(),
    isBuyCandidate: true,
    engine: {
      currentAction: { displayLabel: 'BUY', why: 'Breakout with volume confirmation.' },
      bullishFactors: [{ label: 'Price/volume surge', weight: 1, polarity: 'bull' }],
      bearishFactors: [{ label: 'Elevated valuation', weight: 0.5, polarity: 'bear' }],
    } as any,
    ...overrides,
  } as StockRecommendation;
}

describe('buildAnalysisAskSnapshot — grounds the AI Chat context in the same SSOT object every other panel reads', () => {
  it('returns null when there is no master recommendation (no ticker open)', () => {
    expect(buildAnalysisAskSnapshot({ masterRecommendation: null })).toBeNull();
  });

  it('maps the recommendation fields straight through, unmodified', () => {
    const snap = buildAnalysisAskSnapshot({ masterRecommendation: rec() });
    expect(snap?.ticker).toBe('AAPL');
    expect(snap?.score).toBe(81);
    expect(snap?.confidence).toBe(78);
    expect(snap?.risk).toBe('High');
    expect(snap?.targetPrice).toBe(245);
    expect(snap?.expectedReturn).toBe(10);
    expect(snap?.summaryLead).toBe('Strong momentum with confirming volume.');
  });

  it('prefers the engine\'s position-aware displayLabel/why over the raw recommendation/reason', () => {
    const snap = buildAnalysisAskSnapshot({ masterRecommendation: rec() });
    expect(snap?.action).toBe('BUY');
    expect(snap?.actionReason).toBe('Breakout with volume confirmation.');
  });

  it('pulls bullish/bearish factor labels from the engine output', () => {
    const snap = buildAnalysisAskSnapshot({ masterRecommendation: rec() });
    expect(snap?.bullishFactors).toEqual(['Price/volume surge']);
    expect(snap?.bearishFactors).toEqual(['Elevated valuation']);
  });

  it('derives macdBullish and formats volatility from the technical breakdown when present', () => {
    const snap = buildAnalysisAskSnapshot({
      masterRecommendation: rec(),
      technicalBreakdown: {
        indicators: {
          rsi: 58,
          macd: { macdLine: 1.2, signalLine: 0.8, histogram: 0.4 },
          annualizedVolatilityPct: 31.4,
        },
        quantumRefinement: { trendStrength: { status: 'BULLISH' } },
      } as any,
    });
    expect(snap?.rsi).toBe(58);
    expect(snap?.macdBullish).toBe(true);
    expect(snap?.trend).toBe('BULLISH');
    expect(snap?.volatility).toBe('31.4%/yr (annualized)');
  });

  it('formats the horizon as a readable label', () => {
    const snap = buildAnalysisAskSnapshot({ masterRecommendation: rec(), horizon: '1M' });
    expect(snap?.horizon).toBe('1 Month');
  });

  it('extracts up to 3 real headline titles, tolerating title or headline field naming', () => {
    const snap = buildAnalysisAskSnapshot({
      masterRecommendation: rec(),
      news: [
        { title: 'Apple beats earnings estimates' },
        { headline: 'iPhone sales surge in Q4' },
        { title: 'Analysts raise price targets' },
        { title: 'A fourth headline that should be dropped' },
      ],
    });
    expect(snap?.recentHeadlines).toEqual([
      'Apple beats earnings estimates',
      'iPhone sales surge in Q4',
      'Analysts raise price targets',
    ]);
  });

  it('omits recentHeadlines entirely when there is no real news', () => {
    const snap = buildAnalysisAskSnapshot({ masterRecommendation: rec(), news: [] });
    expect(snap?.recentHeadlines).toBeUndefined();
  });
});
