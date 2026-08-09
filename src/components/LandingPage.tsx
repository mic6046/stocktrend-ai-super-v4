import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { AuthModal } from './AuthModal';
import { InstallAppBanner } from './InstallAppBanner';
import { LegalLinks } from './LegalDocs';
import { openLegalDoc } from '../lib/legal';

/** Public front page — shown only before login. Dashboard never mounts here. */
export function LandingPage() {
  const [showAuthModal, setShowAuthModal] = useState(true);

  return (
    <div className="min-h-dvh bg-[#050505] text-[#e0e0e0] relative overflow-hidden flex flex-col">
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

      <header className="relative z-10 flex items-center justify-between safe-px pt-[max(1.25rem,env(safe-area-inset-top))] pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_18px_rgba(16,185,129,0.45)]">
            <Activity className="w-5 h-5 text-black" />
          </div>
          <span className="text-lg font-sans font-extrabold tracking-tight uppercase">
            QUANTUM<span className="text-emerald-500">NODE</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowAuthModal(true)}
          className="touch-manipulation min-h-11 rounded-xl bg-emerald-500 px-4 py-2.5 text-[12px] font-sans font-bold uppercase tracking-wide text-black hover:bg-emerald-400 cursor-pointer"
        >
          Sign in
        </button>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center safe-px pb-16">
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
              className="text-emerald-400/90 hover:underline touch-manipulation min-h-11 px-1"
              onClick={() => openLegalDoc('risk')}
            >
              Read risk warning
            </button>
          </p>
          <button
            type="button"
            onClick={() => setShowAuthModal(true)}
            className="touch-manipulation inline-flex w-full max-w-sm mx-auto items-center justify-center rounded-xl bg-emerald-500 px-5 py-3.5 min-h-12 text-sm font-bold text-black transition hover:bg-emerald-400 cursor-pointer"
          >
            Sign in with Google
          </button>
          <p className="mt-6 text-xs text-gray-600 font-sans">
            Installable on PC, Android, and iPhone — look for Install / Add to Home Screen.
          </p>
        </div>
      </main>

      <footer className="relative z-10 safe-px py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-gray-600">
        <span>Quantum Node</span>
        <LegalLinks />
      </footer>

      <InstallAppBanner />
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
