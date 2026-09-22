/**
 * Peak Analog Finder — for one ticker, finds every past local peak, checks
 * what actually followed it (breakout continuation vs pullback vs
 * indecisive chop), extracts the average signal fingerprint (RSI, volume
 * behavior, extension above the 50-day MA) that distinguished breakouts
 * from pullbacks, and compares today's state against that fingerprint.
 *
 * This is historical pattern-matching for a SPECIFIC stock's own past
 * behavior — not a general model, not self-modifying, and not something
 * that feeds back into the recommendation engine. It answers "under what
 * conditions has THIS name historically broken out vs faded at highs,"
 * which a human then judges against the current setup.
 */
import { calculateRSISeries, calculateSMA } from './technical';
import type { DailyBar } from './pullbackReclaim';

export type PeakOutcome = 'BREAKOUT' | 'PULLBACK' | 'MIXED' | 'TOO_RECENT';

export type PeakRecord = {
  idx: number;
  date: string;
  price: number;
  rsi: number | null;
  volRatio: number;
  volTrendIntoPeakPct: number | null;
  pctAboveMA50: number | null;
  outcome: PeakOutcome;
  outcomeDetail: string;
};

export type SignalFingerprint = {
  count: number;
  avgRsi: number | null;
  avgVolRatio: number | null;
  avgVolTrendPct: number | null;
  avgPctAboveMA50: number | null;
};

export type PeakAnalogOptions = {
  /** A bar counts as a local peak if it's the highest close within +/- this many trading days. */
  peakWindow?: number;
  /** Trading days forward used to classify what followed a peak. */
  outcomeLookaheadDays?: number;
  /** % above the peak within the lookahead window to call it a breakout continuation. */
  breakoutMarginPct?: number;
  /** % decline from the peak within the lookahead window to call it a real pullback. */
  pullbackMarginPct?: number;
};

export type CurrentState = {
  date: string;
  price: number;
  rsi: number | null;
  volRatio: number;
  volTrendIntoPeakPct: number | null;
  pctAboveMA50: number | null;
  isNearRecentHigh: boolean;
};

export type PeakAnalogResult = {
  peaks: PeakRecord[];
  breakoutFingerprint: SignalFingerprint | null;
  pullbackFingerprint: SignalFingerprint | null;
  current: CurrentState;
};

const DEFAULTS: Required<PeakAnalogOptions> = {
  peakWindow: 10,
  outcomeLookaheadDays: 15,
  breakoutMarginPct: 2,
  pullbackMarginPct: 6,
};

