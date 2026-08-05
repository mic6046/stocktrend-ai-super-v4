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
    blurb: 'Paid daily AI runway for focused watchlists — use credits or lose them.',
    icon: 'rocket',
    features: [
      '10 AI stock analyses per day',
      '10 AI news summaries per day',
      'Unused credits do not roll over',
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
    blurb: 'Higher daily AI limits for active traders — reload when you need more.',
    highlight: true,
    badge: 'Most popular',
    icon: 'gem',
    features: [
      '30 AI stock analyses per day',
      '30 AI news summaries per day',
      'Unused credits do not roll over',
      'Everything in Basic',
      'Same overage rates & AI pack',
      'Cancel anytime',
    ],
  },
];

export const PUBLIC_OVERAGES = [
  { label: 'AI analysis mini reload', price: 'RM 5', note: '+5 analyses · same month only' },
  { label: 'AI news mini reload', price: 'RM 5', note: '+10 news · same month only' },
  { label: 'AI analysis pack', price: 'RM 10', note: '+12 analyses · same month only' },
] as const;
