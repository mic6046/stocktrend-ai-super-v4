/**
 * Absolute API base for production (Cloud Run) or empty for same-origin local dev.
 */
export const DEFAULT_PRODUCTION_API_BASE =
  'https://stocktrend-ai-357117913612.us-central1.run.app';

export function getApiBase(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  // On Firebase Hosting / App Hosting, call Cloud Run directly so /api
  // never falls through to the SPA HTML shell.
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (
      host.endsWith('web.app') ||
      host.endsWith('firebaseapp.com') ||
      host.endsWith('hosted.app') ||
      host.endsWith('run.app')
    ) {
      return DEFAULT_PRODUCTION_API_BASE;
    }
  }
  return '';
}

export function apiUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = getApiBase();
  const p = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${p}`;
}

export async function assertJsonResponse(res: Response): Promise<Response> {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/html')) {
    const preview = (await res.clone().text()).slice(0, 80);
    throw new Error(
      `API returned HTML instead of JSON (${res.status}). Check backend routing. Preview: ${preview}`
    );
  }
  return res;
}

export type ApiRequestMeta = {
  /** Why this call exists (e.g. quote refresh, stock search) */
  reason?: string;
  /** Explicit user action that caused it (e.g. Click Refresh, Search stock) */
  userAction?: string;
  /** Legacy alias for reason */
  trigger?: string;
};

type LoggedInit = RequestInit & {
  __qnMeta?: ApiRequestMeta;
  /** @deprecated use __qnMeta.reason */
  __qnTrigger?: string;
};

/** In-flight duplicate suppression keyed by method+url (same request ignored while pending). */
const inflightByKey = new Map<string, Promise<Response>>();

function shouldLogApi(): boolean {
  const isDev = Boolean((import.meta as any)?.env?.DEV);
  return isDev || (typeof window !== 'undefined' && (window as any).__QN_LOG_API__ === true);
}

function logApiRequest(method: string, url: string, meta: ApiRequestMeta) {
  if (!shouldLogApi()) return;
  console.log('API Request', {
    Endpoint: url,
    Method: method,
    Timestamp: new Date().toISOString(),
    Reason: meta.reason || meta.trigger || 'unspecified',
    UserAction: meta.userAction || 'unspecified',
  });
}

/**
 * Dev-traced fetch. Logs every outbound request for cost verification.
 * Dedupes identical in-flight GET requests (same method+url).
 */
export async function loggedFetch(input: RequestInfo | URL, init?: LoggedInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : String(input);
  const method = (init?.method || 'GET').toUpperCase();
  const meta: ApiRequestMeta = {
    ...(init?.__qnMeta || {}),
  };
  if (!meta.reason && !meta.trigger && init?.__qnTrigger) {
    meta.reason = init.__qnTrigger;
    meta.trigger = init.__qnTrigger;
  }

  const cleanInit: RequestInit | undefined = init
    ? (() => {
        const { __qnMeta, __qnTrigger, ...rest } = init;
        return rest;
      })()
    : undefined;

  logApiRequest(method, url, meta);

  // Deduplicate concurrent identical GETs (prevents double-click / re-render storms)
  const dedupe = method === 'GET';
  const key = dedupe ? `${method} ${url}` : '';
  if (dedupe && inflightByKey.has(key)) {
    if (shouldLogApi()) {
      console.log('API Request suppressed (duplicate in-flight)', { Endpoint: url, Method: method });
    }
    return inflightByKey.get(key)!.then((r) => r.clone());
  }

  const pending = fetch(input, cleanInit).finally(() => {
    if (dedupe) inflightByKey.delete(key);
  });
  if (dedupe) inflightByKey.set(key, pending);

  return pending;
}

/** fetch wrapper that always hits the configured API base */
export async function apiFetch(input: string, init?: LoggedInit): Promise<Response> {
  const res = await loggedFetch(apiUrl(input), init);
  return assertJsonResponse(res);
}

/** Global market-data refresh lock — ignore extra Refresh clicks while busy. */
let marketRefreshBusy = false;

export function isMarketRefreshBusy(): boolean {
  return marketRefreshBusy;
}

export async function withMarketRefreshLock<T>(fn: () => Promise<T>): Promise<T | undefined> {
  if (marketRefreshBusy) {
    if (shouldLogApi()) {
      console.log('API Request suppressed (refresh already running)', {
        Timestamp: new Date().toISOString(),
        Reason: 'duplicate-refresh-guard',
        UserAction: 'ignored',
      });
    }
    return undefined;
  }
  marketRefreshBusy = true;
  try {
    return await fn();
  } finally {
    marketRefreshBusy = false;
  }
}
