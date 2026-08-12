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
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AppPage } from './navTypes';

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
};

export function AppSidebar({
  activePage,
  onNavigate,
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange,
  alertCount = 0,
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

        {!isCollapsed && (
          <div className="border-t border-white/5 p-3 shrink-0">
            <p className="text-[10px] text-gray-600 leading-relaxed">
              Signals translated into plain language for clear decisions.
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col shrink-0 border-r border-white/5 bg-[#08080a]/95 backdrop-blur-md sticky top-0 h-screen z-30 transition-[width] duration-200',
          collapsed ? 'w-16' : 'w-56'
        )}
      >
        {navBody('desktop')}
      </aside>

      {/* Mobile drawer */}
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
