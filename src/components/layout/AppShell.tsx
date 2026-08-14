import React from 'react';
import { Globe } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import type { AppPage } from './navTypes';
import type { MarketDataStatus } from '../../lib/marketDataRefresh';
import {
  DASHBOARD_MARKETS,
  type DashboardMarket,
} from '../../lib/dashboardMarket';

type IndexQuote = {
  symbol?: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
};

type AppShellProps = {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (v: boolean) => void;
  alertCount?: number;
  indices: IndexQuote[];
  /** Shown above the market pulse on Dashboard */
  dashboardMarket?: DashboardMarket;
  onDashboardMarketChange?: (m: DashboardMarket) => void;
  // header
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  onSearchSubmit: (raw: string) => void;
  searchInputKey: number;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  loading: boolean;
  marketDataStatus: MarketDataStatus;
  lastUpdatedAt: number | null;
  onRefresh: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  authLoading?: boolean;
  userEmail?: string | null;
  usageSlot?: React.ReactNode;
  planLabel?: string | null;
  planId?: string | null;
  planUnlimited?: boolean;
  onOpenPlans?: () => void;
  cloudSyncStatus?: 'idle' | 'loading' | 'synced' | 'error';
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function AppShell({
  activePage,
  onNavigate,
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange,
  alertCount = 0,
  indices,
  dashboardMarket,
  onDashboardMarketChange,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  searchInputKey,
  searchInputRef,
  loading,
  marketDataStatus,
  lastUpdatedAt,
  onRefresh,
  onSignIn,
  onSignOut,
  authLoading,
  userEmail,
  usageSlot,
  planLabel,
  planId,
  planUnlimited,
  onOpenPlans,
  cloudSyncStatus,
  children,
  footer,
}: AppShellProps) {
  const showMarketSelect = activePage === 'DASHBOARD' && !!onDashboardMarketChange;

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-sans selection:bg-emerald-500 selection:text-black overflow-x-hidden relative flex">
      <div className="fixed top-[-100px] left-[-100px] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-100px] right-[-100px] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none" />

      <AppSidebar
        activePage={activePage}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onCollapsedChange={onCollapsedChange}
        mobileOpen={mobileOpen}
        onMobileOpenChange={onMobileOpenChange}
        alertCount={alertCount}
        userEmail={userEmail}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        authLoading={authLoading}
        usageSlot={usageSlot}
        planLabel={planLabel}
        planId={planId}
        planUnlimited={planUnlimited}
        onOpenPlans={onOpenPlans}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <AppHeader
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          onSearchSubmit={(raw) => {
            onSearchSubmit(raw);
            onNavigate('ANALYSIS');
          }}
          searchInputKey={searchInputKey}
          searchInputRef={searchInputRef}
          loading={loading}
          marketDataStatus={marketDataStatus}
          lastUpdatedAt={lastUpdatedAt}
          onRefresh={onRefresh}
          onToggleMobileSidebar={() => onMobileOpenChange(!mobileOpen)}
          onOpenAlerts={() => onNavigate('ALERTS')}
          alertCount={alertCount}
          onGoDashboard={() => onNavigate('DASHBOARD')}
          cloudSyncStatus={cloudSyncStatus}
        />

        {showMarketSelect && (
          <div className="relative z-20 border-b border-emerald-500/25 bg-[#0a1210]">
            <div className="px-3 sm:px-4 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-400 shrink-0">
                <Globe className="h-4 w-4" />
                Select market
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DASHBOARD_MARKETS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => onDashboardMarketChange(m.key)}
                    className={cn(
                      'min-h-[40px] rounded-xl px-3.5 text-[12px] font-bold tracking-wide border cursor-pointer',
                      dashboardMarket === m.key
                        ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.35)]'
                        : 'bg-black/40 text-gray-300 border-white/10 hover:text-white hover:border-emerald-500/40'
                    )}
                  >
                    <span className="sm:hidden">{m.short}</span>
                    <span className="hidden sm:inline">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Market pulse */}
        <div className="relative z-10 bg-[#0A0A0C] border-b border-white/5 py-1.5 sm:py-2">
          <div className="px-3 sm:px-4 flex items-center gap-x-4 sm:gap-x-6 overflow-x-auto no-scrollbar lg:flex-wrap lg:justify-center lg:overflow-visible [-webkit-overflow-scrolling:touch]">
            {Array.isArray(indices) && indices.length > 0 ? (
              indices.filter(Boolean).map((idx, i) => (
                <div
                  key={`${idx?.symbol || 'idx'}-${i}`}
                  className="flex gap-1.5 sm:gap-2 items-center font-mono text-[10px] sm:text-[12px] tracking-tight shrink-0"
                >
                  <span className="text-gray-500">{idx.shortName || idx.symbol}</span>
                  <span className="text-white font-semibold">
                    {idx.regularMarketPrice?.toFixed(2) || '---'}
                  </span>
                  <span
                    className={cn(
                      'font-semibold',
                      (idx.regularMarketChange || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    )}
                  >
                    {(idx.regularMarketChangePercent || 0) >= 0 ? '+' : ''}
                    {idx.regularMarketChangePercent?.toFixed(2) || '0.00'}%
                  </span>
                </div>
              ))
            ) : (
              <div className="text-[11px] text-gray-600 animate-pulse font-sans">
                Awaiting global exchange feed…
              </div>
            )}
          </div>
        </div>

        <main className="relative z-10 flex-1 w-full max-w-[1400px] mx-auto px-3 py-4 sm:p-6 md:p-8 pb-10 min-w-0 overflow-x-hidden">
          {children}
        </main>

        {footer}
      </div>
    </div>
  );
}
