/**
 * Daily AI usage quotas (MYT) for Quantum Node plans.
 * Basic: 20 analyses + 20 news / day
 * Pro:   30 analyses + 30 news / day
 * Overage: Reload pack RM10 (+10 analyses +10 news), Mini RM5 (+5 analyses / +10 news)
 *
 * All plan quotas hard-reset at MYT midnight — unused included credits
 * do not roll over. Purchased bonus packs persist until spent.
 * After daily included is exhausted, the meter shows the latest purchase
 * (e.g. Pack → 0/12 → 12/12).
 */

import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export type BillableKind = 'analysis' | 'news';
export type SubscriptionPlanId = 'monthly' | 'pro_monthly' | 'yearly' | string | null | undefined;

export const DEVELOPER_EMAILS = ['mic6046@gmail.com'] as const;

export function isDeveloperEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return DEVELOPER_EMAILS.includes(email.trim().toLowerCase() as (typeof DEVELOPER_EMAILS)[number]);
}

export function mytDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function dailyLimitsForPlan(plan: SubscriptionPlanId): {
  analyses: number;
  news: number;
  planLabel: string;
} {
  if (plan === 'pro_monthly') {
    return { analyses: 30, news: 30, planLabel: 'Pro' };
  }
  return { analyses: 20, news: 20, planLabel: 'Basic' };
}

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

export type UsageSnapshot = {
  email: string;
  plan: string;
  planLabel: string;
  dateKey: string;
  analysesUsed: number;
  newsUsed: number;
  analysesLimit: number;
  newsLimit: number;
  analysesRemaining: number;
  newsRemaining: number;
  bonusAnalyses: number;
  bonusNews: number;
  /** Credits consumed from the latest purchase pack. */
  bonusAnalysesUsed: number;
  bonusNewsUsed: number;
  /** Latest purchase size (5 / 10 / 12) — meter denominator. */
  bonusAnalysesPackSize: number;
  bonusNewsPackSize: number;
  analysesOnBonus: boolean;
  newsOnBonus: boolean;
  unlimited: boolean;
  subscriptionStatus: string;
};

type UserDoc = {
  email?: string;
  subscriptionStatus?: string;
  subscriptionPlan?: string;
  bonusAnalyses?: number;
  bonusNews?: number;
  bonusAnalysesPackSize?: number;
  bonusNewsPackSize?: number;
  appliedOverageSessions?: Record<string, boolean>;
  usage?: {
    dateKey?: string;
    analysesUsed?: number;
    newsUsed?: number;
    bonusAnalysesUsed?: number;
    bonusNewsUsed?: number;
  };
  [key: string]: unknown;
};

type DayState = {
  dateKey: string;
  analysesUsed: number;
  newsUsed: number;
  bonusAnalysesUsed: number;
  bonusNewsUsed: number;
  bonusAnalyses: number;
  bonusNews: number;
  bonusAnalysesPackSize: number;
  bonusNewsPackSize: number;
  /** True when state must be persisted (day change or meter sync). */
  rolled: boolean;
};

/**
 * Build today's usage state. On MYT day change, included quotas hard-reset.
 * Unused included credits are discarded; purchased bonus packs persist.
 */
function buildDayState(
  data: UserDoc,
  dateKey: string,
  _limits: { analyses: number; news: number }
): DayState {
  const usage = data.usage || {};
  const prevKey = usage.dateKey ? String(usage.dateKey) : '';
  const bonusAnalyses = Math.max(0, Number(data.bonusAnalyses) || 0);
  const bonusNews = Math.max(0, Number(data.bonusNews) || 0);
  const bonusAnalysesPackSize = Math.max(0, Number(data.bonusAnalysesPackSize) || 0);
  const bonusNewsPackSize = Math.max(0, Number(data.bonusNewsPackSize) || 0);
  const bonusAnalysesUsed = Math.max(0, Number(usage.bonusAnalysesUsed) || 0);
  const bonusNewsUsed = Math.max(0, Number(usage.bonusNewsUsed) || 0);

  if (prevKey === dateKey) {
    return {
      dateKey,
      analysesUsed: Math.max(0, Number(usage.analysesUsed) || 0),
      newsUsed: Math.max(0, Number(usage.newsUsed) || 0),
      bonusAnalysesUsed,
      bonusNewsUsed,
      bonusAnalyses,
      bonusNews,
      bonusAnalysesPackSize,
      bonusNewsPackSize,
      rolled: false,
    };
  }

  // New MYT day (or first write): hard-reset daily counters only.
  // Purchased pack meters survive the day change.
  return {
    dateKey,
    analysesUsed: 0,
    newsUsed: 0,
    bonusAnalysesUsed,
    bonusNewsUsed,
    bonusAnalyses,
    bonusNews,
    bonusAnalysesPackSize,
    bonusNewsPackSize,
    rolled: true,
  };
}

