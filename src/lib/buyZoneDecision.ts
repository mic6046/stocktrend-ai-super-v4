/**
 * Buy-zone decision SSOT.
 * Hierarchy: CURRENT PRICE → PRICE LOCATION → CONFIRMATION → FINAL ACTION → EXPLANATION
 * Never allow "outside BUY zone" when price is inside any Buy Zone 1–3.
 */

export type BuyBand = {
  level: 1 | 2 | 3;
  label: string;
  lo: number;
  hi: number;
  sizePct?: number;
  anchor?: string;
};

export type PriceLocation =
  | 'INSIDE_ZONE_1'
  | 'INSIDE_ZONE_2'
  | 'INSIDE_ZONE_3'
  | 'ABOVE_ALL'
  | 'BELOW_ALL'
  | 'BETWEEN_ZONES'
  | 'NONE';

export type ConfirmationStatus = 'STRONG' | 'PENDING' | 'REJECTED';

export type BuyZoneDecision = {
  currentPrice: number;
  buyZones: BuyBand[];
  priceLocation: PriceLocation;
  activeBuyZoneLevel: 1 | 2 | 3 | null;
  activeBuyZone: BuyBand | null;
  confirmationStatus: ConfirmationStatus;
  /** Machine action for existing ZoneAction consumers */
  action: 'BUY' | 'WAIT' | 'AVOID NEW POSITION';
  /** Precise user-facing status (never bare "WAIT") */
  displayLabel: string;
  reason: string;
  zoneKey: 'buy' | 'hold' | 'stop';
  confidence: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function inBand(px: number, band: { lo: number; hi: number }): boolean {
  const lo = Math.min(band.lo, band.hi);
  const hi = Math.max(band.lo, band.hi);
  return px >= lo - 1e-9 && px <= hi + 1e-9;
}

/** Split a single buy envelope into descending Buy Zone 1→3 tranches. */
export function splitBuyEnvelope(
  buy: { lo: number; hi: number },
  px: number
): BuyBand[] {
  const lo = Math.min(buy.lo, buy.hi);
  const hi = Math.max(buy.lo, buy.hi);
  const span = Math.max(hi - lo, px * 0.024);
  const top = hi;
  const bot = Math.min(lo, hi - span);
  const t1Hi = top;
  const t1Lo = top - span / 3;
  const t2Hi = t1Lo - px * 0.0015;
  const t2Lo = t2Hi - span / 3;
  const t3Hi = t2Lo - px * 0.0015;
  const t3Lo = bot;
  return [
    { level: 1, label: 'Buy Zone 1', sizePct: 30, anchor: 'upper entry', lo: round2(t1Lo), hi: round2(t1Hi) },
    { level: 2, label: 'Buy Zone 2', sizePct: 40, anchor: 'core entry', lo: round2(t2Lo), hi: round2(t2Hi) },
    { level: 3, label: 'Buy Zone 3', sizePct: 30, anchor: 'deep entry', lo: round2(t3Lo), hi: round2(t3Hi) },
  ];
}

export function locatePriceInBuyZones(
  price: number,
  buyZones: BuyBand[]
): { location: PriceLocation; active: BuyBand | null } {
  if (!(price > 0) || !buyZones?.length) {
    return { location: 'NONE', active: null };
  }
  const sorted = [...buyZones].sort((a, b) => a.level - b.level);
  const z1 = sorted.find((z) => z.level === 1) ?? sorted[0];
  const z3 = sorted.find((z) => z.level === 3) ?? sorted[sorted.length - 1];
  const envelopeHi = Math.max(...sorted.map((z) => Math.max(z.lo, z.hi)));
  const envelopeLo = Math.min(...sorted.map((z) => Math.min(z.lo, z.hi)));

  for (const z of sorted) {
    if (inBand(price, z)) {
      const loc: PriceLocation =
        z.level === 1 ? 'INSIDE_ZONE_1' : z.level === 2 ? 'INSIDE_ZONE_2' : 'INSIDE_ZONE_3';
      return { location: loc, active: z };
    }
  }

  if (price > envelopeHi) return { location: 'ABOVE_ALL', active: null };
  if (price < envelopeLo) return { location: 'BELOW_ALL', active: null };

  // Between zone gaps (e.g. below BZ1 hi but above BZ2 hi)
  if (z1 && price < Math.min(z1.lo, z1.hi) && price > envelopeLo) {
    return { location: 'BETWEEN_ZONES', active: null };
  }
  return { location: 'BETWEEN_ZONES', active: null };
}

export type ConfirmationInput = {
  recommendation?: string | null;
  confidence?: number | null;
  score?: number | null;
  rsi?: number | null;
  macdBullish?: boolean | null;
  trend?: string | null;
  userHasPosition?: boolean;
};

/**
 * ENTRY CONFIRMATION — separate from price location.
 * Strong = thesis + signals support entering at this pocket.
 */
export function evaluateConfirmation(input: ConfirmationInput): ConfirmationStatus {
  const rec = String(input.recommendation || '').toUpperCase();
  const conf = Number(input.confidence ?? 0);
  const score = Number(input.score ?? 0);
  const rsi = input.rsi != null && Number.isFinite(input.rsi) ? Number(input.rsi) : null;
  const trend = String(input.trend || '').toUpperCase();

  if (rec === 'SELL' || rec === 'AVOID NEW POSITION' || rec === 'REDUCE') {
    return 'REJECTED';
  }

  let points = 0;
  if (rec === 'STRONG BUY') points += 3;
  else if (rec === 'BUY') points += 2;
  else if (rec === 'HOLD') points += 0;
  else points -= 1;

  if (conf >= 72) points += 2;
  else if (conf >= 58) points += 1;
  else if (conf > 0 && conf < 45) points -= 1;

  if (score >= 72) points += 2;
  else if (score >= 58) points += 1;
  else if (score > 0 && score < 45) points -= 1;

  if (rsi != null) {
    if (rsi > 78) points -= 2; // chasing overbought
    else if (rsi >= 30 && rsi <= 65) points += 1;
    else if (rsi < 28) points += 1; // oversold bounce pocket
  }

  if (input.macdBullish === true) points += 1;
  if (input.macdBullish === false) points -= 1;
  if (/STRONG|UPTREND|BULL/.test(trend)) points += 1;
  if (/DOWNTREND|BEAR|WEAK/.test(trend)) points -= 1;

  if (points >= 5) return 'STRONG';
  if (points <= 0) return 'REJECTED';
  return 'PENDING';
}

function formatZoneRange(z: BuyBand): string {
  return `${round2(Math.min(z.lo, z.hi)).toFixed(2)}–${round2(Math.max(z.lo, z.hi)).toFixed(2)}`;
}

/**
 * Core decision: location first, then confirmation, then action + wording.
 */
export function resolveBuyZoneDecision(opts: {
  currentPrice: number;
  buyZones: BuyBand[];
  confirmation: ConfirmationInput;
  baseConfidence?: number;
}): BuyZoneDecision {
  const px = opts.currentPrice;
  const buyZones = opts.buyZones;
  const { location, active } = locatePriceInBuyZones(px, buyZones);
  const confirmationStatus = evaluateConfirmation(opts.confirmation);
  const conf = Math.round(
    Math.min(94, Math.max(40, Number(opts.baseConfidence ?? opts.confirmation.confidence ?? 55)))
  );

  const base: Omit<BuyZoneDecision, 'action' | 'displayLabel' | 'reason' | 'zoneKey'> = {
    currentPrice: round2(px),
    buyZones,
    priceLocation: location,
    activeBuyZoneLevel: active?.level ?? null,
    activeBuyZone: active,
    confirmationStatus,
    confidence: conf,
  };

  // --- Outside / above / below ---
  if (location === 'ABOVE_ALL') {
    return {
      ...base,
      action: 'WAIT',
      displayLabel: 'WAIT — PRICE ABOVE BUY ZONES',
      reason:
        'Current price is above all Buy Zones. Do not chase — wait for a pullback into Buy Zone 1–3.',
      zoneKey: 'hold',
    };
  }

  if (location === 'BELOW_ALL') {
    return {
      ...base,
      action: 'WAIT',
      displayLabel: 'WAIT — WAIT FOR BUY ZONE',
      reason:
        'Current price is below Buy Zone 3. Wait for the price to reclaim a Buy Zone and hold above stop before entering.',
      zoneKey: 'hold',
    };
  }

  if (location === 'BETWEEN_ZONES' || location === 'NONE' || !active) {
    return {
      ...base,
      action: 'WAIT',
      displayLabel: 'WAIT — WAIT FOR BUY ZONE',
      reason:
        'Price has not reached a Buy Zone entry pocket yet. Wait for price to enter Buy Zone 1, 2, or 3.',
      zoneKey: 'hold',
    };
  }

  // --- Inside a Buy Zone: NEVER say "outside" ---
  const zoneName = `BUY ZONE ${active.level}`;
  const zoneRange = formatZoneRange(active);

  if (confirmationStatus === 'REJECTED') {
    return {
      ...base,
      action: 'AVOID NEW POSITION',
      displayLabel: `${zoneName} — CONFIRMATION REJECTED`,
      reason: `Current price is inside Buy Zone ${active.level} (${zoneRange}). The entry price is in-zone, but committee validation rejects a new long here — do not buy just because price is in the zone.`,
      zoneKey: 'buy',
    };
  }

  if (confirmationStatus === 'PENDING') {
    return {
      ...base,
      action: 'WAIT',
      displayLabel: `${zoneName} — CONFIRMATION PENDING`,
      reason: `Current price is inside Buy Zone ${active.level} (${zoneRange}). The entry price is acceptable, but the required confirmation signals are not yet strong enough. Wait for confirmation — do not treat this as a missed entry.`,
      zoneKey: 'buy',
    };
  }

  // STRONG confirmation
  if (active.level === 1) {
    return {
      ...base,
      action: 'BUY',
      displayLabel: 'BUY NOW — BUY ZONE 1',
      reason: `Current price is inside Buy Zone 1 (${zoneRange}) with strong confirmation — preferred accumulation pocket for a new position.`,
      zoneKey: 'buy',
    };
  }
  if (active.level === 2) {
    return {
      ...base,
      action: 'BUY',
      displayLabel: 'BUY / ADD — BUY ZONE 2',
      reason: `Current price is inside Buy Zone 2 (${zoneRange}) with sufficient confirmation — core scale-in entry.`,
      zoneKey: 'buy',
    };
  }
  return {
    ...base,
    action: 'BUY',
    displayLabel: 'DEEP VALUE BUY — BUY ZONE 3',
    reason: `Current price is inside Buy Zone 3 (${zoneRange}) with sufficient confirmation — deep-value accumulation pocket.`,
    zoneKey: 'buy',
  };
}

/**
 * Hard validation: forbid contradictory "outside" wording when inside a zone.
 */
export function assertBuyZoneDecisionConsistent(d: BuyZoneDecision): boolean {
  const inside =
    d.priceLocation === 'INSIDE_ZONE_1' ||
    d.priceLocation === 'INSIDE_ZONE_2' ||
    d.priceLocation === 'INSIDE_ZONE_3';
  if (!inside) return true;
  const text = `${d.displayLabel} ${d.reason}`.toLowerCase();
  // Ban affirmative "is outside" claims only — not educational negatives.
  if (
    /price is outside/.test(text) ||
    /outside the preferred buy zone/.test(text) ||
    (/outside the buy zone/.test(text) && !/not outside|already inside|inside buy zone/.test(text))
  ) {
    return false;
  }
  if (d.activeBuyZone && !inBand(d.currentPrice, d.activeBuyZone)) {
    return false;
  }
  return true;
}

/** Repair banned wording if a caller somehow produced it. */
export function sanitizeBuyZoneCopy(d: BuyZoneDecision): BuyZoneDecision {
  if (assertBuyZoneDecisionConsistent(d)) return d;
  if (d.activeBuyZoneLevel != null) {
    return {
      ...d,
      displayLabel: `BUY ZONE ${d.activeBuyZoneLevel} — CONFIRMATION PENDING`,
      reason: `Current price is inside Buy Zone ${d.activeBuyZoneLevel}. Entry price is in-zone; waiting on confirmation.`,
      action: d.action === 'BUY' ? 'BUY' : 'WAIT',
      zoneKey: 'buy',
    };
  }
  return d;
}
