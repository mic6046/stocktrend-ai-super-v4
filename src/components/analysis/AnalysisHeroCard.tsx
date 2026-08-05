import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getRecommendationTheme } from '../../utils/recommendationTheme';
import { GlassCard } from './GlassCard';
import { AnimatedNumber } from './AnimatedNumber';
import {
  ACTION_COLORS,
  actionToneFromLabel,
  formatMoney,
  formatPct,
  HORIZON_OPTIONS,
  HorizonKey,
  starsFromScore,
} from './analysisTheme';

export type HeroProjection = {
  baseCase: number | null;
  bullCase: number | null;
  bearCase: number | null;
  lastClose: number;
  shortConf: number;
};

export type HeroCockpit = {
  baseCase?: { targetPrice?: number; expectedReturn?: number };
  bullCase?: { targetPrice?: number; expectedReturn?: number };
  bearCase?: { targetPrice?: number; expectedReturn?: number };
  confidence?: number;
} | null;

type DualDoNow = {
  holding: string;
  noPosition: string;
};

type AnalysisHeroCardProps = {
  ticker: string;
  stockName?: string;
  currentPrice?: number | null;
  /** Horizon-adjusted score */
  score: number;
  ratingLabel?: string;
  /** Horizon-adjusted confidence */
  confidence: number | null;
  currency?: string;
  targetPrice?: number | null;
  expectedReturn?: number | null;
  horizon: HorizonKey;
  onHorizonChange: (h: HorizonKey) => void;
  horizonExplanation?: string;
  isLoading?: boolean;
  /** Live do-now for the user's selected ownership state */
  currentAction?: string | null;
  currentActionReason?: string | null;
  /** Always show both paths (Holding vs No Position) */
  doNowByPosition?: DualDoNow | null;
  userHasPosition?: boolean;
  /** @deprecated kept for compatibility — unused when target/return passed */
  projection?: HeroProjection;
  cockpit?: HeroCockpit;
};

