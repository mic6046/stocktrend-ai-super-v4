/**
 * Firebase ID token verification for billing / usage APIs.
 * Never trust client-supplied email for grants or quota without this.
 */

import type { Request } from 'express';
import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function ensureFirebaseAdminApp() {
  if (!getApps().length) {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (json) {
      const cred = JSON.parse(json);
      initializeApp({
        credential: cert(cred),
        projectId: cred.project_id || process.env.FIREBASE_PROJECT_ID || 'stocktrend-ai-super',
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({
        credential: applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || 'stocktrend-ai-super',
      });
    } else {
      initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'stocktrend-ai-super',
      });
    }
  }
}

export type AuthedEmailResult =
  | { ok: true; email: string; uid: string }
  | { ok: false; status: number; error: string };

/**
 * Require Authorization: Bearer <Firebase ID token> and return verified email.
 */
export async function requireAuthedEmail(req: Request): Promise<AuthedEmailResult> {
  const header = String(req.headers.authorization || '');
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return {
      ok: false,
      status: 401,
      error: 'Sign in required. Missing Authorization Bearer token.',
    };
  }

  try {
    ensureFirebaseAdminApp();
    const decoded = await getAuth().verifyIdToken(match[1].trim());
    const email = String(decoded.email || '')
      .trim()
      .toLowerCase();
    if (!email || !email.includes('@')) {
      return {
        ok: false,
        status: 401,
        error: 'Signed-in account has no email.',
      };
    }
    return { ok: true, email, uid: decoded.uid };
  } catch (err: any) {
    console.warn('[auth] verifyIdToken failed:', err?.message || err);
    return {
      ok: false,
      status: 401,
      error: 'Invalid or expired sign-in token.',
    };
  }
}

/** Require auth and that body/query email (if present) matches the token email. */
export async function requireAuthedEmailMatch(
  req: Request,
  claimedEmail?: string | null
): Promise<AuthedEmailResult> {
  const authed = await requireAuthedEmail(req);
  if (!authed.ok) return authed;
  const claimed = String(claimedEmail || '')
    .trim()
    .toLowerCase();
  if (claimed && claimed !== authed.email) {
    return {
      ok: false,
      status: 403,
      error: 'Email does not match signed-in account.',
    };
  }
  return authed;
}
