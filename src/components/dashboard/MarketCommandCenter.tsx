import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Sparkles, Eye, ShieldAlert, ArrowRight } from 'lucide-react';
import { GlassCard, SectionLabel } from '../analysis/GlassCard';
import { cn } from '../../lib/utils';
import {
  DASHBOARD_ALL_INDEX_SYMBOLS,
  DASHBOARD_INDEX_SYMBOLS,
  DASHBOARD_MARKETS,
  tickerBelongsToMarket,
  type DashboardMarket,
} from '../../lib/dashboardMarket';

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
  market: DashboardMarket;
  onOpenTicker: (ticker: string) => void;
  onGoFind: () => void;
};

const INDEX_LABEL: Record<string, string> = {
  '^GSPC': 'S&P 500',
  '^IXIC': 'NASDAQ',
  '^DJI': 'DOW 30',
  '^RUT': 'RUSSELL 2000',
  '^HSI': 'HANG SENG',
  '^N225': 'NIKKEI',
  '^FTSE': 'FTSE 100',
  '^GDAXI': 'DAX',
  '^STOXX50E': 'EURO STOXX 50',
  '^FCHI': 'CAC 40',
  '^KS11': 'KOSPI',
};

function formatPrice(price: number | undefined, market: DashboardMarket, ticker?: string): string {
  if (price == null || !Number.isFinite(price)) return '—';
  const m =
    market === 'ALL' && ticker
      ? tickerBelongsToMarket(ticker, 'HK')
        ? 'HK'
        : tickerBelongsToMarket(ticker, 'JP')
          ? 'JP'
          : tickerBelongsToMarket(ticker, 'EU')
            ? 'EU'
            : 'US'
      : market === 'ALL'
        ? 'US'
        : market;
  if (m === 'HK') return `HK$${price.toFixed(2)}`;
  if (m === 'JP') return `¥${price.toFixed(0)}`;
  if (m === 'EU') return `€${price.toFixed(2)}`;
  return `$${price.toFixed(2)}`;
}

function headlineText(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw && 'title' in raw && typeof (raw as { title?: unknown }).title === 'string') {
    return (raw as { title: string }).title;
  }
  return null;
}

/** Primary benchmark for each dashboard market — trend follows this index's day move. */
const MARKET_TREND_SYMBOL: Record<DashboardMarket, string> = {
  US: '^GSPC',
  HK: '^HSI',
  JP: '^N225',
  EU: '^STOXX50E',
  ALL: '^GSPC',
};

