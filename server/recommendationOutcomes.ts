/**
 * Recommendation outcome tracking — logs what each engine called at the time
 * of the call, then grades it against the real price once its horizon elapses.
 * This is the only way to know whether an engine (or its confidence number)
 * is actually accurate, instead of just internally consistent.
 */

import type { Express, Request, Response } from 'express';
import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import YahooFinanceImport from 'yahoo-finance2';
import { requireAuthedEmail } from './authBearer';
import { isDeveloperEmail, mytDateKey } from './usageQuota';

const YahooFinanceConstructor = (YahooFinanceImport as any).default || YahooFinanceImport;
const yahooFinance = new YahooFinanceConstructor({
  validation: {
    logErrors: false,
    logOptionsErrors: false,
    allowAdditionalProps: true,
  },
}) as any;

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

const HORIZON_CALENDAR_DAYS: Record<string, number> = { '1W': 7, '1M': 30, '3M': 90, '1Y': 365 };
const VALID_ENGINES = new Set(['quantum', 'suggest', 'dayTrade']);
const BULLISH_ACTIONS = new Set(['STRONG BUY', 'BUY']);
const BEARISH_ACTIONS = new Set(['SELL', 'REDUCE', 'AVOID NEW POSITION']);

function sanitizeTicker(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, '_')
    .slice(0, 20);
}

// Per-user rate limit so a stuck client can't spam writes.
const recentByUid = new Map<string, number[]>();
function allowLog(uid: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const prev = (recentByUid.get(uid) || []).filter((t) => now - t < windowMs);
  if (prev.length >= 20) {
    recentByUid.set(uid, prev);
    return false;
  }
  prev.push(now);
  recentByUid.set(uid, prev);
  return true;
}

async function handleLogRecommendation(req: Request, res: Response) {
  try {
    const authed = await requireAuthedEmail(req);
    if (authed.ok === false) return res.status(authed.status).json({ error: authed.error });
    if (!allowLog(authed.uid)) {
      return res.status(429).json({ error: 'Too many log requests.' });
    }

    const ticker = sanitizeTicker(req.body?.ticker);
    const engine = String(req.body?.engine || '');
    const horizon = String(req.body?.horizon || '');
    const action = String(req.body?.action || '').toUpperCase();
    const confidence = Number(req.body?.confidence);
    const entryPrice = Number(req.body?.entryPrice);
    const targetPrice = Number(req.body?.targetPrice);
    const expectedReturn = Number(req.body?.expectedReturn);

    if (!ticker) return res.status(400).json({ error: 'ticker is required' });
    if (!VALID_ENGINES.has(engine)) return res.status(400).json({ error: 'invalid engine' });
    if (!Object.prototype.hasOwnProperty.call(HORIZON_CALENDAR_DAYS, horizon)) {
      return res.status(400).json({ error: 'invalid horizon' });
    }
    if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
      return res.status(400).json({ error: 'invalid entryPrice' });
    }

    const db = ensureFirebaseAdmin();
    const dayKey = mytDateKey();
    const docId = `${engine}_${ticker}_${horizon}_${dayKey}`;
    const evaluateAtMs = Date.now() + HORIZON_CALENDAR_DAYS[horizon] * 24 * 60 * 60 * 1000;

    try {
      await db
        .collection('recommendationOutcomes')
        .doc(docId)
        .create({
          ticker,
          engine,
          horizon,
          action,
          confidence: Number.isFinite(confidence) ? confidence : null,
          entryPrice,
          targetPrice: Number.isFinite(targetPrice) ? targetPrice : null,
          expectedReturn: Number.isFinite(expectedReturn) ? expectedReturn : null,
          createdAt: FieldValue.serverTimestamp(),
          evaluateAt: Timestamp.fromMillis(evaluateAtMs),
          graded: false,
        });
      return res.json({ ok: true, logged: true });
    } catch (err: any) {
      // Already logged this ticker/horizon/engine today — expected, not an error.
      if (err?.code === 6) return res.json({ ok: true, logged: false, reason: 'already-logged-today' });
      throw err;
    }
  } catch (err: any) {
    console.error('[recommendationOutcomes] log failed:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Failed to log recommendation' });
  }
}

