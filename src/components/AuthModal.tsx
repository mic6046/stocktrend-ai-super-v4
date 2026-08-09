import React, { useEffect, useState } from 'react';
import { Loader2, X, ShieldAlert } from 'lucide-react';
import { useAuth, SignInNotAllowedError } from '../lib/auth';
import { cn } from '../lib/utils';
import type { AccessState } from '../lib/subscription';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (accessState: AccessState) => void;
}

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

export function AuthModal({ open, onClose, onSuccess }: AuthModalProps) {
  const { signInWithGoogle, accessDenied, clearAccessDenied } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = open || !!accessDenied;

  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  if (!open && !accessDenied) return null;

  const handleClose = () => {
    setError(null);
    clearAccessDenied();
    onClose();
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    clearAccessDenied();
    setBusy(true);
    try {
      const accessState = await signInWithGoogle();
      onSuccess?.(accessState);
      onClose();
    } catch (err: any) {
      const code = err?.code || '';
      if (err instanceof SignInNotAllowedError || code === 'auth/signin-not-allowed') {
        // accessDenied UI is shown via auth context
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

  if (accessDenied) {
    return (
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 pb-[env(safe-area-inset-bottom)]">
        <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-red-500/30 bg-[#0c0c0e] shadow-2xl">
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
              onClick={handleClose}
              className="touch-target touch-manipulation rounded-xl border border-white/10 p-2 text-gray-400 hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-4 p-5">
            <p className="text-sm text-gray-300">
              This account is not authorized to access Quantum Node.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="touch-manipulation flex w-full min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-white hover:bg-white/10"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 pb-[env(safe-area-inset-bottom)]">
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0c0c0e] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">Quantum Node</p>
            <h2 className="text-lg font-bold tracking-tight text-white">Login to access</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="touch-target touch-manipulation rounded-xl border border-white/10 p-2 text-gray-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm text-gray-400">
            Sign in with Google to access your private dashboard.
          </p>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={handleGoogleSignIn}
            className={cn(
              'touch-manipulation flex w-full min-h-11 items-center justify-center gap-3 rounded-xl border border-white/10 bg-white py-3 text-sm font-bold text-gray-900 transition hover:bg-gray-100 disabled:opacity-60'
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon className="h-5 w-5" />}
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
