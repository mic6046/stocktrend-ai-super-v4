import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Sparkles, Eye, ShieldAlert, ArrowRight } from 'lucide-react';
import { GlassCard, SectionLabel } from '../analysis/GlassCard';
import { cn } from '../../lib/utils';
import { apiUrl, loggedFetch } from '../../lib/api';
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

/** Primary benchmark whose chart trend line drives Market Outlook. */
export const MARKET_TREND_SYMBOL: Record<DashboardMarket, string> = {
  US: '^GSPC',
  HK: '^HSI',
  JP: '^N225',
  EU: '^STOXX50E',
  ALL: '^GSPC',
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

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/** Simple linear slope of last N closes as % of price per bar. */
function trendSlopePct(closes: number[], lookback = 20): number | null {
  const n = Math.min(lookback, closes.length);
  if (n < 5) return null;
  const y = closes.slice(-n);
  const xMean = (n - 1) / 2;
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    num += dx * (y[i] - yMean);
    den += dx * dx;
  }
  if (den === 0 || yMean === 0) return null;
  const slopePerBar = num / den;
  return (slopePerBar / yMean) * 100;
}

export type TrendOutlook = {
  label: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  confidence: number;
  why: string;
};

/**
 * Market outlook from the benchmark's chart trend line (price vs SMA20 + slope),
 * with today's session move as confirmation — not headline keywords.
 */
