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

type ValuationStatus =
  | 'Deeply Undervalued'
  | 'Undervalued'
  | 'Fair Value'
  | 'Slightly Overvalued'
  | 'Overvalued';

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

/** Single source of truth: Current Position % → status */
function statusFromPercentile(percentile: number): ValuationStatus {
  const p = Math.min(100, Math.max(0, percentile));
  if (p < 20) return 'Deeply Undervalued';
  if (p < 40) return 'Undervalued';
  if (p < 60) return 'Fair Value';
  if (p < 80) return 'Slightly Overvalued';
  return 'Overvalued';
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
    };
  }
  if (status === 'Slightly Overvalued') {
    return {
      text: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      dot: 'bg-orange-400',
      gauge: '#fb923c',
      icon: '🟡',
      label: 'Slightly Overvalued',
      badge: '🟡 Slightly Overvalued',
    };
  }
  if (status === 'Overvalued') {
    return {
      text: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30',
      dot: 'bg-rose-400',
      gauge: '#f43f5e',
      icon: '🔴',
      label: 'Overvalued',
      badge: '🔴 Overvalued',
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
    case 'Slightly Overvalued':
      return {
        action: 'Reduce',
        confidence: 72,
        expectedReturnPct: -Math.min(10, Math.max(3, absPrem * 0.4)),
        signal: 'WAIT FOR BETTER ENTRY',
      };
    case 'Overvalued':
      return {
        action: 'Sell',
        confidence: 80,
        expectedReturnPct: -Math.min(18, Math.max(8, absPrem * 0.5)),
        signal: 'TRIM / WAIT',
      };
  }
}

