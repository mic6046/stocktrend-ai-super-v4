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

/** fetch wrapper that always hits the configured API base */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(apiUrl(input), init);
  return assertJsonResponse(res);
}
