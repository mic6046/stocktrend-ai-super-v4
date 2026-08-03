import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { apiUrl, loggedFetch } from './api';
import { db } from './firebase';

export type SubscriptionStatus = 'active' | 'inactive' | 'expired' | 'none';
export type SubscriptionPlan = 'monthly' | 'yearly' | 'pro_monthly';
export type AccessState = 'none' | 'inactive' | 'expired' | 'active';

/** Developer accounts — full unrestricted access (no quota caps). */
export const DEVELOPER_EMAILS = ['mic6046@gmail.com'] as const;

export function isDeveloperEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return DEVELOPER_EMAILS.some((e) => e === normalized);
}

/** @deprecated Any Google account may sign in; kept for compatibility. */
export function isAllowedSignInEmail(email: string | null | undefined): boolean {
  return Boolean(email && String(email).includes('@'));
}

export interface UserSubscriptionProfile {
  id: string;
  email: string;
  uid?: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPlan?: SubscriptionPlan | null;
  subscriptionEndsAt?: Timestamp | Date | string | number | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toDate(value: UserSubscriptionProfile['subscriptionEndsAt']): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate();
  }
  return null;
}

export function resolveSubscriptionAccess(
  profile: UserSubscriptionProfile | null,
  email?: string | null
): AccessState {
  if (isDeveloperEmail(email || profile?.email)) {
    return 'active';
  }

  if (!profile) return 'none';

  const status = (profile.subscriptionStatus || 'none').toLowerCase() as SubscriptionStatus;
  const endsAt = toDate(profile.subscriptionEndsAt);
  // Require the period end to be clearly past (>1 day) so a mistaken
  // "ends at now" timestamp from Stripe field-mapping bugs does not lock out
  // freshly paid subscribers.
  const clearlyEnded = Boolean(
    endsAt && endsAt.getTime() < Date.now() - 24 * 60 * 60 * 1000
  );

  if (status === 'active') {
    return clearlyEnded ? 'expired' : 'active';
  }
  if (status === 'expired') return 'expired';
  if (clearlyEnded) return 'expired';
  if (status === 'inactive') return 'inactive';
  return 'none';
}

/**
 * Looks up a user in Firestore `users` by email.
 * Supports doc id = email, or a document with an `email` field (e.g. uid-keyed docs).
 */
export async function getUserByEmail(
  email: string | null | undefined
): Promise<UserSubscriptionProfile | null> {
  if (!email) return null;
  const normalized = normalizeEmail(email);

  const byId = await getDoc(doc(db, 'users', normalized));
  if (byId.exists()) {
    const data = byId.data() as Record<string, unknown>;
    return {
      id: byId.id,
      email: String(data.email || normalized),
      uid: data.uid ? String(data.uid) : undefined,
      subscriptionStatus: (String(data.subscriptionStatus || 'none').toLowerCase() as SubscriptionStatus),
      subscriptionPlan: (data.subscriptionPlan as SubscriptionPlan | null | undefined) ?? null,
      subscriptionEndsAt: (data.subscriptionEndsAt as UserSubscriptionProfile['subscriptionEndsAt']) ?? null,
      stripeCustomerId: (data.stripeCustomerId as string | null | undefined) ?? null,
      stripeSubscriptionId: (data.stripeSubscriptionId as string | null | undefined) ?? null,
    };
  }

  const q = query(
    collection(db, 'users'),
    where('email', '==', normalized),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    // Also try original casing
    const q2 = query(collection(db, 'users'), where('email', '==', email.trim()), limit(1));
    const snap2 = await getDocs(q2);
    if (snap2.empty) return null;
    const d = snap2.docs[0];
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      email: String(data.email || email),
      uid: data.uid ? String(data.uid) : undefined,
      subscriptionStatus: (String(data.subscriptionStatus || 'none').toLowerCase() as SubscriptionStatus),
      subscriptionPlan: (data.subscriptionPlan as SubscriptionPlan | null | undefined) ?? null,
      subscriptionEndsAt: (data.subscriptionEndsAt as UserSubscriptionProfile['subscriptionEndsAt']) ?? null,
      stripeCustomerId: (data.stripeCustomerId as string | null | undefined) ?? null,
      stripeSubscriptionId: (data.stripeSubscriptionId as string | null | undefined) ?? null,
    };
  }

  const d = snap.docs[0];
  const data = d.data() as Record<string, unknown>;
  return {
    id: d.id,
    email: String(data.email || normalized),
    uid: data.uid ? String(data.uid) : undefined,
    subscriptionStatus: (String(data.subscriptionStatus || 'none').toLowerCase() as SubscriptionStatus),
    subscriptionPlan: (data.subscriptionPlan as SubscriptionPlan | null | undefined) ?? null,
    subscriptionEndsAt: (data.subscriptionEndsAt as UserSubscriptionProfile['subscriptionEndsAt']) ?? null,
    stripeCustomerId: (data.stripeCustomerId as string | null | undefined) ?? null,
    stripeSubscriptionId: (data.stripeSubscriptionId as string | null | undefined) ?? null,
  };
}

/** Ensure a lightweight user profile exists after first Google sign-in (never subscribed). */
export async function ensureUserProfile(email: string, uid: string): Promise<void> {
  const id = normalizeEmail(email);
  const ref = doc(db, 'users', id);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await setDoc(ref, { uid, email: id, updatedAt: serverTimestamp() }, { merge: true });
    return;
  }
  await setDoc(ref, {
    email: id,
    uid,
    subscriptionStatus: 'none',
    subscriptionPlan: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function startStripeCheckout(
  plan: SubscriptionPlan,
  email: string
): Promise<{ url: string }> {
  const res = await loggedFetch(apiUrl('/api/stripe/create-checkout-session'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, email }),
    __qnMeta: { reason: 'stripe-checkout', userAction: 'Start subscription checkout' },
  });
  const data = await res.json();
  if (!res.ok || !data?.url) {
    throw new Error(data?.error || 'Failed to start Stripe Checkout');
  }
  return { url: data.url as string };
}

/** Pull latest Stripe subscription state into Firestore for this email. */
export async function syncStripeSubscription(email: string): Promise<boolean> {
  const res = await loggedFetch(apiUrl('/api/stripe/sync-subscription'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
    __qnMeta: { reason: 'stripe-sync', userAction: 'Sync subscription' },
  });
  if (!res.ok) return false;
  const data = await res.json().catch(() => null);
  return Boolean(data?.ok);
}
