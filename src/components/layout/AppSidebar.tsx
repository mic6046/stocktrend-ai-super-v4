import React from 'react';
import {
  LayoutDashboard,
  Search,
  Bot,
  Star,
  Briefcase,
  LineChart,
  Newspaper,
  Bell,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  LogOut,
  LogIn,
  Activity,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { LegalLinks } from '../LegalDocs';
import { openLegalDoc } from '../../lib/legal';
import type { AppPage } from './navTypes';
import { SubscriptionPlansSummary } from '../SubscriptionPlansSummary';
import { planDisplayName } from '../../lib/pricingPlans';

type NavGroup = {
  label: string;
  items: { id: AppPage; label: string; icon: React.ElementType }[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Markets',
    items: [
      { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'FIND_TRADES', label: 'Find Trades', icon: Search },
      { id: 'AI_SIGNALS', label: 'AI Signals', icon: Bot },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { id: 'WATCHLIST', label: 'Watchlist', icon: Star },
      { id: 'PORTFOLIO', label: 'Portfolio', icon: Briefcase },
      { id: 'ANALYSIS', label: 'Analysis', icon: LineChart },
      { id: 'NEWS_CENTER', label: 'News', icon: Newspaper },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'ALERTS', label: 'Alerts', icon: Bell },
      { id: 'SETTINGS', label: 'Settings', icon: Settings },
    ],
  },
];

type AppSidebarProps = {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  alertCount?: number;
  userEmail?: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  authLoading?: boolean;
  usageSlot?: React.ReactNode;
  planLabel?: string | null;
  planId?: string | null;
  planUnlimited?: boolean;
  onOpenPlans?: () => void;
};

