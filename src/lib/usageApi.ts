import { apiUrl, loggedFetch } from './api';

export type UsageSnapshot = {
  email: string;
  plan: string;
  planLabel: string;
  dateKey: string;
  analysesUsed: number;
  newsUsed: number;
  analysesLimit: number;
  newsLimit: number;
  analysesRemaining: number;
  newsRemaining: number;
  bonusAnalyses: number;
  bonusNews: number;
  bonusAnalysesUsed: number;
  bonusNewsUsed: number;
  bonusAnalysesPackSize: number;
  bonusNewsPackSize: number;
  analysesOnBonus: boolean;
  newsOnBonus: boolean;
  unlimited: boolean;
  subscriptionStatus: string;
};

export type OverageProduct = 'analysis' | 'news' | 'analysis_pack';

export async function fetchUsage(email: string): Promise<UsageSnapshot> {
  const res = await loggedFetch(apiUrl(`/api/usage?email=${encodeURIComponent(email)}`), {
    __qnMeta: { reason: 'usage', userAction: 'Load usage quota' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to load usage');
  return data as UsageSnapshot;
}

/** Charge 1 AI analysis credit (Find a Trade / Suggest a Trade). */
export async function consumeAnalysisCredit(
  email: string,
  reason: 'find-a-trade' | 'suggest-a-trade' | string
): Promise<{ usage: UsageSnapshot; chargedFrom?: string }> {
  const res = await loggedFetch(apiUrl('/api/usage/consume'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, kind: 'analysis', reason }),
    __qnMeta: {
      reason: 'usage-consume-analysis',
      userAction: reason === 'suggest-a-trade' ? 'Click Suggest a Trade' : 'Click Find a Trade',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data?.error || 'Failed to use analysis credit');
    err.status = res.status;
    err.code = data?.code;
    err.usage = data?.usage;
    throw err;
  }
  return { usage: data.usage as UsageSnapshot, chargedFrom: data.chargedFrom };
}

export async function startOverageCheckout(
  product: OverageProduct,
  email: string
): Promise<{ url: string }> {
  const res = await loggedFetch(apiUrl('/api/stripe/create-overage-checkout'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product, email }),
    __qnMeta: { reason: 'stripe-overage', userAction: 'Start overage checkout' },
  });
  const data = await res.json();
  if (!res.ok || !data?.url) {
    throw new Error(data?.error || 'Failed to start overage checkout');
  }
  return { url: data.url as string };
}
