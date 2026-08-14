import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Sparkles, Eye, ShieldAlert, ArrowRight, Globe } from 'lucide-react';
import { GlassCard, SectionLabel } from '../analysis/GlassCard';
import { cn } from '../../lib/utils';
import { POPULAR_UNIVERSE, type SuggestMarket } from '../../lib/suggestTradeUniverses';

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

type DashboardMarket = Exclude<SuggestMarket, never>; // US | HK | JP | EU | ALL

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

const MARKET_OPTS: { key: DashboardMarket; label: string }[] = [
  { key: 'US', label: 'United States' },
  { key: 'HK', label: 'Hong Kong' },
  { key: 'JP', label: 'Japan' },
  { key: 'EU', label: 'Europe' },
  { key: 'ALL', label: 'All markets' },
];

const INDEX_BY_MARKET: Record<Exclude<DashboardMarket, 'ALL'>, string[]> = {
  US: ['^GSPC', '^IXIC', '^DJI', '^RUT'],
  HK: ['^HSI', '^KS11'],
  JP: ['^N225', '^KS11'],
  EU: ['^STOXX50E', '^FTSE', '^GDAXI', '^FCHI'],
};

const ALL_INDEX_SYMBOLS = ['^GSPC', '^HSI', '^N225', '^STOXX50E'];

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

const STORAGE_KEY = 'qn-dashboard-market';

const EU_TICKERS = new Set(
  POPULAR_UNIVERSE.filter((u) => u.market === 'EU').map((u) => u.ticker.toUpperCase())
);

function loadMarket(): DashboardMarket {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'US' || v === 'HK' || v === 'JP' || v === 'EU' || v === 'ALL') return v;
  } catch {
    /* ignore */
  }
  return 'US';
}

function tickerMarket(ticker: string): Exclude<DashboardMarket, 'ALL'> {
  const t = ticker.toUpperCase();
  if (t.endsWith('.HK') || /^\d{4}(\.HK)?$/.test(t)) return 'HK';
  if (t.endsWith('.T')) return 'JP';
  if (EU_TICKERS.has(t) || t.includes('.PA') || t.includes('.DE') || t.includes('.L')) return 'EU';
  return 'US';
}

function rowMatchesMarket(ticker: string, market: DashboardMarket): boolean {
  if (market === 'ALL') return true;
  return tickerMarket(ticker) === market;
}

function formatPrice(price: number | undefined, market: DashboardMarket, ticker?: string): string {
  if (price == null || !Number.isFinite(price)) return '—';
  const m = market === 'ALL' && ticker ? tickerMarket(ticker) : market === 'ALL' ? 'US' : market;
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

function sentimentFromApi(
  sentiment: any | null,
  market: DashboardMarket
): {
  label: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  confidence: number;
  why: string;
  source: string;
} {
  const pickKey = market === 'HK' ? 'HK' : market === 'US' || market === 'ALL' ? 'US' : 'US';
  const block = sentiment?.[pickKey] || (market === 'ALL' ? sentiment?.US : null);

  if (!block) {
    return {
      label: 'NEUTRAL',
      confidence: 50,
      why:
        market === 'JP' || market === 'EU'
          ? 'Headline sentiment is strongest for US & HK feeds — outlook below uses the nearest available proxy.'
          : 'Waiting for market news feed to estimate sentiment.',
      source: pickKey,
    };
  }

  const total = Math.max(
    1,
    Number(block.total) || Number(block.good || 0) + Number(block.neutral || 0) + Number(block.bad || 0)
  );
  const good = Number(block.good || 0);
  const bad = Number(block.bad || 0);
  const score = (good - bad) / total;
  const confidence = Math.round(Math.min(92, Math.max(45, 55 + Math.abs(score) * 40)));
  const topHeadline = Array.isArray(block.headlines)
    ? headlineText(block.headlines[0])
    : headlineText(block.headlines);

  const regionNote =
    market === 'JP' || market === 'EU'
      ? ` (${pickKey} news proxy for ${market})`
      : market === 'ALL'
        ? ' (global view weighted to US feed)'
        : '';

  if (score > 0.12) {
    return {
      label: 'BULLISH',
      confidence,
      why: (topHeadline || 'Positive headlines outweigh negatives — risk appetite looks constructive.') + regionNote,
      source: pickKey,
    };
  }
  if (score < -0.12) {
    return {
      label: 'BEARISH',
      confidence,
      why: (topHeadline || 'Negative headlines dominate — caution is warranted near support levels.') + regionNote,
      source: pickKey,
    };
  }
  return {
    label: 'NEUTRAL',
    confidence,
    why: (topHeadline || 'Mixed headlines — markets lack a clear directional bias today.') + regionNote,
    source: pickKey,
  };
}

function resolveIndices(indices: MarketIndex[], symbols: string[]): MarketIndex[] {
  const list = Array.isArray(indices) ? indices.filter(Boolean) : [];
  const bySym = new Map(list.map((i) => [i.symbol, i]));
  return symbols.map((sym) => {
    const hit = bySym.get(sym);
    if (hit) {
      return {
        ...hit,
        shortName: hit.shortName || INDEX_LABEL[sym] || sym,
      };
    }
    // Stock proxies (e.g. 0700.HK) may appear in signal cache only — still show placeholder
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
  onOpenTicker,
  onGoFind,
}: MarketCommandCenterProps) {
  const [market, setMarket] = useState<DashboardMarket>(() => loadMarket());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, market);
    } catch {
      /* ignore */
    }
  }, [market]);

  const core = useMemo(() => {
    const symbols = market === 'ALL' ? ALL_INDEX_SYMBOLS : INDEX_BY_MARKET[market];
    return resolveIndices(indices, symbols).slice(0, 4);
  }, [indices, market]);

  const outlook = sentimentFromApi(sentiment, market);

  const filterRows = (rows: CommandStockRow[]) =>
    rows.filter((r) => rowMatchesMarket(r.ticker, market));

  const opp = filterRows(opportunities);
  const watchRows = filterRows(watch);
  const riskRows = filterRows(riskAlerts);

  const marketLabel = MARKET_OPTS.find((m) => m.key === market)?.label || market;

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-emerald-400">Market Command Center</p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-sans font-bold text-white tracking-tight">
            Market Today
          </h2>
          <p className="mt-1 text-[13px] text-gray-500 max-w-xl">
            A quick read of {marketLabel} indices and AI-ranked opportunities — no chart jargon required.
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

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-gray-500 shrink-0">
          <Globe className="h-3.5 w-3.5 text-emerald-400" />
          Market
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MARKET_OPTS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMarket(m.key)}
              className={cn(
                'min-h-[36px] rounded-full px-3 text-[11px] font-bold uppercase tracking-wide border cursor-pointer',
                market === m.key
                  ? 'bg-emerald-500 text-black border-emerald-400'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:text-white hover:border-white/20'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
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
          AI Market Outlook · {marketLabel}
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
          <p className="text-[13px] text-gray-300 leading-relaxed flex-1">{outlook.why}</p>
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
          <SectionLabel icon={<ShieldAlert className="w-3.5 h-3.5 text-rose-400" />}>
            Risk Alerts
          </SectionLabel>
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