function explanationForStatus(status: ValuationStatus): string {
  switch (status) {
    case 'Deeply Undervalued':
      return 'Valuation sits in the cheapest historical band — long-term margin of safety is elevated; weakness is a potential accumulation zone.';
    case 'Undervalued':
      return 'Although short-term momentum can still be weak, long-term valuation remains attractive relative to history.';
    case 'Fair Value':
      return 'Valuation is balanced versus history — accumulate on dips rather than chasing extended multiples.';
    case 'Slightly Overvalued':
      return 'Price is modestly rich versus history — prefer waiting for a pullback before adding risk.';
    case 'Overvalued':
      return 'Price strength may continue, but historical valuation argues for patience or partial profit-taking.';
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
          <span className="text-gray-500 shrink-0">Valuation Status</span>
          <span className={cn('font-bold text-right min-w-0 break-words leading-tight', tone.text)}>{status}</span>
        </div>
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
}

export function HistoricalValuationDashboard({
  data,
  ticker,
  stockName,
  currentPe,
  currentPrice,
  currency = 'USD',
  eps = 0,
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
    const peMin = Math.min(...pes, undervaluedMax * 0.85);
    const peMax = Math.max(...pes, fairMax * 1.15);

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
      peMin,
      peMax,
      chartData,
    };
  }, [filtered, data, currentPe, currentPrice, eps]);

  const tone = statusTone(analytics.status);
  const hasData = filtered.length > 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#111113]/90 backdrop-blur-xl overflow-visible shadow-[0_0_40px_rgba(0,0,0,0.35)]">
      {/* Header */}
      <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-white/5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <h3 className="text-sm font-bold text-white tracking-wide">Historical PE Valuation</h3>
              <span title="Historical PE versus its own average — valuation only">
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
              Shows how the current PE compares with its historical valuation over the selected period.
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
        {/* Current Valuation — full-width status band (never clipped) */}
        <div
          className={cn(
            'rounded-xl border px-4 py-5 sm:px-6 sm:py-6 flex flex-col items-center justify-center text-center w-full gap-2',
            tone.border,
            tone.bg
          )}
          style={{ boxShadow: `0 0 32px ${tone.gauge}40` }}
        >
          <p className="text-[9px] font-mono uppercase tracking-wider text-gray-500">Current Valuation</p>
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-2">
            <span className="text-[11px] font-mono font-bold text-white">{ticker.toUpperCase()}</span>
            {displayName && (
              <span className="text-[11px] text-gray-300 font-medium break-words text-center leading-snug">
                {displayName}
              </span>
            )}
          </div>
          <ValuationStatusLabel label={tone.label} textClassName={tone.text} size="lg" />
          <p className="text-[10px] font-mono text-gray-500 tabular-nums">{analytics.pctile}th historical percentile</p>
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
            label="Intrinsic Value Est."
            value={`${sym}${analytics.intrinsic.toFixed(2)}`}
            sub={`MoS ${analytics.marginOfSafety >= 0 ? '+' : ''}${analytics.marginOfSafety.toFixed(1)}%`}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* PE-only valuation chart */}
          <div className="xl:col-span-2 rounded-2xl border border-white/10 bg-black/30 p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-white tracking-wide">Historical PE Valuation</p>
                <p className="mt-0.5 text-[10px] text-gray-500 leading-snug max-w-md">
                  Shows how the current PE compares with its historical valuation over the selected period.
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
                  <span className="w-2 h-2 rounded-full bg-violet-300 shadow-[0_0_8px_rgba(196,181,253,0.9)]" /> Current PE
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/35 border border-emerald-500/40" /> Undervalued
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-sky-500/35 border border-sky-500/40" /> Fair Value
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/35 border border-rose-500/40" /> Overvalued
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
                      <linearGradient id="zoneOvervalued" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.16} />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.04} />
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
                      y2={analytics.peMax * 1.05}
                      fill="url(#zoneOvervalued)"
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
                        isFront
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
              PE multiples only · market price is not plotted on this chart
            </p>
          </div>

          {/* Right valuation panel */}
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 min-w-0 overflow-visible">
              <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-3">Valuation Panel</p>
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
                  label="Current Valuation"
                  value={tone.label}
                  valueClass={tone.text}
                />
                <PanelRow label="Intrinsic Value" value={`${sym}${analytics.intrinsic.toFixed(2)}`} />
                <PanelRow
                  label="Expected Return"
                  value={`${analytics.rec.expectedReturnPct >= 0 ? '+' : ''}${analytics.rec.expectedReturnPct.toFixed(1)}%`}
                  valueClass={
                    analytics.rec.expectedReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }
                />
              </div>
              <ValuationMeter percentile={analytics.pctile} />
              <div className="mt-3 grid grid-cols-3 gap-1 text-[8px] sm:text-[9px] font-mono text-gray-500">
                <span className="text-emerald-400 text-left break-words leading-tight">Undervalued</span>
                <span className="text-cyan-400 text-center break-words leading-tight">Fair</span>
                <span className="text-rose-400 text-right break-words leading-tight">Overvalued</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#121214] p-4 min-w-0 overflow-visible">
              <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-3">
                Recommendation
              </p>
              <div className="w-full overflow-visible">
                <HeroStatusBlock
                  label={analytics.rec.action}
                  confidence={analytics.rec.confidence}
                  textClassName={
                    analytics.rec.action === 'Strong Buy' || analytics.rec.action === 'Buy'
                      ? 'text-emerald-400'
                      : analytics.rec.action === 'Hold'
                        ? 'text-amber-400'
                        : analytics.rec.action === 'Reduce'
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
                {analytics.rec.signal}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono">
                <Stat
                  label="Expected Return"
                  value={`${analytics.rec.expectedReturnPct >= 0 ? '+' : ''}${analytics.rec.expectedReturnPct.toFixed(1)}%`}
                />
                <Stat label="Intrinsic Value" value={`${sym}${analytics.intrinsic.toFixed(2)}`} />
                <Stat
                  label="Margin of Safety"
                  value={`${analytics.marginOfSafety >= 0 ? '+' : ''}${analytics.marginOfSafety.toFixed(1)}%`}
                />
                <Stat label="Percentile" value={`${analytics.pctile}%`} />
              </div>
            </div>
          </div>
        </div>

        {/* AI Explanation + Correlation + Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/5 to-transparent p-4 min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <p className="text-[10px] font-mono uppercase tracking-wider text-gray-300 font-bold truncate">AI Explanation</p>
            </div>
            <p className="text-[12px] text-gray-300 leading-relaxed break-words">
              At the{' '}
              <span className={cn('font-semibold', tone.text)}>
                {analytics.pctile}% historical percentile
              </span>
              , status is{' '}
              <span className={cn('font-semibold', tone.text)}>{tone.badge}</span>
              . Current valuation is{' '}
              {Math.abs(analytics.premiumPct) < 3
                ? 'near'
                : analytics.premiumPct < 0
                  ? 'below'
                  : 'above'}{' '}
              the {range === 'MAX' ? 'full-history' : range} historical average. The stock trades at a PE of{' '}
              <span className="text-violet-300 font-semibold">{analytics.latestPe.toFixed(1)}×</span> versus the
              historical average of{' '}
              <span className="text-white font-semibold">{analytics.avgPe.toFixed(1)}×</span>. This represents a{' '}
              <span className={cn('font-semibold', analytics.premiumPct >= 0 ? 'text-rose-400' : 'text-emerald-400')}>
                {Math.abs(analytics.premiumPct).toFixed(1)}% valuation {analytics.premiumPct >= 0 ? 'premium' : 'discount'}
              </span>
              . Intrinsic value estimate is{' '}
              <span className="text-white font-semibold">
                {sym}
                {analytics.intrinsic.toFixed(2)}
              </span>{' '}
              with a margin of safety of{' '}
              <span className={cn('font-semibold', analytics.marginOfSafety >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {analytics.marginOfSafety >= 0 ? '+' : ''}
                {analytics.marginOfSafety.toFixed(1)}%
              </span>
              .
            </p>
            <p className="mt-2 text-[11px] text-gray-400 leading-relaxed break-words">
              {explanationForStatus(analytics.status)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 min-w-0 max-w-full overflow-hidden">
              <span className="text-[9px] font-mono uppercase tracking-wider text-violet-300 shrink-0">Valuation Signal</span>
              <FitText maxPx={12} minPx={9} maxLines={2} className="font-black text-white flex-1">
                {analytics.rec.signal}
              </FitText>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <p className="text-[10px] font-mono uppercase tracking-wider text-gray-300 font-bold truncate">Correlation Analysis</p>
            </div>
            <FitText maxPx={15} minPx={11} maxLines={2} className="font-bold text-cyan-300">
              {analytics.corr.title}
            </FitText>
            <p className="mt-1.5 text-[11px] text-gray-400 leading-relaxed break-words">{analytics.corr.detail}</p>
            <div className="mt-3 space-y-1.5 text-[9px] font-mono text-gray-500">
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
            <StatCard label={`${range} Avg PE`} value={analytics.avgPe.toFixed(1)} />
          </div>
        </div>
      </div>
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

  return (
    <div className="relative pt-1 pb-2 min-w-0 overflow-visible">
      <div className="h-3 rounded-full overflow-hidden flex border border-white/10">
        <div className="flex-[20] bg-emerald-500/85" title="0–20% Deeply Undervalued" />
        <div className="flex-[20] bg-emerald-400/70" title="20–40% Undervalued" />
        <div className="flex-[20] bg-cyan-400/75" title="40–60% Fair Value" />
        <div className="flex-[20] bg-orange-400/80" title="60–80% Slightly Overvalued" />
        <div className="flex-[20] bg-rose-500/85" title="80–100% Overvalued" />
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
        </p>
      </div>
    </div>
  );
}
