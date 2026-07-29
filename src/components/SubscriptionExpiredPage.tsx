import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { startStripeCheckout, type SubscriptionPlan } from '../lib/subscription';
import { openLegalDoc } from '../lib/legal';
import { LegalLinks } from './LegalDocs';

export function SubscriptionExpiredPage() {
  const { user, subscription, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const renew = async (plan: SubscriptionPlan) => {
    if (!user?.email) return;
    if (!acceptedLegal) {
      setError('Please confirm the Terms, Privacy Policy, and Risk Warning before renewing.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { url } = await startStripeCheckout(plan, user.email);
      window.location.href = url;
    } catch (err: any) {
      setError(err?.message || 'Unable to start renewal checkout.');
      setBusy(false);
    }
  };

  const preferred: SubscriptionPlan =
    subscription?.subscriptionPlan === 'pro_monthly' ? 'pro_monthly' : 'monthly';

  const preferredLabel =
    preferred === 'pro_monthly' ? 'Pro · RM 349' : 'Basic · RM 199';

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.12),transparent_45%)] pointer-events-none" />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-red-500/30 bg-[#0c0c0e] p-8 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-red-400">Billing</p>
            <h1 className="text-2xl font-bold text-white">Subscription Expired</h1>
          </div>
        </div>

        <p className="text-sm text-gray-300 mb-2">
          Your subscription has ended. Renew Basic or Pro to restore dashboard access.
        </p>
        {user?.email && (
          <p className="mb-4 text-xs font-mono text-gray-500">{user.email}</p>
        )}

        <label className="mb-4 flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedLegal}
            onChange={(e) => setAcceptedLegal(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black accent-emerald-500 cursor-pointer"
          />
          <span className="text-[11px] text-gray-400 leading-relaxed">
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
              Terms
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
              Privacy
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
            .
          </span>
        </label>

        {error && (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        <div className="space-y-3">
          <button
            type="button"
            disabled={busy || !acceptedLegal}
            onClick={() => renew(preferred)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Renew {preferredLabel}
          </button>
          {preferred !== 'pro_monthly' && (
            <button
              type="button"
              disabled={busy || !acceptedLegal}
              onClick={() => renew('pro_monthly')}
              className="flex w-full items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-sm font-bold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60"
            >
              Upgrade to Pro · RM 349 / mo
            </button>
          )}
          {preferred !== 'monthly' && (
            <button
              type="button"
              disabled={busy || !acceptedLegal}
              onClick={() => renew('monthly')}
              className="flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-60"
            >
              Basic · RM 199 / mo
            </button>
          )}
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full py-2 text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-gray-300"
          >
            Sign out
          </button>
          <LegalLinks className="justify-center pt-1" />
        </div>
      </div>
    </div>
  );
}
