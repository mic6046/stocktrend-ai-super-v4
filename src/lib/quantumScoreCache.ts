/**
 * Persist Quantum / Recommendation scores so Find a Trade can match the card
 * even after navigation (in-memory predictCache alone is not enough).
 */

export type PersistedQuantumHint = {
  ticker: string;
  recommendation?: string | null;
  score?: number | null;
  confidence?: number | null;
  expectedReturn?: number | null;
  price?: number | null;
  name?: string | null;
  updatedAt: number;
};

const STORAGE_KEY = 'qn-quantum-score-cache-v1';
const MAX_ENTRIES = 80;
const TTL_MS = 1000 * 60 * 60 * 36; // 36h

function readAll(): Record<string, PersistedQuantumHint> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PersistedQuantumHint>;
    if (!parsed || typeof parsed !== 'object') return {};
    const now = Date.now();
    const out: Record<string, PersistedQuantumHint> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!v || typeof v !== 'object') continue;
      if (v.updatedAt && now - v.updatedAt > TTL_MS) continue;
      out[k.toUpperCase()] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, PersistedQuantumHint>) {
  try {
    const entries = Object.entries(map).sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
    const trimmed = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore quota */
  }
}

export function loadPersistedQuantumHints(): Record<string, PersistedQuantumHint> {
  return readAll();
}

export function persistQuantumHint(hint: Omit<PersistedQuantumHint, 'updatedAt'> & { updatedAt?: number }) {
  const ticker = String(hint.ticker || '')
    .trim()
    .toUpperCase();
  if (!ticker) return;
  if (hint.score == null && !hint.recommendation) return;
  const map = readAll();
  const prev = map[ticker] || { ticker, updatedAt: 0 };
  map[ticker] = {
    ...prev,
    ...hint,
    ticker,
    updatedAt: hint.updatedAt || Date.now(),
  };
  writeAll(map);
}
