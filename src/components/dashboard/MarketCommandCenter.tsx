import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Sparkles, Eye, ShieldAlert, ArrowRight } from 'lucide-react';
import { GlassCard, SectionLabel } from '../analysis/GlassCard';
import { cn } from '../../lib/utils';

export type MarketIndex = {
  symbol?: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
};

export type CommandStockRow = {
  ticker: string;
  name?: string;
  price?: number;
  changePct?: number;
  signal?: string;
  confidence?: number;
  note?: string;
};

type MarketCommandCenterProps = {
  indices: MarketIndex[];
  sentiment: any | null;
  loadingSentiment?: boolean;
  opportunities: CommandStockRow[];
  watch: CommandStockRow[];
  riskAlerts: CommandStockRow[];
  onOpenTicker: (ticker: string) => void;
  onGoFind: () => void;
};

const CORE_SYMBOLS = ['^GSPC', '^IXIC', '^DJI', '^RUT'];

function sentimentFromApi(sentiment: any | null): {
  label: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  confidence: number;
  why: string;
} {
  if (!sentiment?.US) {
    return {
      label: 'NEUTRAL',
      confidence: 50,
      why: 'Waiting for market news feed to estimate sentiment.',
    };
  }
  const us = sentiment.US;
  const total = Math.max(1, Number(us.total) || Number(us.good || 0) + Number(us.neutral || 0) + Number(us.bad || 0));
  const good = Number(us.good || 0);
  const bad = Number(us.bad || 0);
  const score = (good - bad) / total;
  const confidence = Math.round(Math.min(92, Math.max(45, 55 + Math.abs(score) * 40)));
  if (score > 0.12) {
    return {
      label: 'BULLISH',
      confidence,
      why:
        us.headlines?.[0] ||
        'Positive headlines outweigh negatives — risk appetite looks constructive.',
    };
  }
  if (score < -0.12) {
    return {
      label: 'BEARISH',
      confidence,
      why:
        us.headlines?.[0] ||
        'Negative headlines dominate — caution is warranted near support levels.',
    };
  }
  return {
    label: 'NEUTRAL',
    confidence,
    why:
      us.headlines?.[0] ||
      'Mixed headlines — markets lack a clear directional bias today.',
  };
}

