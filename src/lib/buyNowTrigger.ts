/**
 * "Buy Now" real-time entry trigger — a gate layered on top of the existing
 * recommendation engines, not a replacement for them. The Quantum engine /
 * day-trade scout already decide WHICH tickers are buy-worthy and WHERE the
 * entry zone is; this evaluates live price/volume samples against that zone
 * and only fires when price is genuinely still at a good entry, not after
 * it has already run (the overshoot case).
 *
 * Pure and polling-agnostic on purpose: the caller supplies one live sample
 * at a time plus the prior armed state, gets back a decision plus the next
 * state to persist. No I/O, no timers — those live in the watcher hook.
 */

export type BuyZone = { low: number; high: number };

export type QuoteSample = {
  price: number;
  /** Relative volume vs. typical pace (e.g. today's volume / 10-day average). */
  rvol: number;
  /** Epoch ms this sample was taken. */
  at: number;
  /** Yahoo-style market state; anything other than 'REGULAR' suppresses firing. */
  marketState?: string | null;
};

export type BuyNowConfig = {
  /** Below this, volume isn't confirming the move yet. */
  rvolMin: number;
  /** Above this, volume looks climactic — likely the blow-off, not the entry. */
  rvolMax: number;
  /** Consecutive qualifying polls required before firing. */
  persistPolls: number;
  /** Minimum time between fires for the same ticker, unless it exits and re-enters the zone. */
  cooldownMs: number;
};

export const DEFAULT_BUY_NOW_CONFIG: BuyNowConfig = {
  rvolMin: 1.3,
  rvolMax: 2.5,
  persistPolls: 3,
  cooldownMs: 60 * 60 * 1000,
};

export type BuyNowArmedState = {
  /** Rolling recent samples, most-recent last. */
  history: QuoteSample[];
  /** Epoch ms of the last fire, or null if it has never fired. */
  lastFiredAt: number | null;
  /** Whether the most recently seen sample was inside the zone. */
  wasInZone: boolean;
};

export function createBuyNowArmedState(): BuyNowArmedState {
  return { history: [], lastFiredAt: null, wasInZone: false };
}

export type BuyNowEvaluation = {
  fire: boolean;
  reason: string;
  /** How many consecutive qualifying polls have been seen so far, capped at persistPolls — for a "confirming 2/3" style readout. */
  confirmingCount: number;
  /** Updated armed state to persist for the next poll. */
  state: BuyNowArmedState;
};

function sampleQualifies(s: QuoteSample, zone: BuyZone, config: BuyNowConfig): boolean {
  const inZone = s.price >= zone.low && s.price <= zone.high;
  const rvolOk = s.rvol >= config.rvolMin && s.rvol <= config.rvolMax;
  return inZone && rvolOk;
}

function consecutiveQualifyingStreak(history: QuoteSample[], zone: BuyZone, config: BuyNowConfig): number {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (sampleQualifies(history[i], zone, config)) streak++;
    else break;
  }
  return streak;
}

export function evaluateBuyNowTrigger(
  sample: QuoteSample,
  zone: BuyZone,
  prior: BuyNowArmedState,
  config: BuyNowConfig = DEFAULT_BUY_NOW_CONFIG
): BuyNowEvaluation {
  const historyCap = config.persistPolls + 2;
  const history = [...prior.history, sample].slice(-historyCap);
  const inZone = sample.price >= zone.low && sample.price <= zone.high;
  const isRegularSession = sample.marketState == null || sample.marketState === 'REGULAR';
  const exitedThenReentered = prior.wasInZone === false && inZone;
  const inCooldown =
    prior.lastFiredAt != null &&
    sample.at - prior.lastFiredAt < config.cooldownMs &&
    !exitedThenReentered;

  // Once price has exited and re-come back into the zone, treat it as a
  // genuinely new setup: clear the old cooldown timestamp for good (not just
  // for this one sample) so the persistence streak building back up over the
  // next few polls isn't blocked by a cooldown from the previous visit.
  const carriedLastFiredAt = exitedThenReentered ? null : prior.lastFiredAt;

  const nextState = (overrides: Partial<BuyNowArmedState> = {}): BuyNowArmedState => ({
    history,
    lastFiredAt: carriedLastFiredAt,
    wasInZone: inZone,
    ...overrides,
  });

  if (!isRegularSession) {
    return { fire: false, reason: 'Outside regular trading session.', confirmingCount: 0, state: nextState() };
  }

  if (!inZone) {
    const reason =
      sample.price > zone.high
        ? 'Price has moved past the buy zone — waiting for a pullback, not chasing.'
        : 'Price is below the buy zone.';
    return { fire: false, reason, confirmingCount: 0, state: nextState() };
  }

  if (inCooldown) {
    return {
      fire: false,
      reason: 'Already alerted recently for this ticker — on cooldown.',
      confirmingCount: 0,
      state: nextState(),
    };
  }

  if (sample.rvol < config.rvolMin) {
    return {
      fire: false,
      reason: `Volume not yet confirming (RVOL ${sample.rvol.toFixed(1)}x, need ${config.rvolMin}x+).`,
      confirmingCount: 0,
      state: nextState(),
    };
  }

  if (sample.rvol > config.rvolMax) {
    return {
      fire: false,
      reason: `Volume looks climactic (RVOL ${sample.rvol.toFixed(1)}x) — this may already be the blow-off, not the entry.`,
      confirmingCount: 0,
      state: nextState(),
    };
  }

  const streak = consecutiveQualifyingStreak(history, zone, config);
  const streakSamples = history.slice(-streak);
  const directionOk =
    streakSamples.length < 2 || streakSamples[streakSamples.length - 1].price >= streakSamples[0].price;

  if (!directionOk) {
    return {
      fire: false,
      reason: 'Price is rolling over within the zone — waiting for direction to hold.',
      confirmingCount: 0,
      state: nextState(),
    };
  }

  const confirmingCount = Math.min(streak, config.persistPolls);

  if (streak < config.persistPolls) {
    return {
      fire: false,
      reason: `Confirming — ${confirmingCount}/${config.persistPolls} checks so far.`,
      confirmingCount,
      state: nextState(),
    };
  }

  return {
    fire: true,
    reason: `In buy zone (${zone.low}-${zone.high}) with confirming volume (RVOL ${sample.rvol.toFixed(1)}x) held for ${config.persistPolls} checks.`,
    confirmingCount: config.persistPolls,
    state: nextState({ lastFiredAt: sample.at }),
  };
}
