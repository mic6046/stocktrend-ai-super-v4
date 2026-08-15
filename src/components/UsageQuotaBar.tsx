import React, { useState } from 'react';
import { Loader2, Zap, Newspaper, Plus, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  startOverageCheckout,
  type OverageProduct,
  type UsageSnapshot,
} from '../lib/usageApi';

interface UsageQuotaBarProps {
  usage: UsageSnapshot | null;
  email?: string | null;
  onRefresh?: () => void;
  compact?: boolean;
  /** Sidebar: stacked Search / News cards instead of a cramped pill */
  variant?: 'inline' | 'sidebar';
}

/** Resolve what the meter should show: daily included OR pack credits after daily is out. */
function meterValues(
  usage: UsageSnapshot,
  kind: 'analysis' | 'news'
): { used: number; total: number; remaining: number; mode: 'daily' | 'pack' | 'out' } {
  if (kind === 'analysis') {
    if (usage.unlimited) {
      return { used: 0, total: 0, remaining: 9999, mode: 'daily' };
    }
    const dailyRem = Math.max(0, usage.analysesLimit - usage.analysesUsed);
    if (dailyRem > 0) {
      return {
        used: usage.analysesUsed,
        total: usage.analysesLimit,
        remaining: dailyRem,
        mode: 'daily',
      };
    }
    if ((usage.bonusAnalyses || 0) > 0 || usage.analysesOnBonus) {
      const rem = Math.max(0, usage.bonusAnalyses || 0);
      const used = Math.max(0, usage.bonusAnalysesUsed || 0);
      const total = Math.max(usage.bonusAnalysesPackSize || 0, used + rem, rem);
      if (total <= 0) {
        return { used: usage.analysesLimit, total: usage.analysesLimit, remaining: 0, mode: 'out' };
      }
      return { used: Math.min(used, total), total, remaining: rem, mode: 'pack' };
    }
    return {
      used: usage.analysesLimit,
      total: usage.analysesLimit,
      remaining: 0,
      mode: 'out',
    };
  }

  if (usage.unlimited) {
    return { used: 0, total: 0, remaining: 9999, mode: 'daily' };
  }
  const dailyRem = Math.max(0, usage.newsLimit - usage.newsUsed);
  if (dailyRem > 0) {
    return {
      used: usage.newsUsed,
      total: usage.newsLimit,
      remaining: dailyRem,
      mode: 'daily',
    };
  }
  if ((usage.bonusNews || 0) > 0 || usage.newsOnBonus) {
    const rem = Math.max(0, usage.bonusNews || 0);
    const used = Math.max(0, usage.bonusNewsUsed || 0);
    const total = Math.max(usage.bonusNewsPackSize || 0, used + rem, rem);
    if (total <= 0) {
      return { used: usage.newsLimit, total: usage.newsLimit, remaining: 0, mode: 'out' };
    }
    return { used: Math.min(used, total), total, remaining: rem, mode: 'pack' };
  }
  return {
    used: usage.newsLimit,
    total: usage.newsLimit,
    remaining: 0,
    mode: 'out',
  };
}

