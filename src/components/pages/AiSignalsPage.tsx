import React, { useMemo, useState } from 'react';
import { Bot, TrendingUp, TrendingDown, RefreshCw, Trash2, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { GlassCard, SectionLabel } from '../analysis/GlassCard';
import { cn } from '../../lib/utils';
import type { SignalSyncStatus } from '../../lib/signalCloudSync';
import {
  WATCHLIST_MARKETS,
  classifyTickerMarket,
  type WatchlistMarket,
} from '../../lib/dashboardMarket';

export type AiSignalRow = {
  ticker: string;
  name?: string;
  recommendation: string;
  confidence: number;
  trend?: string;
  smartMoney?: string;
  fundFlow?: string;
  rsi?: number | null;
  momentum?: string;
  technicalTrend?: string;
  risk?: string;
  price?: number;
  changePct?: number;
  srSignal?: string;
  srDetail?: string;
};

const EXPLAIN: Record<string, string> = {
  smartMoney: 'Large institutional-style buying or selling activity detected.',
  fundFlow: 'Net money moving into or out of the stock recently.',
  rsi: 'RSI near 30 can mean oversold; near 70 can mean overbought.',
  momentum: 'How strongly price has been moving in one direction.',
  technicalTrend: 'Short-term chart direction from moving averages and structure.',
  risk: 'How volatile or fragile the setup looks for a typical investor.',
  sr: 'Whether price is near support (possible bounce zone) or resistance (possible rejection / breakout zone).',
};

type MarketFilter = 'ALL' | WatchlistMarket;

type AiSignalsPageProps = {
  signals: AiSignalRow[];
  onOpenTicker: (ticker: string) => void;
  onDeleteSignal?: (ticker: string) => void;
  onUpdate?: () => void;
  updating?: boolean;
  updateProgress?: { done: number; total: number } | null;
  onRefreshHint?: () => void;
  cloudSyncStatus?: SignalSyncStatus;
  onSyncNow?: () => void;
};

function DirIcon({ v }: { v?: string }) {
  const s = (v || '').toLowerCase();
  if (!s || s === '—' || s === '-' || s === 'flat' || s === 'neutral') return null;
  if (s.includes('up') || s.includes('bull') || s.includes('inflow') || s === '↑') {
    return <TrendingUp className="h-2.5 w-2.5 text-emerald-400 shrink-0" />;
  }
  if (s.includes('down') || s.includes('bear') || s.includes('outflow') || s === '↓') {
    return <TrendingDown className="h-2.5 w-2.5 text-rose-400 shrink-0" />;
  }
  return null;
}

export function AiSignalsPage({
  signals,
  onOpenTicker,
  onDeleteSignal,
  onUpdate,
  updating = false,
  updateProgress = null,
  onRefreshHint,
  cloudSyncStatus = 'idle',
  onSyncNow,
}: AiSignalsPageProps) {
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('ALL');

  const grouped = useMemo(() => {
    const buckets: Record<WatchlistMarket, AiSignalRow[]> = {
      US: [],
      HK: [],
      JP: [],
      EU: [],
    };
    for (const s of signals) {
      buckets[classifyTickerMarket(s.ticker)].push(s);
    }
    return buckets;
  }, [signals]);

  const visibleMarkets = useMemo(() => {
    if (marketFilter !== 'ALL') {
      return WATCHLIST_MARKETS.filter((m) => m.key === marketFilter);
    }
    return WATCHLIST_MARKETS.filter((m) => grouped[m.key].length > 0);
  }, [marketFilter, grouped]);

  const renderCard = (s: AiSignalRow, market: WatchlistMarket) => (
    <div key={s.ticker} className="relative">
      {onDeleteSignal && (
        <button
          type="button"
          title={`Remove ${s.ticker}`}
          aria-label={`Delete ${s.ticker} signal`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDeleteSignal(s.ticker);
          }}
          className="absolute top-1.5 right-1.5 z-10 h-7 w-7 inline-flex items-center justify-center rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 cursor-pointer"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
      <button
        type="button"
        onClick={() => onOpenTicker(s.ticker)}
        className="text-left cursor-pointer w-full"
      >
        <GlassCard hover padding="sm" className="h-full border-white/10 !p-2.5">
          <div className="flex items-center justify-between gap-2 pr-8 min-w-0">
            <div className="min-w-0 flex items-baseline gap-2">
              <p className="font-mono font-bold text-white text-[13px] shrink-0">{s.ticker}</p>
              <span className="rounded bg-cyan-500/15 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-cyan-300 shrink-0">
                {market}
              </span>
              <p className="text-[10px] text-gray-500 truncate hidden sm:block">{s.name || ''}</p>
            </div>
            <div className="text-right shrink-0">
              <p
                className={cn(
                  'text-[11px] font-black uppercase tracking-wide leading-tight',
                  /buy|add/i.test(s.recommendation) && 'text-emerald-400',
                  /sell|trim|reduce/i.test(s.recommendation) && 'text-rose-400',
                  /wait|hold|indiffer|indecision/i.test(s.recommendation) && 'text-amber-300'
                )}
              >
                {s.recommendation}
              </p>
              <p className="text-[10px] font-mono text-cyan-300 leading-tight">
                {Math.round(s.confidence)}%
              </p>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            <Chip
              label="S/R"
              value={s.srSignal && s.srSignal !== '—' ? s.srSignal : 'Mid Range'}
              tip={s.srDetail || EXPLAIN.sr}
              tone={
                /support/i.test(s.srSignal || '')
                  ? 'bull'
                  : /resistance/i.test(s.srSignal || '')
                    ? 'bear'
                    : undefined
              }
            />
            <Chip label="Trend" value={s.trend || 'Flat'} tip={EXPLAIN.technicalTrend} />
            <Chip
              label="SM"
              value={s.smartMoney && s.smartMoney !== '—' ? s.smartMoney : 'Flat'}
              icon={<DirIcon v={s.smartMoney} />}
              tip={EXPLAIN.smartMoney}
            />
            <Chip
              label="Flow"
              value={s.fundFlow && s.fundFlow !== '—' ? s.fundFlow : 'Flat'}
              icon={<DirIcon v={s.fundFlow} />}
              tip={EXPLAIN.fundFlow}
            />
            <Chip
              label="RSI"
              value={s.rsi != null && Number.isFinite(s.rsi) ? String(Math.round(s.rsi)) : 'n/a'}
              tip={EXPLAIN.rsi}
            />
            <Chip label="Risk" value={s.risk || '—'} tip={EXPLAIN.risk} />
            <Chip
              label="Chg"
              value={
                s.changePct != null
                  ? `${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(1)}%`
                  : '—'
              }
            />
          </div>
        </GlassCard>
      </button>
    </div>
  );

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-400">Intelligence</p>
          <h2 className="mt-1 text-2xl font-sans font-bold text-white">AI Signals</h2>
          <p className="mt-1 text-[13px] text-gray-500 max-w-2xl">
            Grouped by market (US · HK · JP · EU). Use the chips below, then tap a stock for full analysis.
          </p>
          <p
            className={cn(
              'mt-1.5 text-[10px] font-mono inline-flex items-center gap-1',
              cloudSyncStatus === 'synced'
                ? 'text-emerald-400/90'
                : cloudSyncStatus === 'error'
                  ? 'text-rose-400'
                  : cloudSyncStatus === 'saving' || cloudSyncStatus === 'connecting'
                    ? 'text-cyan-300'
                    : 'text-gray-500'
            )}
          >
            {cloudSyncStatus === 'error' ? (
              <CloudOff className="h-3 w-3" />
            ) : cloudSyncStatus === 'saving' || cloudSyncStatus === 'connecting' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Cloud className="h-3 w-3" />
            )}
            {cloudSyncStatus === 'synced'
              ? 'Cloud sync on · iPhone, Android & PC'
              : cloudSyncStatus === 'saving'
                ? 'Saving signals to cloud…'
                : cloudSyncStatus === 'connecting'
                  ? 'Connecting cloud…'
                  : cloudSyncStatus === 'error'
                    ? 'Cloud sync error — tap Sync'
                    : 'Cloud sync idle — sign in with active plan'}
          </p>
          {updating && updateProgress && updateProgress.total > 0 && (
            <p className="mt-1.5 text-[11px] font-mono text-cyan-300/90">
              Updating {updateProgress.done}/{updateProgress.total}…
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onSyncNow && (
            <button
              type="button"
              onClick={onSyncNow}
              disabled={cloudSyncStatus === 'saving' || cloudSyncStatus === 'connecting'}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3.5 text-[11px] font-bold uppercase tracking-wide cursor-pointer border border-cyan-500/35 text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-50"
            >
              <Cloud className="h-3.5 w-3.5" />
              Sync
            </button>
          )}
          {onUpdate && (
            <button
              type="button"
              onClick={onUpdate}
              disabled={updating}
              className={cn(
                'min-h-[40px] inline-flex items-center gap-2 rounded-xl px-4 text-[11px] font-bold uppercase tracking-wide cursor-pointer',
                'bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed'
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', updating && 'animate-spin')} />
              {updating ? 'Updating…' : 'Update'}
            </button>
          )}
          {onRefreshHint && (
            <button
              type="button"
              onClick={onRefreshHint}
              disabled={updating}
              className="min-h-[40px] rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 text-[11px] font-bold uppercase tracking-wide text-cyan-300 hover:bg-cyan-500/20 cursor-pointer disabled:opacity-50"
            >
              Open Find Trades
            </button>
          )}
        </div>
      </div>

      {signals.length > 0 && (
        <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-[#050505]/95 backdrop-blur-sm border-b border-white/5">
          <p className="mb-1.5 text-[9px] font-mono uppercase tracking-[0.18em] text-gray-500">
            Markets
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setMarketFilter('ALL')}
              className={cn(
                'min-h-[34px] rounded-lg px-3 text-[11px] font-bold uppercase tracking-wide border cursor-pointer',
                marketFilter === 'ALL'
                  ? 'bg-cyan-500 text-black border-cyan-400'
                  : 'bg-black/40 text-gray-400 border-white/10 hover:text-white hover:border-cyan-500/35'
              )}
            >
              All · {signals.length}
            </button>
            {WATCHLIST_MARKETS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMarketFilter(m.key)}
                className={cn(
                  'min-h-[34px] rounded-lg px-3 text-[11px] font-bold uppercase tracking-wide border cursor-pointer',
                  marketFilter === m.key
                    ? 'bg-cyan-500 text-black border-cyan-400'
                    : 'bg-black/40 text-gray-400 border-white/10 hover:text-white hover:border-cyan-500/35'
                )}
              >
                {m.short} · {grouped[m.key].length}
              </button>
            ))}
          </div>
        </div>
      )}

      {!signals.length ? (
        <GlassCard>
          <p className="text-[13px] text-gray-400 text-center py-8">
            No cached signals yet. Tap <span className="text-cyan-300 font-semibold">Update</span> to scan, or run{' '}
            <span className="text-emerald-400 font-semibold">Find Trades</span> /{' '}
            <span className="text-sky-400 font-semibold">Suggest</span>.
          </p>
        </GlassCard>
      ) : visibleMarkets.length === 0 ||
        (marketFilter !== 'ALL' && grouped[marketFilter].length === 0) ? (
        <GlassCard>
          <p className="text-[13px] text-gray-400 text-center py-8">No signals in this market yet.</p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {visibleMarkets.map((m) => {
            const rows = [...grouped[m.key]].sort((a, b) => a.ticker.localeCompare(b.ticker));
            if (!rows.length) return null;
            return (
              <GlassCard key={m.key} padding="sm" className="border-cyan-500/20">
                <div className="flex items-center justify-between gap-2 mb-3 px-0.5 border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md bg-cyan-500/20 px-1.5 text-[11px] font-black text-cyan-300">
                      {m.short}
                    </span>
                    <p className="text-[12px] font-semibold text-white truncate">{m.label}</p>
                  </div>
                  <span className="text-[11px] font-mono text-gray-400 shrink-0">
                    {rows.length} signal{rows.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
                  {rows.map((s) => renderCard(s, m.key))}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      <GlassCard padding="sm" className="border-cyan-500/15">
        <SectionLabel icon={<Bot className="w-3.5 h-3.5 text-cyan-400" />}>How to read this</SectionLabel>
        <ul className="mt-1.5 space-y-0.5 text-[10px] text-gray-400">
          <li>S/R — {EXPLAIN.sr}</li>
          <li>SM — {EXPLAIN.smartMoney}</li>
          <li>Flow — {EXPLAIN.fundFlow}</li>
          <li>Risk — {EXPLAIN.risk}</li>
        </ul>
      </GlassCard>
    </div>
  );
}

function Chip({
  label,
  value,
  icon,
  tip,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tip?: string;
  tone?: 'bull' | 'bear';
}) {
  return (
    <span
      title={tip}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[9px] max-w-full',
        tone === 'bull'
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          : tone === 'bear'
            ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
            : 'border-white/5 bg-black/30 text-gray-300'
      )}
    >
      <span className="uppercase tracking-wider text-gray-500 shrink-0">{label}</span>
      {icon}
      <span className="font-semibold truncate">{value}</span>
    </span>
  );
}