function ConfidenceRadial({
  value,
  accent,
  resetKey,
}: {
  value: number;
  accent: string;
  resetKey: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const r = 46;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  return (
    <div className="relative w-[120px] h-[120px] shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
        <motion.circle
          key={resetKey}
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${accent}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Confidence</span>
        <AnimatedNumber
          value={clamped}
          resetKey={resetKey}
          durationMs={420}
          format={(n) => `${Math.round(n)}`}
          className="font-display text-2xl font-bold text-white tabular-nums leading-none mt-0.5"
        />
        <span className="text-sm text-gray-500 -mt-0.5">%</span>
      </div>
    </div>
  );
}

function StarRow({ score }: { score: number }) {
  const stars = starsFromScore(score);
  return (
    <div className="flex items-center gap-0.5" aria-label={`${stars} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={cn('text-sm leading-none', i < stars ? 'text-amber-400' : 'text-white/15')}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export function AnalysisHeroCard({
  ticker,
  stockName,
  currentPrice,
  score,
  ratingLabel,
  confidence,
  currency,
  targetPrice,
  expectedReturn,
  horizon,
  onHorizonChange,
  horizonExplanation,
  isLoading,
  currentAction,
  currentActionReason,
  doNowByPosition,
  userHasPosition = false,
}: AnalysisHeroCardProps) {
  const theme = useMemo(() => getRecommendationTheme(score), [score]);
  const outlookLabel = ratingLabel || theme.label;
  const primaryAction =
    currentAction ||
    (userHasPosition ? doNowByPosition?.holding : doNowByPosition?.noPosition) ||
    outlookLabel;
  const actionTone = ACTION_COLORS[actionToneFromLabel(primaryAction)];
  const outlookTone = ACTION_COLORS[actionToneFromLabel(outlookLabel)];
  const conf = confidence != null && Number.isFinite(confidence) ? confidence : 70;
  const displayName = stockName?.trim() || '';
  const priceValue =
    currentPrice != null && Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : null;
  const priceLabel = priceValue != null ? formatMoney(priceValue, currency) : '';
  const horizonLabel = HORIZON_OPTIONS.find((o) => o.key === horizon)?.label || horizon;
  const holdingAction = doNowByPosition?.holding || (userHasPosition ? primaryAction : 'HOLD');
  const flatAction = doNowByPosition?.noPosition || (!userHasPosition ? primaryAction : 'WAIT');

  if (isLoading) {
    return (
      <GlassCard className="animate-pulse min-h-[200px]" hover={false}>
        <div className="h-3 w-40 bg-white/10 rounded mb-6" />
        <div className="flex gap-6">
          <div className="w-28 h-28 rounded-full bg-white/5" />
          <div className="flex-1 space-y-3">
            <div className="h-10 w-48 bg-white/10 rounded" />
            <div className="h-4 w-32 bg-white/5 rounded" />
            <div className="h-16 w-full bg-white/5 rounded-xl" />
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      className={cn('relative overflow-hidden', actionTone.border, actionTone.glow)}
      glow
      padding="lg"
    >
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/[0.03] via-transparent to-transparent" />

      <div className="relative z-10 flex flex-col xl:flex-row gap-6 xl:gap-8 items-stretch">
        {/* Score block */}
        <div className="flex flex-col items-center xl:items-start shrink-0 min-w-[140px]">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-gray-400 font-bold">
              AI Quantum Score
            </p>
            <span title="Score is calibrated to the selected Investment Horizon">
              <Info className="w-3.5 h-3.5 text-gray-600" />
            </span>
          </div>
          <motion.div
            key={`score-${horizon}-${Math.round(score)}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col items-center xl:items-start"
          >
            <p className="font-display text-5xl sm:text-6xl font-bold text-white tracking-tight leading-none tabular-nums">
              <AnimatedNumber
                value={score}
                resetKey={horizon}
                durationMs={450}
                format={(n) => String(Math.round(n))}
              />
              <span className="text-xl text-gray-500 font-semibold"> / 100</span>
            </p>
            <div className="mt-2">
              <StarRow score={score} />
            </div>
            <p className="mt-2 text-[10px] font-mono text-gray-500 uppercase tracking-wider">
              {ticker.toUpperCase()}
            </p>
            {displayName && (
              <p className="mt-0.5 text-[11px] text-gray-300 font-medium text-center xl:text-left break-words leading-snug max-w-[200px]">
                {displayName}
              </p>
            )}
            {priceLabel && (
              <p className="mt-1 text-[15px] font-mono font-bold text-white tabular-nums text-center xl:text-left leading-none">
                {priceLabel}
              </p>
            )}
          </motion.div>
        </div>

        {/* Do Now primary + demoted outlook */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 flex-1 min-w-0">
          <ConfidenceRadial value={conf} accent={actionTone.hex} resetKey={horizon} />

          <div className="flex-1 min-w-0 w-full">
            <p className="text-[10px] uppercase tracking-wider text-cyan-300/80 mb-1">
              Do now · {userHasPosition ? 'Holding' : 'No position'}
            </p>
            <AnimatePresence mode="wait">
              <motion.p
                key={`${horizon}-${primaryAction}-${userHasPosition ? 'own' : 'flat'}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.35 }}
                className={cn(
                  'font-display font-black text-3xl sm:text-4xl tracking-tight leading-none uppercase',
                  actionTone.text
                )}
              >
                {primaryAction}
              </motion.p>
            </AnimatePresence>

            {currentActionReason && (
              <p className="mt-2 text-[11px] text-gray-400 leading-snug">{currentActionReason}</p>
            )}

            <div className="mt-3 rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-wider text-gray-500 mb-1.5">
                By ownership · live price
              </p>
              <div className="flex flex-wrap items-stretch gap-2">
                <div
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 min-w-[7.5rem] flex-1',
                    userHasPosition
                      ? 'border-cyan-400/40 bg-cyan-500/10'
                      : 'border-white/8 bg-white/[0.02]'
                  )}
                >
                  <p className="text-[8px] uppercase tracking-wider text-gray-500">Holding</p>
                  <p
                    className={cn(
                      'mt-0.5 text-sm font-bold uppercase',
                      ACTION_COLORS[actionToneFromLabel(holdingAction)].text
                    )}
                  >
                    {holdingAction}
                  </p>
                </div>
                <div
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 min-w-[7.5rem] flex-1',
                    !userHasPosition
                      ? 'border-cyan-400/40 bg-cyan-500/10'
                      : 'border-white/8 bg-white/[0.02]'
                  )}
                >
                  <p className="text-[8px] uppercase tracking-wider text-gray-500">No position</p>
                  <p
                    className={cn(
                      'mt-0.5 text-sm font-bold uppercase',
                      ACTION_COLORS[actionToneFromLabel(flatAction)].text
                    )}
                  >
                    {flatAction}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[9px] text-gray-500 leading-snug">
                Toggle “I own this stock” in Trade Zones to switch your Do now path.
              </p>
            </div>

            <p className="mt-3 text-[11px] text-gray-400">
              <span className="text-[9px] uppercase tracking-wider text-gray-500 mr-1.5">
                Outlook · {horizonLabel}
              </span>
              <span className={cn('font-semibold uppercase', outlookTone.text)}>{outlookLabel}</span>
              <span className="text-gray-600"> · thesis for the selected horizon, not the live entry cue</span>
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 min-w-0">
                <p className="text-[9px] uppercase tracking-wider text-gray-500">Target Price</p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`tp-${horizon}-${targetPrice}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="font-display text-lg sm:text-xl font-bold text-white tabular-nums mt-0.5 break-words leading-tight"
                  >
                    {formatMoney(targetPrice, currency)}
                  </motion.p>
                </AnimatePresence>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 min-w-0">
                <p className="text-[9px] uppercase tracking-wider text-gray-500">Expected Return</p>
                <p
                  className={cn(
                    'font-display text-lg sm:text-xl font-bold tabular-nums mt-0.5',
                    (expectedReturn ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  <AnimatedNumber
                    value={expectedReturn}
                    resetKey={horizon}
                    durationMs={450}
                    format={(n) => formatPct(n)}
                  />
                </p>
              </div>
            </div>

            <p className="mt-2 text-[9px] text-gray-500 font-mono leading-relaxed">
              {horizonExplanation ||
                'Investment Horizon is the single time selector — every metric below matches this window.'}
            </p>
          </div>
        </div>

        {/* Horizon chips — sole time selector */}
        <div className="xl:w-[210px] shrink-0 flex flex-col justify-center">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 text-center xl:text-left">
            Investment Horizon
          </p>
          <div className="grid grid-cols-2 xl:grid-cols-1 gap-1.5" role="radiogroup" aria-label="Investment Horizon">
            {HORIZON_OPTIONS.map((opt) => {
              const active = horizon === opt.key;
              return (
                <motion.button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onHorizonChange(opt.key)}
                  whileTap={{ scale: 0.97 }}
                  animate={
                    active
                      ? {
                          boxShadow: [
                            `0 0 0 0 ${actionTone.hex}00`,
                            `0 0 22px 2px ${actionTone.hex}55`,
                            `0 0 16px 1px ${actionTone.hex}40`,
                          ],
                        }
                      : { boxShadow: '0 0 0 0 rgba(0,0,0,0)' }
                  }
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-[11px] font-semibold transition-colors cursor-pointer',
                    active
                      ? cn(actionTone.bg, actionTone.border, actionTone.text, 'ring-1 ring-white/10')
                      : 'border-white/8 bg-white/[0.02] text-gray-400 hover:text-gray-200 hover:border-white/15'
                  )}
                >
                  {opt.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