function InlineMeter({
  label,
  icon,
  used,
  total,
  remaining,
  unlimited,
  accent,
  mode,
}: {
  label: string;
  icon: React.ReactNode;
  used: number;
  total: number;
  remaining: number;
  unlimited: boolean;
  accent: 'emerald' | 'cyan';
  mode: 'daily' | 'pack' | 'out';
}) {
  const low = !unlimited && remaining <= Math.max(2, Math.ceil(Math.max(total, 1) * 0.2));
  const empty = !unlimited && remaining <= 0;
  const pct = unlimited ? 100 : total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 100;

  return (
    <div
      className="inline-flex items-center gap-1.5 shrink-0"
      title={
        unlimited
          ? `${label}: unlimited`
          : mode === 'pack'
            ? `${label} credits: ${used}/${total} used · ${remaining} left`
            : `${label}: ${used} used · ${remaining} left · ${total} daily limit`
      }
    >
      <span
        className={cn(
          empty ? 'text-rose-400' : low ? 'text-amber-300' : accent === 'emerald' ? 'text-emerald-400' : 'text-cyan-400'
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          'text-[9px] uppercase tracking-wide font-bold',
          empty ? 'text-rose-300' : low ? 'text-amber-200' : 'text-gray-500'
        )}
      >
        {label}
        {mode === 'pack' && <span className="text-[8px] text-amber-300/90 normal-case ml-0.5">pack</span>}
      </span>
      {unlimited ? (
        <span className="text-[10px] text-gray-200 font-semibold">∞</span>
      ) : (
        <>
          <span
            className={cn(
              'text-[10px] font-semibold tabular-nums',
              empty ? 'text-rose-300' : low ? 'text-amber-200' : 'text-gray-100'
            )}
          >
            {used}
            <span className="text-gray-500 font-normal">/{total}</span>
          </span>
          <div className="h-1 w-10 rounded-full bg-white/10 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                empty ? 'bg-rose-500' : low ? 'bg-amber-400' : accent === 'emerald' ? 'bg-emerald-500' : 'bg-cyan-500'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span
            className={cn(
              'text-[8px] font-mono tabular-nums hidden sm:inline',
              empty ? 'text-rose-300/90' : low ? 'text-amber-200/80' : 'text-gray-500'
            )}
          >
            {remaining} left
          </span>
        </>
      )}
    </div>
  );
}

