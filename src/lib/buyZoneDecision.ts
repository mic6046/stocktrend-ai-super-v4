/**
 * Primary-action decision SSOT.
 * Sequence: market data → zones → price location → position → priority → ONE action → validate → explain.
 * Future Buy / Re-entry / Take-Profit zones may be shown, but never as a second concurrent primary action.
 */

export type BuyBand = {
  level: 1 | 2 | 3;
  label: string;
  lo: number;
  hi: number;
  sizePct?: number;
  anchor?: string;
  /** Opportunity metadata — never implies current BUY by itself */
  reason?: string;
  confirmationRequirement?: string;
  riskLevel?: 'Low' | 'Medium' | 'High';
  invalidation?: number | null;
  /** Display role relative to current primary action */
  status?: 'ACTIVE_ENTRY' | 'FUTURE_ENTRY_ZONE' | 'FUTURE_REENTRY_ZONE' | 'INACTIVE';
};

export type PriceBand = { lo: number; hi: number };

export type PriceLocation =
  | 'INSIDE_ZONE_1'
  | 'INSIDE_ZONE_2'
  | 'INSIDE_ZONE_3'
  | 'INSIDE_TAKE_PROFIT'
  | 'INSIDE_REDUCE'
  | 'INSIDE_EXIT'
  | 'ABOVE_ALL'
  | 'BELOW_ALL'
  | 'BETWEEN_ZONES'
  | 'AT_STOP'
  | 'NORMAL_HOLD'
  | 'NONE';

export type ConfirmationStatus = 'STRONG' | 'PENDING' | 'REJECTED';

/** Canonical primary actions — exactly one per stock/horizon/price */
export type PrimaryAction =
  | 'BUY'
  | 'ADD'
  | 'HOLD'
  | 'WAIT'
  | 'TAKE PROFIT'
  | 'PARTIAL TAKE PROFIT'
  | 'REDUCE'
  | 'EXIT'
  | 'RE-ENTRY'
  | 'REASSESS'
  | 'INDECISION'
  | 'STOP LOSS'
  | 'AVOID NEW POSITION';

export type ConfidenceBand = 'Very Low' | 'Low' | 'Moderate' | 'High';

export type PrimaryDecision = {
  currentPrice: number;
  userHasPosition: boolean;
  buyZones: BuyBand[];
  takeProfitZone: PriceBand;
  reEntryZone: PriceBand | null;
  stopLoss: number;
  targetPrice: number;
  expectedReturn: number;
  priceLocation: PriceLocation;
  activeBuyZoneLevel: 1 | 2 | 3 | null;
  activeBuyZone: BuyBand | null;
  confirmationStatus: ConfirmationStatus;
  /** Machine action mapped for ZoneAction consumers */
  action: PrimaryAction;
  displayLabel: string;
  reason: string;
  why: string;
  nextOpportunity: string;
  /** 2–4 conflicting factors when action is INDECISION */
  conflictingFactors: string[];
  /** Specific condition that would resolve uncertainty */
  whatToWatch: string;
  confidenceBand: ConfidenceBand;
  zoneKey: string;
  confidence: number;
  /** True after contradiction repair */
  validated: boolean;
  conflictsFixed: string[];
};

