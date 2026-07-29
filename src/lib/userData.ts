import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface UserCloudData {
  alerts: unknown[];
  autoAlertRsiDivergence: boolean;
  modelWeights: Record<string, number> | null;
  trendlines: unknown;
  annotations: unknown;
  updatedAt?: unknown;
}

const emptyData = (): UserCloudData => ({
  alerts: [],
  autoAlertRsiDivergence: false,
  modelWeights: null,
  trendlines: null,
  annotations: null,
});

function userDocId(emailOrUid: string): string {
  return emailOrUid.includes('@') ? emailOrUid.trim().toLowerCase() : emailOrUid;
}

export async function loadUserData(emailOrUid: string): Promise<UserCloudData> {
  const ref = doc(db, 'users', userDocId(emailOrUid));
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return emptyData();
  }
  const data = snap.data() as Partial<UserCloudData>;
  return {
    alerts: Array.isArray(data.alerts) ? data.alerts : [],
    autoAlertRsiDivergence: Boolean(data.autoAlertRsiDivergence),
    modelWeights: data.modelWeights ?? null,
    trendlines: data.trendlines ?? null,
    annotations: data.annotations ?? null,
  };
}

export async function saveUserData(emailOrUid: string, data: Partial<UserCloudData>): Promise<void> {
  const ref = doc(db, 'users', userDocId(emailOrUid));
  await setDoc(
    ref,
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
