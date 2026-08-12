import React from 'react';
import { Activity, X, ShieldAlert } from 'lucide-react';
import { AuthPanel } from './AuthPanel';
import { LegalLinks } from './LegalDocs';
import { openLegalDoc } from '../lib/legal';
import { useAuth } from '../lib/auth';

/** Public front page — the only signed-out entry. Dashboard never mounts here. */
export function LandingPage() {
  const { accessDenied, clearAccessDenied } = useAuth();

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

      <header className="relative z-10 flex items-center justify-between px-4 sm:px-10 py-4 sm:py-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_18px_rgba(16,185,129,0.45)] shrink-0">
            <Activity className="w-5 h-5 text-black" />
          </div>
          <span className="text-base sm:text-lg font-sans font-extrabold tracking-tight uppercase truncate">
            QUANTUM<span className="text-emerald-500">NODE</span>
          </span>
        </div>
        <a
          href="#signin"
          className="rounded-xl bg-emerald-500 px-4 py-2.5 min-h-[44px] inline-flex items-center text-[11px] font-sans font-bold uppercase tracking-wide text-black hover:bg-emerald-400 cursor-pointer shrink-0"
        >
          Sign in
        </a>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 pb-10 sm:pb-16">
        <div id="signin" className="w-full max-w-md text-center scroll-mt-24">
          <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-emerald-400 mb-3 sm:mb-4">
            AI equity terminal
          </p>
          <h1 className="text-3xl sm:text-5xl font-sans font-extrabold tracking-tight text-white mb-3 sm:mb-4">
            Quantum<span className="text-emerald-500">Node</span>
          </h1>
          <p className="text-sm sm:text-lg text-gray-400 font-sans leading-relaxed mb-4 sm:mb-5 max-w-md mx-auto">
            Sign in with any Google account or email to open your private dashboard.
          </p>
          <p className="mb-6 sm:mb-8 text-[11px] text-gray-500 leading-relaxed max-w-sm mx-auto">
            Analysis tool only — not financial advice.{' '}
            <button
              type="button"
              className="text-emerald-400/90 hover:underline cursor-pointer"
              onClick={() => openLegalDoc('risk')}
            >
              Read risk warning
            </button>
          </p>

          <div className="rounded-2xl border border-white/10 bg-[#0c0c0e]/90 backdrop-blur-md p-4 sm:p-5 text-left shadow-[0_0_40px_rgba(0,0,0,0.35)]">
            <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 mb-1">
              Login to access
            </p>
            <p className="text-sm text-gray-400 mb-4">
              Use a different Google account or your email — each account keeps its own dashboard.
            </p>
            <AuthPanel variant="landing" />
          </div>
        </div>
      </main>

      <footer className="relative z-10 px-4 sm:px-10 py-5 sm:py-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-gray-600 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <span>Quantum Node</span>
        <LegalLinks />
      </footer>

      {accessDenied && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#0c0c0e] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2">
                  <ShieldAlert className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-red-400">Access denied</p>
                  <h2 className="text-lg font-bold tracking-tight text-white">Not authorized</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => clearAccessDenied()}
                className="rounded-lg border border-white/10 p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-gray-400 hover:bg-white/5 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-gray-300">
                This account is not authorized to access Quantum Node. Sign in with a different account.
              </p>
              <button
                type="button"
                onClick={() => clearAccessDenied()}
                className="flex w-full min-h-[48px] items-center justify-center rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white hover:bg-white/10 cursor-pointer"
              >
                Try another account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