/** @deprecated alias — flat buy-zone path still returns BuyZoneDecision shape fields */
export type BuyZoneDecision = {
  currentPrice: number;
  buyZones: BuyBand[];
  priceLocation: PriceLocation;
  activeBuyZoneLevel: 1 | 2 | 3 | null;
  activeBuyZone: BuyBand | null;
  confirmationStatus: ConfirmationStatus;
  action: 'BUY' | 'WAIT' | 'AVOID NEW POSITION';
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

function bandHi(b: { lo: number; hi: number }) {
  return Math.max(b.lo, b.hi);
}

function bandLo(b: { lo: number; hi: number }) {
  return Math.min(b.lo, b.hi);
}

function formatZoneRange(z: { lo: number; hi: number }): string {
  return `${round2(bandLo(z)).toFixed(2)}–${round2(bandHi(z)).toFixed(2)}`;
}

function overlaps(a: PriceBand, b: PriceBand): boolean {
  return bandLo(a) < bandHi(b) - 1e-9 && bandLo(b) < bandHi(a) - 1e-9;
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
  const envelopeHi = Math.max(...sorted.map((z) => bandHi(z)));
  const envelopeLo = Math.min(...sorted.map((z) => bandLo(z)));

  for (const z of sorted) {
    if (inBand(price, z)) {
      const loc: PriceLocation =
        z.level === 1 ? 'INSIDE_ZONE_1' : z.level === 2 ? 'INSIDE_ZONE_2' : 'INSIDE_ZONE_3';
      return { location: loc, active: z };
    }
  }

  if (price > envelopeHi) return { location: 'ABOVE_ALL', active: null };
  if (price < envelopeLo) return { location: 'BELOW_ALL', active: null };
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
  /** Extended conflict-detection inputs (optional) */
  institutionalScore?: number | null;
  whaleScore?: number | null;
  smartMoneyScore?: number | null;
  fundFlowBias?: 'inflow' | 'outflow' | 'neutral' | null;
  volumeBias?: 'high' | 'low' | 'normal' | null;
  bollingerBias?: 'oversold' | 'overbought' | 'mid' | null;
  emaBias?: 'bull' | 'bear' | 'neutral' | null;
  newsBias?: 'bull' | 'bear' | 'neutral' | null;
  technicalScore?: number | null;
  fundamentalScore?: number | null;
  momentumScore?: number | null;
  resistanceNearby?: boolean | null;
  supportNearby?: boolean | null;
  dataQuality?: 'good' | 'stale' | 'missing' | 'unreliable' | null;
  zoneConflict?: boolean | null;
  /** Price still holding above key support (not a confirmed breakdown). */
  supportHolding?: boolean | null;
  supportBroken?: boolean | null;
  supportLevel?: number | null;
  resistanceLevel?: number | null;
  majorResistance?: number | null;
};

export type EvidenceConflictReport = {
  isIndecision: boolean;
  /** Setup timing is clear even if not ready to act (WAIT, not INDECISION) */
  setupClear: boolean;
  conflicts: string[];
  whatToWatch: string;
  conflictScore: number;
  confidenceBand: ConfidenceBand;
};

function stanceFromScore(n: number | null | undefined): 'bull' | 'bear' | 'neutral' {
  if (n == null || !Number.isFinite(n)) return 'neutral';
  if (n >= 62) return 'bull';
  if (n <= 38) return 'bear';
  return 'neutral';
}

function confidenceBandFrom(conf: number): ConfidenceBand {
  if (conf >= 80) return 'High';
  if (conf >= 65) return 'Moderate';
  if (conf >= 50) return 'Low';
  return 'Very Low';
}

/**
 * Detect material disagreements across major components.
 * WAIT = setup clear, timing wrong. INDECISION = evidence itself unclear.
 */
export function detectEvidenceConflicts(opts: {
  confirmation: ConfirmationInput;
  currentPrice: number;
  buyZones: BuyBand[];
  takeProfitZone: PriceBand;
  targetPrice: number;
  expectedReturn: number;
  baseConfidence: number;
  zoneConflictsFixed?: string[];
}): EvidenceConflictReport {
  const c = opts.confirmation;
  const conf = opts.baseConfidence;
  const conflicts: string[] = [];
  let conflictScore = 0;

  const trend = String(c.trend || '').toUpperCase();
  const trendBull = /STRONG|UPTREND|BULL/.test(trend);
  const trendBear = /DOWNTREND|BEAR|WEAK/.test(trend);
  const rsi = c.rsi != null && Number.isFinite(c.rsi) ? Number(c.rsi) : null;
  const rsiBull = rsi != null && rsi >= 45 && rsi <= 70;
  const rsiBear = rsi != null && (rsi < 35 || rsi > 75);
  const macdBull = c.macdBullish === true;
  const macdBear = c.macdBullish === false;
  const inst = stanceFromScore(c.institutionalScore);
  const whale = stanceFromScore(c.whaleScore);
  const smart = stanceFromScore(c.smartMoneyScore);
  const fund = stanceFromScore(c.fundamentalScore);
  const tech = stanceFromScore(c.technicalScore ?? c.score);
  const mom = stanceFromScore(c.momentumScore);
  const flowBear = c.fundFlowBias === 'outflow' || inst === 'bear' || whale === 'bear' || smart === 'bear';
  const flowBull = c.fundFlowBias === 'inflow' || inst === 'bull' || whale === 'bull' || smart === 'bull';
  const priceBull = trendBull || macdBull || (c.emaBias === 'bull');
  const priceBear = trendBear || macdBear || (c.emaBias === 'bear');

  if (priceBull && flowBear) {
    conflicts.push('Price/momentum bullish vs institutional / smart-money flow weakening');
    conflictScore += 3;
  }
  if (priceBear && flowBull) {
    conflicts.push('Price weakness vs institutional / smart-money still supportive');
    conflictScore += 2;
  }
  if (tech === 'bull' && fund === 'bear') {
    conflicts.push('Technical bullish vs fundamental weakness');
    conflictScore += 3;
  }
  if (tech === 'bear' && fund === 'bull') {
    conflicts.push('Technical weakness vs stronger fundamentals');
    conflictScore += 2;
  }
  if (trendBull && macdBear) {
    conflicts.push('Trend and MACD disagree');
    conflictScore += 2;
  }
  if (trendBear && macdBull) {
    conflicts.push('Downtrend vs constructive MACD');
    conflictScore += 2;
  }
  if (mom === 'bull' && trendBear) {
    conflicts.push('Momentum improving while trend remains weak');
    conflictScore += 2;
  }
  if (mom === 'bear' && trendBull) {
    conflicts.push('Momentum fading while trend still labeled bullish');
    conflictScore += 2;
  }
  if (rsiBull && flowBear) {
    conflicts.push('RSI constructive but flow/institutional signals are soft');
    conflictScore += 1;
  }
  if (rsi != null && rsi > 72 && priceBull) {
    conflicts.push('Momentum extended (RSI elevated) near resistance risk');
    conflictScore += 1;
  }
  if (c.resistanceNearby && priceBull) {
    conflicts.push('Price approaching significant resistance with incomplete confirmation');
    conflictScore += 2;
  }
  if (c.supportNearby && priceBear) {
    conflicts.push('Price near support while bearish pressure persists');
    conflictScore += 1;
  }
  if (c.volumeBias === 'low' && (priceBull || priceBear)) {
    conflicts.push('Directional move lacks supportive volume');
    conflictScore += 1;
  }
  if (c.newsBias === 'bear' && priceBull) {
    conflicts.push('News/event risk conflicts with bullish price action');
    conflictScore += 2;
  }
  if (c.newsBias === 'bull' && priceBear) {
    conflicts.push('Positive news bias vs weak price action');
    conflictScore += 1;
  }
  if (opts.expectedReturn > -1 && opts.expectedReturn < 2.5 && opts.expectedReturn !== 0) {
    conflicts.push('Expected risk/reward from current price is unclear or thin');
    conflictScore += 2;
  }
  if (c.dataQuality === 'stale' || c.dataQuality === 'missing' || c.dataQuality === 'unreliable') {
    conflicts.push(`Data quality is ${c.dataQuality} — insufficient reliability for a directional call`);
    conflictScore += 3;
  }
  if (c.zoneConflict || (opts.zoneConflictsFixed && opts.zoneConflictsFixed.length >= 2)) {
    conflicts.push('Buy Zone and Take-Profit structure produced conflicting signals');
    conflictScore += 2;
  }

  // Ambiguous mid-structure: between zones / not clearly in buy or TP
  const buyLoc = locatePriceInBuyZones(opts.currentPrice, opts.buyZones);
  const inTp =
    inBand(opts.currentPrice, opts.takeProfitZone) ||
    opts.currentPrice >= bandLo(opts.takeProfitZone);
  if (
    (buyLoc.location === 'BETWEEN_ZONES' || buyLoc.location === 'NONE') &&
    !inTp &&
    conflictScore >= 1
  ) {
    conflicts.push('Price sits in an ambiguous area between key support and resistance zones');
    conflictScore += 1;
  }

  // Committee / score vs recommendation tension
  const rec = String(c.recommendation || '').toUpperCase();
  if ((rec === 'BUY' || rec === 'STRONG BUY') && (flowBear || fund === 'bear')) {
    conflicts.push('Buy-leaning thesis vs opposing flow or fundamental signals');
    conflictScore += 2;
  }
  if ((rec === 'SELL' || rec === 'AVOID NEW POSITION') && (flowBull || tech === 'bull')) {
    conflicts.push('Defensive thesis vs still-constructive technical/flow signals');
    conflictScore += 2;
  }

  const unique = [...new Set(conflicts)].slice(0, 4);
  const envelopeHi = opts.buyZones.length
    ? Math.max(...opts.buyZones.map((z) => bandHi(z)))
    : opts.currentPrice;
  const aboveEntry = opts.currentPrice > envelopeHi;
  const setupClear =
    unique.length === 0 &&
    (aboveEntry || buyLoc.location.startsWith('INSIDE_ZONE') || inTp) &&
    conf >= 50 &&
    c.dataQuality !== 'missing' &&
    c.dataQuality !== 'unreliable';

  // Confidence framework
  let isIndecision = false;
  if (conf < 50) {
    isIndecision = true;
  } else if (conf < 65) {
    isIndecision = conflictScore >= 2 || unique.length >= 2;
  } else if (conf < 80) {
    isIndecision = conflictScore >= 4 || unique.length >= 3;
  } else {
    // High confidence cannot override obvious contradiction
    isIndecision = conflictScore >= 6 || (unique.length >= 3 && conflictScore >= 5);
  }

  if (c.dataQuality === 'missing' || c.dataQuality === 'unreliable') {
    isIndecision = true;
  }

  // Structure-first: mixed flow vs an intact support/trend is WAIT/HOLD, not INDECISION.
  if (c.supportHolding && !c.supportBroken && c.dataQuality !== 'missing' && c.dataQuality !== 'unreliable') {
    isIndecision = false;
  }

  // Build what-to-watch
  let whatToWatch = 'Wait for major signals to agree before taking a directional action.';
  if (aboveEntry) {
    whatToWatch = `Watch for a pullback into ${
      opts.buyZones[0] ? formatZoneRange(opts.buyZones[0]) : 'the preferred Buy Zone'
    } with support holding and flow no longer conflicting.`;
  } else if (buyLoc.active) {
    whatToWatch = `Watch for confirmation while price holds Buy Zone ${buyLoc.active.level} (${formatZoneRange(buyLoc.active)}) with improving institutional flow.`;
  } else if (opts.targetPrice > opts.currentPrice) {
    whatToWatch = `Watch for a confirmed break above ${round2(opts.targetPrice * 0.98).toFixed(2)} with improving institutional flow — or a clean pullback into support.`;
  }
  if (flowBear && priceBull) {
    whatToWatch = `Watch for institutional / smart-money flow to stabilize while price holds above key support, or for a pullback into ${
      opts.buyZones[0] ? formatZoneRange(opts.buyZones[0]) : 'the Buy Zone'
    }.`;
  }
  if (c.resistanceNearby) {
    const rHint =
      c.resistanceLevel != null && Number.isFinite(c.resistanceLevel)
        ? round2(c.resistanceLevel).toFixed(2)
        : opts.targetPrice > 0
          ? round2(opts.targetPrice).toFixed(2)
          : 'nearby resistance';
    whatToWatch = `Watch for a confirmed break above ${rHint} with improving institutional flow — otherwise wait rather than forcing an entry.`;
  }
  const sHint =
    c.supportLevel != null && Number.isFinite(c.supportLevel) ? round2(c.supportLevel).toFixed(2) : null;
  const rHint =
    c.resistanceLevel != null && Number.isFinite(c.resistanceLevel)
      ? round2(c.resistanceLevel).toFixed(2)
      : null;
  const r2Hint =
    c.majorResistance != null && Number.isFinite(c.majorResistance)
      ? round2(c.majorResistance).toFixed(2)
      : null;
  if (sHint || rHint) {
    const bear = sHint
      ? `Bearish trigger: confirmed close below ${sHint} with volume.`
      : 'Bearish trigger: confirmed support breakdown with volume.';
    const bull = rHint
      ? `Bullish trigger: reclaim ${rHint}${r2Hint ? `, then confirmation above ${r2Hint}` : ''}.`
      : 'Bullish trigger: confirmed resistance break with volume.';
    whatToWatch = `${whatToWatch} ${bear} ${bull}`;
  }

  return {
    isIndecision,
    setupClear,
    conflicts: unique,
    whatToWatch,
    conflictScore,
    confidenceBand: confidenceBandFrom(conf),
  };
}

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

  if (rec === 'SELL' || rec === 'AVOID NEW POSITION') {
    return 'REJECTED';
  }
  // REDUCE while support holds is a sizing call, not a broken thesis.
  if (rec === 'REDUCE' && input.supportHolding && !input.supportBroken) {
    return 'PENDING';
  }
  if (rec === 'REDUCE' && input.supportBroken) {
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
    if (rsi > 78) points -= 2;
    else if (rsi >= 30 && rsi <= 65) points += 1;
    else if (rsi < 28) points += 1;
  }

  if (input.macdBullish === true) points += 1;
  if (input.macdBullish === false) points -= 1;
  if (/STRONG|UPTREND|BULL/.test(trend)) points += 1;
  if (/DOWNTREND|BEAR|WEAK/.test(trend)) points -= 1;

  if (points >= 5) return 'STRONG';
  if (points <= 0) return 'REJECTED';
  return 'PENDING';
}

