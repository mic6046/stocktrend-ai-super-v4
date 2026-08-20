import type { Express, Request, Response } from 'express';
import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { requireAuthedEmailMatch } from './authBearer';

const TOPICS = new Set(['how-to', 'billing', 'account', 'bug', 'feature', 'other']);
const recentByEmail = new Map<string, number[]>();

function ensureFirebaseAdmin() {
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
  return getFirestore();
}

function allowSubmit(email: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const prev = (recentByEmail.get(email) || []).filter((t) => now - t < windowMs);
  if (prev.length >= 5) {
    recentByEmail.set(email, prev);
    return false;
  }
  prev.push(now);
  recentByEmail.set(email, prev);
  return true;
}

async function handleHelp(req: Request, res: Response) {
  try {
    const emailRaw = String(req.body?.email || '').trim().toLowerCase();
    const authed = await requireAuthedEmailMatch(req, emailRaw || null);
    const email = authed.ok ? authed.email : emailRaw;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    if (!allowSubmit(email)) {
      return res.status(429).json({ error: 'Too many help requests. Try again later.' });
    }

    const topic = String(req.body?.topic || 'other');
    const subject = String(req.body?.subject || '').trim().slice(0, 200);
    const message = String(req.body?.message || '').trim().slice(0, 4000);
    if (!TOPICS.has(topic)) return res.status(400).json({ error: 'Invalid topic.' });
    if (subject.length < 3) return res.status(400).json({ error: 'Subject is too short.' });
    if (message.length < 10) return res.status(400).json({ error: 'Message is too short.' });

    const db = ensureFirebaseAdmin();
    const doc = {
      email,
      uid: authed.ok ? authed.uid : null,
      topic,
      subject,
      message,
      page: typeof req.body?.page === 'string' ? req.body.page.slice(0, 120) : null,
      clientId: typeof req.body?.clientId === 'string' ? req.body.clientId.slice(0, 80) : null,
      status: 'open',
      createdAt: FieldValue.serverTimestamp(),
    };
    const ref = await db.collection('helpRequests').add(doc);
    res.json({ ok: true, id: ref.id });
  } catch (err: any) {
    console.error('[help] failed:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Failed to save help request' });
  }
}

export function registerHelpRoutes(app: Express) {
  app.post('/api/help', handleHelp);
}
