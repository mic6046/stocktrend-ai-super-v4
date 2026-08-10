import React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  AUTO_REFRESH_OPTIONS,
  formatLastUpdated,
  statusLabel,
  type AutoRefreshIntervalSec,
  type MarketDataStatus,
  type RefreshMode,
} from '../../lib/marketDataRefresh';

type MarketDataRefreshBarProps = {
  lastUpdatedAt: number | null;
  status: MarketDataStatus;
  mode: RefreshMode;
  intervalSec: AutoRefreshIntervalSec;
  onModeChange: (mode: RefreshMode) => void;
  onIntervalChange: (sec: AutoRefreshIntervalSec) => void;
  onRefresh: () => void;
  disabled?: boolean;
  /** Single-row controls for the main header (web). */
  variant?: 'panel' | 'inline';
};

export function MarketDataRefreshBar({
  lastUpdatedAt,
  status,
  mode,
  intervalSec,
  onModeChange,
  onIntervalChange,
  onRefresh,
  disabled = false,
  variant = 'panel',
}: MarketDataRefreshBarProps) {
  const busy = disabled || status === 'loading';

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 text-[10px] font-mono min-w-0">
        <button
          type="button"
          disabled={busy}
          onClick={onRefresh}
          className={cn(
            'inline-flex items-center justify-center gap-1 h-8 w-8 sm:w-auto sm:px-2.5 rounded-full border font-bold uppercase tracking-wider transition-colors cursor-pointer',
            busy
              ? 'border-white/10 text-gray-600'
              : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
          )}
          title={`Refresh market data · last ${formatLastUpdated(lastUpdatedAt)} · ${statusLabel(status)}`}
          aria-label="Refresh market data"
        >
          {status === 'loading' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span className="hidden lg:inline">Refresh</span>
        </button>

        <div className="hidden sm:flex items-center gap-0.5 h-8 rounded-full border border-white/10 bg-black/30 p-0.5">
          <button
            type="button"
            onClick={() => onModeChange('manual')}
            className={cn(
              'h-full rounded-full px-2 font-bold uppercase tracking-wider transition-colors cursor-pointer',
              mode === 'manual'
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'text-gray-500 hover:text-gray-300'
            )}
            title="Manual refresh — credits only on demand"
          >
            Man
          </button>
          <button
            type="button"
            onClick={() => onModeChange('auto')}
            className={cn(
              'h-full rounded-full px-2 font-bold uppercase tracking-wider transition-colors cursor-pointer',
              mode === 'auto'
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-gray-500 hover:text-gray-300'
            )}
            title="Auto refresh on an interval"
          >
            Auto
          </button>
        </div>

        {mode === 'auto' && (
          <select
            value={intervalSec}
            onChange={(e) => onIntervalChange(Number(e.target.value) as AutoRefreshIntervalSec)}
            className="hidden sm:block h-8 rounded-full border border-white/10 bg-black/40 px-2 text-gray-200 focus:outline-none focus:border-amber-500/40 max-w-[4.75rem]"
            title="Auto refresh interval"
          >
            {AUTO_REFRESH_OPTIONS.map((o) => (
              <option key={o.sec} value={o.sec}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/10 bg-[#0D0D10]/90 px-3 py-2.5 text-[10px] font-mono">
      <div className="flex flex-col gap-0.5 min-w-[7.5rem]">
        <span className="uppercase tracking-wider text-gray-500">Market Data Refresh</span>
        <span className="text-gray-400">
          Last Updated:{' '}
          <span className="text-white tabular-nums text-[12px]">{formatLastUpdated(lastUpdatedAt)}</span>
        </span>
        <span className="text-gray-400">
          Status:{' '}
          <span
            className={cn(
              'font-semibold',
              status === 'loading' && 'text-amber-300',
              status === 'updated' && 'text-emerald-300',
              status === 'idle' && 'text-gray-300'
            )}
          >
            {statusLabel(status)}
          </span>
        </span>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={onRefresh}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-bold uppercase tracking-wider transition-colors cursor-pointer',
          busy
            ? 'border-white/10 text-gray-600'
            : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
        )}
        title="Manually refresh market data (uses API credits)"
      >
        {status === 'loading' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5" />
        )}
        Refresh
      </button>

      <div className="flex flex-wrap items-center gap-3 border-l border-white/10 pl-3">
        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-gray-300">
          <input
            type="radio"
            name="qn-refresh-mode"
            checked={mode === 'manual'}
            onChange={() => onModeChange('manual')}
            className="accent-emerald-500"
          />
          <span>
            Manual Refresh <span className="text-gray-600">(Default)</span>
          </span>
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-gray-300">
          <input
            type="radio"
            name="qn-refresh-mode"
            checked={mode === 'auto'}
            onChange={() => onModeChange('auto')}
            className="accent-amber-500"
          />
          <span>Auto Refresh</span>
        </label>

        {mode === 'auto' && (
          <select
            value={intervalSec}
            onChange={(e) => onIntervalChange(Number(e.target.value) as AutoRefreshIntervalSec)}
            className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-gray-200 focus:outline-none focus:border-amber-500/40"
            title="Auto refresh interval"
          >
            {AUTO_REFRESH_OPTIONS.map((o) => (
              <option key={o.sec} value={o.sec}>
                every {o.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {mode === 'manual' && (
        <span className="text-gray-600 normal-case tracking-normal max-w-xs">
          No background API — credits only when you Refresh, Search, Suggest, or Analyze
        </span>
      )}
    </div>
  );
}