/**
 * Prevent Buy Zone ↔ Take-Profit overlap and keep TP above entry structure.
 * Overlapping buy pocket becomes the FUTURE RE-ENTRY zone (not a current BUY).
 */
export function reconcileBuyAndTakeProfitZones(opts: {
  buyZones: BuyBand[];
  takeProfitZone: PriceBand;
  targetPrice: number;
  currentPrice: number;
  stopLoss: number;
}): {
  buyZones: BuyBand[];
  takeProfitZone: PriceBand;
  reEntryZone: PriceBand | null;
  stopLoss: number;
  conflictsFixed: string[];
} {
  const conflictsFixed: string[] = [];
  let buyZones = opts.buyZones.map((z) => ({ ...z }));
  let tp = {
    lo: round2(bandLo(opts.takeProfitZone)),
    hi: round2(Math.max(bandHi(opts.takeProfitZone), bandLo(opts.takeProfitZone) + 0.01)),
  };
  let stopLoss = opts.stopLoss;
  const px = opts.currentPrice;
  const eps = Math.max(px * 0.001, 0.01);

  if (!buyZones.length) {
    return { buyZones, takeProfitZone: tp, reEntryZone: null, stopLoss, conflictsFixed };
  }

  // Sort / de-overlap buy zones descending by level
  buyZones = [...buyZones].sort((a, b) => a.level - b.level);
  for (let i = 0; i < buyZones.length - 1; i++) {
    const upper = buyZones[i];
    const lower = buyZones[i + 1];
    if (overlaps(upper, lower)) {
      conflictsFixed.push(`${upper.label} overlapped ${lower.label}`);
      lower.hi = round2(Math.min(bandHi(lower), bandLo(upper) - eps));
      if (bandLo(lower) >= bandHi(lower)) {
        lower.lo = round2(bandHi(lower) - Math.max(eps * 4, px * 0.008));
      }
    }
  }

  const envelopeHi = Math.max(...buyZones.map((z) => bandHi(z)));
  const envelopeLo = Math.min(...buyZones.map((z) => bandLo(z)));
  const z1 = buyZones.find((z) => z.level === 1) ?? buyZones[0];
  const reEntryZone: PriceBand = { lo: z1.lo, hi: z1.hi };

  // Target must sit at/above TP mid; TP must sit above buy envelope
  let target = opts.targetPrice > 0 ? opts.targetPrice : tp.hi;
  if (target <= envelopeHi) {
    conflictsFixed.push('Target was at/below Buy Zone envelope — lifted target/TP');
    target = round2(envelopeHi * 1.035);
  }
  if (tp.lo <= envelopeHi + eps * 0.5) {
    conflictsFixed.push('Take-Profit overlapped Buy Zones — lifted TP above entry envelope');
    tp = {
      lo: round2(envelopeHi + eps * 2),
      hi: round2(Math.max(target, envelopeHi + eps * 2 + px * 0.015, tp.hi)),
    };
  }
  if (tp.hi < tp.lo) {
    tp.hi = round2(tp.lo + px * 0.012);
    conflictsFixed.push('Take-Profit range inverted — repaired');
  }
  if (!(stopLoss < envelopeLo - eps * 0.25)) {
    stopLoss = round2(envelopeLo - Math.max(eps, px * 0.01));
    conflictsFixed.push('Stop Loss was not under Buy Zones — repaired');
  }

  return { buyZones, takeProfitZone: tp, reEntryZone, stopLoss, conflictsFixed };
}

