import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Info,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
} from 'lucide-react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
} from 'recharts';
import { format, subMonths, subYears, isAfter } from 'date-fns';
import { cn } from '../lib/utils';
import { FitText, splitStatusLabel } from './FitText';
import { HeroStatusBlock } from './AiStockScoreCard';

export type ValuationPoint = {
  date: string;
  rawDate: Date;
  pe: number;
  price: number;
};

type RangeKey = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | '10Y' | 'MAX';

/** Valuation heat — overheat levels 1–3 (3 = max). */
type ValuationStatus =
  | 'Deeply Undervalued'
  | 'Undervalued'
  | 'Fair Value'
  | 'Overheat Level 1'
  | 'Overheat Level 2'
  | 'Overheat Level 3';

/** 0 = cool / fair; 1–3 = overheat intensity (3 = max). */
type OverheatLevel = 0 | 1 | 2 | 3;

type RecommendationAction = 'Strong Buy' | 'Buy' | 'Hold' | 'Reduce' | 'Sell';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: '1Y' },
  { key: '3Y', label: '3Y' },
  { key: '5Y', label: '5Y' },
  { key: '10Y', label: '10Y' },
  { key: 'MAX', label: 'MAX' },
];

function cutoffForRange(key: RangeKey, now = new Date()): Date | null {
  switch (key) {
    case '1M':
      return subMonths(now, 1);
    case '3M':
      return subMonths(now, 3);
    case '6M':
      return subMonths(now, 6);
    case '1Y':
      return subYears(now, 1);
    case '3Y':
      return subYears(now, 3);
    case '5Y':
      return subYears(now, 5);
    case '10Y':
      return subYears(now, 10);
    default:
      return null;
  }
}

