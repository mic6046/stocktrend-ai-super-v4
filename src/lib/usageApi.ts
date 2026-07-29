import { apiUrl } from './api';

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
  const res = await fetch(apiUrl(`/api/usage?email=${encodeURIComponent(email)}`));
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to load usage');
  return data as UsageSnapshot;
}

export async function startOverageCheckout(
  product: OverageProduct,
  email: string
): Promise<{ url: string }> {
  const res = await fetch(apiUrl('/api/stripe/create-overage-checkout'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product, email }),
  });
  const data = await res.json();
  if (!res.ok || !data?.url) {
    throw new Error(data?.error || 'Failed to start overage checkout');
  }
  return { url: data.url as string };
}