function expectedReturnFromTarget(px: number, target: number): number {
  if (!(px > 0)) return 0;
  return round2(((target - px) / px) * 100);
}

function annotateBuyZoneStatus(
  buyZones: BuyBand[],
  primary: PrimaryAction,
  activeLevel: 1 | 2 | 3 | null,
  userHasPosition: boolean
): BuyBand[] {
  return buyZones.map((z) => {
    const isActiveEntry =
      activeLevel === z.level &&
      (primary === 'BUY' || primary === 'ADD' || primary === 'RE-ENTRY');
    let status: BuyBand['status'] = 'FUTURE_ENTRY_ZONE';
    if (isActiveEntry) status = 'ACTIVE_ENTRY';
    else if (userHasPosition || primary === 'TAKE PROFIT' || primary === 'PARTIAL TAKE PROFIT') {
      status = 'FUTURE_REENTRY_ZONE';
    } else if (
      primary === 'WAIT' ||
      primary === 'REASSESS' ||
      primary === 'HOLD' ||
      primary === 'INDECISION'
    ) {
      status = 'FUTURE_ENTRY_ZONE';
    }
    return {
      ...z,
      status,
      reason: z.anchor ? `Structural anchor: ${z.anchor}` : 'Support / pullback pocket',
      confirmationRequirement:
        'Price inside zone + strong confirmation (committee, RSI not chasing, trend intact)',
      riskLevel: z.level === 1 ? 'Medium' : z.level === 2 ? 'Medium' : 'High',
      invalidation: z.invalidation ?? null,
    };
  });
}

/**
 * ONE CURRENT PRICE = ONE CURRENT ACTION.
 * Priority hierarchy is absolute — indicators cannot bypass it.
 */
