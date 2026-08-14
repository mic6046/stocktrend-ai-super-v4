export type ManualSectionId =
  | 'start'
  | 'dashboard'
  | 'find'
  | 'signals'
  | 'watchlist'
  | 'portfolio'
  | 'analysis'
  | 'news'
  | 'alerts'
  | 'settings'
  | 'sync'
  | 'credits'
  | 'risk';

export const MANUAL_UPDATED = '14 August 2026';
export const MANUAL_HASH = 'manual';

export function parseManualHash(hash = window.location.hash): boolean {
  const h = (hash || '').replace(/^#\/?/, '').toLowerCase();
  return h === MANUAL_HASH || h === 'user-manual' || h === 'help' || h === 'guide';
}

export function openUserManual() {
  window.location.hash = MANUAL_HASH;
}

export function clearManualHash() {
  const { pathname, search } = window.location;
  window.history.pushState('', document.title, `${pathname}${search}`);
}

export type ManualSection = {
  id: ManualSectionId;
  title: string;
  body: string[];
};

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: 'start',
    title: 'Getting started',
    body: [
      'Sign in with Google or email/password. An active subscription (or developer access) unlocks the full terminal.',
      'Use the left sidebar to move between Dashboard, Analysis, Find Trades, AI Signals, Watchlist, Portfolio, News, Alerts, and Settings.',
      'On phones, open the menu button to show the same navigation.',
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    body: [
      'Market Command Center shows index pulse, AI market outlook, and opportunity / watch / risk cards from your recent AI signal cache.',
      'Switch US / HK / JP / EU / All markets from the dashboard market control to focus the pulse strip.',
    ],
  },
  {
    id: 'find',
    title: 'Find Trades',
    body: [
      'Find: paste tickers and scan for names that clear BUY gates.',
      'Suggest: scout curated universes by market and theme; only returns a pick when factors clear.',
      'Day Trade: short-horizon scout for intraday-style candidates.',
      'Opening a result loads full Analysis for that ticker.',
    ],
  },
      {
        id: 'signals',
        title: 'AI Signals',
        body: [
          'Stores recent scan rows (opportunity / watch / risk) for quick review, catalogued by market (US, Hong Kong, Japan, Europe).',
          'Each card includes an S/R chip (Near Support / Near Resistance / Mid Range) from Quantum levels.',
          'Use the market chips to filter. Update refreshes prices and signals for listed names. Delete removes a row from the cache.',
          'AI Signals sync across devices on the same signed-in account (iPhone ↔ Android ↔ PC). Use the Sync button if a phone session was backgrounded.',
        ],
      },
  {
    id: 'watchlist',
    title: 'Watchlist',
    body: [
      'Add tickers (e.g. AAPL or 0700 for Hong Kong → 0700.HK). Filter by market group when needed.',
      'Update refreshes quotes and light signals for every listed name.',
      'Your watchlist syncs across devices on the same signed-in account (see Cloud sync).',
    ],
  },
  {
    id: 'portfolio',
    title: 'Portfolio',
    body: [
      'Track holdings with quantity and average cost. Open a ticker for full analysis.',
      'Portfolio holdings also sync across devices for the same account.',
    ],
  },
  {
    id: 'analysis',
    title: 'Analysis & search',
    body: [
      'Search a ticker in the header (US symbols or numeric HK codes). Each Search uses 1 AI analysis credit.',
      'Manual Refresh re-runs analysis and also uses 1 analysis credit. Auto quote refresh does not spend analysis credits.',
      'Charts, thesis, horizons, ensemble, patterns, and cockpit panels summarize the active ticker.',
      'Draw trendlines/annotations on the chart — they sync with your account when signed in.',
    ],
  },
  {
    id: 'news',
    title: 'News',
    body: [
      'News Center pulls headlines for a symbol. AI news summary uses news credits from your daily quota or reload pack.',
    ],
  },
  {
    id: 'alerts',
    title: 'Alerts',
    body: [
      'Create price or RSI alerts for tickers you care about. Enable browser notifications when prompted.',
      'Optional auto RSI-divergence alerts can be toggled. Alert settings sync with your account.',
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    body: [
      'Appearance: switch Light or Dark mode. Preference syncs with your signed-in account.',
      'Choose Manual vs Auto market refresh and the auto interval. Manual is the credit-safe default.',
      'Manage subscription plans, Reload packs (+10 analyses and +10 news), and legal acceptance before checkout.',
      'Self-learning / calibration: adjust model factor weights, then press Save (or Balance / Defaults).',
    ],
  },
  {
    id: 'sync',
    title: 'Cloud sync across devices',
    body: [
      'With the same active account signed in on iPhone, Android, and PC, these sync via Firestore: Watchlist, Portfolio, AI Signals, Alerts, chart drawings, model weights, and preferences.',
      'Watchlist, Portfolio, AI Signals, and Alerts use dedicated live sync (resume when you reopen the app). Use the Sync button on those pages if a phone was backgrounded.',
      'Look for the Cloud pill in the header — green means prefs/drawings synced; Sync err means a write failed (check connection and reload).',
      'Hard-refresh or re-open the PWA after a deploy until the footer build id matches (e.g. cross-dev-0814e). Use the same email account on every device.',
    ],
  },
  {
    id: 'credits',
    title: 'Credits & plans',
    body: [
      'Daily analysis and news quotas reset at midnight Malaysia time. Unused daily credits do not roll over; purchased Reload packs persist until used.',
      'Basic and Pro include daily limits; Reload pack (RM10) adds +10 analyses and +10 news.',
      'Every Search and every manual Refresh costs 1 analysis credit. Auto quote polling does not.',
    ],
  },
  {
    id: 'risk',
    title: 'Important risk note',
    body: [
      'Quantum Node is an analysis tool, not a financial adviser. AI scores and market data can be wrong or delayed.',
      'You alone own trading decisions. Read Risk Warning, Terms, and Privacy from the sidebar legal links before subscribing.',
    ],
  },
];
