import express from 'express';
import Stripe from 'stripe';
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { addBonusCredits } from './usageQuota';

type Plan = 'monthly' | 'yearly' | 'pro_monthly';
type OverageProduct = 'analysis' | 'news' | 'analysis_pack';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  // Header values cannot contain CR/LF; Secret Manager / shell pastes often add them.
  return new Stripe(key);
}

function getPriceId(plan: Plan): string | null {
  if (plan === 'yearly') {
    return process.env.STRIPE_PRICE_YEARLY || null;
  }
  if (plan === 'pro_monthly') {
    return process.env.STRIPE_PRICE_PRO_MONTHLY || null;
  }
  return process.env.STRIPE_PRICE_MONTHLY || null;
}

function overageLineItem(product: OverageProduct): Stripe.Checkout.SessionCreateParams.LineItem {
  // Pack may use a Stripe Dashboard price id; mini top-ups always use inline
  // MYR amounts (Stripe MYR minimum is RM 2 — we sell minis at RM 5).
  if (product === 'analysis_pack') {
    const packPrice = process.env.STRIPE_PRICE_ANALYSIS_PACK;
    if (packPrice) {
      return { price: packPrice, quantity: 1 };
    }
    return {
      quantity: 1,
      price_data: {
        currency: 'myr',
        unit_amount: 1000,
        product_data: {
          name: 'AI analysis pack',
          description: '+12 AI stock analyses (2 bonus)',
        },
      },
    };
  }
  if (product === 'news') {
    return {
      quantity: 1,
      price_data: {
        currency: 'myr',
        unit_amount: 500, // RM 5 mini reload → +10 news
        product_data: {
          name: 'AI news mini reload',
          description: '+10 AI news summary credits (RM 5)',
        },
      },
    };
  }
  return {
    quantity: 1,
    price_data: {
      currency: 'myr',
      unit_amount: 500, // RM 5 mini reload → +5 analyses
      product_data: {
        name: 'AI analysis mini reload',
        description: '+5 AI stock analysis credits (RM 5)',
      },
    },
  };
}

function ensureFirebaseAdmin() {
  if (!getApps().length) {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (json) {
      const cred = JSON.parse(json);
      initializeApp({
        credential: cert(cred),
        projectId: cred.project_id || process.env.FIREBASE_PROJECT_ID || 'stocktrend-ai-super',
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({
        credential: applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || 'stocktrend-ai-super',
      });
    } else {
      initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'stocktrend-ai-super',
      });
    }
  }
  return getFirestore();
}

async function upsertSubscriptionByEmail(
  email: string,
  data: Record<string, unknown>
) {
  const db = ensureFirebaseAdmin();
  const id = email.trim().toLowerCase();
  await db.collection('users').doc(id).set(
    {
      email: id,
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

function planFromPriceId(priceId: string | undefined | null): Plan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_YEARLY) return 'yearly';
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) return 'pro_monthly';
  if (priceId === process.env.STRIPE_PRICE_MONTHLY) return 'monthly';
  return null;
}

/**
 * Stripe API / SDK v22+: billing period lives on subscription items,
 * not the top-level Subscription object. Falling back to "now" incorrectly
 * marks brand-new paid subs as expired in the client.
 */
