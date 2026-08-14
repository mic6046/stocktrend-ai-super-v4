/**
 * Support / resistance proximity labels for Quantum AI board chips & AI Signals.
 * Thresholds match quantumRecommendationEngine (≈3% of S1, ≈2.5% of R1).
 */

export type SrSignalLabel =
  | 'Near Support'
  | 'Near Resistance'
  | 'Below Support'
  | 'Above Resistance'
  | 'Mid Range'
  | '—';

export type SrProximity = {
  label: SrSignalLabel;
  /** Short tip for UI chips */
  detail: string;
  /** Signed distance to nearest relevant level as fraction of price (null if unknown) */
  distPct: number | null;
};

function nearestBelow(price: number, levels: number[]): number | null {
  let best: number | null = null;
  for (const lv of levels) {
    if (!(lv > 0) || !Number.isFinite(lv)) continue;
    if (lv <= price && (best == null || lv > best)) best = lv;
  }
  return best;
}

function nearestAbove(price: number, levels: number[]): number | null {
  let best: number | null = null;
  for (const lv of levels) {
    if (!(lv > 0) || !Number.isFinite(lv)) continue;
    if (lv >= price && (best == null || lv < best)) best = lv;
  }
  return best;
}

export function classifySrProximity(
  price: number,
  supportLevels?: number[] | null,
  resistanceLevels?: number[] | null,
  opts?: { supportPct?: number; resistancePct?: number }
): SrProximity {
  const supportPct = opts?.supportPct ?? 0.03;
  const resistancePct = opts?.resistancePct ?? 0.025;
  if (!(price > 0) || !Number.isFinite(price)) {
    return { label: '—', detail: 'Price unavailable for S/R check.', distPct: null };
  }

  const supports = (supportLevels || []).filter((v) => Number.isFinite(v) && v > 0);
  const resistances = (resistanceLevels || []).filter((v) => Number.isFinite(v) && v > 0);
  if (!supports.length && !resistances.length) {
    return { label: '—', detail: 'No support/resistance levels yet.', distPct: null };
  }

  const s1 = nearestBelow(price, supports) ?? (supports.length ? Math.max(...supports.filter((s) => s < price * 1.2)) : null);
  const r1 = nearestAbove(price, resistances) ?? (resistances.length ? Math.min(...resistances.filter((r) => r > price * 0.8)) : null);

  // Prefer exact structural levels from engine arrays (first = primary S1/R1)
  const primaryS = supports[0] ?? s1;
  const primaryR = resistances[0] ?? r1;

  let nearSupport = false;
  let nearResistance = false;
  let belowSupport = false;
  let aboveResistance = false;
  let distS: number | null = null;
  let distR: number | null = null;

  if (primaryS != null && Number.isFinite(primaryS)) {
    distS = (price - primaryS) / price;
    if (distS < 0) belowSupport = true;
    else if (distS <= supportPct) nearSupport = true;
  }
  if (primaryR != null && Number.isFinite(primaryR)) {
    distR = (primaryR - price) / price;
    if (distR < 0) aboveResistance = true;
    else if (distR <= resistancePct) nearResistance = true;
  }

  if (belowSupport && !aboveResistance) {
    return {
      label: 'Below Support',
      detail: primaryS != null ? `Price under support $${primaryS.toFixed(2)}` : 'Price under support',
      distPct: distS,
    };
  }
  if (aboveResistance && !belowSupport) {
    return {
      label: 'Above Resistance',
      detail: primaryR != null ? `Price above resistance $${primaryR.toFixed(2)}` : 'Price above resistance',
      distPct: distR,
    };
  }
  if (nearSupport && nearResistance) {
    const preferSupport = Math.abs(distS ?? 99) <= Math.abs(distR ?? 99);
    if (preferSupport) {
      return {
        label: 'Near Support',
        detail:
          primaryS != null && primaryR != null
            ? `Tight range — nearer support $${primaryS.toFixed(2)} (resist $${primaryR.toFixed(2)})`
            : 'Price near both support and resistance',
        distPct: distS,
      };
    }
    return {
      label: 'Near Resistance',
      detail:
        primaryS != null && primaryR != null
          ? `Tight range — nearer resistance $${primaryR.toFixed(2)} (support $${primaryS.toFixed(2)})`
          : 'Price near both support and resistance',
      distPct: distR,
    };
  }
  if (nearSupport) {
    return {
      label: 'Near Support',
      detail:
        primaryS != null
          ? `Within ${(supportPct * 100).toFixed(1)}% of support $${primaryS.toFixed(2)}`
          : 'Within support band',
      distPct: distS,
    };
  }
  if (nearResistance) {
    return {
      label: 'Near Resistance',
      detail:
        primaryR != null
          ? `Within ${(resistancePct * 100).toFixed(1)}% of resistance $${primaryR.toFixed(2)}`
          : 'Within resistance band',
      distPct: distR,
    };
  }

  return {
    label: 'Mid Range',
    detail:
      primaryS != null && primaryR != null
        ? `Between support $${primaryS.toFixed(2)} and resistance $${primaryR.toFixed(2)}`
        : 'Between support and resistance',
    distPct: null,
  };
}

export function srSignalFromEngine(engine: {
  currentPrice?: number;
  supportLevels?: number[];
  resistanceLevels?: number[];
} | null | undefined): SrProximity {
  if (!engine) return { label: '—', detail: 'No Quantum engine levels.', distPct: null };
  return classifySrProximity(
    Number(engine.currentPrice) || 0,
    engine.supportLevels,
    engine.resistanceLevels
  );
}
