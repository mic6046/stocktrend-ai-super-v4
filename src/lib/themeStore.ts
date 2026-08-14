import { notifyAccountDataChanged } from './accountSync';

export type AppTheme = 'light' | 'dark';

const KEY = 'qn-app-theme';

export function loadAppTheme(): AppTheme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  return 'dark';
}

export function applyAppTheme(theme: AppTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  root.style.colorScheme = theme;
  try {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f6f8' : '#050505');
  } catch {
    /* ignore */
  }
}

export function saveAppTheme(theme: AppTheme, opts?: { silent?: boolean }) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
  applyAppTheme(theme);
  if (!opts?.silent) notifyAccountDataChanged('prefs');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('qn-theme', { detail: { theme } }));
  }
}

/** Call once at boot (before React paint if possible). */
export function initAppTheme(): AppTheme {
  const theme = loadAppTheme();
  applyAppTheme(theme);
  return theme;
}

export function subscribeAppTheme(handler: (theme: AppTheme) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onEvent = (ev: Event) => {
    const detail = (ev as CustomEvent).detail as { theme?: AppTheme } | undefined;
    handler(detail?.theme === 'light' ? 'light' : loadAppTheme());
  };
  window.addEventListener('qn-theme', onEvent);
  return () => window.removeEventListener('qn-theme', onEvent);
}
