import { doc, onSnapshot, setDoc, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { notifyAccountDataChanged } from './accountSync';
import {
  loadWatchlist,
  saveWatchlist,
  normalizeWatchlist,
  watchlistFingerprint,
  type WatchlistItem,
} from './watchlistStore';

const LOCAL_UPDATED_KEY = 'qn-watchlist-updated-at';

export type WatchlistSyncStatus = 'idle' | 'connecting' | 'synced' | 'saving' | 'error';

function userDocId(email: string): string {
  return email.trim().toLowerCase();
}

export function loadLocalWatchlistUpdatedAt(): number {
  try {
    const n = Number(localStorage.getItem(LOCAL_UPDATED_KEY) || '0');
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function saveLocalWatchlistUpdatedAt(ts: number) {
  try {
    localStorage.setItem(LOCAL_UPDATED_KEY, String(ts));
  } catch {
    /* ignore */
  }
}

/** Union by ticker; keep the newer addedAt (and name if present). */
export function mergeWatchlists(a: WatchlistItem[], b: WatchlistItem[]): WatchlistItem[] {
  const map = new Map<string, WatchlistItem>();
  for (const list of [a, b]) {
    for (const item of normalizeWatchlist(list)) {
      const prev = map.get(item.ticker);
      if (!prev || item.addedAt >= prev.addedAt) {
        map.set(item.ticker, {
          ticker: item.ticker,
          addedAt: Math.max(prev?.addedAt || 0, item.addedAt),
          ...(item.name || prev?.name ? { name: item.name || prev?.name } : {}),
        });
      } else if (!prev.name && item.name) {
        map.set(item.ticker, { ...prev, name: item.name });
      }
    }
  }
  return Array.from(map.values()).sort((x, y) => y.addedAt - x.addedAt);
}

function readCloudUpdatedAt(raw: Record<string, unknown> | undefined): number {
  const v = raw?.watchlistUpdatedAt;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v && typeof v === 'object' && typeof (v as { toMillis?: () => number }).toMillis === 'function') {
    try {
      return (v as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }
  return 0;
}

export type WatchlistSyncHandles = {
  stop: () => void;
  pushNow: () => Promise<void>;
  pullNow: () => Promise<void>;
};

/**
 * Dedicated watchlist sync — not tied to the full account-blob suppress/fingerprint path.
 * Critical for phone↔PC: resumes on visibility/online and merges first-link conflicts.
 */
export function startWatchlistCloudSync(
  email: string,
  opts?: {
    onStatus?: (status: WatchlistSyncStatus, detail?: string) => void;
  }
): WatchlistSyncHandles {
  const id = userDocId(email);
  const ref = doc(db, 'users', id);
  let stopped = false;
  let writing = false;
  let pendingReconcile: { list: WatchlistItem[] | null; updatedAt: number } | null = null;
  let lastCloudFp = '';
  let lastCloudUpdatedAt = 0;
  let latestCloudList: WatchlistItem[] | null = null;
  let pushTimer: number | null = null;

  const setStatus = (status: WatchlistSyncStatus, detail?: string) => {
    opts?.onStatus?.(status, detail);
  };

  const writeCloud = async (items: WatchlistItem[], updatedAt: number) => {
    if (stopped) return;
    const normalized = normalizeWatchlist(items);
    const fp = watchlistFingerprint(normalized);
    if (fp === lastCloudFp && updatedAt <= lastCloudUpdatedAt) {
      setStatus('synced');
      return;
    }
    writing = true;
    setStatus('saving');
    try {
      await setDoc(
        ref,
        {
          watchlist: normalized,
          watchlistUpdatedAt: updatedAt,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      lastCloudFp = fp;
      lastCloudUpdatedAt = updatedAt;
      latestCloudList = normalized;
      setStatus('synced');
    } catch (err) {
      console.error('[watchlist-sync] save failed:', err);
      setStatus('error', err instanceof Error ? err.message : 'save failed');
      throw err;
    } finally {
      writing = false;
      if (pendingReconcile) {
        const next = pendingReconcile;
        pendingReconcile = null;
        void reconcileFromCloud(next.list, next.updatedAt, true);
      }
    }
  };

  const applyToLocal = (items: WatchlistItem[], updatedAt: number) => {
    const fp = watchlistFingerprint(items);
    if (fp !== watchlistFingerprint(loadWatchlist())) {
      saveWatchlist(items, { silent: true });
      notifyAccountDataChanged('watchlist', 'remote');
    }
    saveLocalWatchlistUpdatedAt(updatedAt);
  };

  const reconcileFromCloud = async (
    cloudList: WatchlistItem[] | null,
    cloudUpdatedAt: number,
    allowUpload: boolean
  ) => {
    if (stopped) return;
    if (writing) {
      pendingReconcile = { list: cloudList, updatedAt: cloudUpdatedAt };
      return;
    }

    const local = loadWatchlist();
    const localUpdatedAt = loadLocalWatchlistUpdatedAt();
    const remote = cloudList ? normalizeWatchlist(cloudList) : null;
    latestCloudList = remote;

    if (remote === null) {
      if (local.length > 0 && allowUpload) {
        const ts = Math.max(localUpdatedAt, Date.now());
        saveLocalWatchlistUpdatedAt(ts);
        await writeCloud(local, ts);
      } else {
        setStatus('synced');
      }
      return;
    }

    const remoteFp = watchlistFingerprint(remote);
    lastCloudFp = remoteFp;
    lastCloudUpdatedAt = cloudUpdatedAt;

    if (remoteFp === watchlistFingerprint(local)) {
      saveLocalWatchlistUpdatedAt(Math.max(localUpdatedAt, cloudUpdatedAt || localUpdatedAt));
      setStatus('synced');
      return;
    }

    // First link / missing timestamps → keep tickers from both devices
    if (!cloudUpdatedAt || !localUpdatedAt) {
      const merged = mergeWatchlists(local, remote);
      const ts = Date.now();
      applyToLocal(merged, ts);
      if (allowUpload && watchlistFingerprint(merged) !== remoteFp) {
        await writeCloud(merged, ts);
      } else {
        setStatus('synced');
      }
      return;
    }

    if (cloudUpdatedAt > localUpdatedAt) {
      // Cloud wins, but keep local adds that happened after that cloud stamp
      const newerLocal = local.filter((x) => x.addedAt > cloudUpdatedAt);
      const merged = newerLocal.length ? mergeWatchlists(remote, newerLocal) : remote;
      applyToLocal(merged, Math.max(cloudUpdatedAt, loadLocalWatchlistUpdatedAt()));
      if (allowUpload && watchlistFingerprint(merged) !== remoteFp) {
        const ts = Date.now();
        saveLocalWatchlistUpdatedAt(ts);
        await writeCloud(merged, ts);
      } else {
        setStatus('synced');
      }
      return;
    }

    // Local newer — still absorb cloud-only tickers added after local stamp
    const newerRemote = remote.filter((x) => x.addedAt > localUpdatedAt);
    const merged = newerRemote.length ? mergeWatchlists(local, newerRemote) : local;
    applyToLocal(merged, Math.max(localUpdatedAt, Date.now()));
    if (allowUpload) {
      const ts = Math.max(localUpdatedAt, Date.now());
      saveLocalWatchlistUpdatedAt(ts);
      await writeCloud(merged, ts);
    } else {
      setStatus('synced');
    }
  };

  setStatus('connecting');

  const unsubSnap: Unsubscribe = onSnapshot(
    ref,
    (snap) => {
      if (stopped) return;
      const raw = snap.exists() ? (snap.data() as Record<string, unknown>) : undefined;
      const list = raw && Array.isArray(raw.watchlist) ? normalizeWatchlist(raw.watchlist) : null;
      const updatedAt = readCloudUpdatedAt(raw);
      void reconcileFromCloud(list, updatedAt, true).catch((err) => {
        console.error('[watchlist-sync] reconcile failed:', err);
        setStatus('error');
      });
    },
    (err) => {
      console.error('[watchlist-sync] listener failed:', err);
      setStatus('error', err.message);
    }
  );

  const pushNow = async () => {
    if (stopped) return;
    const local = loadWatchlist();
    const ts = Math.max(loadLocalWatchlistUpdatedAt(), Date.now());
    saveLocalWatchlistUpdatedAt(ts);
    await writeCloud(local, ts);
  };

  const pullNow = async () => {
    if (stopped) return;
    if (latestCloudList) {
      await reconcileFromCloud(latestCloudList, lastCloudUpdatedAt, true);
    } else {
      const local = loadWatchlist();
      if (local.length > 0) await pushNow();
    }
  };

  const schedulePush = () => {
    if (pushTimer) window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(() => {
      void pushNow().catch(() => {});
    }, 250);
  };

  const onAccountEvent = (ev: Event) => {
    const detail = (ev as CustomEvent).detail as { kind?: string; source?: string } | undefined;
    if (detail?.source === 'remote') return;
    if (detail?.kind !== 'watchlist' && detail?.kind !== 'all') return;
    saveLocalWatchlistUpdatedAt(Date.now());
    schedulePush();
  };
  window.addEventListener('qn-account-data', onAccountEvent);

  const onResume = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    void pullNow().catch(() => {});
  };
  window.addEventListener('online', onResume);
  document.addEventListener('visibilitychange', onResume);
  window.addEventListener('focus', onResume);

  return {
    stop: () => {
      stopped = true;
      unsubSnap();
      window.removeEventListener('qn-account-data', onAccountEvent);
      window.removeEventListener('online', onResume);
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
      if (pushTimer) window.clearTimeout(pushTimer);
    },
    pushNow,
    pullNow,
  };
}
