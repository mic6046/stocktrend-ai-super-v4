import { apiUrl, loggedFetch } from './api';
import type { UsageSnapshot } from './usageApi';
import type { AppPage } from '../components/layout/navTypes';

export type AssistantChatContext = {
  page: AppPage;
  pageLabel: string;
  ticker?: string | null;
  dashboardMarket?: string | null;
  watchlistTickers?: string[];
  signalTickers?: string[];
};

export type AssistantChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AssistantChatResult = {
  reply: string;
  usage?: UsageSnapshot;
  fallback?: boolean;
};

export async function postAssistantChat(params: {
  email: string;
  message: string;
  context: AssistantChatContext;
  history?: AssistantChatMessage[];
}): Promise<AssistantChatResult> {
  const res = await loggedFetch(apiUrl('/api/assistant-chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.email,
      message: params.message,
      context: params.context,
      history: (params.history || []).slice(-6),
    }),
    __qnMeta: { reason: 'assistant-chat', userAction: 'Sidebar Ask AI' },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      (data && typeof data.error === 'string' && data.error) ||
        'Assistant request failed'
    ) as Error & { status?: number; code?: string; usage?: UsageSnapshot };
    err.status = res.status;
    err.code = typeof data?.code === 'string' ? data.code : undefined;
    err.usage = data?.usage;
    throw err;
  }

  return {
    reply: typeof data?.reply === 'string' ? data.reply : '',
    usage: data?.usage,
    fallback: !!data?.fallback,
  };
}

export const PAGE_LABELS: Record<AppPage, string> = {
  DASHBOARD: 'Dashboard',
  FIND_TRADES: 'Find Trades',
  AI_SIGNALS: 'AI Signals',
  WATCHLIST: 'Watchlist',
  PORTFOLIO: 'Portfolio',
  ANALYSIS: 'Analysis',
  NEWS_CENTER: 'News',
  ALERTS: 'Alerts',
  SETTINGS: 'Settings',
};
