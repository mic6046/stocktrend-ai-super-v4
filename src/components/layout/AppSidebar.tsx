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
  Shield,
  LogOut,
  LogIn,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { LegalLinks } from '../LegalDocs';
import { openLegalDoc } from '../../lib/legal';
import type { AppPage } from './navTypes';
import { SidebarAiChat } from './SidebarAiChat';
import { SubscriptionPlansSummary } from '../SubscriptionPlansSummary';
import type { AssistantChatContext } from '../../lib/assistantChatApi';
import type { UsageSnapshot } from '../../lib/usageApi';

const NAV_ITEMS: { id: AppPage; label: string; icon: React.ElementType }[] = [
  { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'FIND_TRADES', label: 'Find Trades', icon: Search },
  { id: 'AI_SIGNALS', label: 'AI Signals', icon: Bot },
  { id: 'WATCHLIST', label: 'Watchlist', icon: Star },
  { id: 'PORTFOLIO', label: 'Portfolio', icon: Briefcase },
  { id: 'ANALYSIS', label: 'Analysis', icon: LineChart },
  { id: 'NEWS_CENTER', label: 'News', icon: Newspaper },
  { id: 'ALERTS', label: 'Alerts', icon: Bell },
  { id: 'SETTINGS', label: 'Settings', icon: Settings },
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
  chatContext: AssistantChatContext;
  onChatUsageUpdate?: (usage: UsageSnapshot) => void;
  /** Current subscription plan for the sign-bar plans strip */
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
  chatContext,
  onChatUsageUpdate,
  planLabel,
  planId,
  planUnlimited,
  onOpenPlans,
}: AppSidebarProps) {
  const go = (page: AppPage) => {
    onNavigate(page);
    onMobileOpenChange(false);
  };

  const navBody = (mode: 'desktop' | 'mobile') => {
    const isCollapsed = mode === 'desktop' && collapsed;
    return (
      <div className="flex h-full flex-col">
        <div
          className={cn(
            'flex items-center border-b border-white/5 shrink-0',
            isCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3 py-3'
          )}
        >
          {!isCollapsed && (
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 px-1">
              Navigate
            </p>
          )}
          {mode === 'desktop' ? (
            <button
              type="button"
              onClick={() => onCollapsedChange(!collapsed)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white cursor-pointer"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onMobileOpenChange(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white cursor-pointer ml-auto"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
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
                  'relative w-full flex items-center gap-3 rounded-xl text-left transition-colors cursor-pointer min-h-[44px]',
                  isCollapsed ? 'justify-center px-2' : 'px-3',
                  active
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                    : 'text-gray-400 border border-transparent hover:bg-white/[0.04] hover:text-white'
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-full bg-emerald-400" />
                )}
                <Icon className={cn('h-4 w-4 shrink-0', active && 'text-emerald-400')} />
                {!isCollapsed && (
                  <span className="text-[12px] font-semibold tracking-wide flex-1">{item.label}</span>
                )}
                {!isCollapsed && badge > 0 && (
                  <span className="rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 min-w-[1.25rem] text-center">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
                {isCollapsed && badge > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-400" />
                )}
              </button>
            );
          })}
        </nav>

        <div
          className={cn(
            'border-t border-white/5 shrink-0 space-y-2 overflow-y-auto max-h-[55vh]',
            isCollapsed ? 'p-2' : 'p-3'
          )}
        >
          {!isCollapsed && userEmail && (
            <div className="px-1 space-y-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <Shield className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <p className="text-[10px] text-gray-400 font-mono truncate" title={userEmail}>
                  {userEmail}
                </p>
              </div>
              {usageSlot && <div className="overflow-hidden">{usageSlot}</div>}
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

          <SidebarAiChat
            activePage={activePage}
            collapsed={isCollapsed}
            onExpandSidebar={() => onCollapsedChange(false)}
            userEmail={userEmail}
            onSignIn={() => {
              onSignIn();
              onMobileOpenChange(false);
            }}
            chatContext={chatContext}
            onUsageUpdate={onChatUsageUpdate}
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
                'w-full inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl border border-emerald-500/40 bg-emerald-500/15 font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 cursor-pointer',
                isCollapsed ? 'px-2' : 'px-3 text-[12px]'
              )}
            >
              <LogIn className="h-4 w-4 shrink-0" />
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
                'w-full inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl border border-rose-500/30 bg-rose-500/10 font-bold text-rose-300 hover:bg-rose-500/20 cursor-pointer',
                isCollapsed ? 'px-2' : 'px-3 text-[12px]'
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>Sign out</span>}
            </button>
          )}

          {!isCollapsed && (
            <div className="pt-1 px-0.5">
              <p className="text-[9px] font-mono uppercase tracking-wider text-gray-600 mb-1.5">
                Legal
              </p>
              <LegalLinks
                className="flex-col items-start gap-y-1.5 text-[10px]"
                linkClassName="text-gray-500 hover:text-emerald-400 underline-offset-2 hover:underline transition-colors cursor-pointer text-left"
              />
            </div>
          )}
          {isCollapsed && (
            <button
              type="button"
              onClick={() => openLegalDoc('risk')}
              className="w-full text-center text-[8px] text-gray-500 hover:text-emerald-400 leading-tight px-0.5 py-1 cursor-pointer"
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
          'hidden lg:flex flex-col shrink-0 border-r border-white/5 bg-[#08080a]/95 backdrop-blur-md sticky top-0 h-screen z-30 transition-[width] duration-200',
          collapsed ? 'w-16' : 'w-56'
        )}
      >
        {navBody('desktop')}
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
            aria-label="Close sidebar backdrop"
            onClick={() => onMobileOpenChange(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[min(18rem,88vw)] bg-[#08080a] border-r border-white/10 shadow-2xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            {navBody('mobile')}
          </aside>
        </div>
      )}
    </>
  );
}
