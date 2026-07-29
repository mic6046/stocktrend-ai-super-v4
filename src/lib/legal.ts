export type LegalDocId = 'terms' | 'privacy' | 'risk';

export const LEGAL_UPDATED = '27 July 2026';

export function parseLegalHash(hash = window.location.hash): LegalDocId | null {
  const h = (hash || '').replace(/^#\/?/, '').toLowerCase();
  if (h === 'terms' || h === 'terms-of-use') return 'terms';
  if (h === 'privacy' || h === 'privacy-policy') return 'privacy';
  if (h === 'risk' || h === 'risk-warning' || h === 'disclaimer') return 'risk';
  return null;
}

export function openLegalDoc(id: LegalDocId) {
  window.location.hash = id;
}

export function clearLegalHash() {
  const { pathname, search } = window.location;
  window.history.pushState('', document.title, `${pathname}${search}`);
}

export const LEGAL_TITLES: Record<LegalDocId, string> = {
  terms: 'Terms of Use',
  privacy: 'Privacy Policy',
  risk: 'Risk Warning',
};

type Section = { heading: string; body: string[] };

export const LEGAL_SECTIONS: Record<LegalDocId, Section[]> = {
  risk: [
    {
      heading: 'Not financial advice',
      body: [
        'Quantum Node is an AI-assisted market analysis terminal. It is not a licensed broker, bank, fund manager, or financial adviser in Malaysia or any other jurisdiction.',
        'Scores, projections, support/resistance levels, news summaries, alerts, and advisory labels are informational and educational only. They are not personal investment recommendations and are not an offer to buy or sell any security.',
      ],
    },
    {
      heading: 'You can lose money',
      body: [
        'Financial markets involve substantial risk of loss. You may lose some or all of any capital you choose to invest elsewhere based on information from this product.',
        'Past performance, backtests, and simulated results do not guarantee future outcomes.',
      ],
    },
    {
      heading: 'AI and data can be wrong',
      body: [
        'Models, including Google Gemini and our internal scoring logic, can be incomplete, delayed, biased, or incorrect (“hallucinations”).',
        'Third-party market and news data (for example Yahoo Finance, Finnhub, MarketAux) may be delayed, incomplete, or inaccurate. We do not guarantee real-time or error-free data.',
      ],
    },
    {
      heading: 'Your responsibility',
      body: [
        'You alone decide whether to trade or invest. You accept full responsibility for your decisions and any resulting gains or losses.',
        'If you need advice, consult a licensed professional who understands your situation.',
      ],
    },
  ],
  terms: [
    {
      heading: 'Agreement',
      body: [
        'By creating an account, signing in, or paying for Quantum Node, you agree to these Terms of Use, our Privacy Policy, and the Risk Warning.',
        'If you do not agree, do not use the service.',
      ],
    },
    {
      heading: 'The service',
      body: [
        'Quantum Node provides charts, alerts, AI analysis, news tools, and related features for subscribed users.',
        'We may change, suspend, or discontinue features to improve the product, manage costs, or comply with law.',
      ],
    },
    {
      heading: 'Accounts',
      body: [
        'You must sign in with a Google account you are authorised to use. Keep your account secure. You are responsible for activity under your login.',
        'Do not share accounts or attempt to bypass quotas, billing, or access controls.',
      ],
    },
    {
      heading: 'Subscriptions, quotas, and overages',
      body: [
        'Paid plans (for example Basic and Pro) are billed in Malaysian Ringgit (MYR) via Stripe on a recurring basis unless cancelled.',
        'Daily AI analysis and news quotas reset according to the product rules (midnight Malaysia time). Cached results may not consume an extra credit.',
        'Optional mini reloads and packs are one-time purchases that add bonus credits. Prices and credit amounts may change; the checkout page shows the amount due before you pay.',
        'Unless required by law, fees are non-refundable once charged. Cancel anytime to stop future renewals; access continues until the end of the paid period unless otherwise stated.',
      ],
    },
    {
      heading: 'Acceptable use',
      body: [
        'Use the product only for lawful purposes. Do not scrape, resell, or redistribute our outputs or UI at scale; do not attack, overload, or reverse-engineer the service; and do not use it to provide regulated investment advice to others without the licences you need.',
      ],
    },
    {
      heading: 'Intellectual property',
      body: [
        'The Quantum Node name, design, software, and generated interface content are owned by us or our licensors. We grant you a limited, non-exclusive, non-transferable licence to use the service while subscribed.',
      ],
    },
    {
      heading: 'Disclaimers and liability',
      body: [
        'The service is provided “as is” and “as available.” To the fullest extent allowed by law, we disclaim warranties of accuracy, merchantability, and fitness for a particular purpose.',
        'We are not liable for trading losses, lost profits, or indirect damages. Our total liability for any claim relating to the service is limited to the fees you paid us for the service in the three (3) months before the claim.',
      ],
    },
    {
      heading: 'Governing law',
      body: [
        'These terms are governed by the laws of Malaysia. Courts in Malaysia have exclusive jurisdiction, subject to any mandatory consumer protections that apply to you.',
      ],
    },
    {
      heading: 'Contact',
      body: [
        'For billing or legal questions about these terms, contact the account operator using the email associated with your subscription administrator (the email you use for product support).',
      ],
    },
  ],
  privacy: [
    {
      heading: 'Who we are',
      body: [
        'This Privacy Policy explains how Quantum Node (“we”, “us”) handles personal data when you use our website and application.',
        'We aim to comply with applicable privacy laws, including Malaysia’s Personal Data Protection Act (PDPA) principles of notice, purpose, and security.',
      ],
    },
    {
      heading: 'What we collect',
      body: [
        'Account data: Google sign-in identifiers such as email, display name, and user ID.',
        'Billing data: subscription status, plan, Stripe customer/subscription IDs, and payment metadata. Card numbers are processed by Stripe — we do not store full card details on our servers.',
        'Usage data: daily AI analysis and news counts, bonus credits, and related quota fields needed to enforce plans.',
        'Product data you choose to save: for example alerts, preferences, drawings, or synced settings stored in Firebase for your account.',
        'Technical logs: may include IP address, device/browser info, and error logs for security and reliability.',
      ],
    },
    {
      heading: 'How we use data',
      body: [
        'To authenticate you, provide the dashboard, enforce quotas, process payments, prevent abuse, improve the product, and communicate about your account or service changes.',
        'We do not sell your personal data.',
      ],
    },
    {
      heading: 'Processors and transfers',
      body: [
        'We use service providers such as Google (Firebase Auth, Firestore, Gemini AI, Cloud Run / hosting), Stripe (payments), and market/news data providers (for example Finnhub, MarketAux, Yahoo Finance).',
        'Some processing may occur outside Malaysia (for example in the United States). By using the service you acknowledge these transfers are needed to operate the product.',
      ],
    },
    {
      heading: 'Retention',
      body: [
        'We keep account and billing records while your account is active and for a reasonable period afterward for audits, disputes, and legal obligations.',
        'You may request deletion of account data where legally allowed; we may retain limited records required for tax, fraud prevention, or dispute resolution.',
      ],
    },
    {
      heading: 'Your choices',
      body: [
        'You can sign out at any time. To request access, correction, or deletion of personal data, contact support using your registered email.',
        'If you revoke Google access or delete your Google account, you may lose the ability to sign in.',
      ],
    },
    {
      heading: 'Security',
      body: [
        'We use industry-standard cloud controls (encrypted transit, access-restricted backends, secret-managed API keys). No method of transmission or storage is 100% secure.',
      ],
    },
    {
      heading: 'Updates',
      body: [
        `We may update this policy from time to time. The “Last updated” date at the top of the page will change. Continued use after updates means you accept the revised policy.`,
      ],
    },
  ],
};
