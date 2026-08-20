import React, { useState } from 'react';
import { Settings as SettingsIcon, Shield, CreditCard, Check, Loader2, Gem, Rocket, Zap, BookOpen, Sun, Moon, LifeBuoy } from 'lucide-react';
import { GlassCard, SectionLabel } from '../analysis/GlassCard';
import { MarketDataRefreshBar } from '../analysis/MarketDataRefreshBar';
import type { MarketDataStatus, RefreshMode, AutoRefreshIntervalSec } from '../../lib/marketDataRefresh';
import { OVERAGE_OFFERS, PRICING_PLANS, planDisplayName } from '../../lib/pricingPlans';
import { startStripeCheckout, type SubscriptionPlan } from '../../lib/subscription';
import { startOverageCheckout, type OverageProduct } from '../../lib/usageApi';
import { openLegalDoc } from '../../lib/legal';
import { openUserManual } from '../../lib/userManual';
import { openHelpForm } from '../../lib/helpForm';
import type { AppTheme } from '../../lib/themeStore';
import { cn } from '../../lib/utils';

type SettingsPageProps = {
  lastUpdatedAt: number | null;
  marketDataStatus: MarketDataStatus;
  refreshMode: RefreshMode;
  autoRefreshIntervalSec: AutoRefreshIntervalSec;
  onModeChange: (mode: RefreshMode) => void;
  onIntervalChange: (sec: AutoRefreshIntervalSec) => void;
  onRefresh: () => void;
  disabled?: boolean;
  userEmail?: string | null;
  onSignOut: () => void;
  planLabel?: string | null;
  planId?: string | null;
  planUnlimited?: boolean;
  selfLearningSlot?: React.ReactNode;
  quantTuningSlot?: React.ReactNode;
  theme?: AppTheme;
  onThemeChange?: (theme: AppTheme) => void;
};

