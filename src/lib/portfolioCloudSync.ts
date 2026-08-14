import { doc, onSnapshot, setDoc, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { notifyAccountDataChanged } from './accountSync';
import {
  loadPortfolio,
  savePortfolio,
  normalizePortfolio,
  portfolioFingerprint,
  mergePortfolios,
  loadLocalPortfolioUpdatedAt,
  saveLocalPortfolioUpdatedAt,
  type PortfolioHolding,
} from './portfolioStore';
import {
  bindMobileResume,
  readMillisField,
  userDocIdFromEmail,
  type FieldSyncStatus,
} from './deviceSyncShared';

export type PortfolioSyncStatus = FieldSyncStatus;

export type PortfolioSyncHandles = {
  stop: () => void;
  pushNow: () => Promise<void>;
  pullNow: () => Promise<void>;
};

export function startPortfolioCloudSync(
  email: string,
  opts?: { onStatus?: (status: PortfolioSyncStatus, detail?: string) => void }
): PortfolioSyncHandles {
  const id = userDocIdFromEmail(email);
  const ref = doc(db, 'users', id);
  let stopped = false;
  let writing = false;
  let pendingReconcile: { list: PortfolioHolding[] | null; updatedAt: number } | null = null;
  let lastCloudFp = '';
  let lastCloudUpdatedAt = 0;
  let latestCloudList: PortfolioHolding[] | null = null;
  let pushTimer: number | null = null;

  const setStatus = (status: PortfolioSyncStatus, detail?: string) => opts?.onStatus?.(status, detail);

  const writeCloud = async (items: PortfolioHolding[], updatedAt: number) => {
    if (stopped) return;
    const normalized = normalizePortfolio(items);
    const fp = portfolioFingerprint(normalized);
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
          portfolio: normalized,
          portfolioUpdatedAt: updatedAt,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      lastCloudFp = fp;
      lastCloudUpdatedAt = updatedAt;
      latestCloudList = normalized;
      setStatus('synced');
    } catch (err) {
      console.error('[portfolio-sync] save failed:', err);
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

  const applyToLocal = (items: PortfolioHolding[], updatedAt: number) => {
    if (portfolioFingerprint(items) !== portfolioFingerprint(loadPortfolio())) {
      savePortfolio(items, { silent: true });
      notifyAccountDataChanged('portfolio', 'remote');
    }
    saveLocalPortfolioUpdatedAt(updatedAt);
  };

  const reconcileFromCloud = async (
    cloudList: PortfolioHolding[] | null,
    cloudUpdatedAt: number,
    allowUpload: boolean
  ) => {
    if (stopped) return;
    if (writing) {
      pendingReconcile = { list: cloudList, updatedAt: cloudUpdatedAt };
      return;
    }

    const local = loadPortfolio();
    const localUpdatedAt = loadLocalPortfolioUpdatedAt();
    const remote = cloudList ? normalizePortfolio(cloudList) : null;
    latestCloudList = remote;

    if (remote === null) {
      if (local.length > 0 && allowUpload) {
        const ts = Math.max(localUpdatedAt, Date.now());
        saveLocalPortfolioUpdatedAt(ts);
        await writeCloud(local, ts);
      } else setStatus('synced');
      return;
    }

    const remoteFp = portfolioFingerprint(remote);
    lastCloudFp = remoteFp;
    lastCloudUpdatedAt = cloudUpdatedAt;

    if (remoteFp === portfolioFingerprint(local)) {
      saveLocalPortfolioUpdatedAt(Math.max(localUpdatedAt, cloudUpdatedAt || localUpdatedAt));
      setStatus('synced');
      return;
    }

    if (!cloudUpdatedAt || !localUpdatedAt) {
      const merged = mergePortfolios(local, remote);
      const ts = Date.now();
      applyToLocal(merged, ts);
      if (allowUpload && portfolioFingerprint(merged) !== remoteFp) await writeCloud(merged, ts);
      else setStatus('synced');
      return;
    }

    if (cloudUpdatedAt > localUpdatedAt) {
      const newerLocal = local.filter((x) => x.updatedAt > cloudUpdatedAt);
      const merged = newerLocal.length ? mergePortfolios(remote, newerLocal) : remote;
      applyToLocal(merged, Math.max(cloudUpdatedAt, loadLocalPortfolioUpdatedAt()));
      if (allowUpload && portfolioFingerprint(merged) !== remoteFp) {
        const ts = Date.now();
        saveLocalPortfolioUpdatedAt(ts);
        await writeCloud(merged, ts);
      } else setStatus('synced');
      return;
    }

    const newerRemote = remote.filter((x) => x.updatedAt > localUpdatedAt);
    const merged = newerRemote.length ? mergePortfolios(local, newerRemote) : local;
    applyToLocal(merged, Math.max(localUpdatedAt, Date.now()));
    if (allowUpload) {
      const ts = Math.max(localUpdatedAt, Date.now());
      saveLocalPortfolioUpdatedAt(ts);
      await writeCloud(merged, ts);
    } else setStatus('synced');
  };

  setStatus('connecting');
  const unsubSnap: Unsubscribe = onSnapshot(
    ref,
    (snap) => {
      if (stopped) return;
      const raw = snap.exists() ? (snap.data() as Record<string, unknown>) : undefined;
      const list = raw && Array.isArray(raw.portfolio) ? normalizePortfolio(raw.portfolio) : null;
      void reconcileFromCloud(list, readMillisField(raw, 'portfolioUpdatedAt'), true).catch((err) => {
        console.error('[portfolio-sync] reconcile failed:', err);
        setStatus('error');
      });
    },
    (err) => {
      console.error('[portfolio-sync] listener failed:', err);
      setStatus('error', err.message);
    }
  );

  const pushNow = async () => {
    if (stopped) return;
    const local = loadPortfolio();
    const ts = Math.max(loadLocalPortfolioUpdatedAt(), Date.now());
    saveLocalPortfolioUpdatedAt(ts);
    await writeCloud(local, ts);
  };

  const pullNow = async () => {
    if (stopped) return;
    if (latestCloudList) await reconcileFromCloud(latestCloudList, lastCloudUpdatedAt, true);
    else if (loadPortfolio().length > 0) await pushNow();
  };

  const onAccountEvent = (ev: Event) => {
    const detail = (ev as CustomEvent).detail as { kind?: string; source?: string } | undefined;
    if (detail?.source === 'remote') return;
    if (detail?.kind !== 'portfolio' && detail?.kind !== 'all') return;
    saveLocalPortfolioUpdatedAt(Date.now());
    if (pushTimer) window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(() => void pushNow().catch(() => {}), 250);
  };
  window.addEventListener('qn-account-data', onAccountEvent);
  const unbindResume = bindMobileResume(() => void pullNow().catch(() => {}));

  return {
    stop: () => {
      stopped = true;
      unsubSnap();
      window.removeEventListener('qn-account-data', onAccountEvent);
      unbindResume();
      if (pushTimer) window.clearTimeout(pushTimer);
    },
    pushNow,
    pullNow,
  };
}
