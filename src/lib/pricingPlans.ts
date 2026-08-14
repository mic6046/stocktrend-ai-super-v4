import type { SubscriptionPlan } from './subscription';
import type { OverageProduct } from './usageApi';

export type PricingPlanCard = {
  id: SubscriptionPlan;
  name: string;
  price: string;
  period: string;
  blurb: string;
  features: string[];
  highlight?: boolean;
  badge?: string;
  icon: 'rocket' | 'gem';
};

/** One-time top-ups shown beside Basic / Pro. */
export type OverageOffer = {
  product: OverageProduct;
  label: string;
  price: string;
  note: string;
  highlight?: boolean;
};

export const OVERAGE_OFFERS: OverageOffer[] = [
  {
    product: 'analysis',
    label: 'AI analysis mini',
    price: 'RM 5',
    note: '+5 analyses · lasts until used',
  },
  {
    product: 'news',
    label: 'AI news mini',
    price: 'RM 5',
    note: '+10 news summaries · lasts until used',
  },
  {
    product: 'reload_pack',
    label: 'Reload pack',
    price: 'RM 10',
    note: '+10 analyses + 10 news · lasts until used (no daily reset)',
    highlight: true,
  },
];

/** Public Basic / Pro cards — keep landing, sidebar, and PricingPage in sync. */
export const PRICING_PLANS: PricingPlanCard[] = [
  {
    id: 'monthly',
    name: 'Basic',
    price: 'RM 199',
    period: '/month',
    blurb: 'Focused watchlist use with fair daily AI limits. Quotas reset every day.',
    icon: 'rocket',
    features: [
      '20 AI stock analyses per day',
      '20 AI news summaries per day',
      'Each Search or Refresh uses 1 analysis credit',
      'Reload pack RM 10 · +10 analyses +10 news (until used)',
      'Quotas reset every day (midnight MYT)',
      'Full charts, alerts, score & advisory',
      'Cloud sync across devices',
      'Cancel anytime',
    ],
  },
  {
    id: 'pro_monthly',
    name: 'Pro',
    price: 'RM 349',
    period: '/month',
    blurb: 'For active traders who need a wider daily AI runway. Quotas reset every day.',
    highlight: true,
    badge: 'Most popular',
    icon: 'gem',
    features: [
      '30 AI stock analyses per day',
      '30 AI news summaries per day',
      'Each Search or Refresh uses 1 analysis credit',
      'Reload pack RM 10 · +10 analyses +10 news (until used)',
      'Quotas reset every day (midnight MYT)',
      'Everything in Basic',
      'Same overage rates & Reload pack',
      'Cancel anytime',
    ],
  },
];

export function planDisplayName(
  planId: string | null | undefined,
  planLabel?: string | null
): string {
  if (planLabel && planLabel.trim()) return planLabel.trim();
  if (planId === 'pro_monthly') return 'Pro';
  if (planId === 'monthly' || planId === 'yearly') return 'Basic';
  return 'None';
}
