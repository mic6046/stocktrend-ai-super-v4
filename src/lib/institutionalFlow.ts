/** Long-term institutional flow vs short-term whale order narrative (non-contradictory). */

export type FlowConfidence = 'Very High' | 'High' | 'Moderate' | 'Low';
export type TrendStatus =
  | 'Strong Accumulation'
  | 'Early Accumulation'
  | 'Neutral'
  | 'Early Distribution'
  | 'Strong Distribution';

export interface InstitutionalFlowNarrative {
  longTermPositive: boolean;
  longTermNegative: boolean;
  shortTermBuyDominant: boolean;
  shortTermSellDominant: boolean;
  aligned: boolean;
  confidence: FlowConfidence;
  trendStatus: TrendStatus;
  explanation: string;
}

function signCount(values: number[]) {
  let pos = 0;
  let neg = 0;
  for (const v of values) {
    if (v > 0) pos += 1;
    else if (v < 0) neg += 1;
  }
  return { pos, neg };
}

export function buildInstitutionalFlowNarrative(input: {
  flow5: number;
  flow20: number;
  flow60: number;
  whaleIn: number;
  whaleOut: number;
}): InstitutionalFlowNarrative {
  const horizons = [input.flow5, input.flow20, input.flow60];
  const { pos, neg } = signCount(horizons);
  const sumLt = horizons.reduce((a, b) => a + b, 0);

  const allPositive = pos === 3;
  const allNegative = neg === 3;
  const longTermPositive = allPositive || (pos >= 2 && sumLt > 0);
  const longTermNegative = allNegative || (neg >= 2 && sumLt < 0);

  const whaleIn = Math.abs(input.whaleIn);
  const whaleOut = Math.abs(input.whaleOut);
  const shortTermBuyDominant = whaleIn > whaleOut;
  const shortTermSellDominant = whaleOut > whaleIn;
  const shortTermFlat = !shortTermBuyDominant && !shortTermSellDominant;

  const aligned =
    (longTermPositive && shortTermBuyDominant) ||
    (longTermNegative && shortTermSellDominant);

  const timeframeNote =
    ' Different timeframes can produce different signals; this is normal market behavior and not a contradiction.';

  let explanation = '';
  let confidence: FlowConfidence = 'Moderate';
  let trendStatus: TrendStatus = 'Neutral';

  // Case A — LT distribution, ST accumulation
  if (longTermNegative && shortTermBuyDominant) {
    explanation =
      'Although institutions remain net sellers over the past 5, 20 and 60 trading days, today\'s whale orders show stronger buying than selling. This suggests short-term accumulation within a broader longer-term distribution trend. Continued inflows over the coming sessions would strengthen the probability of a trend reversal.' +
      timeframeNote;
    confidence = allNegative ? 'Low' : 'Moderate';
    trendStatus = 'Early Accumulation';
  }
  // Case B — LT accumulation, ST distribution
  else if (longTermPositive && shortTermSellDominant) {
    explanation =
      'Institutions remain net buyers over the medium-term, but today\'s whale activity shows profit-taking. Unless this selling persists for several sessions, the broader bullish trend remains intact.' +
      timeframeNote;
    confidence = allPositive ? 'Low' : 'Moderate';
    trendStatus = 'Early Distribution';
  }
  // Case C — both bullish
  else if (longTermPositive && shortTermBuyDominant) {
    explanation =
      'Both institutional capital flow and today\'s whale orders are aligned on the bullish side. This indicates sustained accumulation and increases confidence in the current uptrend.' +
      timeframeNote;
    confidence = allPositive ? 'Very High' : 'High';
    trendStatus = allPositive ? 'Strong Accumulation' : 'Early Accumulation';
  }
  // Case D — both bearish
  else if (longTermNegative && shortTermSellDominant) {
    explanation =
      'Both historical institutional flow and today\'s whale orders indicate continued distribution. Selling pressure remains dominant and caution is advised until accumulation begins to appear.' +
      timeframeNote;
    confidence = allNegative ? 'Very High' : 'High';
    trendStatus = allNegative ? 'Strong Distribution' : 'Early Distribution';
  }
  // Flat / mixed short-term
  else if (shortTermFlat) {
    if (longTermPositive) {
      explanation =
        'Historical Institutional Capital Flow (5D / 20D / 60D) remains net positive, while today\'s whale order flow is roughly balanced between buying and selling. The longer-term accumulation trend is intact, with a quiet current session.' +
        timeframeNote;
      confidence = 'Moderate';
      trendStatus = 'Early Accumulation';
    } else if (longTermNegative) {
      explanation =
        'Historical Institutional Capital Flow (5D / 20D / 60D) remains net negative, while today\'s whale order flow is roughly balanced. Longer-term distribution pressure persists without a clear same-session whale bias.' +
        timeframeNote;
      confidence = 'Moderate';
      trendStatus = 'Early Distribution';
    } else {
      explanation =
        'Longer-term institutional flow is mixed across the 5D / 20D / 60D windows, and today\'s whale order flow is balanced. Neither side shows a decisive multi-horizon edge.' +
        timeframeNote;
      confidence = 'Moderate';
      trendStatus = 'Neutral';
    }
  }
  // Mixed long-term with short-term bias
  else {
    if (shortTermBuyDominant) {
      explanation =
        'Longer-term institutional flow is mixed across 5D / 20D / 60D, but today\'s whale orders favor buying. Treat this as short-term activity that may not yet define the broader trend.' +
        timeframeNote;
      confidence = 'Moderate';
      trendStatus = 'Early Accumulation';
    } else {
      explanation =
        'Longer-term institutional flow is mixed across 5D / 20D / 60D, but today\'s whale orders favor selling. Treat this as short-term activity that may not yet define the broader trend.' +
        timeframeNote;
      confidence = 'Moderate';
      trendStatus = 'Early Distribution';
    }
  }

  return {
    longTermPositive,
    longTermNegative,
    shortTermBuyDominant,
    shortTermSellDominant,
    aligned,
    confidence,
    trendStatus,
    explanation,
  };
}

export function formatSignedMillions(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return `${n >= 0 ? '+' : '-'}$${(abs / 1000).toFixed(2)}B`;
  }
  return `${n >= 0 ? '+' : '-'}$${abs.toFixed(1)}M`;
}