export function resolvePrimaryAction(opts: {
  currentPrice: number;
  userHasPosition: boolean;
  buyZones: BuyBand[];
  takeProfitZone: PriceBand;
  reduceZone?: PriceBand | null;
  exitZone?: PriceBand | null;
  stopLoss: number;
  targetPrice: number;
  expectedReturn?: number | null;
  confirmation: ConfirmationInput;
  baseConfidence?: number;
}): PrimaryDecision {
  const px = opts.currentPrice;
  const confInput = {
    ...opts.confirmation,
    userHasPosition: opts.userHasPosition,
  };
  const confirmationStatus = evaluateConfirmation(confInput);
  const conf = Math.round(
    Math.min(94, Math.max(40, Number(opts.baseConfidence ?? opts.confirmation.confidence ?? 55)))
  );

  // Snapshot ORIGINAL zone membership BEFORE display reconciliation lifts TP above buys
  const rawBuyLoc = locatePriceInBuyZones(px, opts.buyZones);
  const rawActive = rawBuyLoc.active;
  const rawEnvelopeHi = opts.buyZones.length
    ? Math.max(...opts.buyZones.map((z) => bandHi(z)))
    : px;
  const rawTp = {
    lo: bandLo(opts.takeProfitZone),
    hi: bandHi(opts.takeProfitZone),
  };
  const rawInTp = inBand(px, rawTp) || px >= rawTp.lo;
  const rawInReduce = opts.reduceZone ? inBand(px, opts.reduceZone) : false;
  const rawInExit = opts.exitZone
    ? inBand(px, opts.exitZone) || px >= bandHi(opts.exitZone)
    : false;
  const rawAboveEntry = px > rawEnvelopeHi;
  const severeBreakdown = px <= opts.stopLoss;
  const thesisRejected =
    confirmationStatus === 'REJECTED' ||
    /SELL|AVOID NEW POSITION/.test(String(opts.confirmation.recommendation || '').toUpperCase());

  const reconciled = reconcileBuyAndTakeProfitZones({
    buyZones: opts.buyZones,
    takeProfitZone: opts.takeProfitZone,
    targetPrice: opts.targetPrice,
    currentPrice: px,
    stopLoss: opts.stopLoss,
  });

  const buyZones = reconciled.buyZones;
  const tp = reconciled.takeProfitZone;
  const stopLoss = reconciled.stopLoss;
  const reEntryZone = reconciled.reEntryZone;
  const target =
    opts.targetPrice > bandHi(tp)
      ? opts.targetPrice
      : Math.max(opts.targetPrice, bandHi(tp));
  let expectedReturn =
    opts.expectedReturn != null && Number.isFinite(opts.expectedReturn)
      ? round2(opts.expectedReturn)
      : expectedReturnFromTarget(px, target);
  const calcEr = expectedReturnFromTarget(px, target);
  if (Math.sign(calcEr) !== Math.sign(expectedReturn) || Math.abs(calcEr - expectedReturn) > 0.2) {
    expectedReturn = calcEr;
  }
  if (target <= px && expectedReturn > 0) expectedReturn = calcEr;

  const conflictReport = detectEvidenceConflicts({
    confirmation: confInput,
    currentPrice: px,
    buyZones: opts.buyZones,
    takeProfitZone: opts.takeProfitZone,
    targetPrice: target,
    expectedReturn,
    baseConfidence: conf,
    zoneConflictsFixed: reconciled.conflictsFixed,
  });

  const { location: buyLoc, active } = locatePriceInBuyZones(px, buyZones);
  // Prefer raw membership for action priority (TP vs Buy overlap case)
  const inTp = rawInTp || px >= target * 0.995;
  const inReduce = rawInReduce;
  const inExit = rawInExit;
  const upsideUnattractive = expectedReturn < 2.5 || px >= target * 0.995;
  const actionActive = rawActive ?? active;
  const actionBuyLoc = rawBuyLoc.location;

  let priceLocation: PriceLocation = actionBuyLoc;
  if (severeBreakdown) priceLocation = 'AT_STOP';
  else if (inExit) priceLocation = 'INSIDE_EXIT';
  else if (inReduce && !inTp) priceLocation = 'INSIDE_REDUCE';
  else if (inTp || (upsideUnattractive && (rawAboveEntry || rawInTp))) {
    priceLocation = 'INSIDE_TAKE_PROFIT';
  } else if (actionBuyLoc === 'ABOVE_ALL' || actionBuyLoc === 'BETWEEN_ZONES' || actionBuyLoc === 'NONE') {
    priceLocation = actionBuyLoc === 'ABOVE_ALL' ? 'ABOVE_ALL' : 'NORMAL_HOLD';
  }

  const base = {
    currentPrice: round2(px),
    userHasPosition: opts.userHasPosition,
    buyZones,
    takeProfitZone: tp,
    reEntryZone,
    stopLoss: round2(stopLoss),
    targetPrice: round2(target),
    expectedReturn,
    confirmationStatus,
    activeBuyZoneLevel: actionActive?.level ?? null,
    activeBuyZone: actionActive,
    confidence: conf,
    conflictsFixed: reconciled.conflictsFixed,
    conflictingFactors: conflictReport.conflicts,
    whatToWatch: conflictReport.whatToWatch,
    confidenceBand: conflictReport.confidenceBand,
  };

  const finish = (
    partial: Omit<
      PrimaryDecision,
      keyof typeof base | 'validated' | 'buyZones' | 'priceLocation'
    > & {
      priceLocation?: PriceLocation;
      conflictingFactors?: string[];
      whatToWatch?: string;
      confidenceBand?: ConfidenceBand;
    }
  ): PrimaryDecision => {
    const action = partial.action;
    const annotated = annotateBuyZoneStatus(
      buyZones,
      action,
      actionActive?.level ?? null,
      opts.userHasPosition
    );
    const decision: PrimaryDecision = {
      ...base,
      ...partial,
      buyZones: annotated,
      priceLocation: partial.priceLocation ?? priceLocation,
      conflictingFactors: partial.conflictingFactors ?? base.conflictingFactors,
      whatToWatch: partial.whatToWatch ?? base.whatToWatch,
      confidenceBand: partial.confidenceBand ?? base.confidenceBand,
      validated: true,
    };
    return sanitizePrimaryDecision(decision);
  };

  const indecisionResult = () =>
    finish({
      action: 'INDECISION',
      displayLabel: 'INDECISION',
      reason:
        'Signals are currently conflicting. There is not enough agreement for a high-confidence directional action — sometimes the best decision is not to make a directional decision.',
      why:
        conflictReport.conflicts.length > 0
          ? `Signals are mixed. ${conflictReport.conflicts.slice(0, 2).join('; ')}.`
          : 'Evidence is insufficient or conflicting for a reliable directional recommendation.',
      nextOpportunity: conflictReport.whatToWatch,
      conflictingFactors: conflictReport.conflicts.slice(0, 4),
      whatToWatch: conflictReport.whatToWatch,
      zoneKey: 'hold',
      confidenceBand: conflictReport.confidenceBand === 'High' ? 'Moderate' : conflictReport.confidenceBand,
    });

  // ─── Hard deterministic risk/exit (survives INDECISION) ─────────
  if (severeBreakdown) {
    if (opts.userHasPosition) {
      return finish({
        action: 'STOP LOSS',
        displayLabel: 'STOP LOSS / REASSESS',
        reason: `Live price is at/below stop ${round2(stopLoss).toFixed(2)} — capital protection exit.`,
        why: `Price broke the invalidation level (${round2(stopLoss).toFixed(2)}). Thesis is compromised.`,
        nextOpportunity:
          'Reassess only after price reclaims structure and holds above the re-entry zone with confirmation.',
        zoneKey: 'stop',
        priceLocation: 'AT_STOP',
        conflictingFactors: [],
        whatToWatch: 'Reclaim and hold above the stop/invalidation with confirmation before any re-entry.',
      });
    }
    return finish({
      action: 'REASSESS',
      displayLabel: 'REASSESS — STRUCTURE BROKEN',
      reason: `Price is below stop/invalidation ${round2(stopLoss).toFixed(2)} — do not buy the breakdown.`,
      why: 'Breakdown is not a bargain entry without structure reclaim.',
      nextOpportunity: 'Wait for reclaim of Buy Zone 3+ and confirmation before any new long.',
      zoneKey: 'stop',
      priceLocation: 'AT_STOP',
      conflictingFactors: [],
      whatToWatch: 'Reclaim of structure above the Buy Zones with confirmation.',
    });
  }

  // Material conflict / low confidence → INDECISION (do not force BUY/HOLD/TP)
  // Exception: intact support is WAIT/HOLD decision-support, not INDECISION
  if (conflictReport.isIndecision) {
    const structureHolds = !!confInput.supportHolding && !confInput.supportBroken;
    if (!structureHolds) return indecisionResult();
  }

  // ─── OWNED POSITION ─────────────────────────────────────────────
  if (opts.userHasPosition) {
    if (inExit) {
      return finish({
        action: 'EXIT',
        displayLabel: 'SELL',
        reason: 'Price is in/above the EXIT zone — close remaining exposure.',
        why: 'Exit zone reached — remaining risk is no longer justified.',
        nextOpportunity: `Watch future re-entry zone ${reEntryZone ? formatZoneRange(reEntryZone) : 'N/A'} only after a clean pullback and confirmation — not an immediate BUY.`,
        zoneKey: 'exit',
      });
    }

    const recU = String(opts.confirmation.recommendation || '').toUpperCase();
    const structureHolds = !!confInput.supportHolding && !confInput.supportBroken;
    const atTarget = inTp || px >= target * 0.995;

    if (inReduce && !atTarget) {
      return finish({
        action: 'REDUCE',
        displayLabel: 'REDUCE PARTIAL',
        reason: 'Price is in the REDUCE zone — trim exposure rather than a full exit while the next support test is unconfirmed.',
        why: 'Extension into reduce territory — cut size; do not treat this as an automatic SELL.',
        nextOpportunity: `Watch future re-entry zone ${reEntryZone ? formatZoneRange(reEntryZone) : 'N/A'} only after a clean pullback and confirmation — not an immediate BUY.`,
        zoneKey: 'reduce',
      });
    }

    // Take-Profit PRIORITY over nearby/overlapping Buy Zone — only when actually at TP
    if (atTarget) {
      const partial = expectedReturn > 0.5 && expectedReturn < 6 && !inExit && !inReduce;
      return finish({
        action: partial ? 'PARTIAL TAKE PROFIT' : 'TAKE PROFIT',
        displayLabel: 'REDUCE PARTIAL',
        reason: `Take profit now. Price has reached the profit-taking area. If the price subsequently pulls back into the re-entry zone, reassess for a new entry.`,
        why: `Current price ${round2(px).toFixed(2)} is in/near take-profit territory. Take-profit has priority over any nearby Buy Zone.`,
        nextOpportunity: `Future re-entry zone${
          reEntryZone ? ` ${formatZoneRange(reEntryZone)}` : ''
        }: wait for pullback + confirmation — not an automatic BUY.`,
        zoneKey: 'takeProfit',
        priceLocation: 'INSIDE_TAKE_PROFIT',
      });
    }

    if (recU === 'REDUCE' && structureHolds) {
      return finish({
        action: 'REDUCE',
        displayLabel: 'REDUCE PARTIAL',
        reason:
          'Price is still holding above key support, but institutional / smart-money flow is weakening — reduce partial rather than a full SELL.',
        why: 'Support and trend structure remain intact. Weakening flow is a sizing warning, not a confirmed breakdown.',
        nextOpportunity: conflictReport.whatToWatch,
        zoneKey: 'hold',
        priceLocation: 'NORMAL_HOLD',
      });
    }

    if (thesisRejected && confInput.supportBroken) {
      return finish({
        action: 'EXIT',
        displayLabel: recU === 'AVOID NEW POSITION' ? 'STRONG SELL' : 'SELL',
        reason: 'Key support has broken with a rejected long thesis — exit remaining exposure.',
        why: 'Confirmed support breakdown is the invalidation for a long hold.',
        nextOpportunity: 'Reassess only after price reclaims structure with volume confirmation.',
        zoneKey: 'exit',
      });
    }

    if (
      actionActive &&
      (actionBuyLoc === 'INSIDE_ZONE_1' ||
        actionBuyLoc === 'INSIDE_ZONE_2' ||
        actionBuyLoc === 'INSIDE_ZONE_3')
    ) {
      if (confirmationStatus === 'STRONG' && expectedReturn >= 3) {
        return finish({
          action: 'ADD',
          displayLabel: `ADD / ACCUMULATE — BUY ZONE ${actionActive.level}`,
          reason: `Price is inside Buy Zone ${actionActive.level} (${formatZoneRange(actionActive)}) with confirmation — scale in because you already own the stock.`,
          why: `Attractive accumulation pocket with sufficient confirmation and remaining upside (+${expectedReturn.toFixed(1)}%).`,
          nextOpportunity: `Hold core; next management checkpoint is take-profit ${formatZoneRange(tp)}.`,
          zoneKey: 'add',
        });
      }
      if (confirmationStatus === 'PENDING' || confirmationStatus === 'STRONG') {
        return finish({
          action: 'HOLD',
          displayLabel:
            confirmationStatus === 'PENDING'
              ? `HOLD — ZONE ${actionActive.level} CONFIRMATION PENDING`
              : 'HOLD — WAIT FOR BETTER R/R',
          reason: `Price is inside Buy Zone ${actionActive.level}, but ${
            confirmationStatus === 'PENDING'
              ? 'confirmation is incomplete'
              : 'remaining upside is limited'
          } — hold existing size; do not add yet.`,
          why: 'In-zone price is not an automatic add.',
          nextOpportunity: 'Add only if confirmation and risk/reward both support it.',
          zoneKey: 'hold',
        });
      }
      return finish({
        action: 'REASSESS',
        displayLabel: 'REASSESS — DO NOT ADD',
        reason: `Price is near accumulation structure but confirmation rejects adding here.`,
        why: 'Risk/reward or thesis does not support increasing size.',
        nextOpportunity: 'Reassess if structure reclaims with stronger confirmation.',
        zoneKey: 'hold',
      });
    }

    return finish({
      action: 'HOLD',
      displayLabel: 'HOLD',
      reason: 'Price is in the normal holding range — no action required.',
      why: structureHolds
        ? 'Price is holding above key support and the trend structure remains intact. Mixed or weakening secondary indicators are not a SELL.'
        : 'Between accumulation and take-profit — risk/reward is balanced for the existing position.',
      nextOpportunity: conflictReport.whatToWatch,
      zoneKey: 'hold',
      priceLocation: 'NORMAL_HOLD',
    });
  }

  // ─── NO POSITION (FLAT) ─────────────────────────────────────────
  if (actionBuyLoc === 'BELOW_ALL' && thesisRejected) {
    return finish({
      action: 'REASSESS',
      displayLabel: 'REASSESS — STRUCTURE BROKEN',
      reason:
        'Price is below Buy Zones with rejected confirmation — reassess, do not automatically buy.',
      why: 'Breakdown is not a bargain entry without structure reclaim.',
      nextOpportunity: 'Wait for reclaim of Buy Zone 3+ and confirmation before any new long.',
      zoneKey: 'stop',
      priceLocation: 'BELOW_ALL',
    });
  }

  // WAIT = setup clear, timing wrong (do not chase)
  if (inTp || upsideUnattractive || rawAboveEntry || actionBuyLoc === 'ABOVE_ALL') {
    const nearSup = !!confInput.supportNearby && !!confInput.supportHolding && !confInput.supportBroken;
    const weakIntoResistance = !!confInput.resistanceNearby && confirmationStatus !== 'STRONG';
    return finish({
      action: 'WAIT',
      displayLabel: nearSup ? 'BUY WATCH' : 'WAIT — NO NEW POSITION',
      reason: nearSup
        ? 'Price is near key support with the uptrend still intact — watch for a bullish rejection before starting a position.'
        : weakIntoResistance
          ? 'Price is near resistance with incomplete confirmation — do not chase a new position.'
          : 'Mixed or incomplete confirmation at the current price — wait; do not open a new position.',
      why: `Current price ${round2(px).toFixed(2)} is not an attractive fresh entry. Decision support is WAIT, not a manufactured BUY or SELL.`,
      nextOpportunity: conflictReport.whatToWatch,
      zoneKey: 'hold',
      priceLocation: inTp || rawInTp ? 'INSIDE_TAKE_PROFIT' : 'ABOVE_ALL',
    });
  }

  if (actionBuyLoc === 'BELOW_ALL') {
    return finish({
      action: 'WAIT',
      displayLabel: 'WAIT — NO NEW POSITION',
      reason:
        'Current price is below the preferred entry structure. Wait for a reclaim with confirmation before starting a position.',
      why: 'Below the entry structure — do not buy a breakdown without a confirmed reclaim.',
      nextOpportunity: conflictReport.whatToWatch,
      zoneKey: 'hold',
      priceLocation: 'BELOW_ALL',
    });
  }

  if (actionBuyLoc === 'BETWEEN_ZONES' || actionBuyLoc === 'NONE' || !actionActive) {
    const nearSup = !!confInput.supportNearby && !!confInput.supportHolding && !confInput.supportBroken;
    return finish({
      action: 'WAIT',
      displayLabel: nearSup ? 'BUY WATCH' : 'WAIT — NO NEW POSITION',
      reason: nearSup
        ? 'Price is approaching support without a confirmed breakdown — watch for rejection before entering.'
        : 'Price has not reached a confirmed entry pocket yet. Wait rather than forcing a new position.',
      why: 'Close to zones is not the same as a confirmed entry. Mixed evidence is WAIT, not BUY.',
      nextOpportunity: conflictReport.whatToWatch,
      zoneKey: 'hold',
    });
  }

  const zoneRange = formatZoneRange(actionActive);
  if (confirmationStatus === 'REJECTED' || thesisRejected) {
    return finish({
      action: 'AVOID NEW POSITION',
      displayLabel: 'NO NEW POSITION',
      reason: `Current price is inside Buy Zone ${actionActive.level} (${zoneRange}), but confirmation rejects a new long — do not buy just because price is in the zone.`,
      why: 'A Buy Zone is an opportunity area, not an unconditional buy instruction.',
      nextOpportunity: conflictReport.whatToWatch,
      zoneKey: 'buy',
    });
  }

  if (confirmationStatus === 'PENDING') {
    return finish({
      action: 'WAIT',
      displayLabel: 'BUY WATCH',
      reason: `Current price is inside Buy Zone ${actionActive.level} (${zoneRange}). The entry price is acceptable, but confirmation is not yet strong enough.`,
      why: 'Inside zone ≠ BUY NOW. Watch for confirmation while support holds.',
      nextOpportunity: 'BUY when confirmation turns strong while price holds the zone.',
      zoneKey: 'buy',
    });
  }

  return finish({
    action: actionActive.level >= 2 ? 'RE-ENTRY' : 'BUY',
    displayLabel:
      actionActive.level === 1
        ? 'BUY NOW — BUY ZONE 1'
        : actionActive.level === 2
          ? 'BUY / START — BUY ZONE 2'
          : 'DEEP VALUE BUY — BUY ZONE 3',
    reason: `Current price is inside Buy Zone ${actionActive.level} (${zoneRange}) with strong confirmation — valid start-position pocket.`,
    why: `Deterministic location = inside Buy Zone ${actionActive.level}; confirmation = STRONG; remaining upside +${expectedReturn.toFixed(1)}%.`,
    nextOpportunity: `Scale carefully; manage toward take-profit ${formatZoneRange(tp)}. Invalidation near stop ${round2(stopLoss).toFixed(2)}.`,
    zoneKey: 'buy',
  });
}

