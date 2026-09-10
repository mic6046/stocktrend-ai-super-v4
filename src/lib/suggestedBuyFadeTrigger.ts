import type { StockRecommendation } from './recommendation';
import type { SuggestedBuySnapshot } from './suggestedBuysStore';

export type SuggestedBuyFadeCheck = {
  fire: boolean;
  reason: string;
};

/** Confidence drop (even with the label unchanged) big enough to count as fading conviction, not noise. */
const CONFIDENCE_DROP_THRESHOLD = 15;

/**
 * Compares a snapshot taken when a BUY/STRONG BUY was suggested against a
 * fresh recommendation for the same ticker, and decides whether it has
 * faded since.
 *
 * USER RULE: waiting for price to actually break the stop loss is too late —
 * the loss is already incurred by then. Every check here is deliberately a
 * LEADING signal that fires before that point: a verdict downgrade, a
 * confidence slide even while the label hasn't moved yet, an accumulation/
 * flow reversal, or the specific setup (Breakout/Pullback) evaporating.
 * There is intentionally no price/stop-loss check in this list.
 */
export function checkSuggestedBuyFade(snapshot: SuggestedBuySnapshot, fresh: StockRecommendation): SuggestedBuyFadeCheck {
  const price = fresh.engine?.currentPrice ?? 0;
  const isStillBuy = fresh.recommendation === 'BUY' || fresh.recommendation === 'STRONG BUY';
  const confidenceDrop = snapshot.confidence - fresh.confidence;
  const priceMove =
    snapshot.price > 0 && price > 0
      ? ` Price is ${price >= snapshot.price ? 'up' : 'down'} ${Math.abs(((price - snapshot.price) / snapshot.price) * 100).toFixed(1)}% from ${snapshot.price.toFixed(2)} since then.`
      : '';

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