async function fetchPrice(ticker: string): Promise<number | null> {
  try {
    const q: any = await yahooFinance.quote(ticker, {}, { validateResult: false });
    const p = Number(q?.regularMarketPrice);
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch (err: any) {
    const p = Number(err?.result?.regularMarketPrice);
    return Number.isFinite(p) && p > 0 ? p : null;
  }
}

async function handleEvaluateOutcomes(req: Request, res: Response) {
  const expected = process.env.INTERNAL_JOB_SECRET;
  const provided = req.headers['x-internal-secret'];
  if (!expected || provided !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const db = ensureFirebaseAdmin();
    const snap = await db
      .collection('recommendationOutcomes')
      .where('graded', '==', false)
      .where('evaluateAt', '<=', Timestamp.now())
      .limit(200)
      .get();

    let graded = 0;
    let failed = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      const price = await fetchPrice(String(data.ticker || ''));
      if (price == null) {
        failed++;
        continue;
      }
      const entryPrice = Number(data.entryPrice);
      const realizedReturn = entryPrice > 0 ? ((price - entryPrice) / entryPrice) * 100 : null;
      const action = String(data.action || '').toUpperCase();

      let directionHit: boolean | null = null;
      if (realizedReturn != null) {
        if (BULLISH_ACTIONS.has(action)) directionHit = realizedReturn > 0;
        else if (BEARISH_ACTIONS.has(action)) directionHit = realizedReturn < 0;
        else if (action === 'HOLD') directionHit = Math.abs(realizedReturn) < 5;
      }

      const targetPrice = Number(data.targetPrice);
      const targetHit = Number.isFinite(targetPrice)
        ? targetPrice >= entryPrice
          ? price >= targetPrice
          : price <= targetPrice
        : null;

      await doc.ref.update({
        graded: true,
        gradedAt: FieldValue.serverTimestamp(),
        realizedPrice: price,
        realizedReturn,
        directionHit,
        targetHit,
      });
      graded++;
    }
    res.json({ ok: true, scanned: snap.size, graded, failed });
  } catch (err: any) {
    console.error('[recommendationOutcomes] evaluate failed:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Failed to evaluate outcomes' });
  }
}

async function handleOutcomeStats(req: Request, res: Response) {
  try {
    const authed = await requireAuthedEmail(req);
    if (authed.ok === false) return res.status(authed.status).json({ error: authed.error });
    if (!isDeveloperEmail(authed.email)) return res.status(403).json({ error: 'Not authorized' });

    const db = ensureFirebaseAdmin();
    const snap = await db.collection('recommendationOutcomes').where('graded', '==', true).limit(2000).get();

    type Bucket = {
      count: number;
      directionHits: number;
      directionGraded: number;
      targetHits: number;
      targetGraded: number;
      sumExpected: number;
      sumRealized: number;
    };
    const buckets = new Map<string, Bucket>();

    for (const doc of snap.docs) {
      const d = doc.data();
      const engine = String(d.engine || 'unknown');
      const horizon = String(d.horizon || 'unknown');
      const confidence = Number(d.confidence);
      const confidenceBucket = Number.isFinite(confidence)
        ? `${Math.floor(confidence / 10) * 10}-${Math.floor(confidence / 10) * 10 + 9}`
        : 'n/a';
      const key = `${engine}|${horizon}|${confidenceBucket}`;
      const b: Bucket = buckets.get(key) || {
        count: 0,
        directionHits: 0,
        directionGraded: 0,
        targetHits: 0,
        targetGraded: 0,
        sumExpected: 0,
        sumRealized: 0,
      };
      b.count++;
      if (typeof d.directionHit === 'boolean') {
        b.directionGraded++;
        if (d.directionHit) b.directionHits++;
      }
      if (typeof d.targetHit === 'boolean') {
        b.targetGraded++;
        if (d.targetHit) b.targetHits++;
      }
      if (Number.isFinite(d.expectedReturn)) b.sumExpected += Number(d.expectedReturn);
      if (Number.isFinite(d.realizedReturn)) b.sumRealized += Number(d.realizedReturn);
      buckets.set(key, b);
    }

    const rows = Array.from(buckets.entries())
      .map(([key, b]) => {
        const [engine, horizon, confidenceBucket] = key.split('|');
        return {
          engine,
          horizon,
          confidenceBucket,
          sampleSize: b.count,
          directionHitRate: b.directionGraded ? +((b.directionHits / b.directionGraded) * 100).toFixed(1) : null,
          targetHitRate: b.targetGraded ? +((b.targetHits / b.targetGraded) * 100).toFixed(1) : null,
          avgExpectedReturn: b.count ? +(b.sumExpected / b.count).toFixed(2) : null,
          avgRealizedReturn: b.count ? +(b.sumRealized / b.count).toFixed(2) : null,
        };
      })
      .sort((a, b) => b.sampleSize - a.sampleSize);

    res.json({ ok: true, totalGraded: snap.size, rows });
  } catch (err: any) {
    console.error('[recommendationOutcomes] stats failed:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Failed to load outcome stats' });
  }
}

export function registerRecommendationOutcomeRoutes(app: Express) {
  app.post('/api/log-recommendation', handleLogRecommendation);
  app.post('/api/internal/evaluate-outcomes', handleEvaluateOutcomes);
  app.get('/api/internal/outcome-stats', handleOutcomeStats);
}
