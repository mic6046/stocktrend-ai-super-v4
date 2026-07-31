import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Info,
  Sparkles,
  Minus,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getRecommendationTheme } from '../utils/recommendationTheme';
import { splitStatusLabel } from './FitText';
import { formatMoney } from './analysis/analysisTheme';

export interface AiStockScoreComponent {
  score: number;
  maxWeight: number;
  explanation: string;
}

export interface AiStockScoreData {
  totalScore: number;
  rating: string;
  components: {
    priceAction?: AiStockScoreComponent;
    volumeAnalysis?: AiStockScoreComponent;
    institutionalFundFlow?: AiStockScoreComponent;
    technicalIndicators?: AiStockScoreComponent;
    fundamentals?: AiStockScoreComponent;
    valuation?: AiStockScoreComponent;
    marketSentiment?: AiStockScoreComponent;
    technicalTrend?: AiStockScoreComponent;
    newsSentiment?: AiStockScoreComponent;
    riskProfile?: AiStockScoreComponent;
    whaleAccumulation?: AiStockScoreComponent;
  };
  overallExplanation: string;
}

export type ProjectionTrend = 'up' | 'down' | 'flat';

interface AiStockScoreCardProps {
  scoreData: AiStockScoreData | null;
  ticker: string;
  stockName?: string;
  currentPrice?: number | null;
  currency?: string;
  isLoading?: boolean;
  projectionTrend?: ProjectionTrend;
  projectionHorizonDays?: number;
  shortTermConfidence?: number | null;
  mediumTermConfidence?: number | null;
  /** full = hero+components+explanation; compact = components+explanation only (hero lives above) */
  variant?: 'full' | 'compact';
}