export function AppSidebar({
  activePage,
  onNavigate,
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange,
  alertCount = 0,
  userEmail,
  onSignIn,
  onSignOut,
  authLoading,
  usageSlot,
  planLabel,
  planId,
  planUnlimited,
  onOpenPlans,
}: AppSidebarProps) {
  const go = (page: AppPage) => {
    onNavigate(page);
    onMobileOpenChange(false);
  };

  const planName = planUnlimited
    ? 'Developer'
    : planDisplayName(planId, planLabel);

  const navBody = (mode: 'desktop' | 'mobile') => {
    const isCollapsed = mode === 'desktop' && collapsed;
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {/* Brand */}
        <div
          className={cn(
            'shrink-0 border-b border-white/[0.06]',
            isCollapsed ? 'px-2 py-3.5 flex justify-center' : 'px-3.5 py-3.5'
          )}
        >
          {isCollapsed ? (
            <button
              type="button"
              onClick={() => onCollapsedChange(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500 text-black cursor-pointer"
              aria-label="Expand sidebar"
              title="Expand"
            >
              <Activity className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500 text-black shrink-0">
                  <Activity className="h-4 w-4" />
                </div>
                <div className="min-w-0 leading-tight">
                  <p className="text-[12px] font-extrabold tracking-[0.04em] text-white uppercase truncate">
                    Quantum<span className="text-emerald-400">Node</span>
                  </p>
                  <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-gray-500">
                    Equity terminal
                  </p>
                </div>
              </div>
              {mode === 'desktop' ? (
                <button
                  type="button"
                  onClick={() => onCollapsedChange(true)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/[0.04] cursor-pointer"
                  aria-label="Collapse sidebar"
                  title="Collapse"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onMobileOpenChange(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/[0.04] cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
          {isCollapsed && mode === 'desktop' && (
            <button
              type="button"
              onClick={() => onCollapsedChange(false)}
              className="mt-2 w-full inline-flex h-8 items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/[0.04] cursor-pointer"
              aria-label="Expand sidebar"
              title="Expand"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 py-3 space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!isCollapsed && (
                <p className="px-2.5 mb-1.5 text-[9px] font-mono uppercase tracking-[0.2em] text-gray-600">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activePage === item.id;
                  const badge = item.id === 'ALERTS' && alertCount > 0 ? alertCount : 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => go(item.id)}
                      title={item.label}
                      className={cn(
                        'relative w-full flex items-center gap-2.5 text-left transition-colors cursor-pointer min-h-[38px]',
                        isCollapsed ? 'justify-center px-2 rounded-md' : 'px-2.5 rounded-md',
                        active
                          ? 'bg-white/[0.06] text-white'
                          : 'text-gray-400 hover:text-gray-100 hover:bg-white/[0.03]'
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-emerald-400" />
                      )}
                      <Icon
                        className={cn(
                          'h-[15px] w-[15px] shrink-0',
                          active ? 'text-emerald-400' : 'text-gray-500'
                        )}
                      />
                      {!isCollapsed && (
                        <span
                          className={cn(
                            'text-[12.5px] tracking-tight flex-1',
                            active ? 'font-semibold text-white' : 'font-medium'
                          )}
                        >
                          {item.label}
                        </span>
                      )}
                      {!isCollapsed && badge > 0 && (
                        <span className="rounded-md bg-white/10 text-gray-200 text-[9px] font-mono font-semibold px-1.5 py-0.5 min-w-[1.1rem] text-center">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                      {isCollapsed && badge > 0 && (
                        <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Account / plan footer */}
        <div
          className={cn(
            'shrink-0 border-t border-white/[0.06] overflow-y-auto overscroll-contain space-y-2',
            isCollapsed ? 'p-2' : 'p-3',
            'max-h-[min(38vh,17rem)]'
          )}
        >
          {!isCollapsed && userEmail && (
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 space-y-1.5">
              <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-gray-600">
                Signed in
              </p>
              <p className="text-[11px] text-gray-300 font-mono truncate" title={userEmail}>
                {userEmail}
              </p>
              <p className="text-[10px] text-gray-500">
                Plan{' '}
                <span className="text-emerald-400/90 font-semibold">{planName}</span>
              </p>
              {usageSlot && (
                <div className="overflow-x-auto overflow-y-hidden pt-0.5 -mx-0.5">{usageSlot}</div>
              )}
            </div>
          )}

          <SubscriptionPlansSummary
            variant="sidebar"
            collapsed={isCollapsed}
            currentPlanLabel={planLabel}
            currentPlanId={planId}
            unlimited={planUnlimited}
            onExpand={() => onCollapsedChange(false)}
            onCta={() => {
              onOpenPlans?.();
              onMobileOpenChange(false);
            }}
            ctaLabel="Manage plan"
          />

          {!userEmail ? (
            <button
              type="button"
              onClick={() => {
                onSignIn();
                onMobileOpenChange(false);
              }}
              disabled={authLoading}
              title="Sign in"
              className={cn(
                'w-full inline-flex items-center justify-center gap-2 min-h-[36px] rounded-md bg-emerald-500 font-semibold text-black hover:bg-emerald-400 disabled:opacity-50 cursor-pointer',
                isCollapsed ? 'px-2' : 'px-3 text-[12px]'
              )}
            >
              <LogIn className="h-3.5 w-3.5 shrink-0" />
              {!isCollapsed && <span>Sign in</span>}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onSignOut();
                onMobileOpenChange(false);
              }}
              title="Sign out"
              className={cn(
                'w-full inline-flex items-center justify-center gap-2 min-h-[34px] rounded-md border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.04] cursor-pointer',
                isCollapsed ? 'px-2' : 'px-3 text-[11px] font-medium'
              )}
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              {!isCollapsed && <span>Sign out</span>}
            </button>
          )}

          {!isCollapsed ? (
            <LegalLinks
              className="flex-wrap gap-x-2.5 gap-y-1 px-0.5 text-[9px]"
              linkClassName="text-gray-600 hover:text-gray-300 transition-colors cursor-pointer"
            />
          ) : (
            <button
              type="button"
              onClick={() => openLegalDoc('risk')}
              className="w-full text-center text-[8px] text-gray-600 hover:text-gray-300 leading-tight px-0.5 py-1 cursor-pointer"
              title="Risk Warning · Terms of Use · Privacy Policy"
            >
              Legal
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <aside
        className={cn(
          'hidden lg:flex flex-col shrink-0 border-r border-white/[0.06] bg-[#070709] sticky top-0 h-screen max-h-screen overflow-hidden z-30 transition-[width] duration-200',
          collapsed ? 'w-[4.25rem]' : 'w-[15.5rem]'
        )}
      >
        {navBody('desktop')}
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <button
            type="button"
            className="absolute inset-0 bg-black/75 cursor-pointer"
            aria-label="Close sidebar backdrop"
            onClick={() => onMobileOpenChange(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[min(19rem,90vw)] bg-[#070709] border-r border-white/[0.08] shadow-2xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] overflow-hidden">
            {navBody('mobile')}
          </aside>
        </div>
      )}
    </>
  );
}