function SidebarMeter({
  label,
  icon,
  used,
  total,
  remaining,
  unlimited,
  accent,
  mode,
  action,
}: {
  label: string;
  icon: React.ReactNode;
  used: number;
  total: number;
  remaining: number;
  unlimited: boolean;
  accent: 'emerald' | 'cyan';
  mode: 'daily' | 'pack' | 'out';
  action?: React.ReactNode;
}) {
  const low = !unlimited && remaining <= Math.max(2, Math.ceil(Math.max(total, 1) * 0.2));
  const empty = !unlimited && remaining <= 0;
  const pct = unlimited ? 100 : total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 100;

  return (
    <div
      className={cn(
        'rounded-lg border px-2.5 py-2 space-y-1.5',
        empty
          ? 'border-rose-500/30 bg-rose-500/10'
          : low
            ? 'border-amber-500/25 bg-amber-500/10'
            : 'border-white/[0.08] bg-black/20'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={cn(
              empty ? 'text-rose-400' : low ? 'text-amber-300' : accent === 'emerald' ? 'text-emerald-400' : 'text-cyan-400'
            )}
          >
            {icon}
          </span>
          <span className="text-[11px] font-bold text-white tracking-tight">{label}</span>
          {mode === 'pack' && (
            <span className="text-[8px] font-mono uppercase tracking-wide text-amber-300/90">pack</span>
          )}
        </div>
        {unlimited ? (
          <span className="text-[12px] font-semibold text-gray-200">∞</span>
        ) : (
          <span
            className={cn(
              'text-[12px] font-semibold tabular-nums',
              empty ? 'text-rose-300' : low ? 'text-amber-200' : 'text-gray-100'
            )}
          >
            {used}
            <span className="text-gray-500 font-normal">/{total}</span>
          </span>
        )}
      </div>
      {!unlimited && (
        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              empty ? 'bg-rose-500' : low ? 'bg-amber-400' : accent === 'emerald' ? 'bg-emerald-500' : 'bg-cyan-500'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'text-[10px] font-mono tabular-nums',
            empty ? 'text-rose-300/90' : low ? 'text-amber-200/80' : 'text-gray-500'
          )}
        >
          {unlimited ? 'Unlimited' : `${remaining} left`}
        </span>
        {action}
      </div>
    </div>
  );
}

export function UsageQuotaBar({
  usage,
  email,
  onRefresh,
  compact,
  variant = 'inline',
}: UsageQuotaBarProps) {
  const [busy, setBusy] = useState<OverageProduct | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!usage) return null;

  const buy = async (product: OverageProduct) => {
    if (!email) {
      setError('Sign in required');
      return;
    }
    setError(null);
    setBusy(product);
    try {
      const { url } = await startOverageCheckout(product, email);
      window.location.href = url;
    } catch (err: any) {
      setError(err?.message || 'Checkout failed');
      setBusy(null);
    }
  };

  const searchMeter = meterValues(usage, 'analysis');
  const newsMeter = meterValues(usage, 'news');

  const searchLow =
    !usage.unlimited &&
    searchMeter.remaining <= Math.max(2, Math.ceil(Math.max(searchMeter.total, 1) * 0.2));
  const newsLow =
    !usage.unlimited &&
    newsMeter.remaining <= Math.max(2, Math.ceil(Math.max(newsMeter.total, 1) * 0.2));
  const anyLow = searchLow || newsLow;
  const anyEmpty =
    !usage.unlimited && (usage.analysesRemaining <= 0 || usage.newsRemaining <= 0);

  if (variant === 'sidebar') {
    return (
      <div className="w-full space-y-2" title={error || undefined}>
        <div className="flex items-center justify-between gap-2 px-0.5">
          <span className="text-[10px] uppercase tracking-[0.14em] text-emerald-400 font-bold">
            {usage.planLabel}
          </span>
          {(anyLow || anyEmpty) && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider',
                anyEmpty ? 'text-rose-300' : 'text-amber-200'
              )}
            >
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {anyEmpty ? 'Out' : 'Low'}
            </span>
          )}
        </div>

        <SidebarMeter
          label="Search"
          icon={<Zap className="h-3.5 w-3.5" />}
          used={searchMeter.used}
          total={searchMeter.total}
          remaining={searchMeter.remaining}
          unlimited={usage.unlimited}
          accent="emerald"
          mode={searchMeter.mode === 'out' ? 'daily' : searchMeter.mode}
          action={
            !usage.unlimited ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => buy('analysis')}
                className="inline-flex items-center gap-0.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[9px] uppercase tracking-wide text-gray-300 hover:bg-white/10 disabled:opacity-50 shrink-0 cursor-pointer"
                title="Buy +5 searches · RM 5"
              >
                {busy === 'analysis' ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                +5
              </button>
            ) : undefined
          }
        />

        <SidebarMeter
          label="News"
          icon={<Newspaper className="h-3.5 w-3.5" />}
          used={newsMeter.used}
          total={newsMeter.total}
          remaining={newsMeter.remaining}
          unlimited={usage.unlimited}
          accent="cyan"
          mode={newsMeter.mode === 'out' ? 'daily' : newsMeter.mode}
          action={
            !usage.unlimited ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => buy('news')}
                  className="inline-flex items-center gap-0.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[9px] uppercase tracking-wide text-gray-300 hover:bg-white/10 disabled:opacity-50 shrink-0 cursor-pointer"
                  title="Buy +10 news · RM 5"
                >
                  {busy === 'news' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  +10
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => buy('reload_pack')}
                  className="inline-flex items-center gap-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[9px] uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 shrink-0 cursor-pointer"
                  title="Reload pack · RM 10 · +10 analyses +10 news"
                >
                  {busy === 'reload_pack' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Pack
                </button>
              </div>
            ) : undefined
          }
        />

        {error && onRefresh && (
          <button
            type="button"
            className="text-[10px] text-rose-400 underline cursor-pointer"
            onClick={onRefresh}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-full border font-mono inline-flex items-center gap-2 shrink-0 px-2.5 py-1.5 h-9 max-w-full overflow-x-auto',
        anyEmpty
          ? 'border-rose-500/35 bg-rose-500/10'
          : anyLow
            ? 'border-amber-500/30 bg-amber-500/10'
            : 'border-white/10 bg-[#111113]',
        compact && 'px-2 py-1 h-8 gap-1.5'
      )}
      title={error || undefined}
    >
      <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold whitespace-nowrap">
        {usage.planLabel}
      </span>
      {(anyLow || anyEmpty) && (
        <span
          className={cn(
            'inline-flex items-center gap-0.5 text-[8px] font-semibold uppercase tracking-wider',
            anyEmpty ? 'text-rose-300' : 'text-amber-200'
          )}
        >
          <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
          {anyEmpty ? 'Out' : 'Low'}
        </span>
      )}

      <span className="w-px h-4 bg-white/10 shrink-0" />

      <InlineMeter
        label="Search"
        icon={<Zap className="h-3 w-3" />}
        used={searchMeter.used}
        total={searchMeter.total}
        remaining={searchMeter.remaining}
        unlimited={usage.unlimited}
        accent="emerald"
        mode={searchMeter.mode === 'out' ? 'daily' : searchMeter.mode}
      />
      {!usage.unlimited && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => buy('analysis')}
          className="inline-flex items-center gap-0.5 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-gray-300 hover:bg-white/10 disabled:opacity-50 shrink-0"
          title="Buy +5 searches · RM 5"
        >
          {busy === 'analysis' ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Plus className="h-2.5 w-2.5" />}
          +5
        </button>
      )}

      <span className="w-px h-4 bg-white/10 shrink-0" />

      <InlineMeter
        label="News"
        icon={<Newspaper className="h-3 w-3" />}
        used={newsMeter.used}
        total={newsMeter.total}
        remaining={newsMeter.remaining}
        unlimited={usage.unlimited}
        accent="cyan"
        mode={newsMeter.mode === 'out' ? 'daily' : newsMeter.mode}
      />
      {!usage.unlimited && (
        <>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => buy('news')}
            className="inline-flex items-center gap-0.5 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-gray-300 hover:bg-white/10 disabled:opacity-50 shrink-0"
            title="Buy +10 news · RM 5"
          >
            {busy === 'news' ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Plus className="h-2.5 w-2.5" />}
            +10
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => buy('reload_pack')}
            className="inline-flex items-center gap-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 shrink-0"
            title="Reload pack · RM 10 · +10 analyses +10 news · lasts until used"
          >
            {busy === 'reload_pack' ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Plus className="h-2.5 w-2.5" />}
            Pack
          </button>
        </>
      )}

      {error && onRefresh && (
        <button type="button" className="text-[8px] text-rose-400 underline shrink-0" onClick={onRefresh}>
          Retry
        </button>
      )}
    </div>
  );
}

