import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from './firebase';
import {
  AccessState,
  getUserByEmail,
  resolveSubscriptionAccess,
  ensureUserProfile,
  isDeveloperEmail,
  type UserSubscriptionProfile,
} from './subscription';

/** Kept for AuthModal compatibility — no longer thrown for normal users. */
export class SignInNotAllowedError extends Error {
  code = 'auth/signin-not-allowed';
  constructor(email?: string | null) {
    super(
      email
        ? `Access denied for ${email}.`
        : 'Access denied.'
    );
    this.name = 'SignInNotAllowedError';
  }
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  accessState: AccessState | 'signed_out' | 'loading';
  accessDenied: boolean;
  deniedEmail: string | null;
  subscription: UserSubscriptionProfile | null;
  clearAccessDenied: () => void;
  refreshSubscription: () => Promise<AccessState | 'signed_out'>;
  signInWithGoogle: () => Promise<AccessState>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const googleProvider = new GoogleAuthProvider();

async function evaluateUser(next: User): Promise<{
  accessState: AccessState;
  subscription: UserSubscriptionProfile | null;
}> {
  if (!next.email) {
    return { accessState: 'none', subscription: null };
  }

  // Developer: always full access (quota bypass is also enforced server-side).
  if (isDeveloperEmail(next.email)) {
    try {
      await ensureUserProfile(next.email, next.uid);
    } catch (err) {
      console.warn('ensureUserProfile failed (continuing as developer):', err);
    }

    let profile: UserSubscriptionProfile | null = null;
    try {
      profile = await getUserByEmail(next.email);
    } catch (err) {
      console.warn('getUserByEmail failed (continuing as developer):', err);
    }

    profile =
      profile ||
      ({
        id: next.email.trim().toLowerCase(),
        email: next.email.trim().toLowerCase(),
        uid: next.uid,
        subscriptionStatus: 'active',
      } as UserSubscriptionProfile);

    return { accessState: 'active', subscription: profile };
  }

  // Any other Google account may sign in; access depends on subscription.
  try {
    await ensureUserProfile(next.email, next.uid);
  } catch (err) {
    console.warn('ensureUserProfile failed:', err);
  }

  let profile: UserSubscriptionProfile | null = null;
  try {
    profile = await getUserByEmail(next.email);
  } catch (err) {
    console.warn('getUserByEmail failed:', err);
  }

  if (!profile) {
    profile = {
      id: next.email.trim().toLowerCase(),
      email: next.email.trim().toLowerCase(),
      uid: next.uid,
      subscriptionStatus: 'none',
    };
  }

  const accessState = resolveSubscriptionAccess(profile, next.email);
  return { accessState, subscription: profile };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessState, setAccessState] = useState<AccessState | 'signed_out' | 'loading'>('loading');
  const [subscription, setSubscription] = useState<UserSubscriptionProfile | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null);

  const clearAccessDenied = () => {
    setAccessDenied(false);
    setDeniedEmail(null);
  };

  const refreshSubscription = async () => {
    const current = auth.currentUser;
    if (!current) {
      setUser(null);
      setSubscription(null);
      setAccessState('signed_out');
      return 'signed_out' as const;
    }
    const result = await evaluateUser(current);
    setUser(current);
    setSubscription(result.subscription);
    setAccessState(result.accessState);
    setAccessDenied(false);
    return result.accessState;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (next) => {
      if (!next) {
        setUser(null);
        setSubscription(null);
        setAccessState('signed_out');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const result = await evaluateUser(next);
        setUser(next);
        setSubscription(result.subscription);
        setAccessState(result.accessState);
        setAccessDenied(false);
      } catch (err) {
        console.warn('Auth evaluation failed:', err);
        if (isDeveloperEmail(next.email)) {
          setUser(next);
          setSubscription({
            id: (next.email || '').toLowerCase(),
            email: (next.email || '').toLowerCase(),
            uid: next.uid,
            subscriptionStatus: 'active',
          });
          setAccessState('active');
          setAccessDenied(false);
        } else {
          // Still keep the signed-in user; send them to pricing if profile read fails.
          setUser(next);
          setSubscription({
            id: (next.email || '').toLowerCase(),
            email: (next.email || '').toLowerCase(),
            uid: next.uid,
            subscriptionStatus: 'none',
          });
          setAccessState('none');
          setAccessDenied(false);
        }
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const signInWithGoogle = async (): Promise<AccessState> => {
    clearAccessDenied();
    const result = await signInWithPopup(auth, googleProvider);
    const email = result.user.email;

    try {
      const evaluated = await evaluateUser(result.user);
      setUser(result.user);
      setSubscription(evaluated.subscription);
      setAccessState(evaluated.accessState);
      setAccessDenied(false);
      setLoading(false);
      return evaluated.accessState;
    } catch (err) {
      if (isDeveloperEmail(email)) {
        setUser(result.user);
        setSubscription({
          id: (email || '').toLowerCase(),
          email: (email || '').toLowerCase(),
          uid: result.user.uid,
          subscriptionStatus: 'active',
        });
        setAccessState('active');
        setAccessDenied(false);
        setLoading(false);
        return 'active';
      }
      setUser(result.user);
      setSubscription({
        id: (email || '').toLowerCase(),
        email: (email || '').toLowerCase(),
        uid: result.user.uid,
        subscriptionStatus: 'none',
      });
      setAccessState('none');
      setAccessDenied(false);
      setLoading(false);
      return 'none';
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setSubscription(null);
    setAccessState('signed_out');
    clearAccessDenied();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        accessState,
        accessDenied,
        deniedEmail,
        subscription,
        clearAccessDenied,
        refreshSubscription,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
