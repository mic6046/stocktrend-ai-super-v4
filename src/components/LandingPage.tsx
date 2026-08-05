import React, { useEffect, useState } from 'react';
import { Activity, Check, Gem, Loader2, Rocket } from 'lucide-react';
import { AuthModal } from './AuthModal';
import { LegalLinks } from './LegalDocs';
import { openLegalDoc } from '../lib/legal';
import { SignInNotAllowedError, useAuth } from '../lib/auth';
import { PUBLIC_OVERAGES, PUBLIC_PLANS } from '../lib/pricingPlans';
import { startStripeCheckout, type SubscriptionPlan } from '../lib/subscription';
import { cn } from '../lib/utils';

type LandingPageProps = {
  /** When true, user is signed in and must pick Basic/Pro on this same page. */
  subscribeMode?: boolean;
};

/**
 * Single public page — sign-in hero + subscription plans.
 * Dashboard never mounts here.
 */
export function LandingPage({ subscribeMode = false }: LandingPageProps) {
  const { user, signInWithGoogle, signOut, clearAccessDenied } = useAuth();
  const awaitingPlan = subscribeMode || !!user;
  const [busy, setBusy] = useState(false);
  const [busyPlan, setBusyPlan] = useState<SubscriptionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  useEffect(() => {
    if (!awaitingPlan) return;
    const el = document.getElementById('plans');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [awaitingPlan]);

  const handleGoogleSignIn = async () => {
    setError(null);
    clearAccessDenied();
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      const code = err?.code || '';
      if (err instanceof SignInNotAllowedError || code === 'auth/signin-not-allowed') {
        setError(null);
      } else if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) {
        setError('Sign-in was cancelled.');
      } else if (code.includes('popup-blocked')) {
        setError('Pop-up was blocked. Allow pop-ups for this site and try again.');
      } else if (code.includes('operation-not-allowed')) {
        setError('Google Sign-In is not enabled in Firebase Console yet.');
      } else if (code.includes('unauthorized-domain')) {
        setError('This domain is not authorized for Google Sign-In in Firebase.');
      } else {
        setError(err?.message || 'Google Sign-In failed.');
      }
    } finally {
      setBusy(false);
    }
  };

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

  const planCta = (planId: SubscriptionPlan, planName: string) => {
    if (!awaitingPlan) {
      return {
        label: `Sign in to get ${planName}`,
        disabled: busy,
        onClick: () => void handleGoogleSignIn(),
        spinning: false,
      };
    }
    return {
      label: busyPlan === planId ? 'Redirecting…' : `Subscribe · ${planName}`,
      disabled: busyPlan !== null || !acceptedLegal,
      onClick: () => void handleCheckout(planId),
      spinning: busyPlan === planId,
    };
  };

  return (
    <div className="min-h-screen bg-black text-[#e0e0e0] relative overflow-hidden flex flex-col">
      <div className="fixed top-[-140px] left-[-100px] w-[520px] h-[520px] bg-emerald-500/[0.12] rounded-full blur-[130px] pointer-events-none" />
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.85) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.85) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_18px_rgba(16,185,129,0.45)]">
            <Activity className="w-5 h-5 text-black" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-sans font-extrabold tracking-tight uppercase text-white">
            QUANTUM<span className="text-emerald-500">NODE</span>
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="#plans"
            className="hidden sm:inline-flex rounded-xl border border-white/10 px-3 py-2 text-[11px] font-sans font-bold uppercase tracking-wide text-gray-300 hover:bg-white/5 cursor-pointer"
          >
            Plans
          </a>
          {awaitingPlan && user ? (
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-xl border border-white/10 px-4 py-2 text-[11px] font-sans font-bold uppercase tracking-wide text-gray-300 hover:bg-white/5 cursor-pointer"
            >
              Sign out
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleGoogleSignIn()}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-[11px] font-sans font-bold uppercase tracking-wide text-black hover:bg-emerald-400 cursor-pointer disabled:opacity-60"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          )}
        </div>
      </header>

      <main className="relative z-10 flex-1 px-6 pb-16">
        {/* Hero — brand + sign-in only (plans live in the next section) */}
        <section
          className={cn(
            'flex items-center justify-center',
            awaitingPlan ? 'min-h-[42vh]' : 'min-h-[78vh]'
          )}
        >
          <div className="w-full max-w-lg text-center">
            <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-emerald-400 mb-4">
              AI equity terminal
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-sans font-extrabold tracking-tight text-white mb-5">
              Quantum<span className="text-emerald-500">Node</span>
            </h1>
            <p className="text-base sm:text-lg text-white/85 font-sans leading-relaxed mb-5 max-w-md mx-auto">
              {awaitingPlan
                ? 'Choose Basic or Pro below to unlock your private dashboard.'
                : 'Sign in to open your private dashboard. Charts, news, and AI analysis stay behind the gate.'}
            </p>
            <p className="mb-8 text-[11px] text-gray-500 leading-relaxed max-w-sm mx-auto">
              Analysis tool only — not financial advice.{' '}
              <button
                type="button"
                className="text-emerald-400 hover:underline cursor-pointer"
                onClick={() => openLegalDoc('risk')}
              >
                Read risk warning
              </button>
            </p>

            {error && (
              <p className="mb-4 mx-auto max-w-sm rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </p>
            )}

            {!awaitingPlan && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleGoogleSignIn()}
                  className="inline-flex w-full max-w-sm mx-auto items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3.5 text-sm font-bold text-black transition hover:bg-emerald-400 cursor-pointer disabled:opacity-60 shadow-[0_0_28px_rgba(16,185,129,0.28)]"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {busy ? 'Signing in…' : 'Sign in with Google'}
                </button>
                <p className="mt-6 text-xs text-gray-600 font-sans">
                  Login to access · then pick a plan below
                </p>
              </>
            )}

            {awaitingPlan && user?.email && (
              <p className="text-xs font-mono text-gray-500">Signed in as {user.email}</p>
            )}
          </div>
        </section>

        {/* Subscription plans */}
        <section id="plans" className="mx-auto max-w-4xl pt-4 pb-8 scroll-mt-20">
          <div className="text-center mb-8">
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-emerald-400 mb-2">
              Pricing · MYR
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Subscription plans
            </h2>
            <p className="mt-2 text-sm text-gray-400 max-w-lg mx-auto">
              {awaitingPlan
                ? 'Accept the legal terms, then subscribe with Stripe.'
                : 'Basic RM 199 · Pro RM 349. Sign in first, then subscribe on this page.'}
            </p>
          </div>

          {awaitingPlan && (
            <label className="mb-6 flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 cursor-pointer max-w-4xl mx-auto">
              <input
                type="checkbox"
                checked={acceptedLegal}
                onChange={(e) => setAcceptedLegal(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-black accent-emerald-500 cursor-pointer"
              />
              <span className="text-xs text-gray-400 leading-relaxed text-left">
                I agree to the{' '}
                <button
                  type="button"
                  className="text-emerald-400 hover:underline cursor-pointer"
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
                  className="text-emerald-400 hover:underline cursor-pointer"
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
                  className="text-emerald-400 hover:underline cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openLegalDoc('risk');
                  }}
                >
                  Risk Warning
                </button>
                . I understand Quantum Node is not a licensed financial adviser and that markets involve
                risk of loss.
              </span>
            </label>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            {PUBLIC_PLANS.map((plan) => {
              const cta = planCta(plan.id, plan.name);
              return (
                <div
                  key={plan.id}
                  className={cn(
                    'rounded-2xl border bg-[#0c0c0e]/90 backdrop-blur-sm p-6 flex flex-col text-left',
                    plan.highlight
                      ? 'border-emerald-500/40 shadow-[0_0_36px_rgba(16,185,129,0.12)]'
                      : 'border-white/10'
                  )}
                >
                  <div className="mb-4 flex items-center gap-2">
                    {plan.icon === 'gem' ? (
                      <Gem className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Rocket className="h-4 w-4 text-sky-400" />
                    )}
                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                    {plan.badge && (
                      <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-emerald-400">
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
                    disabled={cta.disabled}
                    onClick={cta.onClick}
                    className={cn(
                      'flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition cursor-pointer disabled:opacity-60',
                      plan.highlight
                        ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                        : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
                    )}
                  >
                    {cta.spinning && <Loader2 className="h-4 w-4 animate-spin" />}
                    {cta.label}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-[#0c0c0e]/80 px-5 py-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-3">
              Need more before daily reset?
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {PUBLIC_OVERAGES.map((row) => (
                <div key={row.label} className="min-w-0">
                  <p className="text-[11px] text-gray-400">{row.label}</p>
                  <p className="text-lg font-bold text-emerald-400">{row.price}</p>
                  <p className="text-[10px] text-gray-600">{row.note}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] text-gray-600">
            Billing via Stripe · Cancel anytime before renewal · Daily quotas reset at midnight MYT ·
            Credits do not roll over to the next month
          </p>
        </section>
      </main>

      <footer className="relative z-10 px-6 sm:px-10 py-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-gray-600">
        <span>Quantum Node</span>
        <LegalLinks />
      </footer>

      <AuthModal open={false} onClose={() => clearAccessDenied()} />
    </div>
  );
}
