import React, { useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { useAuth, mapAuthError, SignInNotAllowedError } from '../lib/auth';
import { cn } from '../lib/utils';
import type { AccessState } from '../lib/subscription';

type AuthMode = 'signin' | 'signup' | 'reset';

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

export type AuthPanelProps = {
  onSuccess?: (accessState: AccessState) => void;
  /** Compact for modal; roomier for landing page */
  variant?: 'landing' | 'modal';
  className?: string;
};

export function AuthPanel({ onSuccess, variant = 'landing', className }: AuthPanelProps) {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    clearAccessDenied,
  } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);

  const finish = (accessState: AccessState) => {
    onSuccess?.(accessState);
  };

  const handleGoogle = async () => {
    setError(null);
    setInfo(null);
    clearAccessDenied();
    setBusy('google');
    try {
      const accessState = await signInWithGoogle();
      finish(accessState);
    } catch (err) {
      if (err instanceof SignInNotAllowedError) {
        setError(null);
      } else {
        setError(mapAuthError(err, 'Google sign-in failed.'));
      }
    } finally {
      setBusy(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    clearAccessDenied();

    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email.');
      return;
    }

    if (mode === 'reset') {
      setBusy('email');
      try {
        await resetPassword(trimmed);
        setInfo('Password reset email sent. Check your inbox.');
        setMode('signin');
      } catch (err) {
        setError(mapAuthError(err, 'Could not send reset email.'));
      } finally {
        setBusy(null);
      }
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setBusy('email');
    try {
      const accessState =
        mode === 'signup'
          ? await signUpWithEmail(trimmed, password)
          : await signInWithEmail(trimmed, password);
      finish(accessState);
    } catch (err) {
      if (err instanceof SignInNotAllowedError) {
        setError(null);
      } else {
        setError(mapAuthError(err, mode === 'signup' ? 'Could not create account.' : 'Sign-in failed.'));
      }
    } finally {
      setBusy(null);
    }
  };

  const isLanding = variant === 'landing';

  return (
    <div className={cn('w-full space-y-4', className)}>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void handleGoogle()}
        className={cn(
          'flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white text-gray-900 font-bold transition hover:bg-gray-100 disabled:opacity-60 cursor-pointer',
          isLanding ? 'min-h-[52px] px-5 text-sm' : 'py-2.5 text-sm'
        )}
      >
        {busy === 'google' ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <GoogleIcon className="h-5 w-5" />
        )}
        Continue with Google
      </button>
      <p className="text-[11px] text-gray-500 text-center leading-relaxed">
        Google shows an account picker — choose any Google account, or switch accounts anytime.
      </p>

      <div className="relative flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">or email</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={handleEmailSubmit} className="space-y-3" autoComplete="on">
        <label className="block text-left">
          <span className="sr-only">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full min-h-[48px] rounded-xl border border-white/10 bg-[#111113] px-4 text-base text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50"
          />
        </label>

        {mode !== 'reset' && (
          <label className="block text-left">
            <span className="sr-only">Password</span>
            <input
              type="password"
              name="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full min-h-[48px] rounded-xl border border-white/10 bg-[#111113] px-4 text-base text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50"
            />
          </label>
        )}

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 text-left">
            {error}
          </p>
        )}
        {info && (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 text-left">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={busy !== null}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-black font-bold transition hover:bg-emerald-400 disabled:opacity-60 cursor-pointer',
            isLanding ? 'min-h-[52px] px-5 text-sm' : 'py-2.5 text-sm'
          )}
        >
          {busy === 'email' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          {mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in with email'}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
        {mode === 'signin' && (
          <>
            <button
              type="button"
              className="text-emerald-400/90 hover:underline cursor-pointer"
              onClick={() => {
                setMode('signup');
                setError(null);
                setInfo(null);
              }}
            >
              Create an account
            </button>
            <span className="text-white/20">·</span>
            <button
              type="button"
              className="text-gray-400 hover:text-white hover:underline cursor-pointer"
              onClick={() => {
                setMode('reset');
                setError(null);
                setInfo(null);
              }}
            >
              Forgot password?
            </button>
          </>
        )}
        {mode === 'signup' && (
          <button
            type="button"
            className="text-emerald-400/90 hover:underline cursor-pointer"
            onClick={() => {
              setMode('signin');
              setError(null);
              setInfo(null);
            }}
          >
            Already have an account? Sign in
          </button>
        )}
        {mode === 'reset' && (
          <button
            type="button"
            className="text-emerald-400/90 hover:underline cursor-pointer"
            onClick={() => {
              setMode('signin');
              setError(null);
              setInfo(null);
            }}
          >
            Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}
