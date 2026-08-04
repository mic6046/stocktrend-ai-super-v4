/**
 * Dual-audience DO NOW actions derived from the final horizon recommendation.
 * Holding = existing shareholders · No Position = new / flat investors.
 */

export type DoNowActionWord =
  | 'BUY MORE'
  | 'BUY'
  | 'ACCUMULATE'
  | 'HOLD'
  | 'WAIT'
  | 'REDUCE'
  | 'SELL'
  | 'AVOID';

export type DoNowActionTone = 'green' | 'yellow' | 'orange' | 'red';

export type DoNowAudienceBrief = {
  holding: DoNowActionWord;
  noPosition: DoNowActionWord;
};

const TONE_CLASS: Record<DoNowActionTone, string> = {
  green: 'text-emerald-400',
  yellow: 'text-amber-400',
  orange: 'text-orange-400',
  red: 'text-rose-400',
};

export function doNowTone(word: DoNowActionWord): DoNowActionTone {
  if (word === 'BUY' || word === 'BUY MORE' || word === 'ACCUMULATE') return 'green';
  if (word === 'HOLD' || word === 'WAIT') return 'yellow';
  if (word === 'REDUCE') return 'orange';
  return 'red';
}

export function doNowToneClass(word: DoNowActionWord): string {
  return TONE_CLASS[doNowTone(word)];
}

/** Map final recommendation → consistent Holding / No Position actions. */
export function doNowFromRecommendation(rec: string | null | undefined): DoNowAudienceBrief {
  const s = String(rec || '')
    .trim()
    .toUpperCase();

  if (s.includes('ACCUMULAT')) {
    return { holding: 'ACCUMULATE', noPosition: 'BUY' };
  }
  if (s.includes('STRONG BUY') || (s.includes('BUY') && !s.includes('AVOID'))) {
    return { holding: 'BUY MORE', noPosition: 'BUY' };
  }
  if (s.includes('REDUCE')) {
    return { holding: 'REDUCE', noPosition: 'WAIT' };
  }
  if (s.includes('SELL') || s.includes('AVOID') || s.includes('STRONG SELL')) {
    return { holding: 'SELL', noPosition: 'AVOID' };
  }
  // HOLD / neutral / unknown — wait if flat
  return { holding: 'HOLD', noPosition: 'WAIT' };
}
