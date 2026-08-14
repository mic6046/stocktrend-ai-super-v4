import { doc, onSnapshot, setDoc, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { notifyAccountDataChanged } from './accountSync';
import {
  loadAlerts,
  saveAlerts,
  normalizeAlerts,
  alertsFingerprint,
  mergeAlerts,
  loadLocalAlertsUpdatedAt,
  saveLocalAlertsUpdatedAt,
  type PriceAlert,
} from './alertsStore';
import {
  bindMobileResume,
  readMillisField,
  userDocIdFromEmail,
  type FieldSyncStatus,
} from './deviceSyncShared';

export type AlertsSyncStatus = FieldSyncStatus;

export type AlertsSyncHandles = {
  stop: () => void;
  pushNow: () => Promise<void>;
  pullNow: () => Promise<void>;
};

export function startAlertsCloudSync(
  email: string,
  opts?: { onStatus?: (status: AlertsSyncStatus, detail?: string) => void }
): AlertsSyncHandles {
  const id = userDocIdFromEmail(email);
  const ref = doc(db, 'users', id);
  let stopped = false;
  let writing = false;
  let pendingReconcile: { list: PriceAlert[] | null; updatedAt: number } | null = null;
  let lastCloudFp = '';
  let lastCloudUpdatedAt = 0;
  let latestCloudList: PriceAlert[] | null = null;
  let pushTimer: number | null = null;

  const setStatus = (status: AlertsSyncStatus, detail?: string) => opts?.onStatus?.(status, detail);

  const writeCloud = async (items: PriceAlert[], updatedAt: number) => {
    if (stopped) return;
    const normalized = normalizeAlerts(items);
    const fp = alertsFingerprint(normalized);
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
          alerts: normalized,
          alertsUpdatedAt: updatedAt,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      lastCloudFp = fp;
      lastCloudUpdatedAt = updatedAt;
      latestCloudList = normalized;
      setStatus('synced');
    } catch (err) {
      console.error('[alerts-sync] save failed:', err);
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

  const applyToLocal = (items: PriceAlert[], updatedAt: number) => {
    if (alertsFingerprint(items) !== alertsFingerprint(loadAlerts())) {
      saveAlerts(items, { silent: true });
      notifyAccountDataChanged('alerts', 'remote');
    }
    saveLocalAlertsUpdatedAt(updatedAt);
  };

  const reconcileFromCloud = async (
    cloudList: PriceAlert[] | null,
    cloudUpdatedAt: number,
    allowUpload: boolean
  ) => {
    if (stopped) return;
    if (writing) {
      pendingReconcile = { list: cloudList, updatedAt: cloudUpdatedAt };
      return;
    }

    const local = loadAlerts();
    const localUpdatedAt = loadLocalAlertsUpdatedAt();
    const remote = cloudList ? normalizeAlerts(cloudList) : null;
    latestCloudList = remote;

    if (remote === null) {
      if (local.length > 0 && allowUpload) {
        const ts = Math.max(localUpdatedAt, Date.now());
        saveLocalAlertsUpdatedAt(ts);
        await writeCloud(local, ts);
      } else setStatus('synced');
      return;
    }

    const remoteFp = alertsFingerprint(remote);
    lastCloudFp = remoteFp;
    lastCloudUpdatedAt = cloudUpdatedAt;

    if (remoteFp === alertsFingerprint(local)) {
      saveLocalAlertsUpdatedAt(Math.max(localUpdatedAt, cloudUpdatedAt || localUpdatedAt));
      setStatus('synced');
      return;
    }

    if (!cloudUpdatedAt || !localUpdatedAt) {
      const merged = mergeAlerts(local, remote);
      const ts = Date.now();
      applyToLocal(merged, ts);
      if (allowUpload && alertsFingerprint(merged) !== remoteFp) await writeCloud(merged, ts);
      else setStatus('synced');
      return;
    }

    if (cloudUpdatedAt > localUpdatedAt) {
      const newerLocal = local.filter((x) => Math.max(x.createdAt, x.triggeredAt || 0) > cloudUpdatedAt);
      const merged = newerLocal.length ? mergeAlerts(remote, newerLocal) : remote;
      applyToLocal(merged, Math.max(cloudUpdatedAt, loadLocalAlertsUpdatedAt()));
      if (allowUpload && alertsFingerprint(merged) !== remoteFp) {
        const ts = Date.now();
        saveLocalAlertsUpdatedAt(ts);
        await writeCloud(merged, ts);
      } else setStatus('synced');
      return;
    }

    const newerRemote = remote.filter((x) => Math.max(x.createdAt, x.triggeredAt || 0) > localUpdatedAt);
    const merged = newerRemote.length ? mergeAlerts(local, newerRemote) : local;
    applyToLocal(merged, Math.max(localUpdatedAt, Date.now()));
    if (allowUpload) {
      const ts = Math.max(localUpdatedAt, Date.now());
      saveLocalAlertsUpdatedAt(ts);
      await writeCloud(merged, ts);
    } else setStatus('synced');
  };

  setStatus('connecting');
  const unsubSnap: Unsubscribe = onSnapshot(
    ref,
    (snap) => {
      if (stopped) return;
      const raw = snap.exists() ? (snap.data() as Record<string, unknown>) : undefined;
      const list = raw && Array.isArray(raw.alerts) ? normalizeAlerts(raw.alerts) : null;
      void reconcileFromCloud(list, readMillisField(raw, 'alertsUpdatedAt'), true).catch((err) => {
        console.error('[alerts-sync] reconcile failed:', err);
        setStatus('error');
      });
    },
    (err) => {
      console.error('[alerts-sync] listener failed:', err);
      setStatus('error', err.message);
    }
  );

  const pushNow = async () => {
    if (stopped) return;
    const local = loadAlerts();
    const ts = Math.max(loadLocalAlertsUpdatedAt(), Date.now());
    saveLocalAlertsUpdatedAt(ts);
    await writeCloud(local, ts);
  };

  const pullNow = async () => {
    if (stopped) return;
    if (latestCloudList) await reconcileFromCloud(latestCloudList, lastCloudUpdatedAt, true);
    else if (loadAlerts().length > 0) await pushNow();
  };

  const onAccountEvent = (ev: Event) => {
    const detail = (ev as CustomEvent).detail as { kind?: string; source?: string } | undefined;
    if (detail?.source === 'remote') return;
    if (detail?.kind !== 'alerts' && detail?.kind !== 'all') return;
    saveLocalAlertsUpdatedAt(Date.now());
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
