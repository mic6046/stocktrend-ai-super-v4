import type { PeakAnalogResult } from './peakAnalog';

export type PeakAnalogWarningCheck = {
  fire: boolean;
  reason: string;
};

/** Need at least this many resolved (breakout/pullback) peaks before trusting a stock's own fingerprint. */
const MIN_RESOLVED_SAMPLE = 5;
/** The historical pullback rate must be genuinely dominant, not just a slim majority. */
const MIN_PULLBACK_RATE = 0.7;
/** Current RSI counts as "matching" the historical topping zone if within this many points of the average. */
const RSI_TOLERANCE = 5;
/** Current extension above the 50-day MA counts as "matching" if at least this fraction of the historical average. */
const MA_EXTENSION_TOLERANCE_RATIO = 0.75;

/**
 * Decides whether a stock is CURRENTLY sitting in the same zone where it has
 * historically topped out and pulled back — using that specific stock's own
 * track record (from analyzePeakAnalogs), not a generic RSI/extension rule.
 *
 * USER RULE: this only fires when there's a real, dominant pattern to lean
 * on (5+ resolved peaks, 70%+ of them pullbacks) — a stock with a mixed or
 * thin history doesn't get a forced verdict, matching the "Developing" /
 * "not enough data" principle used elsewhere (pullbackReclaim.ts).
 */
export function checkPeakAnalogWarning(ticker: string, result: PeakAnalogResult | null): PeakAnalogWarningCheck {
  if (!result) return { fire: false, reason: '' };
  if (!result.current.isNearRecentHigh) return { fire: false, reason: '' };

  const fp = result.pullbackFingerprint;
  if (!fp || fp.count < MIN_RESOLVED_SAMPLE) return { fire: false, reason: '' };

  const breakoutCount = result.breakoutFingerprint?.count ?? 0;
  const resolvedCount = fp.count + breakoutCount;
  const pullbackRate = resolvedCount > 0 ? fp.count / resolvedCount : 0;
  if (pullbackRate < MIN_PULLBACK_RATE) return { fire: false, reason: '' };

  const { rsi, pctAboveMA50 } = result.current;
  const rsiMatches = rsi != null && fp.avgRsi != null && rsi >= fp.avgRsi - RSI_TOLERANCE;
  const extensionMatches =
    pctAboveMA50 != null && fp.avgPctAboveMA50 != null && fp.avgPctAboveMA50 > 0
      ? pctAboveMA50 >= fp.avgPctAboveMA50 * MA_EXTENSION_TOLERANCE_RATIO
      : false;
  if (!rsiMatches && !extensionMatches) return { fire: false, reason: '' };

  const rsiText = fp.avgRsi != null ? fp.avgRsi.toFixed(0) : 'n/a';
  const extText = fp.avgPctAboveMA50 != null ? `+${fp.avgPctAboveMA50.toFixed(1)}%` : 'n/a';
  const nowRsiText = rsi != null ? rsi.toFixed(0) : 'n/a';
  const nowExtText = pctAboveMA50 != null ? `${pctAboveMA50 >= 0 ? '+' : ''}${pctAboveMA50.toFixed(1)}%` : 'n/a';

  return {
    fire: true,
    reason: `${ticker} is reaching a zone where it has pulled back in ${fp.count} of ${resolvedCount} past instances (${Math.round(pullbackRate * 100)}%) over the lookback window — historical topping average RSI ${rsiText} / ${extText} above the 50-day MA. Currently at RSI ${nowRsiText} / ${nowExtText} above MA50. Consider taking profit before chasing further.`,
  };
}
