import React from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { AuthPanel } from './AuthPanel';
import type { AccessState } from '../lib/subscription';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (accessState: AccessState) => void;
}

/** Modal wrapper around AuthPanel — used from in-app Sign in when needed. */
export function AuthModal({ open, onClose, onSuccess }: AuthModalProps) {
  const { accessDenied, clearAccessDenied } = useAuth();

  if (!open && !accessDenied) return null;

  const handleClose = () => {
    clearAccessDenied();
    onClose();
  };

  if (accessDenied) {
    return (
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
              onClick={handleClose}
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
              onClick={handleClose}
              className="flex w-full min-h-[48px] items-center justify-center rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white hover:bg-white/10 cursor-pointer"
            >
              Try another account
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c0e] shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4 sticky top-0 bg-[#0c0c0e]">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">Quantum Node</p>
            <h2 className="text-lg font-bold tracking-tight text-white">Login to access</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-white/10 p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-gray-400 hover:bg-white/5 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-gray-400 mb-4">
            Sign in with Google (any account) or email/password.
          </p>
          <AuthPanel
            variant="modal"
            onSuccess={(accessState) => {
              onSuccess?.(accessState);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