/**
 * Keep bonus pack meters in sync. Does not fold unused daily into bonus —
 * included quotas reset each day and stay separate from purchased packs.
 */
function foldDailyIntoActivePack(state: DayState, _limits: { analyses: number; news: number }): DayState {
  let rolled = state.rolled;
  let bonusAnalyses = state.bonusAnalyses;
  let bonusNews = state.bonusNews;
  let bonusAnalysesUsed = state.bonusAnalysesUsed;
  let bonusNewsUsed = state.bonusNewsUsed;
  let bonusAnalysesPackSize = state.bonusAnalysesPackSize;
  let bonusNewsPackSize = state.bonusNewsPackSize;

  // Meter denominator = total credit units in the pool (used + remaining).
  if (bonusAnalyses > 0) {
    const total = bonusAnalysesUsed + bonusAnalyses;
    if (bonusAnalysesPackSize !== total) {
      bonusAnalysesPackSize = total;
      rolled = true;
    }
  } else if (bonusAnalysesPackSize > 0 || bonusAnalysesUsed > 0) {
    bonusAnalysesPackSize = 0;
    bonusAnalysesUsed = 0;
    rolled = true;
  }

  if (bonusNews > 0) {
    const total = bonusNewsUsed + bonusNews;
    if (bonusNewsPackSize !== total) {
      bonusNewsPackSize = total;
      rolled = true;
    }
  } else if (bonusNewsPackSize > 0 || bonusNewsUsed > 0) {
    bonusNewsPackSize = 0;
    bonusNewsUsed = 0;
    rolled = true;
  }

  return {
    ...state,
    bonusAnalyses,
    bonusNews,
    bonusAnalysesUsed,
    bonusNewsUsed,
    bonusAnalysesPackSize,
    bonusNewsPackSize,
    rolled,
  };
}

/** Meter shows used / totalUnits for the full credit pool. */
function resolvePackMeter(
  remaining: number,
  used: number,
  packSize: number
): { packSize: number; used: number } {
  const rem = Math.max(0, remaining);
  const trackedUsed = Math.max(0, used);
  if (rem <= 0 && trackedUsed <= 0) return { packSize: 0, used: 0 };

  // Total units = remaining + already used from this pool (fallback to stored pack size).
  const total = Math.max(packSize, rem + trackedUsed, rem);
  const clampedUsed = Math.min(total, trackedUsed);
  return { packSize: total, used: rem > 0 ? clampedUsed : total };
}

function wasOverageSessionApplied(data: UserDoc, sessionId: string): boolean {
  const nested = data.appliedOverageSessions;
  if (nested && nested[sessionId]) return true;
  // Legacy bug: dotted keys written as top-level field names
  if (data[`appliedOverageSessions.${sessionId}`] === true) return true;
  return false;
}