function subscriptionPeriodEnd(sub: Stripe.Subscription): Date {
  const itemEnd = sub.items?.data?.[0]?.current_period_end as number | undefined;
  const legacyEnd = (sub as { current_period_end?: number }).current_period_end;
  const end = itemEnd || legacyEnd;
  if (end && end > 0) {
    return new Date(end * 1000);
  }
  // Safe fallback: one billing month ahead (never "now")
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

async function customerEmail(
  stripe: Stripe,
  customerId: string | null | undefined,
  fallback?: string
): Promise<string> {
  if (fallback) return fallback;
  if (!customerId) return '';
  const customer = await stripe.customers.retrieve(customerId);
  if ((customer as Stripe.DeletedCustomer).deleted) return '';
  return (customer as Stripe.Customer).email || '';
}

async function applyOveragePurchase(
  email: string,
  product: OverageProduct,
  sessionId?: string
) {
  if (product === 'analysis_pack') {
    return addBonusCredits(email, 'analysis_pack', 12, sessionId);
  }
  if (product === 'news') {
    return addBonusCredits(email, 'news', 10, sessionId); // RM 5 mini → +10 news
  }
  return addBonusCredits(email, 'analysis', 5, sessionId); // RM 5 mini → +5 analyses
}

/**
 * Register Stripe routes.
 * Webhook must receive the raw body — mount it before express.json().
 */
export function registerStripeWebhook(app: express.Express) {
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const stripe = getStripe();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
      if (!stripe || !webhookSecret) {
        return res.status(503).send('Stripe webhook not configured');
      }

      const sig = req.headers['stripe-signature'];
      if (!sig || typeof sig !== 'string') {
        return res.status(400).send('Missing stripe-signature');
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: any) {
        console.error('Stripe webhook signature error:', err?.message);
        return res.status(400).send(`Webhook Error: ${err?.message}`);
      }

      try {
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            const overageProduct = session.metadata?.overageProduct as OverageProduct | undefined;

            // Overage packs must credit the signed-in account email from metadata
            // (Stripe checkout email can differ and would hide credits from the meter).
            if (session.mode === 'payment' && overageProduct) {
              const accountEmail = String(session.metadata?.email || '')
                .trim()
                .toLowerCase();
              const checkoutEmail = String(
                session.customer_details?.email || session.customer_email || ''
              )
                .trim()
                .toLowerCase();
              const email = accountEmail || checkoutEmail;
              if (!email) break;
              await applyOveragePurchase(email, overageProduct, session.id);
              break;
            }

            const email =
              session.customer_details?.email ||
              session.customer_email ||
              (session.metadata?.email as string | undefined);
            if (!email) break;

            const plan = (session.metadata?.plan as Plan | undefined) || 'monthly';
            if (session.subscription && typeof session.subscription === 'string') {
              const sub = await stripe.subscriptions.retrieve(session.subscription);
              const endsAt = subscriptionPeriodEnd(sub);
              await upsertSubscriptionByEmail(email, {
                subscriptionStatus:
                  sub.status === 'active' || sub.status === 'trialing' ? 'active' : 'inactive',
                subscriptionPlan: plan,
                subscriptionEndsAt: Timestamp.fromDate(endsAt),
                stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
                stripeSubscriptionId: sub.id,
              });
            } else {
              await upsertSubscriptionByEmail(email, {
                subscriptionStatus: 'active',
                subscriptionPlan: plan,
                stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
              });
            }
            break;
          }
          case 'customer.subscription.updated':
          case 'customer.subscription.created': {
            const sub = event.data.object as Stripe.Subscription;
            const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
            const email = await customerEmail(
              stripe,
              customerId,
              sub.metadata?.email as string | undefined
            );
            if (!email) break;

            const priceId = sub.items.data[0]?.price?.id;
            const plan = planFromPriceId(priceId) || (sub.metadata?.plan as Plan | undefined) || 'monthly';
            const status =
              sub.status === 'active' || sub.status === 'trialing'
                ? 'active'
                : sub.status === 'canceled' ||
                    sub.status === 'unpaid' ||
                    sub.status === 'incomplete_expired'
                  ? 'expired'
                  : 'inactive';

            await upsertSubscriptionByEmail(email, {
              subscriptionStatus: status,
              subscriptionPlan: plan,
              subscriptionEndsAt: Timestamp.fromDate(subscriptionPeriodEnd(sub)),
              stripeCustomerId: customerId || null,
              stripeSubscriptionId: sub.id,
            });
            break;
          }
          case 'customer.subscription.deleted': {
            const sub = event.data.object as Stripe.Subscription;
            const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
            const email = await customerEmail(
              stripe,
              customerId,
              sub.metadata?.email as string | undefined
            );
            if (!email) break;

            await upsertSubscriptionByEmail(email, {
              subscriptionStatus: 'expired',
              subscriptionEndsAt: Timestamp.fromDate(subscriptionPeriodEnd(sub)),
              stripeSubscriptionId: sub.id,
            });
            break;
          }
          default:
            break;
        }
        res.json({ received: true });
      } catch (err: any) {
        console.error('Stripe webhook handler error:', err);
        res.status(500).json({ error: err?.message || 'Webhook handler failed' });
      }
    }
  );
}

