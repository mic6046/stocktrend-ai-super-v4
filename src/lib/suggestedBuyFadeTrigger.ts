import type { StockRecommendation } from './recommendation';
import type { SuggestedBuySnapshot } from './suggestedBuysStore';

export type SuggestedBuyFadeCheck = {
  fire: boolean;
  reason: string;
};

/** Confidence drop (even with the label unchanged) big enough to count as fading conviction, not noise. */
const CONFIDENCE_DROP_THRESHOLD = 15;

/** Same exact bullish-factor label the engine pushes for whale/institutional/smart-money >= 80 — the
 * established "strong accumulation" bar used elsewhere (STRONG BUY confluence, Pullback Buy tag). */
const STRONG_ACCUMULATION_LABEL = 'Accumulation conviction very high (80+)';

/**
 * Compares a snapshot taken when a BUY/STRONG BUY was suggested against a
 * fresh recommendation for the same ticker, and decides whether it has
 * faded since.
 *
 * USER RULE: waiting for price to actually break the stop loss is too late —
 * the loss is already incurred by then, so most checks here are LEADING
 * signals: a verdict downgrade, a confidence slide even while the label
 * hasn't moved yet, an accumulation/flow reversal, or the specific setup
 * (Breakout/Pullback) evaporating.
 *
 * USER RULE (exception): price falling back to the exact cost you were
 * suggested to buy at is itself a distinct, concrete moment worth flagging
 * on its own — well before any stop loss — because it's the point where a
 * further drop turns a flat trade into an actual loss. When that happens
 * AND strong institutional/whale accumulation is still present, soften the
 * message to a watch warning rather than a reduce suggestion — the inflow
 * may still support a bounce. Without that inflow, warn more directly.
 */
export function checkSuggestedBuyFade(snapshot: SuggestedBuySnapshot, fresh: StockRecommendation): SuggestedBuyFadeCheck {
  const price = fresh.engine?.currentPrice ?? 0;
  const isStillBuy = fresh.recommendation === 'BUY' || fresh.recommendation === 'STRONG BUY';
  const confidenceDrop = snapshot.confidence - fresh.confidence;
  const priceMove =
    snapshot.price > 0 && price > 0
      ? ` Price is ${price >= snapshot.price ? 'up' : 'down'} ${Math.abs(((price - snapshot.price) / snapshot.price) * 100).toFixed(1)}% from ${snapshot.price.toFixed(2)} since then.`
      : '';

  if (snapshot.price > 0 && price > 0 && price <= snapshot.price) {
    const strongInflowNow = (fresh.engine?.bullishFactors ?? []).some((f) => f.label === STRONG_ACCUMULATION_LABEL);
    return strongInflowNow
      ? {
          fire: true,
          reason: `Price has fallen back to your suggested entry cost of ${snapshot.price.toFixed(2)} — a further drop would put you in a loss. Strong institutional/whale inflow is still present though, which may support a bounce here — treat this as a watch warning, not a signal to reduce.`,
        }
      : {
          fire: true,
          reason: `Price has fallen back to your suggested entry cost of ${snapshot.price.toFixed(2)} — a further drop would put you in a loss, and there's no strong institutional/whale inflow here to lean on. Consider trimming or protecting the position.`,
        };
  }
  if (!isStillBuy) {
    return { fire: true, reason: `Downgraded from ${snapshot.verdict} to ${fresh.recommendation} since it was suggested.${priceMove}` };
  }
  if (confidenceDrop >= CONFIDENCE_DROP_THRESHOLD) {
    return {
      fire: true,
      reason: `Conviction is fading — confidence dropped from ${snapshot.confidence}% to ${fresh.confidence}% even though it's still rated ${fresh.recommendation}.${priceMove}`,
    };
  }
  if (snapshot.fundFlow !== 'Outflow' && fresh.boardMetrics?.fundFlow === 'Outflow') {
    return { fire: true, reason: `Institutional/whale flow has flipped to net outflow since this was suggested.${priceMove}` };
  }
  if (snapshot.setupTag && fresh.engine?.setupTag !== snapshot.setupTag) {
    const tagLabel = snapshot.setupTag === 'BREAKOUT BUY' ? 'Breakout Buy' : 'Pullback Buy';
    return { fire: true, reason: `The ${tagLabel} setup that justified this pick is gone — the pattern no longer holds.${priceMove}` };
  }
  return { fire: false, reason: '' };
}
