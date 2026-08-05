/** Shared action colors + helpers for the premium analysis shell */

export type ActionTone =
  | 'strong-buy'
  | 'buy'
  | 'moderate-buy'
  | 'hold'
  | 'reduce'
  | 'sell'
  | 'strong-sell';

export const ACTION_COLORS = {
  'strong-buy': {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-400/35',
    glow: 'shadow-[0_0_28px_rgba(16,185,129,0.18)]',
    hex: '#34d399',
    label: 'Strong Buy',
    emoji: '🟢',
  },
  buy: {
    text: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-400/35',
    glow: 'shadow-[0_0_24px_rgba(56,189,248,0.16)]',
    hex: '#38bdf8',
    label: 'Buy',
    emoji: '🔵',
  },
  'moderate-buy': {
    text: 'text-cyan-300',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-400/35',
    glow: 'shadow-[0_0_24px_rgba(34,211,238,0.14)]',
    hex: '#22d3ee',
    label: 'Moderate Buy',
    emoji: '🩵',
  },
  hold: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-400/35',
    glow: 'shadow-[0_0_24px_rgba(251,191,36,0.14)]',
    hex: '#fbbf24',
    label: 'Hold',
    emoji: '🟡',
  },
  reduce: {
    text: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-400/35',
    glow: 'shadow-[0_0_24px_rgba(251,146,60,0.14)]',
    hex: '#fb923c',
    label: 'Reduce',
    emoji: '🟠',
  },
  sell: {
    text: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-400/35',
    glow: 'shadow-[0_0_24px_rgba(244,63,94,0.14)]',
    hex: '#f43f5e',
    label: 'Sell',
    emoji: '🔴',
  },
  'strong-sell': {
    text: 'text-red-500',
    bg: 'bg-red-950/40',
    border: 'border-red-600/40',
    glow: 'shadow-[0_0_24px_rgba(220,38,38,0.16)]',
    hex: '#ef4444',
    label: 'Strong Sell',
    emoji: '🔴',
  },
} as const;

export function actionToneFromLabel(label: string): ActionTone {
  const s = label.trim().toLowerCase();
  if (s.includes('exceptional') || s.includes('very strong buy') || s.includes('strong buy')) return 'strong-buy';
  if (s.includes('avoid') || s.includes('strong sell')) return 'strong-sell';
  if (s.includes('moderate buy') || s.includes('add position') || s.includes('accumulate')) return 'moderate-buy';
  if (s.includes('take profit') || s.includes('reduce')) return 'reduce';
  if (s.includes('sell') || s.includes('exit') || s.includes('stop loss')) return 'sell';
  if (s.includes('wait')) return 'hold';
  if (s.includes('hold') || s.includes('neutral')) return 'hold';
  if (s.includes('buy')) return 'buy';
  return 'hold';
}

export function starsFromScore(score: number): number {
  if (score >= 90) return 5;
  if (score >= 80) return 4;
  if (score >= 70) return 3;
  if (score >= 55) return 2;
  return 1;
}

export function currencySymbol(code?: string) {
  if (code === 'HKD') return 'HK$';
  if (code === 'CNY' || code === 'CNH') return '¥';
  if (code === 'EUR') return '€';
  if (code === 'GBP') return '£';
  if (code === 'JPY') return '¥';
  return '$';
}

export function formatMoney(value: number | null | undefined, currency?: string) {
  if (value == null || !Number.isFinite(value)) return '—';
  const sym = currencySymbol(currency);
  return `${sym}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPct(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

export type HorizonKey = '1W' | '1M' | '3M' | '1Y';

export const HORIZON_OPTIONS: { key: HorizonKey; label: string }[] = [
  { key: '1W', label: '1 Week' },
  { key: '1M', label: '1 Month' },
  { key: '3M', label: '3 Months' },
  { key: '1Y', label: '1 Year' },
];
