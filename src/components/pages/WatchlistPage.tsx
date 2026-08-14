import React, { useMemo, useState } from 'react';
import { Star, Plus, Trash2, RefreshCw } from 'lucide-react';
import { GlassCard, SectionLabel } from '../analysis/GlassCard';
import {
  addToWatchlist,
  loadWatchlist,
  removeFromWatchlist,
  type WatchlistItem,
} from '../../lib/watchlistStore';
import { cn } from '../../lib/utils';
import { toHkTickerIfNumeric } from '../../lib/tickerNormalize';

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
};

export function WatchlistPage({
  quotes = {},
  alertTickers,
  onOpenTicker,
  onUpdate,
  updating = false,
  updateProgress = null,
}: WatchlistPageProps) {
  const alertSet = useMemo(() => {
    if (!alertTickers) return new Set<string>();
    return alertTickers instanceof Set ? alertTickers : new Set(alertTickers.map((t) => t.toUpperCase()));
  }, [alertTickers]);

  const [items, setItems] = useState<WatchlistItem[]>(() => loadWatchlist());
  const [draft, setDraft] = useState('');

  const add = () => {
    const t = toHkTickerIfNumeric(draft);
    if (!t) return;
    setItems(addToWatchlist(t));
    setDraft('');
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-amber-300">Watch</p>
          <h2 className="mt-1 text-2xl font-sans font-bold text-white">Watchlist</h2>
          <p className="mt-1 text-[13px] text-gray-500">
            Track names you care about. Update to refresh prices and AI signals.
          </p>
          {updating && updateProgress && updateProgress.total > 0 && (
            <p className="mt-1.5 text-[11px] font-mono text-amber-300/90">
              Updating {updateProgress.done}/{updateProgress.total}…
            </p>
          )}
        </div>
        {onUpdate && (
          <button
            type="button"
            onClick={onUpdate}
            disabled={updating || items.length === 0}
            className={cn(
              'min-h-[40px] inline-flex items-center gap-2 rounded-xl px-4 text-[11px] font-bold uppercase tracking-wide cursor-pointer shrink-0',
              'bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', updating && 'animate-spin')} />
            {updating ? 'Updating…' : 'Update'}
          </button>
        )}
      </div>

      <GlassCard padding="sm">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Add ticker (e.g. NVDA)"
            className="flex-1 min-h-[44px] rounded-xl border border-white/10 bg-[#111113] px-3 text-base text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 font-mono"
          />
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-emerald-500 px-4 text-[12px] font-bold text-black hover:bg-emerald-400 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionLabel icon={<Star className="w-3.5 h-3.5 text-amber-300" />}>Your list</SectionLabel>
        {!items.length ? (
          <p className="text-[13px] text-gray-500 text-center py-8">Watchlist is empty.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-gray-500 border-b border-white/5">
                  <th className="py-2 px-2">Ticker</th>
                  <th className="py-2 px-2">Company</th>
                  <th className="py-2 px-2">Price</th>
                  <th className="py-2 px-2">Change</th>
                  <th className="py-2 px-2">AI signal</th>
                  <th className="py-2 px-2">Conf.</th>
                  <th className="py-2 px-2">Trend</th>
                  <th className="py-2 px-2">Alert</th>
                  <th className="py-2 px-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const q = quotes[item.ticker] || quotes[item.ticker.toUpperCase()] || {};
                  return (
                    <tr key={item.ticker} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                      <td className="py-2.5 px-2">
                        <button
                          type="button"
                          className="font-mono font-bold text-white text-[12px] hover:text-emerald-400 cursor-pointer"
                          onClick={() => onOpenTicker(item.ticker)}
                        >
                          {item.ticker}
                        </button>
                      </td>
                      <td className="py-2.5 px-2 text-[11px] text-gray-400 truncate max-w-[140px]">
                        {q.name || item.name || '—'}
                      </td>
                      <td className="py-2.5 px-2 font-mono text-[12px]">
                        {q.price != null ? `$${q.price.toFixed(2)}` : '—'}
                      </td>
                      <td
                        className={cn(
                          'py-2.5 px-2 font-mono text-[12px]',
                          (q.changePct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        )}
                      >
                        {q.changePct != null
                          ? `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-2 text-[11px] text-cyan-300">{q.signal || '—'}</td>
                      <td className="py-2.5 px-2 font-mono text-[12px]">
                        {q.confidence != null ? `${Math.round(q.confidence)}%` : '—'}
                      </td>
                      <td className="py-2.5 px-2 text-[11px] text-gray-300">{q.trend || '—'}</td>
                      <td className="py-2.5 px-2 text-[11px]">
                        {alertSet.has(item.ticker) ? (
                          <span className="text-amber-300 font-semibold">On</span>
                        ) : (
                          <span className="text-gray-600">Off</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2">
                        <button
                          type="button"
                          aria-label={`Remove ${item.ticker}`}
                          onClick={() => setItems(removeFromWatchlist(item.ticker))}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