/** Map primary action → legacy ZoneAction string used across the app */
export function toZoneAction(action: PrimaryAction): string {
  if (action === 'ADD') return 'ADD POSITION';
  if (action === 'PARTIAL TAKE PROFIT') return 'TAKE PROFIT';
  return action;
}

/**
 * Hard contradiction gate before display.
 */
export function assertPrimaryDecisionConsistent(d: PrimaryDecision): boolean {
  const text = `${d.displayLabel} ${d.reason} ${d.why}`.toLowerCase();
  const action = d.action;

  // Never BUY + TAKE PROFIT simultaneously (single action field already enforces one,
  // but copy must not advertise both as current)
  if (action === 'BUY' || action === 'RE-ENTRY' || action === 'ADD') {
    if (/take profit now|primary action = take profit/.test(text) && !/after take profit|later/.test(text)) {
      return false;
    }
  }
  if (action === 'TAKE PROFIT' || action === 'PARTIAL TAKE PROFIT') {
    if (/\bbuy now\b/.test(text) || /\bprimary action = buy\b/.test(text)) return false;
    if (!d.userHasPosition) return false; // flat must never TP
  }
  if (!d.userHasPosition && (action === 'ADD' || action === 'EXIT' || action === 'STOP LOSS')) {
    // STOP LOSS for flat → should be REASSESS/AVOID; allow AVOID
    if (action === 'ADD' || action === 'EXIT') return false;
  }
  if (d.userHasPosition && action === 'BUY') return false;

  // Location claims
  const insideBuy =
    d.priceLocation === 'INSIDE_ZONE_1' ||
    d.priceLocation === 'INSIDE_ZONE_2' ||
    d.priceLocation === 'INSIDE_ZONE_3';
  if (insideBuy && /price is outside/.test(text)) return false;
  if (d.activeBuyZone && insideBuy && !inBand(d.currentPrice, d.activeBuyZone)) return false;

  // ER sign vs target
  if (d.targetPrice < d.currentPrice && d.expectedReturn > 0) return false;
  if (d.targetPrice > d.currentPrice && d.expectedReturn < 0) return false;

  // TP overlapping buy without re-entry explanation when TP is primary
  if (
    (action === 'TAKE PROFIT' || action === 'PARTIAL TAKE PROFIT') &&
    d.reEntryZone &&
    overlaps(d.takeProfitZone, d.reEntryZone) &&
    !/re-entry|pullback|future/.test(text)
  ) {
    return false;
  }

  // Inside TP but saying BUY
  if (
    (d.priceLocation === 'INSIDE_TAKE_PROFIT' || inBand(d.currentPrice, d.takeProfitZone)) &&
    (action === 'BUY' || action === 'RE-ENTRY')
  ) {
    return false;
  }

  // Inside buy but TAKE PROFIT without ownership
  if (insideBuy && (action === 'TAKE PROFIT' || action === 'PARTIAL TAKE PROFIT') && !d.userHasPosition) {
    return false;
  }

  // INDECISION must not advertise a directional current action
  if (action === 'INDECISION') {
    if (/\bbuy now\b/.test(text) || /take profit now/.test(text)) return false;
  }

  return true;
}

