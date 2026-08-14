import React from 'react';
import { Check, Gem, Rocket, CreditCard } from 'lucide-react';
import { cn } from '../lib/utils';
import { PRICING_PLANS, planDisplayName } from '../lib/pricingPlans';

type SubscriptionPlansSummaryProps = {
  variant: 'landing' | 'sidebar';
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
        className="w-full inline-flex h-10 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 cursor-pointer"
      >
        <CreditCard className="h-4 w-4" />
      </button>
    );
  }

  if (variant === 'sidebar') {
    const label = unlimited
      ? 'Developer'
      : planDisplayName(currentPlanId, currentPlanLabel);
    return (
      <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden">
        <div className="px-2.5 py-1.5 border-b border-white/5 flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 truncate">
            Subscription
          </p>
        </div>
        <div className="px-2.5 py-2 space-y-2">
          <p className="text-[11px] text-gray-300">
            Plan:{' '}
            <span className="font-bold text-emerald-300">{label}</span>
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {PRICING_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={cn(
                  'rounded-lg border px-1.5 py-1.5 text-center',
                  plan.highlight ? 'border-emerald-500/35 bg-emerald-500/10' : 'border-white/10 bg-black/30'
                )}
              >
                <p className="text-[9px] font-mono uppercase tracking-wider text-gray-500">
                  {plan.name}
                </p>
                <p className="text-[11px] font-bold text-white leading-tight">{plan.price}</p>
                <p className="text-[8px] text-gray-500">{plan.period}</p>
              </div>
            ))}
          </div>
          {onCta && (
            <button
              type="button"
              onClick={onCta}
              className="w-full min-h-[32px] rounded-lg border border-amber-500/35 bg-amber-500/10 text-[10px] font-bold uppercase tracking-wider text-amber-200 hover:bg-amber-500/20 cursor-pointer"
            >
              {ctaLabel || 'View plans'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // landing
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
