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
      label: 'Exceptional Buy',
      rangeText: '95-100',
      textColor: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
      progressBg: 'bg-gradient-to-r from-purple-500 to-fuchsia-400',
      glow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]',
      accentColor: '#a855f7',
      subColor: 'rgba(168,85,247,0.7)',
      badgeClass: 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
    };
  }

  if (score >= 80) {
    const label = score >= 90 ? 'Very Strong Buy' : 'Strong Buy';
    const rangeText = score >= 90 ? '90-94' : '80-89';
    return {
      label,
      rangeText,
      textColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      progressBg: 'bg-gradient-to-r from-teal-500 to-emerald-400',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
      accentColor: '#10b981',
      subColor: 'rgba(16,185,129,0.7)',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
    };
  }

  if (score >= 70) {
    return {
      label: 'Buy',
      rangeText: '70-79',
      textColor: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      progressBg: 'bg-gradient-to-r from-green-600 to-emerald-500',
      glow: 'shadow-[0_0_10px_rgba(34,197,94,0.1)]',
      accentColor: '#22c55e',
      subColor: 'rgba(34,197,94,0.7)',
      badgeClass: 'bg-green-500/10 text-green-400 border border-green-500/30'
    };
  }

  if (score >= 60) {
    return {
      label: 'Hold',
      rangeText: '60-69',
      textColor: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      progressBg: 'bg-gradient-to-r from-yellow-500 to-amber-400',
      glow: 'shadow-[0_0_10px_rgba(251,191,36,0.1)]',
      accentColor: '#fbbf24',
      subColor: 'rgba(251,191,36,0.7)',
      badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
    };
  }

  if (score >= 50) {
    return {
      label: 'Sell',
      rangeText: '50-59',
      textColor: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
      progressBg: 'bg-gradient-to-r from-amber-600 to-orange-500',
      glow: 'shadow-[0_0_10px_rgba(249,115,22,0.1)]',
      accentColor: '#f97316',
      subColor: 'rgba(249,115,22,0.7)',
      badgeClass: 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
    };
  }

  return {
    label: 'Avoid',
    rangeText: 'Below 50',
    textColor: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    progressBg: 'bg-gradient-to-r from-rose-600 to-red-500',
    glow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]',
    accentColor: '#ef4444',
    subColor: 'rgba(239,68,68,0.7)',
    badgeClass: 'bg-red-500/10 text-red-500 border border-red-500/30'
  };
}
