import { notifyAccountDataChanged } from './accountSync';

export type PriceAlert = {
  id: string;
  ticker: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  currentPriceAtCreation: number;
  createdAt: number;
  isTriggered: boolean;
  triggeredAt?: number;
  triggeredPrice?: number;
  alertType?: 'PRICE' | 'RSI' | 'RSI_DIVERGENCE';
  rsiTargetType?: 'VALUE' | 'TREND' | 'DIVERGENCE';
  soundEffect?: string;
  consecutiveBars?: number;
  divergenceType?: 'BULLISH' | 'BEARISH';
};

const KEY = 'quantum_price_alerts';
const UPDATED_KEY = 'qn-alerts-updated-at';

export function normalizeAlert(raw: Partial<PriceAlert> | null | undefined): PriceAlert | null {
  if (!raw || typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (typeof raw.ticker !== 'string' || !raw.ticker.trim()) return null;
  const condition = raw.condition === 'BELOW' ? 'BELOW' : 'ABOVE';
  const alert: PriceAlert = {
    id: String(raw.id).trim(),
    ticker: String(raw.ticker).trim().toUpperCase(),
    targetPrice: Number(raw.targetPrice) || 0,
    condition,
    currentPriceAtCreation: Number(raw.currentPriceAtCreation) || 0,
    createdAt: typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
    isTriggered: Boolean(raw.isTriggered),
  };
  if (typeof raw.triggeredAt === 'number') alert.triggeredAt = raw.triggeredAt;
  if (typeof raw.triggeredPrice === 'number') alert.triggeredPrice = raw.triggeredPrice;
  if (raw.alertType === 'PRICE' || raw.alertType === 'RSI' || raw.alertType === 'RSI_DIVERGENCE') {
    alert.alertType = raw.alertType;
  }
  if (raw.rsiTargetType === 'VALUE' || raw.rsiTargetType === 'TREND' || raw.rsiTargetType === 'DIVERGENCE') {
    alert.rsiTargetType = raw.rsiTargetType;
  }
  if (typeof raw.soundEffect === 'string') alert.soundEffect = raw.soundEffect;
  if (typeof raw.consecutiveBars === 'number') alert.consecutiveBars = raw.consecutiveBars;
  if (raw.divergenceType === 'BULLISH' || raw.divergenceType === 'BEARISH') {
    alert.divergenceType = raw.divergenceType;
  }
  return alert;
}

export function normalizeAlerts(items: unknown): PriceAlert[] {
  if (!Array.isArray(items)) return [];
  const map = new Map<string, PriceAlert>();
  for (const raw of items) {
    const item = normalizeAlert(raw as Partial<PriceAlert>);
    if (!item) continue;
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
      continue;
    }
    const prevTs = Math.max(prev.createdAt, prev.triggeredAt || 0);
    const nextTs = Math.max(item.createdAt, item.triggeredAt || 0);
    if (nextTs >= prevTs) map.set(item.id, item);
  }
  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function alertsFingerprint(items: PriceAlert[]): string {
  return JSON.stringify(
    normalizeAlerts(items).map((a) => ({
      id: a.id,
      ticker: a.ticker,
      targetPrice: a.targetPrice,
      condition: a.condition,
      createdAt: a.createdAt,
      isTriggered: a.isTriggered,
      triggeredAt: a.triggeredAt || 0,
      alertType: a.alertType || 'PRICE',
    }))
  );
}

export function mergeAlerts(a: PriceAlert[], b: PriceAlert[]): PriceAlert[] {
  return normalizeAlerts([...normalizeAlerts(a), ...normalizeAlerts(b)]);
}

export function loadLocalAlertsUpdatedAt(): number {
  try {
    const n = Number(localStorage.getItem(UPDATED_KEY) || '0');
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function saveLocalAlertsUpdatedAt(ts: number) {
  try {
    localStorage.setItem(UPDATED_KEY, String(ts));
  } catch {
    /* ignore */
  }
}

export function loadAlerts(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return normalizeAlerts(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveAlerts(items: PriceAlert[], opts?: { silent?: boolean }) {
  const normalized = normalizeAlerts(items);
  try {
    localStorage.setItem(KEY, JSON.stringify(normalized));
  } catch {
    /* ignore */
  }
  if (!opts?.silent) {
    saveLocalAlertsUpdatedAt(Date.now());
    notifyAccountDataChanged('alerts');
  }
}
