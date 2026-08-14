import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import type { WatchlistItem } from './watchlistStore';
import type { PortfolioHolding } from './portfolioStore';
import type { CachedSignalRow } from './signalCache';
import type { RefreshMode, AutoRefreshIntervalSec } from './marketDataRefresh';
import type { DashboardMarket } from './dashboardMarket';

export type AccountPrefs = {
  refreshMode?: RefreshMode;
  autoRefreshIntervalSec?: AutoRefreshIntervalSec;
  dashboardMarket?: DashboardMarket;
  sidebarCollapsed?: boolean;
  analysisHorizon?: string;
  theme?: 'light' | 'dark';
};

export interface UserCloudData {
  alerts: unknown[] | null;
  autoAlertRsiDivergence: boolean | null;
  modelWeights: Record<string, number> | null;
  trendlines: unknown;
  annotations: unknown;
  watchlist: WatchlistItem[] | null;
  portfolio: PortfolioHolding[] | null;
  signalCache: CachedSignalRow[] | null;
  prefs: AccountPrefs | null;
  updatedAt?: unknown;
}

export type UserDataSnapshot = {
  exists: boolean;
  data: UserCloudData;
};

const emptyData = (): UserCloudData => ({
  alerts: null,
  autoAlertRsiDivergence: null,
  modelWeights: null,
  trendlines: null,
  annotations: null,
  watchlist: null,
  portfolio: null,
  signalCache: null,
  prefs: null,
});

export function userDocId(emailOrUid: string): string {
  return emailOrUid.includes('@') ? emailOrUid.trim().toLowerCase() : emailOrUid;
}

function asArray<T>(value: unknown): T[] | null {
  return Array.isArray(value) ? (value as T[]) : null;
}

/** Firestore rejects `undefined` anywhere in the payload. Keep FieldValue/Timestamp intact. */
function isPlainObject(value: object): boolean {
  return Object.prototype.toString.call(value) === '[object Object]' && value.constructor === Object;
}

export function sanitizeForFirestore<T>(value: T): T {
  if (value === undefined) return undefined as T;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined) as T;
  }
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = sanitizeForFirestore(v);
  }
  return out as T;
}

export function parseUserCloudData(raw: Record<string, unknown> | undefined | null): UserCloudData {
  if (!raw || typeof raw !== 'object') return emptyData();
  const data = raw as Partial<UserCloudData> & Record<string, unknown>;
  return {
    alerts: asArray<unknown>(data.alerts),
    autoAlertRsiDivergence:
      typeof data.autoAlertRsiDivergence === 'boolean' ? data.autoAlertRsiDivergence : null,
    modelWeights:
      data.modelWeights && typeof data.modelWeights === 'object'
        ? (data.modelWeights as Record<string, number>)
        : null,
    trendlines: Array.isArray(data.trendlines) ? data.trendlines : data.trendlines ?? null,
    annotations: Array.isArray(data.annotations) ? data.annotations : data.annotations ?? null,
    watchlist: asArray<WatchlistItem>(data.watchlist),
    portfolio: asArray<PortfolioHolding>(data.portfolio),
    signalCache: asArray<CachedSignalRow>(data.signalCache),
    prefs: data.prefs && typeof data.prefs === 'object' ? (data.prefs as AccountPrefs) : null,
  };
}

/** Stable hash of account fields — used to ignore our own write echoes. */
function stableValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value ?? null;
  if (Array.isArray(value)) return value.map(stableValue);
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = stableValue(obj[k]);
  return out;
}

export function accountSyncFingerprint(data: Partial<UserCloudData>): string {
  return JSON.stringify(
    stableValue({
      alerts: data.alerts ?? null,
      autoAlertRsiDivergence: data.autoAlertRsiDivergence ?? null,
      modelWeights: data.modelWeights ?? null,
      trendlines: data.trendlines ?? null,
      annotations: data.annotations ?? null,
      watchlist: data.watchlist ?? null,
      portfolio: data.portfolio ?? null,
      signalCache: data.signalCache ?? null,
      prefs: data.prefs ?? null,
    })
  );
}

export async function loadUserData(emailOrUid: string): Promise<UserCloudData> {
  const ref = doc(db, 'users', userDocId(emailOrUid));
  const snap = await getDoc(ref);
  if (!snap.exists()) return emptyData();
  return parseUserCloudData(snap.data() as Record<string, unknown>);
}

export function subscribeUserData(
  emailOrUid: string,
  onData: (snap: UserDataSnapshot) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const ref = doc(db, 'users', userDocId(emailOrUid));
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData({ exists: false, data: emptyData() });
        return;
      }
      onData({
        exists: true,
        data: parseUserCloudData(snap.data() as Record<string, unknown>),
      });
    },
    (err) => {
      onError?.(err);
    }
  );
}

export async function saveUserData(emailOrUid: string, data: Partial<UserCloudData>): Promise<void> {
  const ref = doc(db, 'users', userDocId(emailOrUid));
  const cleaned = sanitizeForFirestore({
    ...data,
    updatedAt: serverTimestamp(),
  }) as Record<string, unknown>;
  await setDoc(ref, cleaned, { merge: true });
}