function avg(values: (number | null)[]): number | null {
  const vals = values.filter((v): v is number => v != null && Number.isFinite(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function fingerprintOf(peaks: PeakRecord[]): SignalFingerprint | null {
  if (!peaks.length) return null;
  return {
    count: peaks.length,
    avgRsi: avg(peaks.map((p) => p.rsi)),
    avgVolRatio: avg(peaks.map((p) => p.volRatio)),
    avgVolTrendPct: avg(peaks.map((p) => p.volTrendIntoPeakPct)),
    avgPctAboveMA50: avg(peaks.map((p) => p.pctAboveMA50)),
  };
}

export function analyzePeakAnalogs(historyIn: DailyBar[], opts?: PeakAnalogOptions): PeakAnalogResult | null {
  const o = { ...DEFAULTS, ...opts };
  const history = historyIn.filter((h) => h?.close != null && Number.isFinite(Number(h.close)));
  if (history.length < o.peakWindow * 2 + 20) return null;

  const closes = history.map((h) => h.close);
  const volumes = history.map((h) => h.volume);
  const rsi = calculateRSISeries(closes, 14);

  const volRatioAt = (i: number): number => {
    const start = Math.max(0, i - 20);
    const denom = i - start;
    if (denom <= 0) return 1;
    const avgVol = volumes.slice(start, i).reduce((a, b) => a + b, 0) / denom;
    return avgVol > 0 ? volumes[i] / avgVol : 1;
  };
  const pctAboveMA50At = (i: number): number | null => {
    const ma = calculateSMA(closes.slice(0, i + 1), 50);
    return ma != null && ma > 0 ? ((closes[i] - ma) / ma) * 100 : null;
  };
  // Was volume building or fading in the 5 days leading into this bar, vs the 5 before that?
  const volumeTrendInto = (i: number): number | null => {
    if (i < 10) return null;
    const recent = volumes.slice(i - 4, i + 1).reduce((a, b) => a + b, 0) / 5;
    const prior = volumes.slice(i - 9, i - 4).reduce((a, b) => a + b, 0) / 5;
    return prior > 0 ? (recent / prior - 1) * 100 : null;
  };

  const peaks: PeakRecord[] = [];
  for (let i = o.peakWindow; i < history.length - o.peakWindow; i++) {
    const windowStart = i - o.peakWindow;
    const windowEnd = i + o.peakWindow;
    const isPeak = closes[i] === Math.max(...closes.slice(windowStart, windowEnd + 1));
    if (!isPeak) continue;
    if (peaks.length && i - peaks[peaks.length - 1].idx < o.peakWindow) continue; // skip near-duplicate adjacent peaks

    let outcome: PeakOutcome;
    let outcomeDetail: string;
    if (i + o.outcomeLookaheadDays >= history.length) {
      outcome = 'TOO_RECENT';
      outcomeDetail = 'not enough forward data yet';
    } else {
      const future = closes.slice(i + 1, i + 1 + o.outcomeLookaheadDays);
      const upside = ((Math.max(...future) - closes[i]) / closes[i]) * 100;
      const downside = ((closes[i] - Math.min(...future)) / closes[i]) * 100;
      if (upside >= o.breakoutMarginPct && upside > downside) {
        outcome = 'BREAKOUT';
        outcomeDetail = `+${upside.toFixed(1)}% beyond the peak within ${o.outcomeLookaheadDays}d`;
      } else if (downside >= o.pullbackMarginPct) {
        outcome = 'PULLBACK';
        outcomeDetail = `-${downside.toFixed(1)}% off the peak within ${o.outcomeLookaheadDays}d`;
      } else {
        outcome = 'MIXED';
        outcomeDetail = `+${upside.toFixed(1)}% / -${downside.toFixed(1)}% (choppy, no clear resolution)`;
      }
    }

    peaks.push({
      idx: i,
      date: new Date(history[i].date).toISOString().slice(0, 10),
      price: closes[i],
      rsi: rsi[i],
      volRatio: volRatioAt(i),
      volTrendIntoPeakPct: volumeTrendInto(i),
      pctAboveMA50: pctAboveMA50At(i),
      outcome,
      outcomeDetail,
    });
  }

  const resolved = peaks.filter((p): p is PeakRecord & { outcome: 'BREAKOUT' | 'PULLBACK' } =>
    p.outcome === 'BREAKOUT' || p.outcome === 'PULLBACK'
  );
  const breakoutFingerprint = fingerprintOf(resolved.filter((p) => p.outcome === 'BREAKOUT'));
  const pullbackFingerprint = fingerprintOf(resolved.filter((p) => p.outcome === 'PULLBACK'));

  const lastIdx = history.length - 1;
  const recentWindowStart = Math.max(0, lastIdx - o.peakWindow);
  const isNearRecentHigh = closes[lastIdx] >= Math.max(...closes.slice(recentWindowStart, lastIdx + 1)) * 0.98;

  const current: CurrentState = {
    date: new Date(history[lastIdx].date).toISOString().slice(0, 10),
    price: closes[lastIdx],
    rsi: rsi[lastIdx],
    volRatio: volRatioAt(lastIdx),
    volTrendIntoPeakPct: volumeTrendInto(lastIdx),
    pctAboveMA50: pctAboveMA50At(lastIdx),
    isNearRecentHigh,
  };

  return { peaks, breakoutFingerprint, pullbackFingerprint, current };
}