function averageChangePct(indices: MarketIndex[]): number | null {
  const vals = indices
    .map((i) => i.regularMarketChangePercent)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function marketTrendOutlook(
  indices: MarketIndex[],
  sentiment: any | null,
  market: DashboardMarket
): {
  label: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  confidence: number;
  why: string;
} {
  const primarySym = MARKET_TREND_SYMBOL[market];
  const primary =
    market === 'ALL'
      ? null
      : indices.find((i) => i.symbol === primarySym) || null;

  const pct =
    market === 'ALL'
      ? averageChangePct(indices)
      : primary?.regularMarketChangePercent != null &&
          Number.isFinite(primary.regularMarketChangePercent)
        ? primary.regularMarketChangePercent
        : averageChangePct(indices);

  const name =
    market === 'ALL'
      ? 'global benchmarks'
      : primary?.shortName || INDEX_LABEL[primarySym] || primarySym;

  const pickKey = market === 'HK' ? 'HK' : 'US';
  const block = sentiment?.[pickKey];
  const topHeadline = Array.isArray(block?.headlines)
    ? headlineText(block.headlines[0])
    : headlineText(block?.headlines);

  if (pct == null) {
    return {
      label: 'NEUTRAL',
      confidence: 50,
      why: 'Waiting for live index quotes to determine market trend.',
    };
  }

  const abs = Math.abs(pct);
  const confidence = Math.round(Math.min(92, Math.max(52, 55 + abs * 12)));
  const pctStr = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
  const newsBit = topHeadline ? ` News lean: ${topHeadline}` : '';

  if (pct > 0.15) {
    return {
      label: 'BULLISH',
      confidence,
      why: `${name} is up ${pctStr} today — market trend is positive.${newsBit}`,
    };
  }
  if (pct < -0.15) {
    return {
      label: 'BEARISH',
      confidence,
      why: `${name} is down ${pctStr} today — market trend is negative.${newsBit}`,
    };
  }
  return {
    label: 'NEUTRAL',
    confidence: Math.min(confidence, 62),
    why: `${name} is roughly flat (${pctStr}) — no strong directional trend today.${newsBit}`,
  };
}

function resolveIndices(indices: MarketIndex[], symbols: string[]): MarketIndex[] {
  const list = Array.isArray(indices) ? indices.filter(Boolean) : [];
  const bySym = new Map(list.map((i) => [i.symbol, i]));
  return symbols.map((sym) => {
    const hit = bySym.get(sym);
    if (hit) {
      return { ...hit, shortName: hit.shortName || INDEX_LABEL[sym] || sym };
    }
    return {
      symbol: sym,
      shortName: INDEX_LABEL[sym] || sym,
      regularMarketPrice: undefined,
      regularMarketChangePercent: undefined,
    };
  });
}

function StockTable({
  rows,
  onOpen,
  emptyHint,
  market,
}: {
  rows: CommandStockRow[];
  onOpen: (t: string) => void;
  emptyHint: string;
  market: DashboardMarket;
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
                {formatPrice(r.price, market, r.ticker)}
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
  market,
  onOpenTicker,
  onGoFind,
}: MarketCommandCenterProps) {
  const core = useMemo(() => {
    const symbols = market === 'ALL' ? DASHBOARD_ALL_INDEX_SYMBOLS : DASHBOARD_INDEX_SYMBOLS[market];
    return resolveIndices(indices, symbols).slice(0, 4);
  }, [indices, market]);

  const outlook = useMemo(
    () => marketTrendOutlook(core, sentiment, market),
    [core, sentiment, market]
  );

  const filterRows = (rows: CommandStockRow[]) =>
    rows.filter((r) => tickerBelongsToMarket(r.ticker, market));

  const opp = filterRows(opportunities);
  const watchRows = filterRows(watch);
  const riskRows = filterRows(riskAlerts);

  const marketLabel = DASHBOARD_MARKETS.find((m) => m.key === market)?.label || market;

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-emerald-400">Market Command Center</p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-sans font-bold text-white tracking-tight">
            Market Today · {marketLabel}
          </h2>
          <p className="mt-1 text-[13px] text-gray-500 max-w-xl">
            Use <span className="text-emerald-400 font-semibold">Select market</span> above the ticker strip to switch
            region. Indices and AI lists update with your choice.
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

      <div
        className={cn(
          'grid gap-3',
          core.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'
        )}
      >
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
          Market Outlook · {marketLabel}
        </SectionLabel>
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Market Trend</p>
            <p
              className={cn(
                'mt-1 text-2xl font-black tracking-wide',
                outlook.label === 'BULLISH' && 'text-emerald-400',
                outlook.label === 'BEARISH' && 'text-rose-400',
                outlook.label === 'NEUTRAL' && 'text-amber-300'
              )}
            >
              {outlook.label}
            </p>
            <p className="mt-1 text-[12px] font-mono text-cyan-300">Confidence {outlook.confidence}%</p>
          </div>
          <p className="text-[13px] text-gray-300 leading-relaxed flex-1">{outlook.why}</p>
        </div>
        <p className="mt-3 text-[11px] text-gray-500">
          Plain language: trend follows the main index day move for this market (e.g. Hang Seng for HK) — not a trade
          order. Headlines are secondary context only.
        </p>
      </GlassCard>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <GlassCard className="xl:col-span-1 min-w-0">
          <SectionLabel icon={<Sparkles className="w-3.5 h-3.5 text-emerald-400" />}>
            Top AI Opportunities
          </SectionLabel>
          <StockTable
            rows={opp}
            onOpen={onOpenTicker}
            market={market}
            emptyHint={`No ${marketLabel} opportunities yet. Run Find Trades for this market.`}
          />
        </GlassCard>
        <GlassCard className="min-w-0">
          <SectionLabel icon={<Eye className="w-3.5 h-3.5 text-cyan-400" />}>Watch</SectionLabel>
          <StockTable
            rows={watchRows}
            onOpen={onOpenTicker}
            market={market}
            emptyHint="Near-miss setups for this market appear here after a scan."
          />
        </GlassCard>
        <GlassCard className="min-w-0">
          <SectionLabel icon={<ShieldAlert className="w-3.5 h-3.5 text-rose-400" />}>Risk Alerts</SectionLabel>
          <StockTable
            rows={riskRows}
            onOpen={onOpenTicker}
            market={market}
            emptyHint="Bearish or high-risk names for this market show here."
          />
        </GlassCard>
      </div>
    </div>
  );
}