export function outlookFromTrendLine(params: {
  name: string;
  closes: number[];
  todayPct: number | null;
  headline?: string | null;
}): TrendOutlook {
  const { name, closes, todayPct, headline } = params;
  const last = closes.length ? closes[closes.length - 1] : null;
  const ma20 = sma(closes, Math.min(20, closes.length));
  const slope = trendSlopePct(closes, 20);
  const newsBit = headline ? ` News: ${headline}` : '';

  if (last == null || ma20 == null) {
    if (todayPct == null) {
      return {
        label: 'NEUTRAL',
        confidence: 50,
        why: `Waiting for ${name} chart data to read the trend line.`,
      };
    }
    const pctStr = `${todayPct >= 0 ? '+' : ''}${todayPct.toFixed(2)}%`;
    if (todayPct > 0.15) {
      return {
        label: 'BULLISH',
        confidence: 60,
        why: `${name} is up ${pctStr} today (trend line loading).${newsBit}`,
      };
    }
    if (todayPct < -0.15) {
      return {
        label: 'BEARISH',
        confidence: 60,
        why: `${name} is down ${pctStr} today (trend line loading).${newsBit}`,
      };
    }
    return {
      label: 'NEUTRAL',
      confidence: 55,
      why: `${name} is flat today (${pctStr}).${newsBit}`,
    };
  }

  const vsMaPct = ((last - ma20) / ma20) * 100;
  let score = 0;
  if (vsMaPct > 0.35) score += 2;
  else if (vsMaPct < -0.35) score -= 2;
  else if (vsMaPct > 0.1) score += 1;
  else if (vsMaPct < -0.1) score -= 1;

  if (slope != null) {
    if (slope > 0.04) score += 2;
    else if (slope < -0.04) score -= 2;
    else if (slope > 0.01) score += 1;
    else if (slope < -0.01) score -= 1;
  }

  // Today's tape confirms / softens the trend line (does not override a clear trend alone)
  if (todayPct != null) {
    if (todayPct > 0.4) score += 1;
    else if (todayPct < -0.4) score -= 1;
  }

  const absStrength = Math.abs(vsMaPct) + Math.abs(slope || 0) * 8 + Math.abs(todayPct || 0) * 0.5;
  const confidence = Math.round(Math.min(92, Math.max(55, 58 + absStrength * 4)));

  const todayStr =
    todayPct != null ? ` Today ${todayPct >= 0 ? '+' : ''}${todayPct.toFixed(2)}%.` : '';
  const maStr = ` vs 20-day avg ${vsMaPct >= 0 ? '+' : ''}${vsMaPct.toFixed(2)}%`;
  const slopeStr =
    slope != null ? `; trend-line slope ${slope >= 0 ? '+' : ''}${slope.toFixed(3)}%/bar` : '';

  if (score >= 2) {
    return {
      label: 'BULLISH',
      confidence,
      why: `${name} trend line is rising (${maStr}${slopeStr}).${todayStr}${newsBit}`,
    };
  }
  if (score <= -2) {
    return {
      label: 'BEARISH',
      confidence,
      why: `${name} trend line is falling (${maStr}${slopeStr}).${todayStr}${newsBit}`,
    };
  }
  return {
    label: 'NEUTRAL',
    confidence: Math.min(confidence, 68),
    why: `${name} trend line is sideways (${maStr}${slopeStr}).${todayStr}${newsBit}`,
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

  const trendSym = MARKET_TREND_SYMBOL[market];
  const primaryQuote =
    indices.find((i) => i.symbol === trendSym) ||
    core.find((i) => i.symbol === trendSym) ||
    core[0] ||
    null;

  const [closes, setCloses] = useState<number[]>([]);
  const [loadingTrend, setLoadingTrend] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingTrend(true);
      try {
        const url = apiUrl(
          `/api/stock/${encodeURIComponent(trendSym)}?range=3mo&interval=1d`
        );
        const res = await loggedFetch(url, {
          __qnMeta: { reason: 'market-trend', userAction: 'Dashboard trend line' },
        });
        const data = await res.json();
        const hist = Array.isArray(data?.history) ? data.history : [];
        const series = hist
          .map((h: any) => Number(h?.close))
          .filter((n: number) => Number.isFinite(n) && n > 0);
        if (!cancelled) setCloses(series);
      } catch {
        if (!cancelled) setCloses([]);
      } finally {
        if (!cancelled) setLoadingTrend(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [trendSym]);

  const outlook = useMemo(() => {
    const name = primaryQuote?.shortName || INDEX_LABEL[trendSym] || trendSym;
    const todayPct =
      primaryQuote?.regularMarketChangePercent != null &&
      Number.isFinite(primaryQuote.regularMarketChangePercent)
        ? primaryQuote.regularMarketChangePercent
        : null;
    const pickKey = market === 'HK' ? 'HK' : 'US';
    const block = sentiment?.[pickKey];
    const topHeadline = Array.isArray(block?.headlines)
      ? headlineText(block.headlines[0])
      : headlineText(block?.headlines);

    // Prefer live quote as last point on the trend line when available
    const series = [...closes];
    if (
      primaryQuote?.regularMarketPrice != null &&
      Number.isFinite(primaryQuote.regularMarketPrice) &&
      primaryQuote.regularMarketPrice > 0
    ) {
      if (series.length) series[series.length - 1] = primaryQuote.regularMarketPrice;
      else series.push(primaryQuote.regularMarketPrice);
    }

    return outlookFromTrendLine({
      name,
      closes: series,
      todayPct,
      headline: topHeadline,
    });
  }, [closes, primaryQuote, sentiment, market, trendSym]);

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
            region. Outlook follows that market’s benchmark trend line.
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
          core.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4',
          core.length === 1 && 'grid-cols-1 max-w-sm'
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
            <p className="text-[10px] uppercase tracking-wider text-gray-500">
              Trend line · {INDEX_LABEL[trendSym] || trendSym}
            </p>
            <p
              className={cn(
                'mt-1 text-2xl font-black tracking-wide',
                outlook.label === 'BULLISH' && 'text-emerald-400',
                outlook.label === 'BEARISH' && 'text-rose-400',
                outlook.label === 'NEUTRAL' && 'text-amber-300'
              )}
            >
              {loadingTrend && !closes.length ? '…' : outlook.label}
            </p>
            <p className="mt-1 text-[12px] font-mono text-cyan-300">Confidence {outlook.confidence}%</p>
          </div>
          <p className="text-[13px] text-gray-300 leading-relaxed flex-1">{outlook.why}</p>
        </div>
        <p className="mt-3 text-[11px] text-gray-500">
          Plain language: outlook follows this market’s benchmark chart trend line (20-day average + slope). Today’s %
          confirms; headlines are secondary — not a trade order.
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
