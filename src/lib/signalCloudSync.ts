import { doc, onSnapshot, setDoc, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { notifyAccountDataChanged } from './accountSync';
import {
  loadSignalCache,
  saveSignalCache,
  normalizeSignalCache,
  signalCacheFingerprint,
  mergeSignalCaches,
  loadLocalSignalCacheUpdatedAt,
  saveLocalSignalCacheUpdatedAt,
  type CachedSignalRow,
} from './signalCache';

export type SignalSyncStatus = 'idle' | 'connecting' | 'synced' | 'saving' | 'error';

function userDocId(email: string): string {
  return email.trim().toLowerCase();
}

function readCloudUpdatedAt(raw: Record<string, unknown> | undefined): number {
  const v = raw?.signalCacheUpdatedAt;
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

export type SignalSyncHandles = {
  stop: () => void;
  pushNow: () => Promise<void>;
  pullNow: () => Promise<void>;
};

/**
 * Dedicated AI Signals (signalCache) sync for phone ↔ PC.
 * Same pattern as watchlistCloudSync — not tied to full-account suppress/fingerprint.
 */
export function startSignalCloudSync(
  email: string,
  opts?: {
    onStatus?: (status: SignalSyncStatus, detail?: string) => void;
  }
): SignalSyncHandles {
  const id = userDocId(email);
  const ref = doc(db, 'users', id);
  let stopped = false;
  let writing = false;
  let pendingReconcile: { list: CachedSignalRow[] | null; updatedAt: number } | null = null;
  let lastCloudFp = '';
  let lastCloudUpdatedAt = 0;
  let latestCloudList: CachedSignalRow[] | null = null;
  let pushTimer: number | null = null;

  const setStatus = (status: SignalSyncStatus, detail?: string) => {
    opts?.onStatus?.(status, detail);
  };

  const writeCloud = async (items: CachedSignalRow[], updatedAt: number) => {
    if (stopped) return;
    const normalized = normalizeSignalCache(items);
    const fp = signalCacheFingerprint(normalized);
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
          signalCache: normalized,
          signalCacheUpdatedAt: updatedAt,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      lastCloudFp = fp;
      lastCloudUpdatedAt = updatedAt;
      latestCloudList = normalized;
      setStatus('synced');
    } catch (err) {
      console.error('[signal-sync] save failed:', err);
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

  const applyToLocal = (items: CachedSignalRow[], updatedAt: number) => {
    const fp = signalCacheFingerprint(items);
    if (fp !== signalCacheFingerprint(loadSignalCache())) {
      saveSignalCache(items, { silent: true });
      notifyAccountDataChanged('signals', 'remote');
    }
    saveLocalSignalCacheUpdatedAt(updatedAt);
  };

  const reconcileFromCloud = async (
    cloudList: CachedSignalRow[] | null,
    cloudUpdatedAt: number,
    allowUpload: boolean
  ) => {
    if (stopped) return;
    if (writing) {
      pendingReconcile = { list: cloudList, updatedAt: cloudUpdatedAt };
      return;
    }

    const local = loadSignalCache();
    const localUpdatedAt = loadLocalSignalCacheUpdatedAt();
    const remote = cloudList ? normalizeSignalCache(cloudList) : null;
    latestCloudList = remote;

    if (remote === null) {
      if (local.length > 0 && allowUpload) {
        const ts = Math.max(localUpdatedAt, Date.now());
        saveLocalSignalCacheUpdatedAt(ts);
        await writeCloud(local, ts);
      } else {
        setStatus('synced');
      }
      return;
    }

    const remoteFp = signalCacheFingerprint(remote);
    lastCloudFp = remoteFp;
    lastCloudUpdatedAt = cloudUpdatedAt;

    if (remoteFp === signalCacheFingerprint(local)) {
      saveLocalSignalCacheUpdatedAt(Math.max(localUpdatedAt, cloudUpdatedAt || localUpdatedAt));
      setStatus('synced');
      return;
    }

    // First link / missing timestamps → keep rows from both devices
    if (!cloudUpdatedAt || !localUpdatedAt) {
      const merged = mergeSignalCaches(local, remote);
      const ts = Date.now();
      applyToLocal(merged, ts);
      if (allowUpload && signalCacheFingerprint(merged) !== remoteFp) {
        await writeCloud(merged, ts);
      } else {
        setStatus('synced');
      }
      return;
    }

    if (cloudUpdatedAt > localUpdatedAt) {
      const newerLocal = local.filter((x) => (x.updatedAt || 0) > cloudUpdatedAt);
      const merged = newerLocal.length ? mergeSignalCaches(remote, newerLocal) : remote;
      applyToLocal(merged, Math.max(cloudUpdatedAt, loadLocalSignalCacheUpdatedAt()));
      if (allowUpload && signalCacheFingerprint(merged) !== remoteFp) {
        const ts = Date.now();
        saveLocalSignalCacheUpdatedAt(ts);
        await writeCloud(merged, ts);
      } else {
        setStatus('synced');
      }
      return;
    }

    const newerRemote = remote.filter((x) => (x.updatedAt || 0) > localUpdatedAt);
    const merged = newerRemote.length ? mergeSignalCaches(local, newerRemote) : local;
    applyToLocal(merged, Math.max(localUpdatedAt, Date.now()));
    if (allowUpload) {
      const ts = Math.max(localUpdatedAt, Date.now());
      saveLocalSignalCacheUpdatedAt(ts);
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
      const list = raw && Array.isArray(raw.signalCache) ? normalizeSignalCache(raw.signalCache) : null;
      const updatedAt = readCloudUpdatedAt(raw);
      void reconcileFromCloud(list, updatedAt, true).catch((err) => {
        console.error('[signal-sync] reconcile failed:', err);
        setStatus('error');
      });
    },
    (err) => {
      console.error('[signal-sync] listener failed:', err);
      setStatus('error', err.message);
    }
  );

  const pushNow = async () => {
    if (stopped) return;
    const local = loadSignalCache();
    const ts = Math.max(loadLocalSignalCacheUpdatedAt(), Date.now());
    saveLocalSignalCacheUpdatedAt(ts);
    await writeCloud(local, ts);
  };

  const pullNow = async () => {
    if (stopped) return;
    if (latestCloudList) {
      await reconcileFromCloud(latestCloudList, lastCloudUpdatedAt, true);
    } else {
      const local = loadSignalCache();
      if (local.length > 0) await pushNow();
    }
  };

  const schedulePush = () => {
    if (pushTimer) window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(() => {
      void pushNow().catch(() => {});
    }, 280);
  };

  const onAccountEvent = (ev: Event) => {
    const detail = (ev as CustomEvent).detail as { kind?: string; source?: string } | undefined;
    if (detail?.source === 'remote') return;
    if (detail?.kind !== 'signals' && detail?.kind !== 'all') return;
    saveLocalSignalCacheUpdatedAt(Date.now());
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