function sanitizeExplanation(text: string | undefined): string {
  if (!text) return '';
  return text
    .replace(/[*_#`~]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function toPct(comp?: AiStockScoreComponent): number {
  if (!comp) return 0;
  const max = Math.max(1, Number(comp.maxWeight) || 100);
  return Math.round(Math.min(100, Math.max(0, (Number(comp.score) || 0) / max * 100)));
}

function mediumConfidence(score: number, api?: number | null): number {
  if (api != null && Number.isFinite(api)) return Math.round(Math.min(99, Math.max(1, api)));
  return Math.round(Math.min(94, Math.max(55, 58 + Math.abs(score - 65) * 0.9)));
}

function shortConfidence(days: number, band = 1.5): number {
  const h = days <= 5 ? 6 : days <= 10 ? 0 : -8;
  const b = band <= 1 ? 5 : band <= 1.5 ? 0 : -5;
  return Math.round(Math.min(92, Math.max(52, 70 + h + b)));
}

type HorizonBias = 'Bullish' | 'Bearish' | 'Neutral';

function stanceFromScore(score: number): HorizonBias {
  if (score >= 70) return 'Bullish';
  if (score < 60) return 'Bearish';
  return 'Neutral';
}

function longBiasFromComponents(c: AiStockScoreData['components']): HorizonBias {
  const fund = toPct(c.fundamentals);
  const val = toPct(c.valuation);
  const avg = (fund + val) / 2;
  if (avg >= 65) return 'Bullish';
  if (avg < 45) return 'Bearish';
  return 'Neutral';
}

function BiasIcon({ bias }: { bias: HorizonBias }) {
  if (bias === 'Bullish') return <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />;
  if (bias === 'Bearish') return <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />;
  return <Minus className="w-3.5 h-3.5 text-amber-400" />;
}

function biasColor(bias: HorizonBias) {
  if (bias === 'Bullish') return 'text-emerald-400';
  if (bias === 'Bearish') return 'text-rose-400';
  return 'text-amber-400';
}

function riskFromScore(score: number): { risk: string; volatility: string; liquidity: string } {
  if (score >= 80) return { risk: 'Low', volatility: 'Moderate', liquidity: 'High' };
  if (score >= 60) return { risk: 'Medium', volatility: 'Moderate', liquidity: 'High' };
  if (score >= 50) return { risk: 'Medium', volatility: 'Elevated', liquidity: 'Moderate' };
  return { risk: 'High', volatility: 'Elevated', liquidity: 'Moderate' };
}

function buildReconcileCopy(opts: {
  score: number;
  label: string;
  shortBias: HorizonBias;
  mediumBias: HorizonBias;
  days: number;
}): string {
  const { score, label, shortBias, mediumBias, days } = opts;
  if (mediumBias === 'Bullish' && shortBias === 'Bearish') {
    return `AI Stock Score remains ${label.toUpperCase()} (${score}/100) because the medium-term outlook is constructive. However, the AI projection expects a short-term pullback over the next ${days} trading sessions before the broader trend resumes.`;
  }
  if (mediumBias === 'Bearish' && shortBias === 'Bullish') {
    return `AI Stock Score remains ${label.toUpperCase()} (${score}/100) on a weaker medium-term outlook. The purple projection’s short-term rebound over ~${days} sessions is likely a temporary relief rally within the broader trend.`;
  }
  if (mediumBias === 'Neutral' && shortBias === 'Bearish') {
    return `${label} (${score}/100) reflects a balanced medium-term view (1–3 months). Short-term technical momentum is soft and the AI projection expects a pullback over the next ${days} trading days — normal across different horizons.`;
  }
  if (mediumBias === 'Neutral' && shortBias === 'Bullish') {
    return `${label} (${score}/100) is a medium-term neutral stance. Short-term AI projection leans higher over ~${days} sessions; treat that as tactical noise until the medium-term rating improves.`;
  }
  return `Medium-term Stock Score (${label}, ${score}/100) and short-term projection (${shortBias.toLowerCase()} over ${days}D) are read on separate horizons and should be used together, not as a conflict.`;
}

/** Semi-circular gauge — green (left) → amber → red (right), score centered inside. */
function SemiGauge({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  const r = 58;
  const cx = 72;
  const cy = 68;
  const startX = cx - r;
  const endX = cx + r;
  const circumference = Math.PI * r;
  const progress = (clamped / 100) * circumference;
  const angleDeg = 180 - (clamped / 100) * 180;
  const rad = (angleDeg * Math.PI) / 180;
  const nx = cx + Math.cos(rad) * (r - 10);
  const ny = cy - Math.sin(rad) * (r - 10);

  return (
    <div className="relative w-[148px] h-[100px] shrink-0">
      <svg viewBox="0 0 144 84" className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="qnScoreArc" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
        </defs>
        <path
          d={`M ${startX} ${cy} A ${r} ${r} 0 0 1 ${endX} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <motion.path
          d={`M ${startX} ${cy} A ${r} ${r} 0 0 1 ${endX} ${cy}`}
          fill="none"
          stroke="url(#qnScoreArc)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e5e7eb" strokeWidth="2" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="4" fill="#e5e7eb" />
        <circle cx={cx} cy={cy} r="1.75" fill="#0a0a0c" />
      </svg>
      <div className="absolute inset-x-0 bottom-1 flex flex-col items-center pointer-events-none">
        <span className="text-[28px] font-black font-mono text-white tracking-tight leading-none">{clamped}</span>
        <span className="text-[11px] text-gray-500 font-semibold leading-none mt-0.5">/100</span>
      </div>
    </div>
  );
}

/** Large status + Confidence row — matches the HOLD / Confidence mockup. */
export function HeroStatusBlock({
  label,
  confidence,
  textClassName,
  uppercase = true,
  align = 'left',
  size = 'lg',
  className,
  /** When true, never clip/truncate; wrap at word boundaries and grow height */
  allowWrap = false,
}: {
  label: string;
  confidence?: number | null;
  textClassName?: string;
  uppercase?: boolean;
  align?: 'left' | 'center';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  allowWrap?: boolean;
}) {
  const { line1, line2 } = splitStatusLabel(label);
  const display1 = uppercase && line1 ? line1.toUpperCase() : line1;
  const display2 = uppercase ? line2.toUpperCase() : line2;
  const alignCls = align === 'center' ? 'items-center text-center' : 'items-start text-left';

  const line1Cls =
    size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-[12px] sm:text-[13px]' : 'text-[13px] sm:text-[14px]';
  const line2Cls =
    size === 'sm'
      ? 'text-[16px] sm:text-[18px]'
      : size === 'md'
        ? 'text-[20px] sm:text-[24px]'
        : 'text-[28px] sm:text-[34px]';
  const singleCls =
    size === 'sm'
      ? 'text-[16px] sm:text-[18px]'
      : size === 'md'
        ? 'text-[20px] sm:text-[24px]'
        : 'text-[32px] sm:text-[40px]';
  const confSize = size === 'sm' ? 'text-[14px]' : size === 'md' ? 'text-[16px]' : 'text-[18px] sm:text-[20px]';

  const wrapCls = allowWrap
    ? 'whitespace-normal break-words [overflow-wrap:normal] [word-break:normal]'
    : 'break-keep';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={label}
        initial={{ opacity: 0, scale: 0.97, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -3 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'flex flex-col w-full',
          allowWrap ? 'overflow-visible' : 'min-w-0 overflow-hidden',
          alignCls,
          className
        )}
      >
        <div className={cn('flex flex-col w-full justify-center', allowWrap ? '' : 'min-w-0', alignCls, textClassName)}>
          {line1 ? (
            <>
              <span className={cn('font-semibold tracking-wide leading-tight opacity-90 max-w-full', wrapCls, line1Cls)}>
                {display1}
              </span>
              <span className={cn('font-black tracking-tight leading-[1.15] max-w-full mt-0.5', wrapCls, line2Cls)}>
                {display2}
              </span>
            </>
          ) : (
            <span className={cn('font-black tracking-tight leading-[1.15] max-w-full', wrapCls, singleCls)}>
              {display2}
            </span>
          )}
        </div>

        {confidence != null && Number.isFinite(confidence) && (
          <div
            className={cn(
              'mt-3 pt-2.5 border-t border-white/10 w-full max-w-[160px]',
              align === 'center' && 'mx-auto'
            )}
          >
            <p className="text-[10px] text-gray-500 font-medium leading-none">Confidence</p>
            <p className={cn('mt-1 font-bold text-emerald-400 tabular-nums leading-none', confSize)}>
              {Math.round(confidence)}%
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function ComponentBar({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="space-y-1 min-w-0">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[10px] text-gray-400 font-medium min-w-0 break-words leading-tight">{label}</span>
        <span className="text-[10px] font-mono font-bold text-gray-200 tabular-nums shrink-0">
          {value}
          <span className="text-gray-500">/100</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', accent)}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export const AiStockScoreCard: React.FC<AiStockScoreCardProps> = ({
  scoreData,
  ticker,
  stockName,
  currentPrice,
  currency,
  isLoading,
  projectionTrend = 'flat',
  projectionHorizonDays = 5,
  shortTermConfidence = null,
  mediumTermConfidence = null,
  variant = 'full',
}) => {
  const displayName = stockName?.trim() || '';
  const priceLabel =
    currentPrice != null && Number.isFinite(currentPrice) && currentPrice > 0
      ? formatMoney(currentPrice, currency)
      : '';
  if (isLoading) {
    return (
      <div className="bg-[#121214] border border-white/10 rounded-2xl p-5 animate-pulse space-y-4">
        <div className="h-3 w-48 bg-white/10 rounded" />
        <div className="h-24 bg-white/5 rounded-xl" />
        <div className="h-20 bg-white/5 rounded-xl" />
      </div>
    );
  }

  const finalScoreData = scoreData || {
    totalScore: 61,
    rating: 'Hold',
    components: {
      technicalIndicators: { score: 11, maxWeight: 15, explanation: '' },
      institutionalFundFlow: { score: 8, maxWeight: 15, explanation: '' },
      whaleAccumulation: { score: 12, maxWeight: 15, explanation: '' },
      fundamentals: { score: 14, maxWeight: 15, explanation: '' },
      valuation: { score: 6, maxWeight: 10, explanation: '' },
      marketSentiment: { score: 2, maxWeight: 5, explanation: '' },
      priceAction: { score: 15, maxWeight: 25, explanation: '' },
    },
    overallExplanation:
      'Balanced medium-term setup. Fundamentals support the rating while short-term technical momentum can diverge from the AI price projection.',
  };

  const theme = getRecommendationTheme(finalScoreData.totalScore);
  const score = finalScoreData.totalScore;
  const medConf = mediumConfidence(score, mediumTermConfidence);
  const shortConf =
    shortTermConfidence != null && Number.isFinite(shortTermConfidence)
      ? Math.round(shortTermConfidence)
      : shortConfidence(projectionHorizonDays);

  const shortBias: HorizonBias =
    projectionTrend === 'up' ? 'Bullish' : projectionTrend === 'down' ? 'Bearish' : 'Neutral';
  const mediumBias = stanceFromScore(score);
  const longBias = longBiasFromComponents(finalScoreData.components);
  const risks = riskFromScore(score);

  const techPct = Math.round(
    (toPct(finalScoreData.components.technicalIndicators || finalScoreData.components.technicalTrend) +
      toPct(finalScoreData.components.priceAction)) /
      2 || toPct(finalScoreData.components.technicalIndicators)
  );
  const bars = [
    {
      label: 'Technical Analysis',
      value: techPct || toPct(finalScoreData.components.priceAction),
      accent: 'bg-gradient-to-r from-cyan-500 to-emerald-400',
    },
    {
      label: 'Institutional Flow',
      value: toPct(finalScoreData.components.institutionalFundFlow),
      accent: 'bg-gradient-to-r from-sky-500 to-cyan-400',
    },
    {
      label: 'Whale Money Flow',
      value: toPct(finalScoreData.components.whaleAccumulation || finalScoreData.components.volumeAnalysis),
      accent: 'bg-gradient-to-r from-violet-500 to-fuchsia-400',
    },
    {
      label: 'Fundamental Strength',
      value: toPct(finalScoreData.components.fundamentals),
      accent: 'bg-gradient-to-r from-emerald-500 to-teal-400',
    },
    {
      label: 'Valuation',
      value: toPct(finalScoreData.components.valuation),
      accent: 'bg-gradient-to-r from-amber-500 to-orange-400',
    },
    {
      label: 'Market Sentiment',
      value: toPct(finalScoreData.components.marketSentiment || finalScoreData.components.newsSentiment),
      accent: 'bg-gradient-to-r from-rose-500 to-pink-400',
    },
  ];

  const explanation =
    sanitizeExplanation(finalScoreData.overallExplanation) ||
    buildReconcileCopy({
      score,
      label: theme.label,
      shortBias,
      mediumBias,
      days: projectionHorizonDays,
    });

  const horizons: { label: string; range: string; bias: HorizonBias }[] = [
    { label: 'Short-Term', range: '3–10 Days', bias: shortBias },
    { label: 'Medium-Term', range: '1–3 Months', bias: mediumBias },
    { label: 'Long-Term', range: '3–12 Months', bias: longBias },
  ];

  const compact = variant === 'compact';

  return (
    <div className="space-y-3 w-full">
      {!compact && (
      <div className="bg-[#121214] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden min-w-0">
        <div className="flex items-start gap-2 mb-4 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h4 className="text-[11px] font-bold text-gray-100 uppercase tracking-[0.14em] font-mono">
                AI Quantum Stock Score
              </h4>
              <span title="Medium-term investment rating (1–3 months)">
                <Info className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              </span>
            </div>
            {displayName && (
              <p className="mt-1 text-[12px] text-gray-300 font-medium leading-snug break-words">
                {displayName}
              </p>
            )}
            {priceLabel && (
              <p className="mt-1 text-[15px] font-mono font-bold text-emerald-300 tabular-nums leading-none">
                {priceLabel}
              </p>
            )}
          </div>
          <span className="ml-auto text-[9px] font-mono text-gray-500 uppercase tracking-wider shrink-0 pt-0.5">
            {ticker.toUpperCase()}
          </span>
        </div>

        <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 items-stretch min-w-0">
          <div className="flex flex-col items-center gap-2.5 shrink-0 lg:pt-1">
            <SemiGauge score={score} />
            <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-center w-full max-w-[148px]">
              <p className="text-[8px] uppercase tracking-wider text-gray-500 leading-tight">Time Horizon (Primary)</p>
              <p className="text-[11px] font-semibold text-white mt-0.5">1 – 3 Months</p>
            </div>
          </div>

          <div className="flex flex-col justify-center min-w-0 lg:min-w-[140px] lg:max-w-[200px] shrink-0">
            <HeroStatusBlock
              label={theme.label}
              confidence={medConf}
              textClassName={theme.textColor}
              uppercase
              align="left"
            />
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-2 justify-center">
            {horizons.map((h) => (
              <div
                key={h.label}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/35 px-3.5 py-2.5 min-w-0"
              >
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-white leading-tight">{h.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{h.range}</p>
                </div>
                <div className={cn('flex items-center gap-1.5 text-[12px] font-bold shrink-0', biasColor(h.bias))}>
                  <BiasIcon bias={h.bias} />
                  {h.bias}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      <div className="bg-[#121214] border border-white/10 rounded-2xl p-4 sm:p-5 glass-panel">
        {compact && (
          <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b border-white/5 min-w-0">
            <div className="min-w-0">
              <h4 className="text-[11px] font-bold text-gray-100 uppercase tracking-[0.14em] font-mono">
                AI Quantum Stock Score
              </h4>
              {displayName ? (
                <p className="mt-1 text-[12px] text-gray-300 font-medium leading-snug break-words">
                  {displayName}
                </p>
              ) : null}
              {priceLabel ? (
                <p className="mt-1 text-[15px] font-mono font-bold text-emerald-300 tabular-nums leading-none">
                  {priceLabel}
                </p>
              ) : null}
            </div>
            <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider shrink-0 pt-0.5">
              {ticker.toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 mb-3">
          <h4 className="text-[11px] font-bold text-gray-200 uppercase tracking-[0.14em] font-mono">
            AI Score Components
          </h4>
          <Info className="w-3.5 h-3.5 text-gray-500" />
        </div>
        <div className="space-y-2.5">
          {bars.map((b) => (
            <ComponentBar key={b.label} label={b.label} value={b.value} accent={b.accent} />
          ))}
        </div>
      </div>

      <div className="bg-[#121214] border border-white/10 rounded-2xl p-4 sm:p-5 min-w-0 overflow-hidden glass-panel">
        <div className="flex items-center gap-2 mb-2.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <h4 className="text-[11px] font-bold text-gray-200 uppercase tracking-[0.14em] font-mono truncate">
            AI Explanation
          </h4>
        </div>
        <p className="text-[12px] text-gray-300 leading-relaxed font-sans break-words">{explanation}</p>
        <div className="mt-3 flex flex-wrap gap-1.5 min-w-0">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[9px] font-mono font-bold text-amber-300">
            Risk: {risks.risk}
          </span>
          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[9px] font-mono font-bold text-sky-300">
            Volatility: {risks.volatility}
          </span>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-mono font-bold text-emerald-300">
            Liquidity: {risks.liquidity}
          </span>
        </div>
        <p className="mt-2 text-[9px] text-gray-600 font-mono">
          Stance inherits Master Decision Engine for the selected Investment Horizon only.
        </p>
      </div>
    </div>
  );
};
