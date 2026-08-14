import React, { useEffect, useMemo, useState } from 'react';
import { Star, Plus, Trash2, RefreshCw, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { GlassCard } from '../analysis/GlassCard';
import {
  addToWatchlist,
  loadWatchlist,
  removeFromWatchlist,
  type WatchlistItem,
} from '../../lib/watchlistStore';
import { subscribeAccountDataChanged } from '../../lib/accountSync';
import type { WatchlistSyncStatus } from '../../lib/watchlistCloudSync';
import { cn } from '../../lib/utils';
import { toHkTickerIfNumeric } from '../../lib/tickerNormalize';
import {
  WATCHLIST_MARKETS,
  classifyTickerMarket,
  type WatchlistMarket,
} from '../../lib/dashboardMarket';

type WatchlistPageProps = {
  quotes?: Record<
    string,
    { price?: number; changePct?: number; name?: string; signal?: string; confidence?: number; trend?: string }
  >;
  alertTickers?: Set<string> | string[];
  onOpenTicker: (ticker: string) => void;
  onUpdate?: () => void;
  updating?: boolean;
  updateProgress?: { done: number; total: number } | null;
  cloudSyncStatus?: WatchlistSyncStatus;
  onSyncNow?: () => void;
};

type MarketFilter = 'ALL' | WatchlistMarket;

function formatWatchPrice(price: number | undefined, market: WatchlistMarket): string {
  if (price == null || !Number.isFinite(price)) return '—';
  if (market === 'HK') return `HK$${price.toFixed(2)}`;
  if (market === 'JP') return `¥${price.toFixed(0)}`;
  if (market === 'EU') return `€${price.toFixed(2)}`;
  return `$${price.toFixed(2)}`;
}

export function WatchlistPage({
  quotes = {},
  alertTickers,
  onOpenTicker,
  onUpdate,
  updating = false,
  updateProgress = null,
  cloudSyncStatus = 'idle',
  onSyncNow,
}: WatchlistPageProps) {
  const alertSet = useMemo(() => {
    if (!alertTickers) return new Set<string>();
    return alertTickers instanceof Set ? alertTickers : new Set(alertTickers.map((t) => t.toUpperCase()));
  }, [alertTickers]);

  const [items, setItems] = useState<WatchlistItem[]>(() => loadWatchlist());
  const [draft, setDraft] = useState('');
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('ALL');

  useEffect(() => {
    return subscribeAccountDataChanged((kind) => {
      if (kind === 'watchlist' || kind === 'all') {
        setItems(loadWatchlist());
      }
    });
  }, []);

  const add = () => {
    const t = toHkTickerIfNumeric(draft);
    if (!t) return;
    setItems(addToWatchlist(t));
    setDraft('');
  };

  const grouped = useMemo(() => {
    const buckets: Record<WatchlistMarket, WatchlistItem[]> = {
      US: [],
      HK: [],
      JP: [],
      EU: [],
    };
    for (const item of items) {
      buckets[classifyTickerMarket(item.ticker)].push(item);
    }
    return buckets;
  }, [items]);

  const visibleMarkets = useMemo(() => {
    if (marketFilter !== 'ALL') {
      return WATCHLIST_MARKETS.filter((m) => m.key === marketFilter);
    }
    return WATCHLIST_MARKETS.filter((m) => grouped[m.key].length > 0);
  }, [marketFilter, grouped]);

  const renderRow = (item: WatchlistItem, market: WatchlistMarket) => {
    const q = quotes[item.ticker] || quotes[item.ticker.toUpperCase()] || {};
    const name = q.name || item.name;
    return (
      <tr key={item.ticker} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
        <td className="py-1.5 px-1.5 align-middle">
          <button
            type="button"
            className="text-left cursor-pointer group"
            onClick={() => onOpenTicker(item.ticker)}
          >
            <span className="font-mono font-bold text-white text-[11px] group-hover:text-emerald-400">
              {item.ticker}
            </span>
            {name && (
              <span className="block text-[9px] text-gray-500 truncate max-w-[7.5rem] leading-tight">
                {name}
              </span>
            )}
          </button>
        </td>
        <td className="py-1.5 px-1.5 font-mono text-[11px] tabular-nums text-white">
          {formatWatchPrice(q.price, market)}
        </td>
        <td
          className={cn(
            'py-1.5 px-1.5 font-mono text-[11px] tabular-nums',
            (q.changePct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
          )}
        >
          {q.changePct != null ? `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%` : '—'}
        </td>
        <td className="py-1.5 px-1.5">
          <span className="inline-block max-w-[5.5rem] truncate rounded-md bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-300">
            {q.signal || '—'}
          </span>
        </td>
        <td className="py-1.5 px-1.5 font-mono text-[10px] text-gray-300 tabular-nums">
          {q.confidence != null ? `${Math.round(q.confidence)}%` : '—'}
        </td>
        <td className="py-1.5 px-1.5 text-[10px] text-gray-400 truncate max-w-[4.5rem]">
          {q.trend || '—'}
        </td>
        <td className="py-1.5 px-1.5 text-[9px] font-semibold">
          {alertSet.has(item.ticker) ? (
            <span className="text-amber-300">On</span>
          ) : (
            <span className="text-gray-600">—</span>
          )}
        </td>
        <td className="py-1.5 px-1">
          <button
            type="button"
            aria-label={`Remove ${item.ticker}`}
            onClick={() => setItems(removeFromWatchlist(item.ticker))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Star className="h-3.5 w-3.5 text-amber-300 shrink-0" />
            <h2 className="text-lg font-sans font-bold text-white tracking-tight">Watchlist</h2>
            <span className="text-[10px] font-mono text-gray-500">{items.length}</span>
          </div>
          <p
            className={cn(
              'mt-0.5 text-[10px] font-mono inline-flex items-center gap-1',
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
              ? 'Cloud sync on · same account on phone & PC'
              : cloudSyncStatus === 'saving'
                ? 'Saving to cloud…'
                : cloudSyncStatus === 'connecting'
                  ? 'Connecting cloud…'
                  : cloudSyncStatus === 'error'
                    ? 'Cloud sync error — tap Sync'
                    : 'Cloud sync idle — sign in with active plan'}
          </p>
          {updating && updateProgress && updateProgress.total > 0 && (
            <p className="mt-0.5 text-[10px] font-mono text-amber-300/90">
              Updating {updateProgress.done}/{updateProgress.total}…
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onSyncNow && (
            <button
              type="button"
              onClick={onSyncNow}
              disabled={cloudSyncStatus === 'saving' || cloudSyncStatus === 'connecting'}
              className="min-h-[32px] inline-flex items-center gap-1.5 rounded-lg px-3 text-[10px] font-bold uppercase tracking-wide cursor-pointer border border-emerald-500/35 text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
            >
              <Cloud className="h-3 w-3" />
              Sync
            </button>
          )}
          {onUpdate && (
            <button
              type="button"
              onClick={onUpdate}
              disabled={updating || items.length === 0}
              className={cn(
                'min-h-[32px] inline-flex items-center gap-1.5 rounded-lg px-3 text-[10px] font-bold uppercase tracking-wide cursor-pointer shrink-0',
                'bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <RefreshCw className={cn('h-3 w-3', updating && 'animate-spin')} />
              {updating ? 'Updating…' : 'Update'}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add ticker"
          className="flex-1 min-w-0 min-h-[36px] rounded-lg border border-white/10 bg-[#111113] px-2.5 text-[13px] text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 font-mono"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center justify-center gap-1 min-h-[36px] rounded-lg bg-emerald-500 px-3 text-[11px] font-bold text-black hover:bg-emerald-400 cursor-pointer shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setMarketFilter('ALL')}
          className={cn(
            'min-h-[30px] rounded-lg px-2.5 text-[10px] font-bold uppercase tracking-wide border cursor-pointer',
            marketFilter === 'ALL'
              ? 'bg-emerald-500 text-black border-emerald-400'
              : 'bg-black/40 text-gray-400 border-white/10 hover:text-white hover:border-emerald-500/35'
          )}
        >
          All · {items.length}
        </button>
        {WATCHLIST_MARKETS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMarketFilter(m.key)}
            className={cn(
              'min-h-[30px] rounded-lg px-2.5 text-[10px] font-bold uppercase tracking-wide border cursor-pointer',
              marketFilter === m.key
                ? 'bg-emerald-500 text-black border-emerald-400'
                : 'bg-black/40 text-gray-400 border-white/10 hover:text-white hover:border-emerald-500/35'
            )}
          >
            {m.short} · {grouped[m.key].length}
          </button>
        ))}
      </div>

      {!items.length ? (
        <GlassCard padding="sm">
          <p className="text-[12px] text-gray-500 text-center py-5">Watchlist is empty.</p>
        </GlassCard>
      ) : visibleMarkets.length === 0 ||
        (marketFilter !== 'ALL' && grouped[marketFilter].length === 0) ? (
        <GlassCard padding="sm">
          <p className="text-[12px] text-gray-500 text-center py-5">No names in this market yet.</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {visibleMarkets.map((m) => {
            const rows = grouped[m.key];
            if (!rows.length) return null;
            return (
              <GlassCard key={m.key} padding="sm">
                <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
                  <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-emerald-400">
                    {m.label}
                  </p>
                  <span className="text-[10px] font-mono text-gray-500">{rows.length}</span>
                </div>
                <div className="overflow-x-auto -mx-0.5">
                  <table className="w-full min-w-[520px] text-left">
                    <thead>
                      <tr className="text-[8px] uppercase tracking-wider text-gray-500 border-b border-white/5">
                        <th className="py-1.5 px-1.5 font-medium">Ticker</th>
                        <th className="py-1.5 px-1.5 font-medium">Price</th>
                        <th className="py-1.5 px-1.5 font-medium">Chg</th>
                        <th className="py-1.5 px-1.5 font-medium">Signal</th>
                        <th className="py-1.5 px-1.5 font-medium">Conf</th>
                        <th className="py-1.5 px-1.5 font-medium">Trend</th>
                        <th className="py-1.5 px-1.5 font-medium">Alert</th>
                        <th className="py-1.5 px-1 w-8" />
                      </tr>
                    </thead>
                    <tbody>{rows.map((item) => renderRow(item, m.key))}</tbody>
                  </table>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