export function registerStripeRoutes(app: express.Express) {
  app.post('/api/stripe/create-checkout-session', async (req, res) => {
    try {
      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({
          error:
            'Stripe is not configured. Set STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, and STRIPE_PRICE_PRO_MONTHLY in .env',
        });
      }

      const plan = (req.body?.plan as Plan) || 'monthly';
      const email = String(req.body?.email || '').trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      if (plan !== 'monthly' && plan !== 'pro_monthly') {
        return res.status(400).json({ error: 'Plan must be monthly or pro_monthly' });
      }

      const priceId = getPriceId(plan);
      if (!priceId) {
        const envHint =
          plan === 'pro_monthly'
            ? 'STRIPE_PRICE_PRO_MONTHLY'
            : `STRIPE_PRICE_${plan.toUpperCase()}`;
        return res.status(503).json({
          error: `Missing Stripe price id for ${plan}. Set ${envHint} in .env`,
        });
      }

      const origin =
        (req.headers.origin as string) ||
        process.env.APP_URL ||
        `http://localhost:${process.env.PORT || 3000}`;

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: email,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?checkout=cancel`,
        metadata: { email, plan },
        subscription_data: {
          metadata: { email, plan },
        },
        allow_promotion_codes: true,
      });

      if (!session.url) {
        return res.status(500).json({ error: 'Stripe did not return a checkout URL' });
      }

      res.json({ url: session.url, sessionId: session.id });
    } catch (err: any) {
      console.error('create-checkout-session error:', err);
      res.status(500).json({ error: err?.message || 'Failed to create checkout session' });
    }
  });

  // One-time overage / pack purchases
  app.post('/api/stripe/create-overage-checkout', async (req, res) => {
    try {
      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({ error: 'Stripe is not configured' });
      }

      const email = String(req.body?.email || '').trim().toLowerCase();
      const product = String(req.body?.product || '') as OverageProduct;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      if (product !== 'analysis' && product !== 'news' && product !== 'analysis_pack') {
        return res.status(400).json({
          error: 'product must be analysis, news, or analysis_pack',
        });
      }

      const origin =
        (req.headers.origin as string) ||
        process.env.APP_URL ||
        `http://localhost:${process.env.PORT || 3000}`;

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: email,
        line_items: [overageLineItem(product)],
        success_url: `${origin}/?overage=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?overage=cancel`,
        metadata: { email, overageProduct: product },
        allow_promotion_codes: true,
      });

      if (!session.url) {
        return res.status(500).json({ error: 'Stripe did not return a checkout URL' });
      }

      res.json({ url: session.url, sessionId: session.id });
    } catch (err: any) {
      console.error('create-overage-checkout error:', err);
      res.status(500).json({ error: err?.message || 'Failed to create overage checkout' });
    }
  });

  // Optional confirm endpoint after redirect (useful before webhooks are fully set up)
  app.get('/api/stripe/confirm', async (req, res) => {
    try {
      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({ error: 'Stripe is not configured' });
      }
      const sessionId = String(req.query.session_id || '');
      if (!sessionId) {
        return res.status(400).json({ error: 'session_id required' });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription'],
      });

      const overageProduct = session.metadata?.overageProduct as OverageProduct | undefined;
      if (session.mode === 'payment' && overageProduct && session.payment_status === 'paid') {
        // Prefer account email stored at checkout — not whatever email Stripe collected.
        const accountEmail = String(session.metadata?.email || '')
          .trim()
          .toLowerCase();
        const checkoutEmail = String(
          session.customer_details?.email || session.customer_email || ''
        )
          .trim()
          .toLowerCase();
        const email = accountEmail || checkoutEmail;
        if (!email) {
          return res.status(400).json({ error: 'No email on session' });
        }
        const usage = await applyOveragePurchase(email, overageProduct, session.id);
        return res.json({ ok: true, email, overageProduct, type: 'overage', usage });
      }

      const email =
        session.customer_details?.email ||
        session.customer_email ||
        session.metadata?.email ||
        '';
      if (!email) {
        return res.status(400).json({ error: 'No email on session' });
      }

      const plan = (session.metadata?.plan as Plan | undefined) || 'monthly';
      const sub = session.subscription as Stripe.Subscription | null;
      await upsertSubscriptionByEmail(email, {
        subscriptionStatus:
          session.payment_status === 'paid' || sub?.status === 'active' ? 'active' : 'inactive',
        subscriptionPlan: plan,
        subscriptionEndsAt: sub ? Timestamp.fromDate(subscriptionPeriodEnd(sub)) : null,
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
        stripeSubscriptionId: sub?.id || null,
      });

      res.json({ ok: true, email, plan, status: 'active', type: 'subscription' });
    } catch (err: any) {
      console.error('stripe confirm error:', err);
      res.status(500).json({ error: err?.message || 'Confirm failed' });
    }
  });

  /**
   * Re-sync Firestore subscription fields from Stripe for an email.
   * Used after checkout when period-end / webhook writes were wrong.
   */
  app.post('/api/stripe/sync-subscription', async (req, res) => {
    try {
      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({ error: 'Stripe is not configured' });
      }
      const email = String(req.body?.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email is required' });
      }

      const customers = await stripe.customers.list({ email, limit: 10 });
      let activeSub: Stripe.Subscription | null = null;
      let customerId: string | null = null;

      for (const customer of customers.data) {
        const subs = await stripe.subscriptions.list({
          customer: customer.id,
          status: 'all',
          limit: 10,
        });
        const preferred =
          subs.data.find((s) => s.status === 'active' || s.status === 'trialing') ||
          subs.data.find((s) => s.status === 'past_due') ||
          null;
        if (preferred) {
          activeSub = preferred;
          customerId = customer.id;
          break;
        }
      }

      if (!activeSub) {
        return res.status(404).json({ error: 'No Stripe subscription found for this email' });
      }

      const priceId = activeSub.items.data[0]?.price?.id;
      const plan =
        planFromPriceId(priceId) ||
        (activeSub.metadata?.plan as Plan | undefined) ||
        'monthly';
      const status =
        activeSub.status === 'active' || activeSub.status === 'trialing'
          ? 'active'
          : activeSub.status === 'canceled' ||
              activeSub.status === 'unpaid' ||
              activeSub.status === 'incomplete_expired'
            ? 'expired'
            : 'inactive';

      await upsertSubscriptionByEmail(email, {
        subscriptionStatus: status,
        subscriptionPlan: plan,
        subscriptionEndsAt: Timestamp.fromDate(subscriptionPeriodEnd(activeSub)),
        stripeCustomerId: customerId,
        stripeSubscriptionId: activeSub.id,
      });

      res.json({
        ok: true,
        email,
        plan,
        status,
        subscriptionId: activeSub.id,
        endsAt: subscriptionPeriodEnd(activeSub).toISOString(),
      });
    } catch (err: any) {
      console.error('stripe sync-subscription error:', err);
      res.status(500).json({ error: err?.message || 'Sync failed' });
    }
  });
}
