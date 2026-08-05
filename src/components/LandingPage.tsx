import React, { useState } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { AuthModal } from './AuthModal';
import { LegalLinks } from './LegalDocs';
import { openLegalDoc } from '../lib/legal';
import { SignInNotAllowedError, useAuth } from '../lib/auth';
import { cn } from '../lib/utils';

/**
 * Public sign-in landing — shown only before login.
 * Dashboard never mounts here. Google sign-in is inline (no auto-open modal).
 */
export function LandingPage() {
  const { signInWithGoogle, clearAccessDenied } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    clearAccessDenied();
    setBusy(true);
    try {
      await signInWithGoogle();
      // SubscriptionGate switches away once auth state resolves
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

  return (
    <div className="min-h-screen bg-black text-[#e0e0e0] relative overflow-hidden flex flex-col">
      {/* Soft emerald glow — top-left, matches brand hero */}
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
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleGoogleSignIn()}
          className="rounded-xl bg-emerald-500 px-4 py-2 text-[11px] font-sans font-bold uppercase tracking-wide text-black hover:bg-emerald-400 cursor-pointer disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-lg text-center">
          <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-emerald-400 mb-4">
            AI equity terminal
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-sans font-extrabold tracking-tight text-white mb-5">
            Quantum<span className="text-emerald-500">Node</span>
          </h1>
          <p className="text-base sm:text-lg text-white/85 font-sans leading-relaxed mb-5 max-w-md mx-auto">
            Sign in to open your private dashboard. Charts, news, and AI analysis stay behind the gate.
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

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleGoogleSignIn()}
            className={cn(
              'inline-flex w-full max-w-sm mx-auto items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3.5 text-sm font-bold text-black transition hover:bg-emerald-400 cursor-pointer disabled:opacity-60 shadow-[0_0_28px_rgba(16,185,129,0.28)]'
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? 'Signing in…' : 'Sign in with Google'}
          </button>
          <p className="mt-6 text-xs text-gray-600 font-sans">Login to access</p>
        </div>
      </main>

      <footer className="relative z-10 px-6 sm:px-10 py-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-gray-600">
        <span>Quantum Node</span>
        <LegalLinks />
      </footer>

      {/* Access-denied overlay only — sign-in itself is inline on this page */}
      <AuthModal open={false} onClose={() => clearAccessDenied()} />
    </div>
  );
}