export async function getUsageSnapshot(email: string): Promise<UsageSnapshot> {
  const normalized = email.trim().toLowerCase();
  const unlimited = isDeveloperEmail(normalized);
  const db = ensureFirebaseAdmin();
  const ref = db.collection('users').doc(normalized);
  const snap = await ref.get();
  const data = (snap.exists ? snap.data() : {}) as UserDoc;
  const dateKey = mytDateKey();
  const plan = data.subscriptionPlan || 'monthly';
  const limits = dailyLimitsForPlan(plan);
  const state = foldDailyIntoActivePack(buildDayState(data, dateKey, limits), limits);

  // Persist day reset / meter sync so counters stay correct on the next read.
  if (state.rolled) {
    await ref.set(
      {
        email: normalized,
        bonusAnalyses: state.bonusAnalyses,
        bonusNews: state.bonusNews,
        bonusAnalysesPackSize: state.bonusAnalysesPackSize,
        bonusNewsPackSize: state.bonusNewsPackSize,
        usage: {
          dateKey: state.dateKey,
          analysesUsed: state.analysesUsed,
          newsUsed: state.newsUsed,
          bonusAnalysesUsed: state.bonusAnalysesUsed,
          bonusNewsUsed: state.bonusNewsUsed,
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  const analysesPack = resolvePackMeter(
    state.bonusAnalyses,
    state.bonusAnalysesUsed,
    state.bonusAnalysesPackSize
  );
  const newsPack = resolvePackMeter(state.bonusNews, state.bonusNewsUsed, state.bonusNewsPackSize);

  const analysesRemaining = unlimited
    ? 9999
    : Math.max(0, limits.analyses - state.analysesUsed) + state.bonusAnalyses;
  const newsRemaining = unlimited
    ? 9999
    : Math.max(0, limits.news - state.newsUsed) + state.bonusNews;

  // Pack meter only after daily included is exhausted (bonus packs never expire).
  const analysesOnBonus =
    !unlimited && state.analysesUsed >= limits.analyses && (state.bonusAnalyses > 0 || analysesPack.packSize > 0);
  const newsOnBonus =
    !unlimited && state.newsUsed >= limits.news && (state.bonusNews > 0 || newsPack.packSize > 0);

  return {
    email: normalized,
    plan: String(plan),
    planLabel: unlimited ? 'Developer' : limits.planLabel,
    dateKey,
    analysesUsed: state.analysesUsed,
    newsUsed: state.newsUsed,
    analysesLimit: limits.analyses,
    newsLimit: limits.news,
    analysesRemaining,
    newsRemaining,
    bonusAnalyses: state.bonusAnalyses,
    bonusNews: state.bonusNews,
    bonusAnalysesUsed: analysesPack.used,
    bonusNewsUsed: newsPack.used,
    bonusAnalysesPackSize: analysesPack.packSize,
    bonusNewsPackSize: newsPack.packSize,
    analysesOnBonus,
    newsOnBonus,
    unlimited,
    subscriptionStatus: unlimited ? 'active' : String(data.subscriptionStatus || 'none'),
  };
}

export type BonusCreditKind = BillableKind | 'analysis_pack' | 'reload_pack';

export async function addBonusCredits(
  email: string,
  kind: BonusCreditKind,
  amount?: number,
  sessionId?: string
): Promise<UsageSnapshot> {
  const db = ensureFirebaseAdmin();
  const id = email.trim().toLowerCase();
  const ref = db.collection('users').doc(id);
  const dateKey = mytDateKey();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = (snap.exists ? snap.data() : {}) as UserDoc;

    if (sessionId && wasOverageSessionApplied(data, sessionId)) {
      return;
    }

    const plan = data.subscriptionPlan || 'monthly';
    const limits = dailyLimitsForPlan(plan);
    const state = foldDailyIntoActivePack(buildDayState(data, dateKey, limits), limits);

    let {
      bonusAnalyses,
      bonusNews,
      bonusAnalysesUsed,
      bonusNewsUsed,
      bonusAnalysesPackSize,
      bonusNewsPackSize,
      analysesUsed,
      newsUsed,
    } = state;

    if (kind === 'reload_pack') {
      // Combo pack: +10 analyses +10 news. Persists until spent; daily quota stays intact.
      const addAnalyses = amount ?? 10;
      const addNews = 10;
      bonusAnalyses = bonusAnalyses + addAnalyses;
      bonusNews = bonusNews + addNews;
      bonusAnalysesUsed = 0;
      bonusNewsUsed = 0;
      bonusAnalysesPackSize = bonusAnalyses;
      bonusNewsPackSize = bonusNews;
    } else if (kind === 'analysis_pack' || kind === 'analysis') {
      const add = amount ?? (kind === 'analysis_pack' ? 12 : 5);
      bonusAnalyses = bonusAnalyses + add;
      bonusAnalysesUsed = 0;
      bonusAnalysesPackSize = bonusAnalyses;
    } else {
      const add = amount ?? 10;
      bonusNews = bonusNews + add;
      bonusNewsUsed = 0;
      bonusNewsPackSize = bonusNews;
    }

    const applied = { ...(data.appliedOverageSessions || {}) };
    if (sessionId) {
      applied[sessionId] = true;
    }

    tx.set(
      ref,
      {
        email: id,
        bonusAnalyses,
        bonusNews,
        bonusAnalysesPackSize,
        bonusNewsPackSize,
        ...(sessionId ? { appliedOverageSessions: applied } : {}),
        usage: {
          dateKey: state.dateKey,
          analysesUsed,
          newsUsed,
          bonusAnalysesUsed,
          bonusNewsUsed,
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  return getUsageSnapshot(id);
}

/**
 * Reserve one unit of analysis or news.
 * Uses daily included first, then bonus pool.
 */
export async function consumeUsageCredit(
  email: string | null | undefined,
  kind: BillableKind
): Promise<
  | { ok: true; usage: UsageSnapshot; chargedFrom: 'included' | 'bonus' | 'unlimited' }
  | {
      ok: false;
      status: number;
      code: string;
      error: string;
      usage?: UsageSnapshot;
    }
> {
  if (!email || !String(email).trim()) {
    return {
      ok: false,
      status: 401,
      code: 'email_required',
      error: 'Sign in required to use AI analysis / news credits.',
    };
  }

  const normalized = email.trim().toLowerCase();
  if (isDeveloperEmail(normalized)) {
    const usage = await getUsageSnapshot(normalized);
    return { ok: true, usage, chargedFrom: 'unlimited' };
  }

  const db = ensureFirebaseAdmin();
  const ref = db.collection('users').doc(normalized);
  const dateKey = mytDateKey();

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = (snap.exists ? snap.data() : {}) as UserDoc;
      const status = String(data.subscriptionStatus || 'none').toLowerCase();
      if (status !== 'active') {
        return {
          ok: false as const,
          status: 402,
          code: 'subscription_required',
          error: 'Active subscription required. Subscribe to Basic or Pro to continue.',
        };
      }

      const plan = data.subscriptionPlan || 'monthly';
      const limits = dailyLimitsForPlan(plan);
      const state = foldDailyIntoActivePack(buildDayState(data, dateKey, limits), limits);

      let analysesUsed = state.analysesUsed;
      let newsUsed = state.newsUsed;
      let bonusAnalyses = state.bonusAnalyses;
      let bonusNews = state.bonusNews;
      let bonusAnalysesUsed = state.bonusAnalysesUsed;
      let bonusNewsUsed = state.bonusNewsUsed;
      let bonusAnalysesPackSize = state.bonusAnalysesPackSize;
      let bonusNewsPackSize = state.bonusNewsPackSize;
      let chargedFrom: 'included' | 'bonus' = 'included';

      if (kind === 'analysis') {
        if (analysesUsed < limits.analyses) {
          analysesUsed += 1;
          chargedFrom = 'included';
        } else if (bonusAnalyses > 0) {
          if (bonusAnalysesPackSize <= 0) {
            bonusAnalysesPackSize = bonusAnalysesUsed + bonusAnalyses;
          }
          bonusAnalyses -= 1;
          bonusAnalysesUsed += 1;
          chargedFrom = 'bonus';
          if (bonusAnalyses <= 0) {
            bonusAnalyses = 0;
            bonusAnalysesUsed = 0;
            bonusAnalysesPackSize = 0;
          }
        } else {
          return {
            ok: false as const,
            status: 402,
            code: 'analysis_quota_exceeded',
            error: `Daily AI analysis usage is out (${limits.analyses}/day on ${limits.planLabel}). Please reload credits — Mini RM5 (+5) or Reload pack RM10 (+10 analyses +10 news).`,
          };
        }
      } else if (newsUsed < limits.news) {
        newsUsed += 1;
        chargedFrom = 'included';
      } else if (bonusNews > 0) {
        if (bonusNewsPackSize <= 0) {
          bonusNewsPackSize = bonusNewsUsed + bonusNews;
        }
        bonusNews -= 1;
        bonusNewsUsed += 1;
        chargedFrom = 'bonus';
        if (bonusNews <= 0) {
          bonusNews = 0;
          bonusNewsUsed = 0;
          bonusNewsPackSize = 0;
        }
      } else {
        return {
          ok: false as const,
          status: 402,
          code: 'news_quota_exceeded',
          error: `Daily AI news usage is out (${limits.news}/day on ${limits.planLabel}). Please reload credits — News mini RM5 (+10) or Reload pack RM10 (+10 analyses +10 news).`,
        };
      }

      tx.set(
        ref,
        {
          email: normalized,
          bonusAnalyses,
          bonusNews,
          bonusAnalysesPackSize,
          bonusNewsPackSize,
          usage: {
            dateKey,
            analysesUsed,
            newsUsed,
            bonusAnalysesUsed,
            bonusNewsUsed,
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { ok: true as const, chargedFrom };
    });

    if (!result.ok) {
      const usage = await getUsageSnapshot(normalized);
      return { ...result, usage };
    }

    const usage = await getUsageSnapshot(normalized);
    return { ok: true, usage, chargedFrom: result.chargedFrom };
  } catch (err: any) {
    console.error('[usageQuota] consume failed:', err?.message || err);
    return {
      ok: false,
      status: 500,
      code: 'usage_error',
      error: err?.message || 'Failed to update usage quota',
    };
  }
}