export function sanitizePrimaryDecision(d: PrimaryDecision): PrimaryDecision {
  if (assertPrimaryDecisionConsistent(d)) return { ...d, validated: true };

  // Repair common contradictions
  if (!d.userHasPosition && (d.action === 'TAKE PROFIT' || d.action === 'PARTIAL TAKE PROFIT' || d.action === 'ADD')) {
    return {
      ...d,
      action: 'WAIT',
      displayLabel: 'WAIT — DO NOT CHASE',
      reason:
        'Price is above the preferred entry zone. Wait for a pullback rather than chasing.',
      why: 'Non-owners do not take profit — WAIT for a future entry.',
      nextOpportunity: d.reEntryZone
        ? `Future re-entry zone ${formatZoneRange(d.reEntryZone)}.`
        : 'Wait for a confirmed Buy Zone pullback.',
      zoneKey: 'hold',
      validated: true,
      conflictsFixed: [...d.conflictsFixed, 'Sanitized: flat account cannot TAKE PROFIT/ADD'],
    };
  }

  if (!d.userHasPosition && d.action === 'EXIT') {
    return {
      ...d,
      action: 'WAIT',
      displayLabel: 'WAIT — NO POSITION TO EXIT',
      reason: 'This exit alert applies to existing holders. You have no position here to exit.',
      why: 'Non-owners cannot EXIT a position they do not hold.',
      nextOpportunity: d.reEntryZone
        ? `Future entry zone ${formatZoneRange(d.reEntryZone)}.`
        : 'Wait for a confirmed Buy Zone setup.',
      zoneKey: 'hold',
      validated: true,
      conflictsFixed: [...d.conflictsFixed, 'Sanitized: flat account cannot EXIT'],
    };
  }

  if (d.userHasPosition && d.action === 'BUY') {
    return {
      ...d,
      action: 'ADD',
      displayLabel: 'ADD / ACCUMULATE',
      reason: d.reason.replace(/\bBUY\b/gi, 'ADD'),
      why: 'You already own the stock — ADD replaces BUY.',
      validated: true,
      conflictsFixed: [...d.conflictsFixed, 'Sanitized: owned account cannot BUY'],
    };
  }

  if (
    (d.priceLocation === 'INSIDE_TAKE_PROFIT' || inBand(d.currentPrice, d.takeProfitZone)) &&
    (d.action === 'BUY' || d.action === 'RE-ENTRY' || d.action === 'ADD')
  ) {
    if (d.userHasPosition) {
      return {
        ...d,
        action: 'TAKE PROFIT',
        displayLabel: 'TAKE PROFIT',
        reason:
          'Price has reached the profit-taking area. Consider taking partial or full profit. If price later pulls back into the re-entry zone, reassess rather than buying immediately.',
        why: 'Take-profit priority overrides nearby Buy Zone overlap.',
        nextOpportunity: d.reEntryZone
          ? `Future re-entry zone ${formatZoneRange(d.reEntryZone)} — confirmation required.`
          : 'Wait for pullback confirmation.',
        zoneKey: 'takeProfit',
        validated: true,
        conflictsFixed: [...d.conflictsFixed, 'Sanitized: TP priority over BUY'],
      };
    }
    return {
      ...d,
      action: 'WAIT',
      displayLabel: 'WAIT — DO NOT CHASE',
      reason:
        'Price is in take-profit territory. Wait for a pullback into the re-entry zone rather than chasing.',
      why: 'Non-owner: TP area = WAIT, not BUY.',
      nextOpportunity: d.reEntryZone
        ? `Future re-entry zone ${formatZoneRange(d.reEntryZone)}.`
        : 'Wait for Buy Zone pullback.',
      zoneKey: 'hold',
      validated: true,
      conflictsFixed: [...d.conflictsFixed, 'Sanitized: flat TP→WAIT'],
    };
  }

  return { ...d, validated: assertPrimaryDecisionConsistent(d) };
}

