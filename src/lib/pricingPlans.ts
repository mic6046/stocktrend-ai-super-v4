import type { SubscriptionPlan } from './subscription';

export type PublicPlanCard = {
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

/** Public subscription plans shown on Landing (+ Pricing pages). */
export const PUBLIC_PLANS: PublicPlanCard[] = [
  {
    id: 'monthly',
    name: 'Basic',
    price: 'RM 199',
    period: '/month',
    blurb: 'Focused watchlist use with fair daily AI limits.',
    icon: 'rocket',
    features: [
      '10 AI stock analyses per day',
      '10 AI news summaries per day',
      'Credits do not roll over to next month',
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
    blurb: 'For active traders who need a wider daily AI runway.',
    highlight: true,
    badge: 'Most popular',
    icon: 'gem',
    features: [
      '30 AI stock analyses per day',
      '30 AI news summaries per day',
      'Credits do not roll over to next month',
      'Everything in Basic',
      'Same overage rates & AI pack',
      'Cancel anytime',
    ],
  },
];

export const PUBLIC_OVERAGES = [
  { label: 'AI analysis mini reload', price: 'RM 5', note: '+5 analyses · Stripe MYR minimum' },
  { label: 'AI news mini reload', price: 'RM 5', note: '+10 news summaries · Stripe MYR minimum' },
  { label: 'AI analysis pack', price: 'RM 10', note: '+12 analyses (2 bonus) · same for all plans' },
] as const;