export function SettingsPage({
  lastUpdatedAt,
  marketDataStatus,
  refreshMode,
  autoRefreshIntervalSec,
  onModeChange,
  onIntervalChange,
  onRefresh,
  disabled,
  userEmail,
  onSignOut,
  planLabel,
  planId,
  planUnlimited,
  selfLearningSlot,
  quantTuningSlot,
  theme = 'dark',
  onThemeChange,
}: SettingsPageProps) {
  const [busyPlan, setBusyPlan] = useState<SubscriptionPlan | null>(null);
  const [busyOverage, setBusyOverage] = useState<OverageProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const currentName = planUnlimited
    ? 'Developer'
    : planDisplayName(planId, planLabel);

  const handleCheckout = async (plan: SubscriptionPlan) => {
    if (!userEmail) {
      setError('Please sign in first.');
      return;
    }
    if (!acceptedLegal) {
      setError('Please confirm the Terms, Privacy Policy, and Risk Warning before checkout.');
      return;
    }
    setError(null);
    setBusyPlan(plan);
    try {
      const { url } = await startStripeCheckout(plan, userEmail);
      window.location.href = url;
    } catch (err: any) {
      setError(err?.message || 'Unable to start checkout.');
      setBusyPlan(null);
    }
  };

  const handleOverage = async (product: OverageProduct) => {
    if (!userEmail) {
      setError('Please sign in first.');
      return;
    }
    setError(null);
    setBusyOverage(product);
    try {
      const { url } = await startOverageCheckout(product, userEmail);
      window.location.href = url;
    } catch (err: any) {
      setError(err?.message || 'Unable to start reload checkout.');
      setBusyOverage(null);
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-gray-400">Preferences</p>
        <h2 className="mt-1 text-2xl font-sans font-bold text-white">Settings</h2>
        <p className="mt-1 text-[13px] text-gray-500">
          Appearance, market refresh, subscription, calibration, and account controls.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openUserManual()}
            className="inline-flex items-center gap-2 min-h-[40px] rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 text-[12px] font-semibold text-emerald-200 hover:bg-emerald-500/15 cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Open User Manual
          </button>
          <button
            type="button"
            onClick={() => openHelpForm()}
            className="inline-flex items-center gap-2 min-h-[40px] rounded-xl border border-white/10 bg-white/5 px-3.5 text-[12px] font-semibold text-white hover:bg-white/10 cursor-pointer"
          >
            <LifeBuoy className="h-3.5 w-3.5" />
            Contact support
          </button>
        </div>
      </div>

      <GlassCard>
        <SectionLabel icon={<Sun className="w-3.5 h-3.5 text-amber-400" />}>
          Appearance
        </SectionLabel>
        <p className="mt-2 text-[12px] text-gray-400 leading-relaxed">
          Choose light or dark mode for the terminal. Preference syncs with your account when signed in.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onThemeChange?.('light')}
            className={cn(
              'min-h-[48px] rounded-xl border px-3 inline-flex items-center justify-center gap-2 text-[12px] font-bold cursor-pointer',
              theme === 'light'
                ? 'border-amber-400/50 bg-amber-400/15 text-amber-700'
                : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
            )}
          >
            <Sun className="h-4 w-4" />
            Light
          </button>
          <button
            type="button"
            onClick={() => onThemeChange?.('dark')}
            className={cn(
              'min-h-[48px] rounded-xl border px-3 inline-flex items-center justify-center gap-2 text-[12px] font-bold cursor-pointer',
              theme === 'dark'
                ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200'
                : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
            )}
          >
            <Moon className="h-4 w-4" />
            Dark
          </button>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionLabel icon={<BookOpen className="w-3.5 h-3.5 text-emerald-400" />}>
          Help & manual
        </SectionLabel>
        <p className="mt-2 text-[12px] text-gray-400 leading-relaxed">
          Step-by-step guide for Dashboard, Find Trades, Watchlist sync across devices, Analysis credits,
          Alerts, and Settings. Use Contact support if you need help from us.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openUserManual()}
            className="min-h-[40px] rounded-xl border border-white/10 bg-white/5 px-4 text-[12px] font-bold text-white hover:bg-white/10 cursor-pointer inline-flex items-center gap-2"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Read the User Manual
          </button>
          <button
            type="button"
            onClick={() => openHelpForm()}
            className="min-h-[40px] rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 text-[12px] font-bold text-emerald-200 hover:bg-emerald-500/20 cursor-pointer inline-flex items-center gap-2"
          >
            <LifeBuoy className="h-3.5 w-3.5" />
            Contact support
          </button>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionLabel icon={<CreditCard className="w-3.5 h-3.5 text-amber-400" />}>
          Subscription
        </SectionLabel>
        <p className="mt-2 text-[13px] text-gray-300">
          Current plan:{' '}
          <span className="font-bold text-emerald-300">{currentName}</span>
        </p>
        <p className="mt-1 text-[11px] text-gray-500">
          Basic RM 199/mo · 20 analyses + 20 news/day · Pro RM 349/mo · Each Search/Refresh = 1 credit · Quotas reset every day (midnight MYT).
        </p>

        <label className="mt-4 flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedLegal}
            onChange={(e) => setAcceptedLegal(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black accent-emerald-500 cursor-pointer"
          />
          <span className="text-[11px] text-gray-400 leading-relaxed">
            I agree to the{' '}
            <button
              type="button"
              className="text-emerald-400 hover:underline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openLegalDoc('terms');
              }}
            >
              Terms
            </button>
            ,{' '}
            <button
              type="button"
              className="text-emerald-400 hover:underline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openLegalDoc('privacy');
              }}
            >
              Privacy
            </button>
            , and{' '}
            <button
              type="button"
              className="text-emerald-400 hover:underline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openLegalDoc('risk');
              }}
            >
              Risk Warning
            </button>
            .
          </span>
        </label>

        {error && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'rounded-xl border p-4 flex flex-col',
                plan.highlight ? 'border-emerald-500/35 bg-emerald-500/5' : 'border-white/10 bg-black/30'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                {plan.icon === 'gem' ? (
                  <Gem className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Rocket className="h-3.5 w-3.5 text-blue-400" />
                )}
                <span className="text-sm font-bold text-white">{plan.name}</span>
                {plan.badge && (
                  <span className="ml-auto text-[9px] font-mono uppercase text-emerald-400">
                    {plan.badge}
                  </span>
                )}
              </div>
              <p className="text-xl font-bold text-white">
                {plan.price}
                <span className="text-xs font-normal text-gray-500">{plan.period}</span>
              </p>
              <ul className="mt-2 mb-3 space-y-1 flex-1">
                {plan.features.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-[11px] text-gray-400">
                    <Check className="h-3 w-3 shrink-0 text-emerald-400 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={busyPlan !== null || busyOverage !== null || !acceptedLegal || !userEmail}
                onClick={() => void handleCheckout(plan.id)}
                className={cn(
                  'w-full min-h-[40px] rounded-xl text-[12px] font-bold disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-2',
                  plan.highlight
                    ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                    : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
                )}
              >
                {busyPlan === plan.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {busyPlan === plan.id ? 'Redirecting…' : `Subscribe · ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-emerald-400">
              Need more credits?
            </p>
          </div>
          <p className="text-[12px] text-gray-400 mb-3">
            One-time Reload pack and minis — credits last until used (do not reset daily).
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {OVERAGE_OFFERS.map((offer) => (
              <div
                key={offer.product}
                className={cn(
                  'rounded-lg border px-3 py-2.5 flex flex-col',
                  offer.highlight
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-white/10 bg-black/30'
                )}
              >
                <p className="text-[12px] font-bold text-white">{offer.label}</p>
                <p className="text-lg font-bold text-emerald-400">{offer.price}</p>
                <p className="text-[10px] text-gray-500 mb-2 flex-1">{offer.note}</p>
                <button
                  type="button"
                  disabled={!userEmail || busyPlan !== null || busyOverage !== null}
                  onClick={() => void handleOverage(offer.product)}
                  className={cn(
                    'w-full min-h-[34px] rounded-lg text-[11px] font-bold disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-1.5',
                    offer.highlight
                      ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                      : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
                  )}
                >
                  {busyOverage === offer.product && <Loader2 className="h-3 w-3 animate-spin" />}
                  {busyOverage === offer.product ? 'Redirecting…' : `Buy · ${offer.price}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionLabel icon={<SettingsIcon className="w-3.5 h-3.5 text-emerald-400" />}>
          Market data refresh
        </SectionLabel>
        <p className="mt-2 text-[11px] text-amber-200/90 leading-relaxed">
          Warning: each manual Search or Refresh uses 1 AI analysis credit. Auto mode only updates the live quote and does not spend analysis credits.
        </p>
        <div className="mt-3">
          <MarketDataRefreshBar
            lastUpdatedAt={lastUpdatedAt}
            status={marketDataStatus}
            mode={refreshMode}
            intervalSec={autoRefreshIntervalSec}
            onModeChange={onModeChange}
            onIntervalChange={onIntervalChange}
            onRefresh={onRefresh}
            disabled={disabled}
          />
        </div>
      </GlassCard>

      <GlassCard>
        <SectionLabel icon={<Shield className="w-3.5 h-3.5 text-cyan-400" />}>Account</SectionLabel>
        <p className="mt-2 text-[13px] text-gray-300 font-mono">{userEmail || 'Not signed in'}</p>
        {userEmail && (
          <button
            type="button"
            onClick={onSignOut}
            className="mt-3 min-h-[44px] rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 text-[12px] font-bold text-rose-300 hover:bg-rose-500/20 cursor-pointer"
          >
            Sign out
          </button>
        )}
      </GlassCard>

      {quantTuningSlot && (
        <GlassCard>
          <SectionLabel>Quant tuning</SectionLabel>
          <div className="mt-3">{quantTuningSlot}</div>
        </GlassCard>
      )}

      {selfLearningSlot && (
        <GlassCard>
          <SectionLabel>Self-learning / calibration</SectionLabel>
          <p className="mt-1 text-[11px] text-gray-500 mb-3">
            Adjust how much weight the AI gives to trend, smart money, and other factors. Use Save when you are done — unsaved slider moves do not apply yet.
          </p>
          <div className="mt-2">{selfLearningSlot}</div>
        </GlassCard>
      )}
    </div>
  );
}
