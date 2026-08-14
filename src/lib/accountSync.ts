/**
 * Same-account sync: localStorage mirrors + Firestore for signed-in subscribers.
 * Stores notify after local writes; App hydrates from cloud and persists back.
 */

export const ACCOUNT_DATA_EVENT = 'qn-account-data';

export type AccountDataKind =
  | 'watchlist'
  | 'portfolio'
  | 'signals'
  | 'alerts'
  | 'prefs'
  | 'all';

export function notifyAccountDataChanged(kind: AccountDataKind = 'all') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(ACCOUNT_DATA_EVENT, { detail: { kind, at: Date.now() } })
  );
}

export function subscribeAccountDataChanged(
  handler: (kind: AccountDataKind) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const onEvent = (ev: Event) => {
    const detail = (ev as CustomEvent).detail as { kind?: AccountDataKind } | undefined;
    handler(detail?.kind || 'all');
  };
  window.addEventListener(ACCOUNT_DATA_EVENT, onEvent);
  return () => window.removeEventListener(ACCOUNT_DATA_EVENT, onEvent);
}
