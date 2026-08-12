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
  /** Single-row controls for the main header (default). */
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
  variant = 'inline',
}: MarketDataRefreshBarProps) {
  const busy = disabled || status === 'loading';

  // Always keep refresh controls on one horizontal strip (never a second header row).
  return (
    <div className="flex flex-nowrap items-center gap-1 shrink-0 text-[10px] font-mono min-w-0">
      <button
        type="button"
        disabled={busy}
        onClick={onRefresh}
        className={cn(
          'inline-flex items-center justify-center gap-1 h-8 w-8 md:w-auto md:px-2.5 rounded-full border font-bold uppercase tracking-wider transition-colors cursor-pointer',
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

      {variant === 'inline' ? (
        <>
          <div className="hidden md:flex items-center gap-0.5 h-8 rounded-full border border-white/10 bg-black/30 p-0.5">
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
              className="hidden md:block h-8 rounded-full border border-white/10 bg-black/40 px-2 text-gray-200 focus:outline-none focus:border-amber-500/40 max-w-[4.75rem]"
              title="Auto refresh interval"
            >
              {AUTO_REFRESH_OPTIONS.map((o) => (
                <option key={o.sec} value={o.sec}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </>
      ) : (
        <span className="text-gray-500 whitespace-nowrap">
          {formatLastUpdated(lastUpdatedAt)} · {statusLabel(status)}
        </span>
      )}
    </div>
  );
}
