import React, { useEffect, useState } from 'react';
import { Activity, Check, Gem, Loader2, Rocket } from 'lucide-react';
import { AuthModal } from './AuthModal';
import { LegalLinks } from './LegalDocs';
import { openLegalDoc } from '../lib/legal';
import { SignInNotAllowedError, useAuth } from '../lib/auth';
import { PUBLIC_OVERAGES, PUBLIC_PLANS } from '../lib/pricingPlans';
import { startStripeCheckout, type SubscriptionPlan } from '../lib/subscription';
import { cn } from '../lib/utils';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12z"
      />
      <path
        fill="#34A853"
        d="M6.6 14.3l-.5.4-2.7 2.1C5.1 19.5 8.3 21.6 12 21.6c2.4 0 4.4-.8 5.9-2.1l-3.1-2.4c-.8.6-1.9.9-2.8.9-2.2 0-4-1.5-4.7-3.5z"
      />
      <path
        fill="#4A90E2"
        d="M3.4 7.2C2.8 8.4 2.4 9.7 2.4 12s.4 3.6 1 4.8l3.2-2.5c-.2-.6-.3-1.2-.3-2.3s.1-1.7.3-2.3L3.4 7.2z"
      />
      <path
        fill="#FBBC05"
        d="M12 5.4c1.3 0 2.5.5 3.4 1.3l2.6-2.6C16.4 2.6 14.4 1.8 12 1.8 8.3 1.8 5.1 3.9 3.4 7.2l3.2 2.5C7.9 6.9 9.8 5.4 12 5.4z"
      />
    </svg>
  );
}

type LandingPageProps = {
  /** When true, user is signed in and must pick Basic/Pro on this same page. */
  subscribeMode?: boolean;
};

/** Single public page — hero + subscription plans. Dashboard never mounts here. */
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
        onClick: handleGoogleSignIn,
        spinning: false,
      };
    }
    return {
      label: busyPlan === planId ? 'Redirecting…' : `Subscribe · ${planName}`,
      disabled: busyPlan !== null || !acceptedLegal,
      onClick: () => handleCheckout(planId),
      spinning: busyPlan === planId,
    };
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] relative overflow-hidden flex flex-col">
      <div className="fixed top-[-120px] left-[-80px] w-[480px] h-[480px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-140px] right-[-100px] w-[520px] h-[520px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_18px_rgba(16,185,129,0.45)]">
            <Activity className="w-5 h-5 text-black" />
          </div>
          <span className="text-lg font-sans font-extrabold tracking-tight uppercase">
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
              onClick={handleGoogleSignIn}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-[11px] font-sans font-bold uppercase tracking-wide text-black hover:bg-emerald-400 cursor-pointer disabled:opacity-60"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      <main className="relative z-10 flex-1 px-6 pb-16">
        <section className={cn('flex items-center justify-center', awaitingPlan ? 'min-h-[42vh]' : 'min-h-[70vh]')}>
          <div className="w-full max-w-lg text-center">
            <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-emerald-400 mb-4">
              AI equity terminal
            </p>
            <h1 className="text-4xl sm:text-5xl font-sans font-extrabold tracking-tight text-white mb-4">
              Quantum<span className="text-emerald-500">Node</span>
            </h1>
            <p className="text-base sm:text-lg text-gray-400 font-sans leading-relaxed mb-6 max-w-md mx-auto">
              {awaitingPlan
                ? 'Choose Basic or Pro below to unlock your private dashboard.'
                : 'Sign in to open your private dashboard. Charts, news, and AI analysis stay behind the gate.'}
            </p>
            <p className="mb-8 text-[11px] text-gray-500 leading-relaxed max-w-sm mx-auto">
              Analysis tool only — not financial advice.{' '}
              <button
                type="button"
                className="text-emerald-400/90 hover:underline"
                onClick={() => openLegalDoc('risk')}
              >
                Read risk warning
              </button>
            </p>

            {error && (
              <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 max-w-sm mx-auto">
                {error}
              </p>
            )}

            {!awaitingPlan && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleGoogleSignIn}
                  className="inline-flex w-full max-w-sm mx-auto items-center justify-center gap-3 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-gray-900 transition hover:bg-gray-100 cursor-pointer disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon className="h-5 w-5" />}
                  Continue with Google
                </button>
                <p className="mt-4 text-xs text-gray-600 font-sans">
                  After sign-in, pick a plan on this same page.
                </p>
              </>
            )}

            {awaitingPlan && user?.email && (
              <p className="text-xs font-mono text-gray-500">Signed in as {user.email}</p>
            )}
          </div>
        </section>

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
                : 'Clear daily AI limits. Sign in first, then subscribe here — one page only.'}
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
                . I understand Quantum Node is not a licensed financial adviser and that markets involve risk of
                loss.
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
            Billing via Stripe · Cancel anytime before renewal · Quotas reset at midnight MYT
          </p>
        </section>
      </main>

      <footer className="relative z-10 px-6 sm:px-10 py-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-gray-600">
        <span>Quantum Node</span>
        <LegalLinks />
      </footer>

      <AuthModal open={false} onClose={() => undefined} />
    </div>
  );
}
