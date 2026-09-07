import { describe, it, expect } from 'vitest';
import { applyPositionAwareness, classifySignalBucket, type CachedSignalRow } from './signalCache';

function row(recommendation: string, bucket?: CachedSignalRow['bucket']): CachedSignalRow {
  return { ticker: 'TEST', recommendation, bucket: bucket ?? classifySignalBucket(recommendation) };
}

describe('applyPositionAwareness — Dashboard Risk Alerts should not show REDUCE/SELL/TRIM for tickers you do not own', () => {
  it('relabels REDUCE to a no-position wait when the user does not own the ticker', () => {
    const out = applyPositionAwareness(row('REDUCE'), false);
    expect(out.recommendation).toBe('WAIT — NO NEW POSITION');
    expect(out.bucket).toBe('watch');
  });

  it('relabels SELL to a no-position wait when the user does not own the ticker', () => {
    const out = applyPositionAwareness(row('SELL'), false);
    expect(out.recommendation).toBe('WAIT — NO NEW POSITION');
    expect(out.bucket).toBe('watch');
  });

  it('relabels TRIM to a no-position wait when the user does not own the ticker', () => {
    const out = applyPositionAwareness(row('TRIM'), false);
    expect(out.recommendation).toBe('WAIT — NO NEW POSITION');
    expect(out.bucket).toBe('watch');
  });

  it('leaves REDUCE untouched when the user does own the ticker', () => {
    const out = applyPositionAwareness(row('REDUCE'), true);
    expect(out.recommendation).toBe('REDUCE');
    expect(out.bucket).toBe('risk');
  });

  it('leaves AVOID NEW POSITION untouched regardless of ownership — it is already position-agnostic', () => {
    const withoutPosition = applyPositionAwareness(row('AVOID NEW POSITION'), false);
    const withPosition = applyPositionAwareness(row('AVOID NEW POSITION'), true);
    expect(withoutPosition.recommendation).toBe('AVOID NEW POSITION');
    expect(withPosition.recommendation).toBe('AVOID NEW POSITION');
  });

  it('leaves BUY/HOLD/WAIT untouched regardless of ownership', () => {
    for (const rec of ['BUY', 'STRONG BUY', 'HOLD', 'WAIT']) {
      expect(applyPositionAwareness(row(rec), false).recommendation).toBe(rec);
      expect(applyPositionAwareness(row(rec), true).recommendation).toBe(rec);
    }
  });
});
