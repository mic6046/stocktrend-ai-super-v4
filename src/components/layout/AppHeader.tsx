import React from 'react';
import {
  Activity,
  Search,
  Loader2,
  Menu,
  Bell,
  RefreshCw,
  Cloud,
  CloudOff,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { MarketDataStatus } from '../../lib/marketDataRefresh';

type AppHeaderProps = {
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  onSearchSubmit: (raw: string) => void;
  searchInputKey: number;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  loading: boolean;
  marketDataStatus: MarketDataStatus;
  lastUpdatedAt: number | null;
  onRefresh: () => void;
  onToggleMobileSidebar: () => void;
  onOpenAlerts: () => void;
  alertCount?: number;
  onGoDashboard?: () => void;
  cloudSyncStatus?: 'idle' | 'loading' | 'synced' | 'error';
};

function formatAgo(ts: number | null): string {
  if (!ts) return '—';
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  return `${Math.round(min / 60)}h`;
}

export function AppHeader({
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  searchInputKey,
  searchInputRef,
  loading,
  marketDataStatus,
  lastUpdatedAt,
  onRefresh,
  onToggleMobileSidebar,
  onOpenAlerts,
  alertCount = 0,
  onGoDashboard,
  cloudSyncStatus = 'idle',
}: AppHeaderProps) {
  const marketLive = marketDataStatus === 'idle' || marketDataStatus === 'updated';

  return (
    <header className="relative z-40 border-b border-white/5 backdrop-blur-md sticky top-0 pt-[env(safe-area-inset-top)] bg-[#050505]/92">
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 min-w-0">
        {/* Left: menu + brand */}
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 cursor-pointer"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onGoDashboard}
            className="flex items-center gap-2 min-w-0 cursor-pointer"
          >
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_18px_rgba(16,185,129,0.35)] shrink-0">
              <Activity className="w-4 h-4 text-black" />
            </div>
            <h1 className="hidden sm:block text-sm font-sans font-extrabold tracking-tight uppercase whitespace-nowrap leading-none">
              QUANTUM<span className="text-emerald-500">NODE</span>
            </h1>
          </button>
        </div>

        {/* Center: search */}
        <form
          className="min-w-0 flex-1 max-w-xl mx-auto"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit(searchQuery);
          }}
        >
          <div className="relative w-full group">
            <input
              key={`hdr-${searchInputKey}`}
              ref={searchInputRef as React.RefObject<HTMLInputElement>}
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                e.preventDefault();
                onSearchSubmit((e.target as HTMLInputElement).value);
              }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="search"
              enterKeyHint="search"
              placeholder="AAPL or 0700…"
              className="w-full h-10 sm:h-9 bg-[#111113] border border-white/10 rounded-full pl-10 pr-9 text-base sm:text-sm focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-gray-600 font-mono tracking-wide"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-emerald-500 pointer-events-none" />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-emerald-500" />
            )}
          </div>
        </form>

        {/* Right: market + alerts only (account lives in sidebar) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {cloudSyncStatus !== 'idle' && (
            <div
              className={cn(
                'hidden sm:inline-flex items-center gap-1 rounded-full border px-2 h-9 text-[10px] font-mono uppercase tracking-wide',
                cloudSyncStatus === 'synced'
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                  : cloudSyncStatus === 'loading'
                    ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
              )}
              title={
                cloudSyncStatus === 'synced'
                  ? 'Account data synced across devices'
                  : cloudSyncStatus === 'loading'
                    ? 'Syncing account data…'
                    : 'Account sync failed — check connection and reload'
              }
            >
              {cloudSyncStatus === 'error' ? (
                <CloudOff className="h-3 w-3" />
              ) : cloudSyncStatus === 'loading' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Cloud className="h-3 w-3" />
              )}
              <span className="hidden lg:inline">
                {cloudSyncStatus === 'synced' ? 'Cloud' : cloudSyncStatus === 'loading' ? 'Sync' : 'Sync err'}
              </span>
            </div>
          )}

          <div
            className={cn(
              'hidden md:flex items-center gap-1.5 rounded-full border px-2.5 h-9 text-[10px] font-mono uppercase tracking-wide',
              marketLive
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : marketDataStatus === 'loading'
                  ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            )}
            title="Market data status"
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                marketLive
                  ? 'bg-emerald-400'
                  : marketDataStatus === 'loading'
                    ? 'bg-cyan-400 animate-pulse'
                    : 'bg-amber-400'
              )}
            />
            {marketDataStatus === 'loading' ? 'Sync' : marketLive ? 'Live' : 'Stale'}
            <span className="text-gray-500 normal-case tracking-normal">{formatAgo(lastUpdatedAt)}</span>
          </div>

          <button
            type="button"
            disabled={loading || marketDataStatus === 'loading'}
            onClick={onRefresh}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-gray-300 hover:bg-white/5 disabled:opacity-50 cursor-pointer"
            aria-label="Refresh analysis (uses 1 credit)"
            title="Refresh analysis · uses 1 AI credit"
          >
            {marketDataStatus === 'loading' || loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenAlerts}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-gray-300 hover:bg-white/5 cursor-pointer"
            aria-label="Alerts"
          >
            <Bell className="h-4 w-4" />
            {alertCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 rounded-full bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
