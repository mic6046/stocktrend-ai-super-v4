/**
 * "Buy Now" entry check — a gate layered on top of the existing
 * recommendation engines, not a replacement for them. The Quantum engine
 * already decides WHICH tickers are buy-worthy and WHERE the entry zone is;
 * this checks a live price/volume snapshot against that zone so a pick only
 * qualifies as "Buy Now" if price is genuinely still at a good entry right
 * now, not after it has already run (the overshoot case).
 *
 * Deliberately a one-shot, stateless check re-run whenever Today's Picks is
 * refreshed — not a background poller. "Reaching the buy zone with
 * confirming volume" is worth re-checking against fresh data each time you
 * look, not something that needs a live loop running in between.
 */

export type BuyZone = { low: number; high: number };

export type BuyNowSnapshot = {
  price: number;
  /** Relative volume vs. typical pace (e.g. today's volume / 10-day average). */
  rvol: number;
  /** Yahoo-style market state; anything other than 'REGULAR' disqualifies. */
  marketState?: string | null;
};

export type BuyNowConfig = {
  /** Below this, volume isn't confirming the move. */
  rvolMin: number;
  /** Above this, volume looks climactic — likely the blow-off, not the entry. */
  rvolMax: number;
};

export const DEFAULT_BUY_NOW_CONFIG: BuyNowConfig = {
  rvolMin: 1.3,
  rvolMax: 2.5,
};

export type BuyNowCheck = {
  qualifies: boolean;
  reason: string;
};

export function checkBuyNow(
  sample: BuyNowSnapshot,
  zone: BuyZone,
  config: BuyNowConfig = DEFAULT_BUY_NOW_CONFIG
): BuyNowCheck {
  const isRegularSession = sample.marketState == null || sample.marketState === 'REGULAR';
  if (!isRegularSession) {
    return { qualifies: false, reason: 'Outside regular trading session.' };
  }

  const inZone = sample.price >= zone.low && sample.price <= zone.high;
  if (!inZone) {
    const reason =
      sample.price > zone.high
        ? 'Price has moved past the buy zone — not a fresh entry right now.'
        : 'Price has not yet reached the buy zone.';
    return { qualifies: false, reason };
  }

  if (sample.rvol < config.rvolMin) {
    return {
      qualifies: false,
      reason: `Volume not yet confirming (RVOL ${sample.rvol.toFixed(1)}x, need ${config.rvolMin}x+).`,
    };
  }

  if (sample.rvol > config.rvolMax) {
    return {
      qualifies: false,
      reason: `Volume looks climactic (RVOL ${sample.rvol.toFixed(1)}x) — this may already be the blow-off, not the entry.`,
    };
  }

  return {
    qualifies: true,
    reason: `In buy zone (${zone.low}-${zone.high}) with confirming volume (RVOL ${sample.rvol.toFixed(1)}x).`,
  };
}
