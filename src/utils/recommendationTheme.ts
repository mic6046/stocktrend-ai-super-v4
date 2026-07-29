export interface RecommendationTheme {
  label: string;
  rangeText: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  progressBg: string;
  glow: string;
  accentColor: string;
  subColor: string;
  badgeClass: string;
}

export function getRecommendationTheme(input: any): RecommendationTheme {
  let score = 75; // default fallback

  if (typeof input === 'number') {
    score = input;
  } else if (typeof input === 'string') {
    const s = input.trim().toUpperCase();
    if (s.includes('EXCEPTIONAL')) {
      score = 97;
    } else if (s.includes('VERY STRONG')) {
      score = 92;
    } else if (s.includes('STRONG BUY')) {
      score = 85;
    } else if (s.includes('BUY')) {
      score = 75;
    } else if (s.includes('HOLD') || s.includes('NEUTRAL')) {
      score = 65;
    } else if (s.includes('SELL') && !s.includes('STRONG')) {
      score = 55;
    } else if (s.includes('AVOID') || s.includes('STRONG SELL')) {
      score = 45;
    } else {
      const parsed = parseFloat(s);
      if (!isNaN(parsed)) {
        score = parsed;
      }
    }
  } else if (input && typeof input === 'object') {
    const ratingStr = String(input.rating || input.action || input.stance || input.recommendation || '').trim().toUpperCase();
    if (ratingStr.includes('EXCEPTIONAL')) score = 97;
    else if (ratingStr.includes('VERY STRONG')) score = 92;
    else if (ratingStr.includes('STRONG BUY')) score = 85;
    else if (ratingStr.includes('BUY')) score = 75;
    else if (ratingStr.includes('HOLD') || ratingStr.includes('NEUTRAL')) score = 65;
    else if (ratingStr.includes('SELL')) score = 55;
    else if (ratingStr.includes('AVOID')) score = 45;
  }

  if (score >= 95) {
    return {
      label: 'Exceptional Strong Buy',
      rangeText: '95-100',
      textColor: 'text-emerald-300',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-400/40',
      progressBg: 'bg-gradient-to-r from-emerald-400 to-green-300',
      glow: 'shadow-[0_0_15px_rgba(52,211,153,0.2)]',
      accentColor: '#6ee7b7',
      subColor: 'rgba(110,231,183,0.7)',
      badgeClass: 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/40'
    };
  }

  if (score >= 80) {
    const label = score >= 90 ? 'Very Strong Buy' : 'Strong Buy';
    const rangeText = score >= 90 ? '90-94' : '80-89';
    return {
      label,
      rangeText,
      textColor: 'text-emerald-300',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-400/35',
      progressBg: 'bg-gradient-to-r from-teal-500 to-emerald-400',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
      accentColor: '#34d399',
      subColor: 'rgba(52,211,153,0.7)',
      badgeClass: 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/35'
    };
  }

  if (score >= 70) {
    return {
      label: 'Buy',
      rangeText: '70-79',
      textColor: 'text-sky-400',
      bgColor: 'bg-sky-500/10',
      borderColor: 'border-sky-500/30',
      progressBg: 'bg-gradient-to-r from-sky-500 to-cyan-400',
      glow: 'shadow-[0_0_10px_rgba(56,189,248,0.12)]',
      accentColor: '#38bdf8',
      subColor: 'rgba(56,189,248,0.7)',
      badgeClass: 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
    };
  }

  // HOLD — amber (matches AI Quantum Stock Score mockup)
  if (score >= 60) {
    return {
      label: 'Hold',
      rangeText: '60-69',
      textColor: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      progressBg: 'bg-gradient-to-r from-amber-500 to-orange-400',
      glow: 'shadow-[0_0_10px_rgba(251,191,36,0.15)]',
      accentColor: '#fbbf24',
      subColor: 'rgba(251,191,36,0.75)',
      badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
    };
  }

  // SELL — vivid rose
  if (score >= 50) {
    return {
      label: 'Sell',
      rangeText: '50-59',
      textColor: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30',
      progressBg: 'bg-gradient-to-r from-rose-500 to-pink-500',
      glow: 'shadow-[0_0_10px_rgba(244,63,94,0.15)]',
      accentColor: '#f43f5e',
      subColor: 'rgba(244,63,94,0.75)',
      badgeClass: 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
    };
  }

  return {
    label: 'Strong Sell',
    rangeText: 'Below 50',
    textColor: 'text-red-600',
    bgColor: 'bg-red-950/45',
    borderColor: 'border-red-700/45',
    progressBg: 'bg-gradient-to-r from-rose-700 to-red-600',
    glow: 'shadow-[0_0_15px_rgba(220,38,38,0.18)]',
    accentColor: '#dc2626',
    subColor: 'rgba(220,38,38,0.7)',
    badgeClass: 'bg-red-950/40 text-red-600 border border-red-700/40'
  };
}