function mean(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stdev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  const v = nums.reduce((acc, n) => acc + (n - m) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(v);
}

function percentileRank(sortedAsc: number[], value: number): number {
  if (!sortedAsc.length) return 50;
  let below = 0;
  for (const v of sortedAsc) {
    if (v < value) below += 1;
    else break;
  }
  return Math.round((below / sortedAsc.length) * 100);
}

/** Single source of truth: historical percentile → valuation / overheat status */
function statusFromPercentile(percentile: number): ValuationStatus {
  const p = Math.min(100, Math.max(0, percentile));
  if (p < 20) return 'Deeply Undervalued';
  if (p < 40) return 'Undervalued';
  if (p < 60) return 'Fair Value';
  if (p < 75) return 'Overheat Level 1';
  if (p < 90) return 'Overheat Level 2';
  return 'Overheat Level 3';
}

function overheatLevelFromStatus(status: ValuationStatus): OverheatLevel {
  if (status === 'Overheat Level 1') return 1;
  if (status === 'Overheat Level 2') return 2;
  if (status === 'Overheat Level 3') return 3;
  return 0;
}

function overheatMeta(level: OverheatLevel): {
  short: string;
  severity: string;
  warningTitle: string;
  warningBody: string;
} {
  switch (level) {
    case 1:
      return {
        short: 'L1 Mild',
        severity: 'Mild overheat',
        warningTitle: 'Overheat Warning · Level 1 of 3',
        warningBody:
          'Multiples are modestly rich versus this stock’s own history. Momentum can still work, but new size should wait for a cooler entry.',
      };
    case 2:
      return {
        short: 'L2 Elevated',
        severity: 'Elevated overheat',
        warningTitle: 'Overheat Warning · Level 2 of 3',
        warningBody:
          'Valuation is stretched into the upper historical band. Upside is less reliable — prefer holding or trimming rather than chasing.',
      };
    case 3:
      return {
        short: 'L3 Max',
        severity: 'Maximum overheat',
        warningTitle: 'Overheat Warning · Level 3 of 3 (Max)',
        warningBody:
          'PE sits near the hottest historical extremes. This is the strongest valuation caution — wait for mean reversion before adding risk.',
      };
    default:
      return {
        short: 'Cool',
        severity: 'No overheat',
        warningTitle: 'Valuation Cool',
        warningBody: 'Multiples are not in an overheat band relative to this stock’s own history.',
      };
  }
}

function statusTone(status: ValuationStatus) {
  if (status === 'Deeply Undervalued') {
    return {
      text: 'text-emerald-600',
      bg: 'bg-emerald-950/45',
      border: 'border-emerald-700/45',
      dot: 'bg-emerald-700',
      gauge: '#047857',
      icon: '🟢',
      label: 'Deeply Undervalued',
      badge: '🟢 Deeply Undervalued',
      subtitle: 'Deep discount vs history',
    };
  }
  if (status === 'Undervalued') {
    return {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      dot: 'bg-emerald-400',
      gauge: '#10b981',
      icon: '🟢',
      label: 'Undervalued',
      badge: '🟢 Undervalued',
      subtitle: 'Attractive vs history',
    };
  }
  if (status === 'Overheat Level 1') {
    return {
      text: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      dot: 'bg-orange-400',
      gauge: '#fb923c',
      icon: '🟡',
      label: 'Overheat Level 1',
      badge: '🟡 Overheat L1 · Mild',
      subtitle: 'Mild overheat — wait for a better entry',
    };
  }
  if (status === 'Overheat Level 2') {
    return {
      text: 'text-orange-500',
      bg: 'bg-orange-600/15',
      border: 'border-orange-500/40',
      dot: 'bg-orange-500',
      gauge: '#f97316',
      icon: '🟠',
      label: 'Overheat Level 2',
      badge: '🟠 Overheat L2 · Elevated',
      subtitle: 'Elevated overheat — avoid chasing',
    };
  }
  if (status === 'Overheat Level 3') {
    return {
      text: 'text-rose-400',
      bg: 'bg-rose-500/15',
      border: 'border-rose-500/45',
      dot: 'bg-rose-400',
      gauge: '#f43f5e',
      icon: '🔴',
      label: 'Overheat Level 3',
      badge: '🔴 Overheat L3 · Max',
      subtitle: 'Maximum overheat — highest valuation caution',
    };
  }
  return {
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    dot: 'bg-cyan-400',
    gauge: '#22d3ee',
    icon: '🔵',
    label: 'Fair Value',
    badge: '🔵 Fair Value',
    subtitle: 'Balanced vs history',
  };
}

function recommendationFromStatus(
  status: ValuationStatus,
  premiumPct: number
): {
  action: RecommendationAction;
  confidence: number;
  expectedReturnPct: number;
  signal: string;
} {
  const absPrem = Math.abs(premiumPct);
  switch (status) {
    case 'Deeply Undervalued':
      return {
        action: 'Strong Buy',
        confidence: 86,
        expectedReturnPct: Math.min(24, Math.max(12, absPrem * 0.95)),
        signal: 'BUY ON WEAKNESS',
      };
    case 'Undervalued':
      return {
        action: 'Buy',
        confidence: 76,
        expectedReturnPct: Math.min(14, Math.max(6, absPrem * 0.85)),
        signal: 'ACCUMULATE',
      };
    case 'Fair Value':
      return {
        action: 'Hold',
        confidence: 68,
        expectedReturnPct: Math.min(5, Math.max(-2, -premiumPct * 0.15)),
        signal: 'HOLD / WAIT',
      };
    case 'Overheat Level 1':
      return {
        action: 'Reduce',
        confidence: 70,
        expectedReturnPct: -Math.min(8, Math.max(2, absPrem * 0.3)),
        signal: 'WAIT FOR BETTER ENTRY',
      };
    case 'Overheat Level 2':
      return {
        action: 'Reduce',
        confidence: 76,
        expectedReturnPct: -Math.min(12, Math.max(5, absPrem * 0.4)),
        signal: 'TRIM / WAIT',
      };
    case 'Overheat Level 3':
      return {
        action: 'Sell',
        confidence: 84,
        expectedReturnPct: -Math.min(20, Math.max(10, absPrem * 0.55)),
        signal: 'STAND DOWN · MAX OVERHEAT',
      };
  }
}

function explanationForStatus(status: ValuationStatus, overheat: OverheatLevel): string[] {
  const heat = overheatMeta(overheat);
  switch (status) {
    case 'Deeply Undervalued':
      return [
        'Valuation sits in the cheapest historical band — long-term margin of safety is elevated.',
        'Weakness into this zone is a potential accumulation window, not a reason to abandon the thesis.',
        'Still size carefully: cheap multiples do not remove near-term price risk.',
      ];
    case 'Undervalued':
      return [
        'Long-term valuation remains attractive relative to this stock’s own history.',
        'Short-term momentum can still be soft — prefer staged buys over all-in entries.',
        'No overheat warning is active; valuation is supportive of a constructive stance.',
      ];
    case 'Fair Value':
      return [
        'Multiples are balanced versus history — neither a deep bargain nor an overheat.',
        'Best practice: accumulate on dips rather than chasing extended prints.',
        'Valuation is neutral context for the Master Engine trading stance.',
      ];
    case 'Overheat Level 1':
      return [
        `${heat.warningTitle}: ${heat.severity}.`,
        heat.warningBody,
        'Master trading stance can still be constructive, but PE heat says wait for a cooler print before adding size.',
        'Use pullbacks toward the historical average PE as preferred entry zones.',
      ];
    case 'Overheat Level 2':
      return [
        `${heat.warningTitle}: ${heat.severity}.`,
        heat.warningBody,
        'This is the second of three overheat tiers — valuation risk is material even if momentum remains firm.',
        'Avoid FOMO adds. Prefer hold / partial trim until percentile cools below the elevated band.',
      ];
    case 'Overheat Level 3':
      return [
        `${heat.warningTitle}: ${heat.severity} — the strongest valuation caution on this scale.`,
        heat.warningBody,
        'Level 3 means PE is in the hottest historical extremes for this ticker. Mean-reversion risk is elevated.',
        'Do not let a bullish Master stance override entry discipline — wait for a better price or a cooler multiple.',
      ];
  }
}

function currencySymbol(code?: string) {
  if (code === 'HKD') return 'HK$';
  if (code === 'CNY' || code === 'CNH') return '¥';
  if (code === 'EUR') return '€';
  if (code === 'GBP') return '£';
  return '$';
}

function correlationLabel(priceDelta: number, peDelta: number): { title: string; detail: string } {
  const pUp = priceDelta > 1.5;
  const pDown = priceDelta < -1.5;
  const peUp = peDelta > 1.5;
  const peDown = peDelta < -1.5;

  if (pUp && peUp) return { title: 'Healthy rerating', detail: 'Price ↑ and PE ↑ — market is paying more for earnings expansion.' };
  if (pUp && !peUp && !peDown) return { title: 'Earnings growth', detail: 'Price ↑ while PE is stable — gains are earnings-supported.' };
  if (pUp && peDown) return { title: 'Fundamental improvement', detail: 'Price ↑ and PE ↓ — earnings are catching up faster than price.' };
  if (pDown && peUp) return { title: 'Temporary selloff', detail: 'Price ↓ while PE ↑ — earnings soft or market pricing a short-term scare.' };
  if (pDown && peDown) return { title: 'Bearish trend', detail: 'Price ↓ and PE ↓ — de-rating with weaker price action.' };
  if (!pUp && !pDown && peUp) return { title: 'Market optimism', detail: 'Price flat while PE ↑ — multiples expanding without price confirmation.' };
  if (!pUp && !pDown && peDown) return { title: 'Multiple compression', detail: 'Price flat while PE ↓ — valuation cooling into a range.' };
  return { title: 'Range-bound tape', detail: 'Price and PE are coiling — wait for a clearer valuation catalyst.' };
}

function ValuationTooltip({
  active,
  payload,
  avgPe,
  currentPe,
}: {
  active?: boolean;
  payload?: any[];
  avgPe: number;
  currentPe: number;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as ValuationPoint & {
    avgPe?: number;
    premiumPct?: number;
    percentile?: number;
    status?: ValuationStatus;
  };
  if (!row) return null;
  const avg = row.avgPe ?? avgPe;
  const premium = row.premiumPct ?? ((row.pe - avg) / avg) * 100;
  const percentile = row.percentile ?? 50;
  const status = row.status ?? statusFromPercentile(percentile);
  const tone = statusTone(status);
  const livePe = currentPe > 0 ? currentPe : row.pe;

  return (
    <div className="rounded-xl border border-white/10 bg-[#0c0c0e]/95 backdrop-blur-md px-3.5 py-3 shadow-2xl min-w-[230px] max-w-[300px]">
      <p className="text-[9px] font-mono uppercase tracking-wider text-gray-500 mb-2">
        {row.rawDate ? format(row.rawDate, 'MMM d, yyyy') : row.date}
      </p>
      <div className="space-y-1.5 text-[11px] font-mono">
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Historical PE</span>
          <span className="text-violet-300 font-bold">{row.pe.toFixed(2)}×</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Current PE</span>
          <span className="text-white font-bold">{livePe.toFixed(2)}×</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Historical Average PE</span>
          <span className="text-gray-200 font-bold">{avg.toFixed(2)}×</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Premium / Discount %</span>
          <span className={cn('font-bold', premium >= 0 ? 'text-rose-400' : 'text-emerald-400')}>
            {premium >= 0 ? '+' : ''}
            {premium.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Historical Percentile</span>
          <span className="text-white font-bold">{percentile}%</span>
        </div>
        <div className="flex justify-between gap-4 items-center pt-1 border-t border-white/5 min-w-0">
          <span className="text-gray-500 shrink-0">Valuation Heat</span>
          <span className={cn('font-bold text-right min-w-0 break-words leading-tight', tone.text)}>{status}</span>
        </div>
        {overheatLevelFromStatus(status) > 0 && (
          <div className="flex justify-between gap-4 items-center min-w-0">
            <span className="text-gray-500 shrink-0">Overheat</span>
            <span className={cn('font-bold text-right', tone.text)}>
              Level {overheatLevelFromStatus(status)} / 3
              {overheatLevelFromStatus(status) === 3 ? ' · Max' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface HistoricalValuationDashboardProps {
  data: ValuationPoint[];
  ticker: string;
  stockName?: string;
  currentPe: number;
  currentPrice: number;
  currency?: string;
  eps?: number;
  /** Master Engine recommendation — only allowed trading stance on this page */
  masterRecommendation?: string;
  masterExpectedReturn?: number | null;
  masterHorizonLabel?: string;
}

export function HistoricalValuationDashboard({
  data,
  ticker,
  stockName,
  currentPe,
  currentPrice,
  currency = 'USD',
  eps = 0,
  masterRecommendation,
  masterExpectedReturn,
  masterHorizonLabel,
}: HistoricalValuationDashboardProps) {
  const [range, setRange] = useState<RangeKey>('5Y');
  const displayName = stockName?.trim() || '';
  const sym = currencySymbol(currency);

  const filtered = useMemo(() => {
    const cut = cutoffForRange(range);
    const rows = !cut ? data : data.filter((d) => isAfter(d.rawDate, cut) || d.rawDate.getTime() === cut.getTime());
    return rows.length ? rows : data;
  }, [data, range]);

  const analytics = useMemo(() => {
    const pes = filtered.map((d) => d.pe).filter((n) => n > 0 && Number.isFinite(n));
    const prices = filtered.map((d) => d.price).filter((n) => n > 0 && Number.isFinite(n));
    const avgPe = mean(pes) || currentPe || 1;
    const pe1y = mean(
      data
        .filter((d) => isAfter(d.rawDate, subYears(new Date(), 1)))
        .map((d) => d.pe)
        .filter((n) => n > 0)
    );
    const pe3y = mean(
      data
        .filter((d) => isAfter(d.rawDate, subYears(new Date(), 3)))
        .map((d) => d.pe)
        .filter((n) => n > 0)
    );
    const pe5y = mean(
      data
        .filter((d) => isAfter(d.rawDate, subYears(new Date(), 5)))
        .map((d) => d.pe)
        .filter((n) => n > 0)
    );
    const pe10y = mean(
      data
        .filter((d) => isAfter(d.rawDate, subYears(new Date(), 10)))
        .map((d) => d.pe)
        .filter((n) => n > 0)
    );

    const latestPe = pes.length ? pes[pes.length - 1] : currentPe;
    const latestPrice = prices.length ? prices[prices.length - 1] : currentPrice;
    const premiumPct = avgPe > 0 ? ((latestPe - avgPe) / avgPe) * 100 : 0;
    const sorted = [...pes].sort((a, b) => a - b);
    const pctile = percentileRank(sorted, latestPe);
    const status = statusFromPercentile(pctile);
    const high = sorted.length ? sorted[sorted.length - 1] : latestPe;
    const low = sorted.length ? sorted[0] : latestPe;
    const sd = stdev(pes);
    const intrinsic = eps > 0 ? avgPe * eps : latestPrice * (avgPe / Math.max(latestPe, 0.01));
    const marginOfSafety = intrinsic > 0 ? ((intrinsic - latestPrice) / intrinsic) * 100 : -premiumPct;

    const startPe = pes[0] ?? latestPe;
    const startPrice = prices[0] ?? latestPrice;
    const priceDeltaPct = startPrice > 0 ? ((latestPrice - startPrice) / startPrice) * 100 : 0;
    const peDeltaPct = startPe > 0 ? ((latestPe - startPe) / startPe) * 100 : 0;
    const corr = correlationLabel(priceDeltaPct, peDeltaPct);
    const rec = recommendationFromStatus(status, premiumPct);

    const undervaluedMax = avgPe * 0.92;
    const fairMax = avgPe * 1.08;
    const overheat1Max = avgPe * 1.2;
    const overheat2Max = avgPe * 1.35;
    const peMin = Math.min(...pes, undervaluedMax * 0.85);
    const peMax = Math.max(...pes, overheat2Max * 1.12);
    const overheatLevel = overheatLevelFromStatus(status);

    const chartData = filtered.map((d) => {
      const prem = ((d.pe - avgPe) / avgPe) * 100;
      const pointPctile = percentileRank(sorted, d.pe);
      // Intentionally omit `price` — PE-only chart must never receive price series data
      return {
        date: d.date,
        rawDate: d.rawDate,
        pe: d.pe,
        avgPe: parseFloat(avgPe.toFixed(2)),
        premiumPct: parseFloat(prem.toFixed(2)),
        percentile: pointPctile,
        status: statusFromPercentile(pointPctile),
      };
    });

    return {
      avgPe,
      pe1y: pe1y || avgPe,
      pe3y: pe3y || avgPe,
      pe5y: pe5y || avgPe,
      pe10y: pe10y || avgPe,
      latestPe,
      latestPrice,
      premiumPct,
      status,
      overheatLevel,
      pctile,
      high,
      low,
      sd,
      intrinsic,
      marginOfSafety,
      corr,
      rec,
      undervaluedMax,
      fairMax,
      overheat1Max,
      overheat2Max,
      peMin,
      peMax,
      chartData,
    };
  }, [filtered, data, currentPe, currentPrice, eps]);

  const tone = statusTone(analytics.status);
  const overheat = overheatMeta(analytics.overheatLevel);
  const aiParagraphs = explanationForStatus(analytics.status, analytics.overheatLevel);
  const hasData = filtered.length > 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#111113]/90 backdrop-blur-xl overflow-visible shadow-[0_0_40px_rgba(0,0,0,0.35)]">
      {/* Header */}
      <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-white/5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <h3 className="text-sm font-bold text-white tracking-wide">Historical PE Valuation</h3>
              <span title="Compares current PE to this stock’s own history — valuation heat only, not a trade order">
                <Info className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
              <span className="text-sm font-black text-white tracking-tight">{ticker.toUpperCase()}</span>
              {displayName && (
                <span className="text-[12px] text-gray-300 font-medium break-words leading-snug">
                  {displayName}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-gray-400 leading-relaxed max-w-2xl">
              Maps today’s PE against this ticker’s own history. Overheat runs Level 1 → 3 (3 = max).
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRange(opt.key)}
                className={cn(
                  'px-2 py-1 rounded-md text-[9px] font-mono font-bold border cursor-pointer transition-all',
                  range === opt.key
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-200'
                    : 'bg-white/[0.02] border-white/5 text-gray-500 hover:text-gray-300'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Valuation Heat — full-width status band */}
        <div
          className={cn(
            'rounded-xl border px-4 py-5 sm:px-6 sm:py-6 flex flex-col items-center justify-center text-center w-full gap-2',
            tone.border,
            tone.bg
          )}
          style={{ boxShadow: `0 0 32px ${tone.gauge}40` }}
        >
          <p className="text-[9px] font-mono uppercase tracking-wider text-gray-500">Valuation Heat</p>
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-2">
            <span className="text-[11px] font-mono font-bold text-white">{ticker.toUpperCase()}</span>
            {displayName && (
              <span className="text-[11px] text-gray-300 font-medium break-words text-center leading-snug">
                {displayName}
              </span>
            )}
          </div>
          <ValuationStatusLabel label={tone.label} textClassName={tone.text} size="lg" />
          <p className={cn('text-[11px] font-mono font-bold', tone.text)}>{tone.subtitle}</p>
          <p className="text-[10px] font-mono text-gray-500 tabular-nums">
            {analytics.pctile}th historical percentile
            {analytics.overheatLevel > 0 ? ` · ${overheat.short}` : ''}
          </p>
          <OverheatLevelMeter level={analytics.overheatLevel} />
        </div>

        {/* Equal metric cards — valuation only */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 items-stretch">
          <MetricTile label="Current PE" value={`${analytics.latestPe.toFixed(1)}×`} />
          <MetricTile label="Historical Avg PE" value={`${analytics.avgPe.toFixed(1)}×`} sub={`${range} window`} />
          <MetricTile
            label="Premium / Discount"
            value={`${analytics.premiumPct >= 0 ? '+' : ''}${analytics.premiumPct.toFixed(1)}%`}
            valueClass={analytics.premiumPct >= 0 ? 'text-rose-400' : 'text-emerald-400'}
          />
          <MetricTile label="Historical Percentile" value={`${analytics.pctile}%`} />
          <MetricTile
            label="Overheat Level"
            value={analytics.overheatLevel === 0 ? 'None' : `${analytics.overheatLevel} / 3`}
            sub={analytics.overheatLevel === 3 ? 'Max overheat' : overheat.severity}
            valueClass={
              analytics.overheatLevel === 3
                ? 'text-rose-400'
                : analytics.overheatLevel >= 1
                  ? 'text-orange-400'
                  : 'text-emerald-400'
            }
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
          {/* PE-only valuation chart */}
          <div className="xl:col-span-2 rounded-2xl border border-white/10 bg-black/30 p-3 sm:p-4 flex flex-col">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-white tracking-wide">PE vs Own History</p>
                <p className="mt-0.5 text-[10px] text-gray-500 leading-snug max-w-md">
                  Violet line = historical PE. Bands show cool → fair → overheat L1–L3.
                </p>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-mono text-gray-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.8)]" /> Historical PE
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 border-t border-dashed border-slate-400" /> Avg PE
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-300 shadow-[0_0_8px_rgba(196,181,253,0.9)]" /> Live PE
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/35 border border-emerald-500/40" /> Cool
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-sky-500/35 border border-sky-500/40" /> Fair
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-orange-400/40 border border-orange-400/45" /> Overheat L1
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-orange-500/45 border border-orange-500/50" /> Overheat L2
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/45 border border-rose-500/50" /> Overheat L3
                </span>
              </div>
            </div>

            <div className="h-[300px] w-full relative">
              {hasData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={analytics.chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="peFillGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="zoneUndervalued" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.16} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.04} />
                      </linearGradient>
                      <linearGradient id="zoneFair" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.14} />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.04} />
                      </linearGradient>
                      <linearGradient id="zoneOverheat1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb923c" stopOpacity={0.14} />
                        <stop offset="100%" stopColor="#fb923c" stopOpacity={0.04} />
                      </linearGradient>
                      <linearGradient id="zoneOverheat2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity={0.16} />
                        <stop offset="100%" stopColor="#f97316" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="zoneOverheat3" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.06} />
                      </linearGradient>
                      <filter id="currentPeGlow" x="-80%" y="-80%" width="260%" height="260%">
                        <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      minTickGap={36}
                      tick={{ fill: '#6b7280', fontSize: 9, fontFamily: 'monospace' }}
                    />
                    <YAxis
                      yAxisId="pe"
                      domain={[
                        Math.max(0, analytics.peMin * 0.9),
                        analytics.peMax * 1.05,
                      ]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#a78bfa', fontSize: 9, fontFamily: 'monospace' }}
                      width={44}
                      tickFormatter={(v: number) => `${Number(v).toFixed(0)}×`}
                      label={{
                        value: 'PE Multiple',
                        angle: -90,
                        position: 'insideLeft',
                        offset: 8,
                        style: { fill: '#6b7280', fontSize: 9, fontFamily: 'monospace' },
                      }}
                    />
                    <ReferenceArea
                      yAxisId="pe"
                      y1={Math.max(0, analytics.peMin * 0.9)}
                      y2={analytics.undervaluedMax}
                      fill="url(#zoneUndervalued)"
                      fillOpacity={1}
                      ifOverflow="extendDomain"
                    />
                    <ReferenceArea
                      yAxisId="pe"
                      y1={analytics.undervaluedMax}
                      y2={analytics.fairMax}
                      fill="url(#zoneFair)"
                      fillOpacity={1}
                      ifOverflow="extendDomain"
                    />
                    <ReferenceArea
                      yAxisId="pe"
                      y1={analytics.fairMax}
                      y2={analytics.overheat1Max}
                      fill="url(#zoneOverheat1)"
                      fillOpacity={1}
                      ifOverflow="extendDomain"
                    />
                    <ReferenceArea
                      yAxisId="pe"
                      y1={analytics.overheat1Max}
                      y2={analytics.overheat2Max}
                      fill="url(#zoneOverheat2)"
                      fillOpacity={1}
                      ifOverflow="extendDomain"
                    />
                    <ReferenceArea
                      yAxisId="pe"
                      y1={analytics.overheat2Max}
                      y2={analytics.peMax * 1.05}
                      fill="url(#zoneOverheat3)"
                      fillOpacity={1}
                      ifOverflow="extendDomain"
                    />
                    <ReferenceLine
                      yAxisId="pe"
                      y={analytics.avgPe}
                      stroke="#94a3b8"
                      strokeDasharray="5 5"
                      strokeOpacity={0.85}
                      strokeWidth={1.5}
                      label={{
                        value: `Avg ${analytics.avgPe.toFixed(1)}×`,
                        position: 'insideTopRight',
                        fill: '#94a3b8',
                        fontSize: 9,
                        fontFamily: 'monospace',
                      }}
                    />
                    <Tooltip
                      content={
                        <ValuationTooltip
                          avgPe={analytics.avgPe}
                          currentPe={currentPe > 0 ? currentPe : analytics.latestPe}
                        />
                      }
                    />
                    {/* Soft fill under PE — stroke disabled so only ONE PE line is visible */}
                    <Area
                      yAxisId="pe"
                      type="monotone"
                      dataKey="pe"
                      name="Historical PE Fill"
                      stroke="none"
                      fill="url(#peFillGrad)"
                      fillOpacity={1}
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                      legendType="none"
                    />
                    <Line
                      yAxisId="pe"
                      type="monotone"
                      dataKey="pe"
                      name="Historical PE"
                      stroke="#a78bfa"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{
                        r: 5,
                        fill: '#c4b5fd',
                        stroke: '#fff',
                        strokeWidth: 1.5,
                      }}
                      isAnimationActive={false}
                    />
                    {analytics.chartData.length > 0 && (
                      <ReferenceDot
                        yAxisId="pe"
                        x={analytics.chartData[analytics.chartData.length - 1].date}
                        y={
                          currentPe > 0
                            ? currentPe
                            : analytics.chartData[analytics.chartData.length - 1].pe
                        }
                        r={7}
                        fill="#ddd6fe"
                        stroke="#ffffff"
                        strokeWidth={2}
                        zIndex={700}
                        ifOverflow="extendDomain"
                        shape={(props: any) => {
                          const { cx, cy } = props;
                          if (cx == null || cy == null) return null;
                          return (
                            <g filter="url(#currentPeGlow)">
                              <circle cx={cx} cy={cy} r={11} fill="#a78bfa" fillOpacity={0.25} />
                              <circle cx={cx} cy={cy} r={7} fill="#ddd6fe" stroke="#fff" strokeWidth={2} />
                              <circle cx={cx} cy={cy} r={2.5} fill="#7c3aed" />
                            </g>
                          );
                        }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono uppercase tracking-widest text-gray-500">
                  Awaiting valuation history…
                </div>
              )}
            </div>
            <p className="mt-2 text-[9px] font-mono text-gray-600 tracking-wide">
              PE multiples only · market price is not plotted · Overheat L3 = max heat band
            </p>
          </div>

          {/* Right valuation panel — stretch to match chart column height */}
          <div className="flex flex-col gap-3 h-full min-h-0">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 min-w-0 overflow-visible shrink-0">
              <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-3">Valuation Snapshot</p>
              <div className="space-y-2 mb-3">
                <PanelRow label="Current PE" value={`${analytics.latestPe.toFixed(2)}×`} />
                <PanelRow label="Historical Average PE" value={`${analytics.avgPe.toFixed(2)}×`} />
                <PanelRow
                  label="Premium / Discount"
                  value={`${analytics.premiumPct >= 0 ? '+' : ''}${analytics.premiumPct.toFixed(1)}%`}
                  valueClass={analytics.premiumPct >= 0 ? 'text-rose-400' : 'text-emerald-400'}
                />
                <PanelRow label="Historical Percentile" value={`${analytics.pctile}%`} />
                <PanelRow
                  label="Valuation Heat"
                  value={tone.label}
                  valueClass={tone.text}
                />
                <PanelRow
                  label="Overheat Level"
                  value={analytics.overheatLevel === 0 ? 'None' : `${analytics.overheatLevel} / 3`}
                  valueClass={
                    analytics.overheatLevel === 3
                      ? 'text-rose-400'
                      : analytics.overheatLevel >= 1
                        ? 'text-orange-400'
                        : 'text-emerald-400'
                  }
                />
                <PanelRow label="Intrinsic Value" value={`${sym}${analytics.intrinsic.toFixed(2)}`} />
                <PanelRow
                  label="Margin of Safety"
                  value={`${analytics.marginOfSafety >= 0 ? '+' : ''}${analytics.marginOfSafety.toFixed(1)}%`}
                  valueClass={
                    analytics.marginOfSafety >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }
                />
              </div>
              <ValuationMeter percentile={analytics.pctile} />
              <div className="mt-3 grid grid-cols-3 gap-1 text-[8px] sm:text-[9px] font-mono text-gray-500">
                <span className="text-emerald-400 text-left break-words leading-tight">Cool</span>
                <span className="text-cyan-400 text-center break-words leading-tight">Fair</span>
                <span className="text-rose-400 text-right break-words leading-tight">Overheat L3</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#121214] p-4 min-w-0 overflow-visible shrink-0">
              <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1">
                Master Recommendation
              </p>
              <p className="text-[9px] text-gray-600 font-mono mb-3">
                Trading stance from Master Engine — valuation heat does not override it
              </p>
              <div className="w-full overflow-visible">
                <HeroStatusBlock
                  label={masterRecommendation || 'HOLD'}
                  confidence={undefined}
                  textClassName={
                    String(masterRecommendation || '').includes('BUY')
                      ? 'text-emerald-400'
                      : String(masterRecommendation || '').includes('HOLD')
                        ? 'text-amber-400'
                        : String(masterRecommendation || '').includes('REDUCE')
                          ? 'text-orange-400'
                          : 'text-rose-400'
                  }
                  uppercase
                  align="left"
                  size="lg"
                  allowWrap
                />
              </div>
              <p className="mt-3 text-[10px] font-mono font-bold text-violet-300 tracking-wide break-words">
                {masterHorizonLabel
                  ? `${masterHorizonLabel} · Master Decision Engine`
                  : 'Master Decision Engine'}
              </p>

              {analytics.overheatLevel > 0 && (
                <div
                  className={cn(
                    'mt-3 rounded-xl border px-3 py-2.5',
                    analytics.overheatLevel === 3
                      ? 'border-rose-500/40 bg-rose-500/10'
                      : analytics.overheatLevel === 2
                        ? 'border-orange-500/40 bg-orange-500/10'
                        : 'border-orange-400/30 bg-orange-400/10'
                  )}
                >
                  <p
                    className={cn(
                      'text-[10px] font-mono font-bold uppercase tracking-wider',
                      analytics.overheatLevel === 3 ? 'text-rose-300' : 'text-orange-300'
                    )}
                  >
                    {overheat.warningTitle}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-300 leading-relaxed">{overheat.warningBody}</p>
                  <OverheatLevelMeter level={analytics.overheatLevel} className="mt-2" />
                </div>
              )}

              <p className="mt-2 text-[10px] text-gray-500 leading-relaxed">
                Valuation context: {tone.label}
                {analytics.overheatLevel > 0
                  ? ` — entry discipline still applies even when Master says ${masterRecommendation || 'HOLD'}.`
                  : '.'}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono">
                <Stat
                  label="Expected Return"
                  value={
                    masterExpectedReturn != null
                      ? `${masterExpectedReturn >= 0 ? '+' : ''}${masterExpectedReturn.toFixed(1)}%`
                      : '—'
                  }
                />
                <Stat label="Intrinsic Value" value={`${sym}${analytics.intrinsic.toFixed(2)}`} />
                <Stat
                  label="Margin of Safety"
                  value={`${analytics.marginOfSafety >= 0 ? '+' : ''}${analytics.marginOfSafety.toFixed(1)}%`}
                />
                <Stat
                  label="Overheat"
                  value={analytics.overheatLevel === 0 ? 'None' : `L${analytics.overheatLevel}/3`}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 min-w-0 overflow-hidden flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-2 min-w-0">
                <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-300 font-bold truncate">
                  Price–PE Correlation
                </p>
              </div>
              <FitText maxPx={15} minPx={11} maxLines={2} className="font-bold text-cyan-300">
                {analytics.corr.title}
              </FitText>
              <p className="mt-1.5 text-[11px] text-gray-400 leading-relaxed break-words">{analytics.corr.detail}</p>
              <div className="mt-auto pt-3 space-y-1.5 text-[9px] font-mono text-gray-500">
                <p className="flex items-start gap-1.5 min-w-0">
                  <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="min-w-0 break-words">Price ↑ PE ↑ = Healthy rerating</span>
                </p>
                <p className="flex items-start gap-1.5 min-w-0">
                  <TrendingUp className="w-3 h-3 text-sky-400 shrink-0 mt-0.5" />
                  <span className="min-w-0 break-words">Price ↑ PE → = Earnings growth</span>
                </p>
                <p className="flex items-start gap-1.5 min-w-0">
                  <TrendingDown className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                  <span className="min-w-0 break-words">Price ↓ PE ↑ = Temporary selloff</span>
                </p>
                <p className="flex items-start gap-1.5 min-w-0">
                  <Minus className="w-3 h-3 text-rose-400 shrink-0 mt-0.5" />
                  <span className="min-w-0 break-words">Price ↓ PE ↓ = Bearish trend</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Valuation Brief — full width under chart + side panels (no empty right column) */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/5 to-black/20 p-4 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 mb-2 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-300 font-bold truncate">
              AI Valuation Brief
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 min-w-0">
              <p className="text-[12px] text-gray-300 leading-relaxed break-words">
                At the{' '}
                <span className={cn('font-semibold', tone.text)}>
                  {analytics.pctile}% historical percentile
                </span>
                , heat status is{' '}
                <span className={cn('font-semibold', tone.text)}>{tone.badge}</span>
                {analytics.overheatLevel > 0 ? (
                  <>
                    {' '}
                    (
                    <span className={cn('font-semibold', tone.text)}>
                      Overheat Level {analytics.overheatLevel} of 3
                      {analytics.overheatLevel === 3 ? ' · Max' : ''}
                    </span>
                    )
                  </>
                ) : null}
                . Current PE is{' '}
                {Math.abs(analytics.premiumPct) < 3
                  ? 'near'
                  : analytics.premiumPct < 0
                    ? 'below'
                    : 'above'}{' '}
                the {range === 'MAX' ? 'full-history' : range} historical average. The stock trades at{' '}
                <span className="text-violet-300 font-semibold">{analytics.latestPe.toFixed(1)}×</span> versus{' '}
                <span className="text-white font-semibold">{analytics.avgPe.toFixed(1)}×</span> average — a{' '}
                <span
                  className={cn(
                    'font-semibold',
                    analytics.premiumPct >= 0 ? 'text-rose-400' : 'text-emerald-400'
                  )}
                >
                  {Math.abs(analytics.premiumPct).toFixed(1)}% valuation{' '}
                  {analytics.premiumPct >= 0 ? 'premium' : 'discount'}
                </span>
                . Intrinsic estimate{' '}
                <span className="text-white font-semibold">
                  {sym}
                  {analytics.intrinsic.toFixed(2)}
                </span>{' '}
                · margin of safety{' '}
                <span
                  className={cn(
                    'font-semibold',
                    analytics.marginOfSafety >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {analytics.marginOfSafety >= 0 ? '+' : ''}
                  {analytics.marginOfSafety.toFixed(1)}%
                </span>
                .
              </p>
              <div className="mt-3 space-y-2">
                {aiParagraphs.map((para, i) => (
                  <p key={i} className="text-[11px] text-gray-400 leading-relaxed break-words">
                    {para}
                  </p>
                ))}
              </div>
            </div>
            <div className="lg:col-span-2 min-w-0 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 min-w-0 overflow-hidden">
                <span className="text-[9px] font-mono uppercase tracking-wider text-violet-300 shrink-0">
                  Valuation Heat
                </span>
                <FitText maxPx={12} minPx={9} maxLines={2} className="font-black text-white flex-1">
                  {analytics.status.toUpperCase()}
                </FitText>
              </div>
              {analytics.overheatLevel > 0 && (
                <div
                  className={cn(
                    'rounded-lg border px-2.5 py-2',
                    analytics.overheatLevel === 3
                      ? 'border-rose-500/35 bg-rose-500/10'
                      : 'border-orange-500/30 bg-orange-500/10'
                  )}
                >
                  <p
                    className={cn(
                      'text-[10px] font-mono font-bold',
                      analytics.overheatLevel === 3 ? 'text-rose-300' : 'text-orange-300'
                    )}
                  >
                    {overheat.warningTitle}
                  </p>
                  <p className="mt-1 text-[10px] text-gray-400 leading-relaxed">{overheat.warningBody}</p>
                  <OverheatLevelMeter level={analytics.overheatLevel} className="mt-2" />
                </div>
              )}
              {masterRecommendation && (
                <p className="text-[10px] text-gray-500 font-mono mt-auto">
                  Master trading stance:{' '}
                  <span className="text-violet-300 font-bold">{masterRecommendation}</span>
                  {masterHorizonLabel ? ` · ${masterHorizonLabel}` : ''} — separate from valuation heat
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Historical statistics */}
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-3">Historical Statistics</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <StatCard label="Current PE" value={analytics.latestPe.toFixed(1)} />
            <StatCard label="1Y Average" value={analytics.pe1y.toFixed(1)} />
            <StatCard label="3Y Average" value={analytics.pe3y.toFixed(1)} />
            <StatCard label="5Y Average" value={analytics.pe5y.toFixed(1)} />
            <StatCard label="10Y Average" value={analytics.pe10y.toFixed(1)} />
            <StatCard label="Highest PE" value={analytics.high.toFixed(1)} />
            <StatCard label="Lowest PE" value={analytics.low.toFixed(1)} />
            <StatCard label="Std Deviation" value={analytics.sd.toFixed(2)} />
            <StatCard label="Percentile Ranking" value={`${analytics.pctile}%`} accent />
            <StatCard
              label="Overheat Level"
              value={analytics.overheatLevel === 0 ? 'None' : `L${analytics.overheatLevel}/3`}
              accent={analytics.overheatLevel >= 2}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function OverheatLevelMeter({
  level,
  className,
}: {
  level: OverheatLevel;
  className?: string;
}) {
  const steps: { n: 1 | 2 | 3; label: string }[] = [
    { n: 1, label: 'Mild' },
    { n: 2, label: 'Elevated' },
    { n: 3, label: 'Max' },
  ];
  return (
    <div className={cn('w-full max-w-xs mx-auto', className)}>
      <div className="flex gap-1.5">
        {steps.map((s) => {
          const active = level >= s.n;
          const isMax = s.n === 3 && level === 3;
          return (
            <div key={s.n} className="flex-1 min-w-0">
              <div
                className={cn(
                  'h-2 rounded-full border transition-colors',
                  !active && 'bg-white/5 border-white/10',
                  active && s.n === 1 && 'bg-orange-400/80 border-orange-400/50',
                  active && s.n === 2 && 'bg-orange-500/85 border-orange-500/55',
                  active && s.n === 3 && 'bg-rose-500/90 border-rose-400/60',
                  isMax && 'shadow-[0_0_10px_rgba(244,63,94,0.45)]'
                )}
              />
              <p
                className={cn(
                  'mt-1 text-[8px] font-mono text-center leading-tight',
                  active
                    ? s.n === 3
                      ? 'text-rose-300 font-bold'
                      : 'text-orange-300 font-bold'
                    : 'text-gray-600'
                )}
              >
                L{s.n} {s.label}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[9px] font-mono text-center text-gray-500">
        {level === 0 ? 'No overheat' : `Active overheat · Level ${level} of 3`}
      </p>
    </div>
  );
}

function ValuationStatusLabel({
  label,
  textClassName,
  size = 'md',
}: {
  label: string;
  textClassName?: string;
  size?: 'md' | 'lg';
}) {
  const { line1, line2 } = splitStatusLabel(label);
  const line1Size = size === 'lg' ? 'text-[13px] sm:text-[14px]' : 'text-[11px] sm:text-[12px]';
  // Floor = 80% of prior large sizes (~24px → ~19px); never go smaller
  const line2Size = size === 'lg' ? 'text-[22px] sm:text-[28px]' : 'text-[18px] sm:text-[20px]';
  const singleSize = size === 'lg' ? 'text-[24px] sm:text-[30px]' : 'text-[18px] sm:text-[22px]';

  return (
    <motion.div
      key={label}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'w-full flex flex-col items-center justify-center text-center px-1',
        textClassName
      )}
    >
      {line1 ? (
        <>
          <span className={cn('font-semibold tracking-wide leading-tight opacity-90 whitespace-normal', line1Size)}>
            {line1}
          </span>
          <span className={cn('font-black tracking-tight leading-[1.15] mt-0.5 whitespace-normal', line2Size)}>
            {line2}
          </span>
        </>
      ) : (
        <span className={cn('font-black tracking-tight leading-[1.15] whitespace-normal', singleSize)}>
          {line2}
        </span>
      )}
    </motion.div>
  );
}

function MetricTile({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 backdrop-blur-sm min-w-0 flex flex-col justify-center min-h-[112px] overflow-visible">
      <p className="text-[9px] font-mono uppercase tracking-wider text-gray-500 mb-1 break-words leading-tight">
        {label}
      </p>
      <FitText
        maxPx={18}
        minPx={Math.ceil(18 * 0.8)}
        maxLines={2}
        className={cn('font-mono font-bold text-white tabular-nums', valueClass)}
      >
        {value}
      </FitText>
      {sub && <p className="text-[9px] text-gray-500 mt-0.5 break-words leading-tight">{sub}</p>}
    </div>
  );
}

function PanelRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 min-w-0 py-1 border-b border-white/[0.04] last:border-0">
      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider shrink-0 leading-snug">
        {label}
      </span>
      <span
        className={cn(
          'text-[12px] font-mono font-bold text-white text-right tabular-nums leading-snug break-words',
          valueClass
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5 min-w-0 overflow-visible">
      <p className="text-[8px] uppercase tracking-wider text-gray-500 break-words leading-tight">{label}</p>
      <FitText
        maxPx={12}
        minPx={Math.ceil(12 * 0.8)}
        maxLines={2}
        className="font-bold text-gray-100 mt-0.5 tabular-nums"
      >
        {value}
      </FitText>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2.5 min-w-0 overflow-visible flex flex-col justify-center',
        accent ? 'border-violet-500/30 bg-violet-500/10' : 'border-white/5 bg-white/[0.02]'
      )}
    >
      <p className="text-[8px] font-mono uppercase tracking-wider text-gray-500 break-words leading-tight">{label}</p>
      <FitText
        maxPx={16}
        minPx={Math.ceil(16 * 0.8)}
        maxLines={2}
        className={cn('mt-1 font-mono font-bold tabular-nums', accent ? 'text-violet-200' : 'text-white')}
      >
        {value}
      </FitText>
    </div>
  );
}

function ValuationMeter({ percentile }: { percentile: number }) {
  const pct = Math.min(100, Math.max(0, percentile));
  const status = statusFromPercentile(pct);
  const tone = statusTone(status);
  const level = overheatLevelFromStatus(status);

  return (
    <div className="relative pt-1 pb-2 min-w-0 overflow-visible">
      <div className="h-3 rounded-full overflow-hidden flex border border-white/10">
        <div className="flex-[20] bg-emerald-500/85" title="0–20% Deeply Undervalued" />
        <div className="flex-[20] bg-emerald-400/70" title="20–40% Undervalued" />
        <div className="flex-[20] bg-cyan-400/75" title="40–60% Fair Value" />
        <div className="flex-[15] bg-orange-400/80" title="60–75% Overheat Level 1" />
        <div className="flex-[15] bg-orange-500/85" title="75–90% Overheat Level 2" />
        <div className="flex-[10] bg-rose-500/90" title="90–100% Overheat Level 3 · Max" />
      </div>
      <motion.div
        className="absolute top-0 pointer-events-none"
        style={{ left: `clamp(0px, calc(${pct}% - 7px), calc(100% - 14px))` }}
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
      >
        <div
          className="w-3.5 h-3.5 rounded-full bg-white border-2 shadow-[0_0_12px_rgba(255,255,255,0.35)]"
          style={{ borderColor: tone.gauge }}
        />
      </motion.div>
      <div className="mt-3 w-full px-1">
        <p className={cn('font-mono font-bold text-center text-[11px] sm:text-[12px] leading-snug break-words', tone.text)}>
          {pct}% · {status}
          {level > 0 ? ` · L${level}/3` : ''}
        </p>
      </div>
    </div>
  );
}
