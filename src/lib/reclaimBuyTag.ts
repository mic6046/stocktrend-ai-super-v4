import { evaluatePullbackReclaim, type DailyBar } from './pullbackReclaim';

/**
 * "RECLAIM BUY" — the confirmatory sibling of the engine's existing
 * "PULLBACK BUY" tag (trend BULL + strong accumulation + price near
 * support, an anticipatory entry before any confirmation the decline has
 * stopped). This tag uses the SAME context gate (trend + accumulation) but
 * requires a confirmed reclaim instead of mere proximity to support.
 *
 * Backtested against 10 tickers over ~3.7 years with the context gate held
 * constant on both sides: near-identical average return (+5.64% vs +5.49%
 * over a 15-trading-day hold) but the reclaim condition fired more than
 * twice as often — it catches real setups the "near support" check misses
 * (price that already based and turned before ever registering as "near"
 * support in the engine's terms). Kept as a separate, additive tag rather
 * than replacing PULLBACK BUY, since both showed comparable quality.
 *
 * The accumulation check here (whale/inst/smart >= 80) is a simplified
 * proxy for the engine's internal strongAccumulation flag (which also
 * requires the other two measures not be actively bearish) — that flag
 * isn't exposed on QuantumEngineOutput, so this is the closest reasonable
 * approximation without duplicating engine internals.
 */
export function computeReclaimBuyTag(
  recommendation: string | null | undefined,
  trend: string | null | undefined,
  whaleScore: number | null | undefined,
  institutionalScore: number | null | undefined,
  smartMoneyScore: number | null | undefined,
  history: DailyBar[]
): 'RECLAIM BUY' | null {
  if (recommendation !== 'BUY' && recommendation !== 'STRONG BUY') return null;

  const trendIsBull = !!trend?.includes('BULL');
  const hasStrongAccum =
    (whaleScore ?? 0) >= 80 || (institutionalScore ?? 0) >= 80 || (smartMoneyScore ?? 0) >= 80;
  if (!trendIsBull || !hasStrongAccum) return null;

  const reclaim = evaluatePullbackReclaim(history);
  if (!reclaim) return null;
  if (reclaim.criteria.reclaimTrigger === 'PASS' && reclaim.criteria.higherLow !== 'FAIL') {
    return 'RECLAIM BUY';
  }
  return null;
}
