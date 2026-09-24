/**
 * Peak & Trough Analog Finder — for one ticker, finds every past local peak
 * AND trough, checks what actually followed each (breakout vs pullback at
 * peaks, rebound vs breakdown at troughs), tags the fund-flow state
 * (accumulation/distribution, institutional flow, smart-money index) at
 * each one, and cross-tabs outcome against fund flow to test the
 * hypothesis: does inflow at a support test predict a rebound, and does
 * outflow at a resistance test predict the pullback?
 *
 * This is historical pattern-matching for a SPECIFIC stock's own past
 * behavior — not a general model, not self-modifying, and not something
 * that feeds back into the recommendation engine. Fund-flow here is the
 * same technical-indicator proxy (OBV/price-volume derived) that already
 * feeds whaleScore/institutionalScore elsewhere in the app — not literal
 * 13F filings or real order-flow data.
 */
import { calculateRSISeries, calculateSMA, computeTechnicalIndicators } from './technical';
import type { DailyBar } from './pullbackReclaim';

export type PeakOutcome = 'BREAKOUT' | 'PULLBACK' | 'MIXED' | 'TOO_RECENT';
export type TroughOutcome = 'REBOUND' | 'BREAKDOWN' | 'MIXED' | 'TOO_RECENT';
export type FundFlowLabel = 'INFLOW' | 'OUTFLOW' | 'NEUTRAL';

type ExtremeRecordBase = {
  idx: number;
  date: string;
  price: number;
  rsi: number | null;
  volRatio: number;
  volTrendIntoExtremePct: number | null;
  pctAboveMA50: number | null;
  fundFlow: FundFlowLabel;
  outcomeDetail: string;
};

export type PeakRecord = ExtremeRecordBase & { outcome: PeakOutcome };
export type TroughRecord = ExtremeRecordBase & { outcome: TroughOutcome };

export type SignalFingerprint = {
  count: number;
  avgRsi: number | null;
  avgVolRatio: number | null;
  avgVolTrendPct: number | null;
  avgPctAboveMA50: number | null;
};

export type PeakAnalogOptions = {
  /** A bar counts as a local peak/trough if it's the highest/lowest close within +/- this many trading days. */
  peakWindow?: number;
  /** Trading days forward used to classify what followed a peak/trough. */
  outcomeLookaheadDays?: number;
  /** % move beyond a peak/trough within the lookahead window to call it a breakout/rebound. */
  breakoutMarginPct?: number;
  /** % move against a peak/trough within the lookahead window to call it a pullback/breakdown. */
  pullbackMarginPct?: number;
};

export type CurrentState = {
  date: string;
  price: number;
  rsi: number | null;
  volRatio: number;
  volTrendIntoExtremePct: number | null;
  pctAboveMA50: number | null;
  fundFlow: FundFlowLabel;
  isNearRecentHigh: boolean;
  isNearRecentLow: boolean;
};

/** Outcome counts for one fund-flow bucket at peaks (breakout/pullback) or troughs (rebound/breakdown). */
export type OutcomeCounts = Record<string, number>;

export type FundFlowCrossTab = {
  peaksByFundFlow: Record<FundFlowLabel, OutcomeCounts>;
  troughsByFundFlow: Record<FundFlowLabel, OutcomeCounts>;
};

export type PeakAnalogResult = {
  peaks: PeakRecord[];
  troughs: TroughRecord[];
  breakoutFingerprint: SignalFingerprint | null;
  pullbackFingerprint: SignalFingerprint | null;
  reboundFingerprint: SignalFingerprint | null;
  breakdownFingerprint: SignalFingerprint | null;
  fundFlowCrossTab: FundFlowCrossTab;
  current: CurrentState;
};

const DEFAULTS: Required<PeakAnalogOptions> = {
  peakWindow: 10,
  outcomeLookaheadDays: 15,
  breakoutMarginPct: 2,
  pullbackMarginPct: 6,
};

/** Below this, computeTechnicalIndicators refuses to run (its own 15-bar floor) — treat fund flow as unknown rather than guessing. */
const MIN_BARS_FOR_FUND_FLOW = 15;

