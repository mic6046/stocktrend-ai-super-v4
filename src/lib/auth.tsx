import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
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
    super(email ? `Access denied for ${email}.` : 'Access denied.');
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
  signInWithEmail: (email: string, password: string) => Promise<AccessState>;
  signUpWithEmail: (email: string, password: string) => Promise<AccessState>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const googleProvider = new GoogleAuthProvider();
// Always show the account picker so users can switch Google accounts.
googleProvider.setCustomParameters({ prompt: 'select_account' });
googleProvider.addScope('email');
googleProvider.addScope('profile');

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

  // Any other signed-in account may continue; access depends on subscription.
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

async function finalizeSignedInUser(
  user: User,
  setters: {
    setUser: (u: User | null) => void;
    setSubscription: (s: UserSubscriptionProfile | null) => void;
    setAccessState: (a: AccessState | 'signed_out' | 'loading') => void;
    setAccessDenied: (v: boolean) => void;
    setLoading: (v: boolean) => void;
  }
): Promise<AccessState> {
  const email = user.email;
  try {
    const evaluated = await evaluateUser(user);
    setters.setUser(user);
    setters.setSubscription(evaluated.subscription);
    setters.setAccessState(evaluated.accessState);
    setters.setAccessDenied(false);
    setters.setLoading(false);
    return evaluated.accessState;
  } catch (err) {
    if (isDeveloperEmail(email)) {
      setters.setUser(user);
      setters.setSubscription({
        id: (email || '').toLowerCase(),
        email: (email || '').toLowerCase(),
        uid: user.uid,
        subscriptionStatus: 'active',
      });
      setters.setAccessState('active');
      setters.setAccessDenied(false);
      setters.setLoading(false);
      return 'active';
    }
    setters.setUser(user);
    setters.setSubscription({
      id: (email || '').toLowerCase(),
      email: (email || '').toLowerCase(),
      uid: user.uid,
      subscriptionStatus: 'none',
    });
    setters.setAccessState('none');
    setters.setAccessDenied(false);
    setters.setLoading(false);
    return 'none';
  }
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

  const authSetters = {
    setUser,
    setSubscription,
    setAccessState,
    setAccessDenied,
    setLoading,
  };

  const signInWithGoogle = async (): Promise<AccessState> => {
    clearAccessDenied();
    const result = await signInWithPopup(auth, googleProvider);
    return finalizeSignedInUser(result.user, authSetters);
  };

  const signInWithEmail = async (email: string, password: string): Promise<AccessState> => {
    clearAccessDenied();
    const result = await signInWithEmailAndPassword(auth, email.trim(), password);
    return finalizeSignedInUser(result.user, authSetters);
  };

  const signUpWithEmail = async (email: string, password: string): Promise<AccessState> => {
    clearAccessDenied();
    const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
    return finalizeSignedInUser(result.user, authSetters);
  };

  const resetPassword = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email.trim());
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
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
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

export function mapAuthError(err: unknown, fallback = 'Sign-in failed.'): string {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code || '') : '';
  const message =
    typeof err === 'object' && err && 'message' in err
      ? String((err as { message?: string }).message || '')
      : '';

  if (err instanceof SignInNotAllowedError || code === 'auth/signin-not-allowed') {
    return 'This account is not authorized.';
  }
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) {
    return 'Sign-in was cancelled.';
  }
  if (code.includes('popup-blocked')) {
    return 'Pop-up was blocked. Allow pop-ups for this site and try again.';
  }
  if (code.includes('operation-not-allowed')) {
    return 'That sign-in method is not enabled in Firebase Console yet.';
  }
  if (code.includes('unauthorized-domain')) {
    return 'This domain is not authorized for sign-in in Firebase.';
  }
  if (code.includes('invalid-email')) {
    return 'Enter a valid email address.';
  }
  if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
    return 'Email or password is incorrect.';
  }
  if (code.includes('email-already-in-use')) {
    return 'An account already exists with this email. Sign in instead.';
  }
  if (code.includes('weak-password')) {
    return 'Password must be at least 6 characters.';
  }
  if (code.includes('too-many-requests')) {
    return 'Too many attempts. Wait a moment and try again.';
  }
  if (code.includes('network-request-failed')) {
    return 'Network error. Check your connection and try again.';
  }
  return message || fallback;
}