interface QuotaExhaustedBannerProps {
  message: string;
  kind: 'analysis' | 'news';
  email?: string | null;
  onDismiss?: () => void;
}

export function QuotaExhaustedBanner({ message, kind, email, onDismiss }: QuotaExhaustedBannerProps) {
  const [busy, setBusy] = useState<OverageProduct | null>(null);

  const buy = async (product: OverageProduct) => {
    if (!email) return;
    setBusy(product);
    try {
      const { url } = await startOverageCheckout(product, email);
      window.location.href = url;
    } catch {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
      <p className="font-medium text-amber-200">{message}</p>
      <p className="mt-1 text-[10px] text-amber-100/80">
        Usage is out — reload credits below to continue.
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {kind === 'analysis' ? (
          <>
            <button
              type="button"
              disabled={!email || busy !== null}
              onClick={() => buy('analysis')}
              className="rounded-md bg-emerald-500 px-2.5 py-1 text-[10px] font-bold text-black disabled:opacity-50"
            >
              {busy === 'analysis' ? '…' : 'Mini RM5 (+5)'}
            </button>
            <button
              type="button"
              disabled={!email || busy !== null}
              onClick={() => buy('reload_pack')}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300 disabled:opacity-50"
            >
              {busy === 'reload_pack' ? '…' : 'Reload RM10 (+10/+10)'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={!email || busy !== null}
              onClick={() => buy('news')}
              className="rounded-md bg-cyan-500 px-2.5 py-1 text-[10px] font-bold text-black disabled:opacity-50"
            >
              {busy === 'news' ? '…' : 'News mini RM5 (+10)'}
            </button>
            <button
              type="button"
              disabled={!email || busy !== null}
              onClick={() => buy('reload_pack')}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300 disabled:opacity-50"
            >
              {busy === 'reload_pack' ? '…' : 'Reload RM10 (+10/+10)'}
            </button>
          </>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md border border-white/10 px-2.5 py-1 text-[10px] text-gray-400"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