function avg(values: (number | null)[]): number | null {
  const vals = values.filter((v): v is number => v != null && Number.isFinite(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function fingerprintOf(records: ExtremeRecordBase[]): SignalFingerprint | null {
  if (!records.length) return null;
  return {
    count: records.length,
    avgRsi: avg(records.map((p) => p.rsi)),
    avgVolRatio: avg(records.map((p) => p.volRatio)),
    avgVolTrendPct: avg(records.map((p) => p.volTrendIntoExtremePct)),
    avgPctAboveMA50: avg(records.map((p) => p.pctAboveMA50)),
  };
}

function emptyCrossTabSide(): Record<FundFlowLabel, OutcomeCounts> {
  return { INFLOW: {}, OUTFLOW: {}, NEUTRAL: {} };
}

function tally(side: Record<FundFlowLabel, OutcomeCounts>, fundFlow: FundFlowLabel, outcome: string) {
  side[fundFlow][outcome] = (side[fundFlow][outcome] ?? 0) + 1;
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
  // Fund flow AS OF that historical date — truncates history so this is
  // never computed with knowledge of what happened afterward.
  const fundFlowAt = (i: number): FundFlowLabel => {
    if (i + 1 < MIN_BARS_FOR_FUND_FLOW) return 'NEUTRAL';
    const truncated = history.slice(0, i + 1);
    const tech = computeTechnicalIndicators(truncated, { regularMarketPrice: closes[i], regularMarketVolume: volumes[i] });
    if (!tech) return 'NEUTRAL';
    const ad = tech.quantumRefinement?.accumulationDistribution?.status;
    const instFlow = tech.indicators?.institutionalFlow?.status;
    const sm = tech.quantumRefinement?.smartMoneyIndex?.status;
    let bull = 0;
    let bear = 0;
    if (ad === 'ACCUMULATION') bull++;
    else if (ad === 'DISTRIBUTION') bear++;
    if (instFlow === 'LARGE_INFLOW' || instFlow === 'STEALTH_ACCUMULATION') bull++;
    else if (instFlow === 'LARGE_OUTFLOW' || instFlow === 'STEALTH_DISTRIBUTION') bear++;
    if (sm === 'BULLISH') bull++;
    else if (sm === 'BEARISH') bear++;
    if (bull > bear) return 'INFLOW';
    if (bear > bull) return 'OUTFLOW';
    return 'NEUTRAL';
  };

  const peaks: PeakRecord[] = [];
  const troughs: TroughRecord[] = [];

  for (let i = o.peakWindow; i < history.length - o.peakWindow; i++) {
    const windowStart = i - o.peakWindow;
    const windowEnd = i + o.peakWindow;
    const windowSlice = closes.slice(windowStart, windowEnd + 1);
    const isPeak = closes[i] === Math.max(...windowSlice);
    const isTrough = closes[i] === Math.min(...windowSlice);

    if (isPeak && (!peaks.length || i - peaks[peaks.length - 1].idx >= o.peakWindow)) {
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
        volTrendIntoExtremePct: volumeTrendInto(i),
        pctAboveMA50: pctAboveMA50At(i),
        fundFlow: fundFlowAt(i),
        outcome,
        outcomeDetail,
      });
    }

    if (isTrough && (!troughs.length || i - troughs[troughs.length - 1].idx >= o.peakWindow)) {
      let outcome: TroughOutcome;
      let outcomeDetail: string;
      if (i + o.outcomeLookaheadDays >= history.length) {
        outcome = 'TOO_RECENT';
        outcomeDetail = 'not enough forward data yet';
      } else {
        const future = closes.slice(i + 1, i + 1 + o.outcomeLookaheadDays);
        const upside = ((Math.max(...future) - closes[i]) / closes[i]) * 100;
        const downside = ((closes[i] - Math.min(...future)) / closes[i]) * 100;
        if (upside >= o.breakoutMarginPct && upside > downside) {
          outcome = 'REBOUND';
          outcomeDetail = `+${upside.toFixed(1)}% off the trough within ${o.outcomeLookaheadDays}d`;
        } else if (downside >= o.pullbackMarginPct) {
          outcome = 'BREAKDOWN';
          outcomeDetail = `-${downside.toFixed(1)}% below the trough within ${o.outcomeLookaheadDays}d`;
        } else {
          outcome = 'MIXED';
          outcomeDetail = `+${upside.toFixed(1)}% / -${downside.toFixed(1)}% (choppy, no clear resolution)`;
        }
      }
      troughs.push({
        idx: i,
        date: new Date(history[i].date).toISOString().slice(0, 10),
        price: closes[i],
        rsi: rsi[i],
        volRatio: volRatioAt(i),
        volTrendIntoExtremePct: volumeTrendInto(i),
        pctAboveMA50: pctAboveMA50At(i),
        fundFlow: fundFlowAt(i),
        outcome,
        outcomeDetail,
      });
    }
  }

  const resolvedPeaks = peaks.filter((p) => p.outcome === 'BREAKOUT' || p.outcome === 'PULLBACK');
  const breakoutFingerprint = fingerprintOf(resolvedPeaks.filter((p) => p.outcome === 'BREAKOUT'));
  const pullbackFingerprint = fingerprintOf(resolvedPeaks.filter((p) => p.outcome === 'PULLBACK'));

  const resolvedTroughs = troughs.filter((t) => t.outcome === 'REBOUND' || t.outcome === 'BREAKDOWN');
  const reboundFingerprint = fingerprintOf(resolvedTroughs.filter((t) => t.outcome === 'REBOUND'));
  const breakdownFingerprint = fingerprintOf(resolvedTroughs.filter((t) => t.outcome === 'BREAKDOWN'));

  const fundFlowCrossTab: FundFlowCrossTab = { peaksByFundFlow: emptyCrossTabSide(), troughsByFundFlow: emptyCrossTabSide() };
  for (const p of peaks) {
    if (p.outcome === 'TOO_RECENT') continue;
    tally(fundFlowCrossTab.peaksByFundFlow, p.fundFlow, p.outcome);
  }
  for (const t of troughs) {
    if (t.outcome === 'TOO_RECENT') continue;
    tally(fundFlowCrossTab.troughsByFundFlow, t.fundFlow, t.outcome);
  }

  const lastIdx = history.length - 1;
  const recentWindowStart = Math.max(0, lastIdx - o.peakWindow);
  const recentWindow = closes.slice(recentWindowStart, lastIdx + 1);
  const isNearRecentHigh = closes[lastIdx] >= Math.max(...recentWindow) * 0.98;
  const isNearRecentLow = closes[lastIdx] <= Math.min(...recentWindow) * 1.02;

  const current: CurrentState = {
    date: new Date(history[lastIdx].date).toISOString().slice(0, 10),
    price: closes[lastIdx],
    rsi: rsi[lastIdx],
    volRatio: volRatioAt(lastIdx),
    volTrendIntoExtremePct: volumeTrendInto(lastIdx),
    pctAboveMA50: pctAboveMA50At(lastIdx),
    fundFlow: fundFlowAt(lastIdx),
    isNearRecentHigh,
    isNearRecentLow,
  };

  return { peaks, troughs, breakoutFingerprint, pullbackFingerprint, reboundFingerprint, breakdownFingerprint, fundFlowCrossTab, current };
}
