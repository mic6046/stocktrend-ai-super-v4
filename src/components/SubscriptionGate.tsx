import React, { useEffect, useState, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { apiUrl, loggedFetch } from '../lib/api';
import { syncStripeSubscription } from '../lib/subscription';

const LandingPage = lazy(() =>
  import('./LandingPage').then((m) => ({ default: m.LandingPage }))
);
const PricingPage = lazy(() =>
  import('./PricingPage').then((m) => ({ default: m.PricingPage }))
);
const SubscriptionExpiredPage = lazy(() =>
  import('./SubscriptionExpiredPage').then((m) => ({ default: m.SubscriptionExpiredPage }))
);

interface SubscriptionGateProps {
  children: React.ReactNode;
  /** Called when access becomes active (e.g. open dashboard). */
  onActive?: () => void;
  /** Called after a successful overage/pack purchase is confirmed. */
  onOverageSuccess?: () => void;
}

function GateFallback() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center text-gray-400">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
    </div>
  );
}

/**
 * Public front page only when signed out.
 * Dashboard (`children`) mounts only after authorized sign-in with active access.
 */
export function SubscriptionGate({ children, onActive, onOverageSuccess }: SubscriptionGateProps) {
  const { user, loading, accessState, refreshSubscription } = useAuth();
  const [syncAttempted, setSyncAttempted] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutOk = params.get('checkout') === 'success';
    const overageOk = params.get('overage') === 'success';
    if (!checkoutOk && !overageOk) return;
    // Confirm requires a Firebase ID token matching the checkout email
    if (!user?.email) return;

    const sessionId = params.get('session_id');
    (async () => {
      try {
        if (sessionId) {
          const res = await loggedFetch(
            apiUrl(`/api/stripe/confirm?session_id=${encodeURIComponent(sessionId)}`),
            { __qnMeta: { reason: 'stripe-confirm', userAction: 'Checkout return' } }
          );
          const data = await res.json().catch(() => null);
          if (overageOk && data?.usage) {
            window.dispatchEvent(
              new CustomEvent('quantum:usage-refresh', { detail: { usage: data.usage } })
            );
          }
        }
        await syncStripeSubscription(user.email);
      } catch {
        // webhook may still update; refresh either way
      } finally {
        await refreshSubscription();
        if (overageOk) {
          onOverageSuccess?.();
          // Always re-fetch even if confirm body had no usage
          window.dispatchEvent(new CustomEvent('quantum:usage-refresh'));
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent('quantum:usage-refresh'));
          }, 2000);
        }
        const url = new URL(window.location.href);
        url.searchParams.delete('checkout');
        url.searchParams.delete('overage');
        url.searchParams.delete('session_id');
        window.history.replaceState({}, '', url.pathname);
      }
    })();
  }, [refreshSubscription, user?.email, onOverageSuccess]);

  // If we landed on "expired" after a fresh payment, repair from Stripe once.
  useEffect(() => {
    if (syncAttempted || !user?.email) return;
    if (accessState !== 'expired' && accessState !== 'inactive') return;

    let cancelled = false;
    setSyncAttempted(true);
    (async () => {
      const ok = await syncStripeSubscription(user.email!);
      if (!cancelled && ok) {
        await refreshSubscription();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessState, user?.email, syncAttempted, refreshSubscription]);

  useEffect(() => {
    if (accessState === 'active') {
      onActive?.();
    }
  }, [accessState, onActive]);

  if (loading || accessState === 'loading') {
    return <GateFallback />;
  }

  // Front page only — dashboard never mounts here
  if (!user || accessState === 'signed_out') {
    return (
      <Suspense fallback={<GateFallback />}>
        <LandingPage />
      </Suspense>
    );
  }

  if (accessState === 'active') {
    return <>{children}</>;
  }

  if (accessState === 'expired') {
    return (
      <Suspense fallback={<GateFallback />}>
        <SubscriptionExpiredPage />
      </Suspense>
    );
  }

  // inactive / none → pricing (user must accept legal terms before Stripe)
  return (
    <Suspense fallback={<GateFallback />}>
      <PricingPage
        title="Quantum Node pricing"
        subtitle="Choose Basic or Pro to unlock the dashboard."
      />
    </Suspense>
  );
}