/**
 * Legacy flat-only helper — wraps resolvePrimaryAction for older callers.
 */
export function resolveBuyZoneDecision(opts: {
  currentPrice: number;
  buyZones: BuyBand[];
  confirmation: ConfirmationInput;
  baseConfidence?: number;
  takeProfitZone?: PriceBand;
  stopLoss?: number;
  targetPrice?: number;
}): BuyZoneDecision {
  const px = opts.currentPrice;
  const envelopeHi = opts.buyZones.length
    ? Math.max(...opts.buyZones.map((z) => bandHi(z)))
    : px * 0.99;
  const tp = opts.takeProfitZone ?? {
    lo: round2(envelopeHi * 1.04),
    hi: round2(envelopeHi * 1.08),
  };
  const primary = resolvePrimaryAction({
    currentPrice: px,
    userHasPosition: false,
    buyZones: opts.buyZones,
    takeProfitZone: tp,
    stopLoss: opts.stopLoss ?? round2(px * 0.92),
    targetPrice: opts.targetPrice ?? tp.hi,
    confirmation: opts.confirmation,
    baseConfidence: opts.baseConfidence,
  });

  const action: BuyZoneDecision['action'] =
    primary.action === 'BUY' || primary.action === 'RE-ENTRY'
      ? 'BUY'
      : primary.action === 'AVOID NEW POSITION'
        ? 'AVOID NEW POSITION'
        : 'WAIT';

  return {
    currentPrice: primary.currentPrice,
    buyZones: primary.buyZones,
    priceLocation: primary.priceLocation,
    activeBuyZoneLevel: primary.activeBuyZoneLevel,
    activeBuyZone: primary.activeBuyZone,
    confirmationStatus: primary.confirmationStatus,
    action,
    displayLabel: primary.displayLabel,
    reason: primary.reason,
    zoneKey: (primary.zoneKey === 'buy' || primary.zoneKey === 'stop' ? primary.zoneKey : 'hold') as
      | 'buy'
      | 'hold'
      | 'stop',
    confidence: primary.confidence,
  };
}

export function assertBuyZoneDecisionConsistent(d: BuyZoneDecision): boolean {
  const inside =
    d.priceLocation === 'INSIDE_ZONE_1' ||
    d.priceLocation === 'INSIDE_ZONE_2' ||
    d.priceLocation === 'INSIDE_ZONE_3';
  if (!inside) return true;
  const text = `${d.displayLabel} ${d.reason}`.toLowerCase();
  if (
    /price is outside/.test(text) ||
    /outside the preferred buy zone/.test(text) ||
    (/outside the buy zone/.test(text) && !/not outside|already inside|inside buy zone/.test(text))
  ) {
    return false;
  }
  if (d.activeBuyZone && !inBand(d.currentPrice, d.activeBuyZone)) return false;
  return true;
}

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