function StockTable({
  rows,
  onOpen,
  emptyHint,
}: {
  rows: CommandStockRow[];
  onOpen: (t: string) => void;
  emptyHint: string;
}) {
  if (!rows.length) {
    return <p className="text-[12px] text-gray-500 py-4 text-center">{emptyHint}</p>;
  }
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full min-w-[520px] text-left">
        <thead>
          <tr className="text-[9px] uppercase tracking-wider text-gray-500 border-b border-white/5">
            <th className="py-2 px-2 font-medium">Ticker</th>
            <th className="py-2 px-2 font-medium">Company</th>
            <th className="py-2 px-2 font-medium">Price</th>
            <th className="py-2 px-2 font-medium">Change</th>
            <th className="py-2 px-2 font-medium">AI signal</th>
            <th className="py-2 px-2 font-medium">Conf.</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 6).map((r) => (
            <tr
              key={r.ticker}
              onClick={() => onOpen(r.ticker)}
              className="border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer"
            >
              <td className="py-2.5 px-2 font-mono font-bold text-white text-[12px]">{r.ticker}</td>
              <td className="py-2.5 px-2 text-[11px] text-gray-400 truncate max-w-[140px]">{r.name || '—'}</td>
              <td className="py-2.5 px-2 font-mono text-[12px] text-white">
                {r.price != null ? `$${r.price.toFixed(2)}` : '—'}
              </td>
              <td
                className={cn(
                  'py-2.5 px-2 font-mono text-[12px]',
                  (r.changePct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                )}
              >
                {r.changePct != null
                  ? `${r.changePct >= 0 ? '+' : ''}${r.changePct.toFixed(2)}%`
                  : '—'}
              </td>
              <td className="py-2.5 px-2 text-[11px] font-semibold text-cyan-300">{r.signal || '—'}</td>
              <td className="py-2.5 px-2 font-mono text-[12px] text-gray-300">
                {r.confidence != null ? `${Math.round(r.confidence)}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketCommandCenter({
  indices,
  sentiment,
  loadingSentiment,
  opportunities,
  watch,
  riskAlerts,
  onOpenTicker,
  onGoFind,
}: MarketCommandCenterProps) {
  const core = useMemo(() => {
    const bySym = new Map(indices.map((i) => [i.symbol, i]));
    return CORE_SYMBOLS.map((sym) => {
      const hit = bySym.get(sym);
      const fallback = indices.find((i) =>
        sym === '^GSPC'
          ? /S&P|GSPC/i.test(i.shortName || '')
          : sym === '^IXIC'
            ? /NASDAQ|IXIC/i.test(i.shortName || '')
            : sym === '^DJI'
              ? /DOW|DJI/i.test(i.shortName || '')
              : /RUSSELL|RUT/i.test(i.shortName || '')
      );
      return hit || fallback || { symbol: sym, shortName: sym, regularMarketPrice: undefined };
    });
  }, [indices]);

  const outlook = sentimentFromApi(sentiment);

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-emerald-400">Market Command Center</p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-sans font-bold text-white tracking-tight">
            Market Today
          </h2>
          <p className="mt-1 text-[13px] text-gray-500 max-w-xl">
            A quick read of major indices and AI-ranked opportunities — no chart jargon required.
          </p>
        </div>
        <button
          type="button"
          onClick={onGoFind}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-emerald-500 px-4 text-[12px] font-bold uppercase tracking-wide text-black hover:bg-emerald-400 cursor-pointer"
        >
          Find Trades <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {core.map((idx) => {
          const pct = idx.regularMarketChangePercent || 0;
          const up = pct >= 0;
          return (
            <GlassCard key={idx.symbol || idx.shortName} padding="sm" className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 truncate">
                {idx.shortName || idx.symbol}
              </p>
              <p className="mt-1 text-xl font-mono font-bold text-white tabular-nums">
                {idx.regularMarketPrice != null ? idx.regularMarketPrice.toFixed(2) : '—'}
              </p>
              <div
                className={cn(
                  'mt-1 flex items-center gap-1 text-[12px] font-mono font-semibold',
                  up ? 'text-emerald-400' : 'text-rose-400'
                )}
              >
                {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {pct >= 0 ? '+' : ''}
                {pct.toFixed(2)}%
              </div>
            </GlassCard>
          );
        })}
      </div>

      <GlassCard className="border-cyan-500/20">
        <SectionLabel icon={<Sparkles className="w-3.5 h-3.5 text-cyan-400" />}>
          AI Market Outlook
        </SectionLabel>
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">AI Market Sentiment</p>
            <p
              className={cn(
                'mt-1 text-2xl font-black tracking-wide',
                outlook.label === 'BULLISH' && 'text-emerald-400',
                outlook.label === 'BEARISH' && 'text-rose-400',
                outlook.label === 'NEUTRAL' && 'text-amber-300'
              )}
            >
              {loadingSentiment ? '…' : outlook.label}
            </p>
            <p className="mt-1 text-[12px] font-mono text-cyan-300">
              Confidence {outlook.confidence}%
            </p>
          </div>
          <p className="text-[13px] text-gray-300 leading-relaxed flex-1">
            {outlook.why}
          </p>
        </div>
        <p className="mt-3 text-[11px] text-gray-500">
          Plain language: sentiment summarizes whether recent headlines lean positive, mixed, or negative — not a trade order.
        </p>
      </GlassCard>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <GlassCard className="xl:col-span-1 min-w-0">
          <SectionLabel icon={<Sparkles className="w-3.5 h-3.5 text-emerald-400" />}>
            Top AI Opportunities
          </SectionLabel>
          <StockTable
            rows={opportunities}
            onOpen={onOpenTicker}
            emptyHint="Run Find Trades or Suggest to populate opportunities."
          />
        </GlassCard>
        <GlassCard className="min-w-0">
          <SectionLabel icon={<Eye className="w-3.5 h-3.5 text-cyan-400" />}>Watch</SectionLabel>
          <StockTable
            rows={watch}
            onOpen={onOpenTicker}
            emptyHint="Near-miss setups appear here after a scan."
          />
        </GlassCard>
        <GlassCard className="min-w-0">
          <SectionLabel icon={<ShieldAlert className="w-3.5 h-3.5 text-rose-400" />}>
            Risk Alerts
          </SectionLabel>
          <StockTable
            rows={riskAlerts}
            onOpen={onOpenTicker}
            emptyHint="Bearish or high-risk names from your last scan show here."
          />
        </GlassCard>
      </div>
    </div>
  );
}
