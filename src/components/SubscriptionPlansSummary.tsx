import React from 'react';
import { Check, Gem, Rocket, CreditCard } from 'lucide-react';
import { cn } from '../lib/utils';
import { PRICING_PLANS, planDisplayName } from '../lib/pricingPlans';

type SubscriptionPlansSummaryProps = {
  variant: 'landing' | 'landingInline' | 'sidebar';
  /** Current plan label from usage / subscription (sidebar). */
  currentPlanLabel?: string | null;
  currentPlanId?: string | null;
  unlimited?: boolean;
  collapsed?: boolean;
  onExpand?: () => void;
  onCta?: () => void;
  ctaLabel?: string;
};

export function SubscriptionPlansSummary({
  variant,
  currentPlanLabel,
  currentPlanId,
  unlimited,
  collapsed,
  onExpand,
  onCta,
  ctaLabel,
}: SubscriptionPlansSummaryProps) {
  if (variant === 'sidebar' && collapsed) {
    return (
      <button
        type="button"
        title="Subscription plans"
        aria-label="Subscription plans"
        onClick={() => {
          onExpand?.();
          onCta?.();
        }}
        className="w-full inline-flex h-9 items-center justify-center rounded-md border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.04] cursor-pointer"
      >
        <CreditCard className="h-3.5 w-3.5" />
      </button>
    );
  }

  if (variant === 'sidebar') {
    const label = unlimited
      ? 'Developer'
      : planDisplayName(currentPlanId, currentPlanLabel);
    return (
      <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-gray-600">
            Subscription
          </p>
          <span className="text-[10px] font-semibold text-emerald-400/90 truncate">{label}</span>
        </div>
        <p className="mt-1 text-[9px] text-gray-500 leading-tight">
          Basic RM 199 · Pro RM 349
        </p>
        {onCta && (
          <button
            type="button"
            onClick={onCta}
            className="mt-2 w-full min-h-[30px] rounded-md border border-white/[0.08] text-[10px] font-medium tracking-wide text-gray-300 hover:text-white hover:bg-white/[0.04] cursor-pointer"
          >
            {ctaLabel || 'Manage plan'}
          </button>
        )}
      </div>
    );
  }

  if (variant === 'landingInline') {
    return (
      <div id="plans-inline" className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-3 sm:p-4 text-left">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400 mb-2">
          Subscription · MYR
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PRICING_PLANS.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={onCta}
              className={cn(
                'rounded-xl border px-2.5 py-2.5 text-left cursor-pointer transition-colors',
                plan.highlight
                  ? 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20'
                  : 'border-white/10 bg-black/40 hover:bg-white/5'
              )}
            >
              <div className="flex items-center gap-1 mb-0.5">
                {plan.icon === 'gem' ? (
                  <Gem className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Rocket className="h-3 w-3 text-blue-400" />
                )}
                <span className="text-[11px] font-bold text-white">{plan.name}</span>
              </div>
              <p className="text-sm font-extrabold text-white leading-tight">
                {plan.price}
                <span className="text-[10px] font-normal text-gray-500">{plan.period}</span>
              </p>
              <p className="mt-1 text-[10px] text-gray-500 leading-snug line-clamp-2">
                {plan.features[0]}
              </p>
            </button>
          ))}
        </div>
        {onCta && (
          <button
            type="button"
            onClick={onCta}
            className="mt-3 w-full min-h-[40px] rounded-xl bg-emerald-500 text-[12px] font-bold text-black hover:bg-emerald-400 cursor-pointer"
          >
            {ctaLabel || 'Sign in to subscribe'}
          </button>
        )}
      </div>
    );
  }

  // landing (full section)
  return (
    <section id="plans" className="w-full scroll-mt-24" aria-label="Subscription plans">
      <div className="text-center mb-6 sm:mb-8">
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-emerald-400 mb-2">
          Subscription
        </p>
        <h2 className="text-2xl sm:text-3xl font-sans font-extrabold tracking-tight text-white">
          Choose your plan
        </h2>
        <p className="mt-2 text-sm text-gray-400 max-w-lg mx-auto">
          Basic or Pro — clear daily AI limits. Sign in to subscribe with Stripe (MYR).
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 max-w-4xl mx-auto">
        {PRICING_PLANS.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              'rounded-2xl border p-5 sm:p-6 bg-[#0c0c0e]/95 flex flex-col text-left',
              plan.highlight
                ? 'border-emerald-500/40 shadow-[0_0_40px_rgba(16,185,129,0.12)]'
                : 'border-white/10'
            )}
          >
            <div className="mb-3 flex items-center gap-2">
              {plan.icon === 'gem' ? (
                <Gem className="h-4 w-4 text-emerald-400" />
              ) : (
                <Rocket className="h-4 w-4 text-blue-400" />
              )}
              <h3 className="text-lg font-bold text-white">{plan.name}</h3>
              {plan.badge && (
                <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                  {plan.badge}
                </span>
              )}
            </div>
            <div className="mb-2 flex items-baseline gap-1">
              <span className="text-3xl sm:text-4xl font-bold text-white">{plan.price}</span>
              <span className="text-sm text-gray-500">{plan.period}</span>
            </div>
            <p className="mb-4 text-sm text-gray-400">{plan.blurb}</p>
            <ul className="space-y-2 flex-1 mb-5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  {f}
                </li>
              ))}
            </ul>
            {onCta && (
              <button
                type="button"
                onClick={onCta}
                className={cn(
                  'w-full min-h-[44px] rounded-xl py-2.5 text-sm font-bold cursor-pointer',
                  plan.highlight
                    ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                    : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
                )}
              >
                {ctaLabel || 'Sign in to subscribe'}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
