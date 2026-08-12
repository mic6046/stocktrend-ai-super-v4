import React, { useState, useRef, useEffect } from 'react';
import {
  Activity,
  Search,
  Loader2,
  Menu,
  Bell,
  Shield,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { MarketDataStatus } from '../../lib/marketDataRefresh';
import type { AppPage } from './navTypes';

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
  userEmail?: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  authLoading?: boolean;
  usageSlot?: React.ReactNode;
  onGoDashboard?: () => void;
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
  userEmail,
  onSignIn,
  onSignOut,
  authLoading,
  usageSlot,
  onGoDashboard,
}: AppHeaderProps) {
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [accountOpen]);

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
              placeholder="Search ticker..."
              className="w-full h-10 sm:h-9 bg-[#111113] border border-white/10 rounded-full pl-10 pr-9 text-base sm:text-sm focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-gray-600 font-mono tracking-wide"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-emerald-500 pointer-events-none" />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-emerald-500" />
            )}
          </div>
        </form>

        {/* Right: market + alerts + account */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
                marketLive ? 'bg-emerald-400' : marketDataStatus === 'loading' ? 'bg-cyan-400 animate-pulse' : 'bg-amber-400'
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
            aria-label="Refresh market data"
            title="Refresh"
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

          <div className="relative" ref={menuRef}>
            {!userEmail ? (
              <button
                type="button"
                onClick={onSignIn}
                disabled={authLoading}
                className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 sm:px-3 font-sans font-bold text-[11px] text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 cursor-pointer"
              >
                <Shield className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign in</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-white/10 px-2 sm:px-2.5 text-[11px] font-semibold text-gray-300 hover:bg-white/5 cursor-pointer max-w-[9rem]"
                >
                  <span className="truncate hidden sm:inline">{userEmail.split('@')[0]}</span>
                  <Shield className="h-3.5 w-3.5 sm:hidden text-emerald-400" />
                  <ChevronDown className="h-3 w-3 text-gray-500 shrink-0" />
                </button>
                {accountOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-white/10 bg-[#0c0c0e] shadow-2xl p-2 z-50">
                    <p className="px-2 py-1.5 text-[10px] text-gray-500 font-mono truncate">{userEmail}</p>
                    {usageSlot && <div className="px-1 py-1 mb-1">{usageSlot}</div>}
                    <button
                      type="button"
                      onClick={() => {
                        setAccountOpen(false);
                        onSignOut();
                      }}
                      className="w-full text-left rounded-lg px-2 py-2 text-[12px] font-semibold text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// re-export for callers that navigate via header brand
export type { AppPage };
