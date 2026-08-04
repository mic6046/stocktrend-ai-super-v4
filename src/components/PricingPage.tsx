import React, { useState } from 'react';
import { Check, Loader2, Sparkles, Rocket, Zap, Newspaper, Info, Gem } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { startStripeCheckout, type SubscriptionPlan } from '../lib/subscription';
import { cn } from '../lib/utils';
import { LegalLinks } from './LegalDocs';
import { openLegalDoc } from '../lib/legal';
import { PUBLIC_OVERAGES as OVERAGES, PUBLIC_PLANS as PLANS, QUOTA_COMPARE } from '../lib/pricingPlans';

interface PricingPageProps {
  title?: string;
  subtitle?: string;
}

export function PricingPage({
  title = 'Quantum Node pricing',
  subtitle = 'Basic or Pro — clear daily AI limits, fair overages when you need more.',
}: PricingPageProps) {
  const { user, signOut } = useAuth();
  const [busyPlan, setBusyPlan] = useState<SubscriptionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const handleCheckout = async (plan: SubscriptionPlan) => {
    if (!user?.email) {
      setError('Please sign in with Google first.');
      return;
    }
    if (!acceptedLegal) {
      setError('Please confirm the Terms, Privacy Policy, and Risk Warning before checkout.');
      return;
    }
    setError(null);
    setBusyPlan(plan);
    try {
      const { url } = await startStripeCheckout(plan, user.email);
      window.location.href = url;
    } catch (err: any) {
      setError(err?.message || 'Unable to start checkout.');
      setBusyPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] relative overflow-hidden">
      <div className="fixed top-[-120px] left-[-80px] w-[480px] h-[480px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-140px] right-[-100px] w-[520px] h-[520px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-emerald-400 mb-3 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" /> Pricing · MYR
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">{title}</h1>
            <p className="mt-2 max-w-xl text-sm text-gray-400">{subtitle}</p>
            {user?.email && (
              <p className="mt-3 text-xs font-mono text-gray-500">Signed in as {user.email}</p>
            )}
          </div>
          {user && (
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-gray-300 hover:bg-white/5"
            >
              Sign out
            </button>
          )}
        </div>

        {error && (
          <p className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <label className="mb-6 flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 cursor-pointer max-w-4xl mx-auto">
          <input
            type="checkbox"
            checked={acceptedLegal}
            onChange={(e) => setAcceptedLegal(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-white/20 bg-black accent-emerald-500 cursor-pointer"
          />
          <span className="text-xs text-gray-400 leading-relaxed">
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
              Terms of Use
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
              Privacy Policy
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
            . I understand Quantum Node is not a licensed financial adviser and that markets involve risk of loss.
          </span>
        </label>

        {/* Subscription cards */}
        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'rounded-2xl border p-6 bg-[#0c0c0e] flex flex-col',
                plan.highlight
                  ? 'border-emerald-500/40 shadow-[0_0_40px_rgba(16,185,129,0.12)]'
                  : 'border-white/10'
              )}
            >
              <div className="mb-4 flex items-center gap-2">
                {plan.icon === 'gem' ? (
                  <Gem className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Rocket className="h-4 w-4 text-blue-400" />
                )}
                <h2 className="text-lg font-bold text-white">{plan.name}</h2>
                {plan.badge && (
                  <span
                    className={cn(
                      'ml-auto rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider',
                      plan.highlight
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-amber-500/15 text-amber-400'
                    )}
                  >
                    {plan.badge}
                  </span>
                )}
              </div>
              <div className="mb-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                <span className="text-sm text-gray-500">{plan.period}</span>
              </div>
              <p className="mb-5 text-sm text-gray-400">{plan.blurb}</p>
              <ul className="mb-6 space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={busyPlan !== null || !acceptedLegal}
                onClick={() => handleCheckout(plan.id)}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition disabled:opacity-60',
                  plan.highlight
                    ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                    : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
                )}
              >
                {busyPlan === plan.id && <Loader2 className="h-4 w-4 animate-spin" />}
                {busyPlan === plan.id ? 'Redirecting…' : `Subscribe · ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        {/* Quota comparison */}
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {QUOTA_COMPARE.map((row) => (
            <div
              key={row.plan}
              className="rounded-2xl border border-white/10 bg-[#0c0c0e] p-5"
            >
              <h3 className="text-sm font-bold text-white mb-3">{row.plan} daily included</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/5 bg-black/40 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                    <Zap className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-mono uppercase tracking-wider">Analyses</span>
                  </div>
                  <div className="text-lg font-bold text-white">{row.analyses}</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/40 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-cyan-400 mb-1">
                    <Newspaper className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-mono uppercase tracking-wider">News</span>
                  </div>
                  <div className="text-lg font-bold text-white">{row.news}</div>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
                Cached re-open of the same ticker does not use another analysis credit. Quotas reset at midnight MYT.
              </p>
            </div>
          ))}
        </div>

        {/* Overage / packs */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-[#0c0c0e] p-6">
          <h3 className="text-sm font-bold text-white mb-1">Need more before reset?</h3>
          <p className="text-xs text-gray-500 mb-4">
            Same overage rates for Basic and Pro. Daily quotas reset at{' '}
            <span className="text-gray-300">midnight (Malaysia Time, MYT)</span>.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {OVERAGES.map((row) => (
              <div
                key={row.label}
                className="rounded-xl border border-white/5 bg-black/40 px-4 py-3"
              >
                <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
                  {row.label}
                </div>
                <div className="mt-1 text-xl font-bold text-emerald-400">{row.price}</div>
                <div className="mt-0.5 text-[11px] text-gray-500">{row.note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Fine print */}
        <div className="mt-6 flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-[11px] leading-relaxed text-gray-400">
          <Info className="h-4 w-4 shrink-0 text-amber-400/80 mt-0.5" />
          <div className="space-y-2">
            <p>
              <span className="text-amber-200 font-semibold">Risk warning:</span> Quantum Node provides
              AI-assisted analysis only. It is not a broker or financial adviser. You may lose money.
              Decisions are yours alone.
            </p>
            <p className="text-gray-500">
              Billing via Stripe · Basic RM 199/mo · Pro RM 349/mo · Cancel anytime before renewal.
            </p>
            <LegalLinks />
          </div>
        </div>
      </div>
    </div>
  );
}
