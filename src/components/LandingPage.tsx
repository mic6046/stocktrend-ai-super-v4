import React, { useState } from 'react';
import { Activity, Check, Gem, Rocket } from 'lucide-react';
import { AuthModal } from './AuthModal';
import { LegalLinks } from './LegalDocs';
import { openLegalDoc } from '../lib/legal';
import { PUBLIC_OVERAGES, PUBLIC_PLANS } from '../lib/pricingPlans';
import { cn } from '../lib/utils';

/** Public front page — shown only before login. Dashboard never mounts here. */
export function LandingPage() {
  const [showAuthModal, setShowAuthModal] = useState(true);

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
          <button
            type="button"
            onClick={() => setShowAuthModal(true)}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-[11px] font-sans font-bold uppercase tracking-wide text-black hover:bg-emerald-400 cursor-pointer"
          >
            Sign in
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-6 pb-16">
        {/* Hero — one composition */}
        <section className="min-h-[70vh] flex items-center justify-center">
          <div className="w-full max-w-lg text-center">
            <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-emerald-400 mb-4">
              AI equity terminal
            </p>
            <h1 className="text-4xl sm:text-5xl font-sans font-extrabold tracking-tight text-white mb-4">
              Quantum<span className="text-emerald-500">Node</span>
            </h1>
            <p className="text-base sm:text-lg text-gray-400 font-sans leading-relaxed mb-6 max-w-md mx-auto">
              Sign in to open your private dashboard. Charts, news, and AI analysis stay behind the gate.
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
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="inline-flex w-full max-w-sm mx-auto items-center justify-center rounded-xl bg-emerald-500 px-5 py-3.5 text-sm font-bold text-black transition hover:bg-emerald-400 cursor-pointer"
            >
              Sign in with Google
            </button>
            <p className="mt-4 text-xs text-gray-600 font-sans">
              After sign-in, choose Basic or Pro to unlock the dashboard.
            </p>
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
              Clear daily AI limits. Sign in first, then subscribe on the next step.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {PUBLIC_PLANS.map((plan) => (
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
                  onClick={() => setShowAuthModal(true)}
                  className={cn(
                    'flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-bold transition cursor-pointer',
                    plan.highlight
                      ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                      : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
                  )}
                >
                  Sign in to get {plan.name}
                </button>
              </div>
            ))}
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

      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
