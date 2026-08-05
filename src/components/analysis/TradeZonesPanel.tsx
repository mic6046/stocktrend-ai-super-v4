import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Crosshair, ShieldAlert, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassCard, SectionLabel } from './GlassCard';
import { formatMoney, type HorizonKey } from './analysisTheme';
import type { LiveActionBrief, QuantumEngineOutput } from '../../lib/quantumRecommendationEngine';

type Levels = {
  s1?: number;
  s2?: number;
  r1?: number;
  r2?: number;
} | null;

type ZoneBand = { lo: number; hi: number };

type TradeZonesPanelProps = {
  lastClose: number;
  levels?: Levels;
  bullCase?: number | null;
  bearCase?: number | null;
  stopLoss?: number | null;
  currency?: string;
  quoteAsOf?: number | null;
  zoneScale?: number;
  horizon?: HorizonKey;
  horizonLabel?: string;
  userHasPosition?: boolean;
  onUserHasPositionChange?: (owns: boolean) => void;
  currentAction?: LiveActionBrief | null;
  visibleZoneKeys?: QuantumEngineOutput['visibleZoneKeys'];
  engineZones?: {
    buyZone: ZoneBand;
    addZone: ZoneBand;
    holdZone: ZoneBand;
    takeProfitZone: ZoneBand;
    reduceZone?: ZoneBand;
    exitZone?: ZoneBand;
    stopLoss: number;
  } | null;
};

function scaleFromSpot(px: number, level: number, scale: number) {
  return px + (level - px) * scale;
}

function formatRange(lo: number, hi: number, currency?: string) {
  return `${formatMoney(Math.min(lo, hi), currency)} – ${formatMoney(Math.max(lo, hi), currency)}`;
}

function nearlyEqual(a: number, b: number, eps = 1e-6) {
  return Math.abs(a - b) <= Math.max(eps, Math.abs(a) * 1e-8);
}

function overlaps(a: ZoneBand, b: ZoneBand) {
  const aLo = Math.min(a.lo, a.hi);
  const aHi = Math.max(a.lo, a.hi);
  const bLo = Math.min(b.lo, b.hi);
  const bHi = Math.max(b.lo, b.hi);
  return aLo < bHi - 1e-9 && bLo < aHi - 1e-9 && !(nearlyEqual(aHi, bLo) || nearlyEqual(bHi, aLo));
}

function JourneyArrow() {
  return (
    <div className="flex justify-center py-0.5" aria-hidden>
      <span className="text-[11px] leading-none text-white/25 font-mono">↓</span>
    </div>
  );
}

function inBand(px: number, band: ZoneBand): boolean {
  const lo = Math.min(band.lo, band.hi);
  const hi = Math.max(band.lo, band.hi);
  return px >= lo - 1e-9 && px <= hi + 1e-9;
}

export function TradeZonesPanel({
  lastClose,
  levels,
  bullCase,
  bearCase,
  stopLoss,
  currency,
  quoteAsOf,
  zoneScale = 1,
  horizon = '1M',
  horizonLabel = '1 Month',
  engineZones = null,
  userHasPosition = false,
  onUserHasPositionChange,
  currentAction = null,
  visibleZoneKeys,
}: TradeZonesPanelProps) {
  const model = useMemo(() => {
    const px = lastClose > 0 ? lastClose : 100;

    let buy: ZoneBand;
    let add: ZoneBand;
    let hold: ZoneBand;
    let takeProfit: ZoneBand;
    let reduce: ZoneBand;
    let exit: ZoneBand;
    let sl: number;

    if (engineZones) {
      buy = engineZones.buyZone;
      add = engineZones.addZone;
      hold = engineZones.holdZone;
      takeProfit = engineZones.takeProfitZone;
      reduce = engineZones.reduceZone ?? {
        lo: takeProfit.hi * 1.002,
        hi: takeProfit.hi * 1.02,
      };
      exit = engineZones.exitZone ?? {
        lo: reduce.hi * 1.002,
        hi: reduce.hi * 1.02,
      };
      sl = engineZones.stopLoss;
    } else {
      const z = Number.isFinite(zoneScale) && zoneScale > 0 ? zoneScale : 1;
      const rawS2 = levels?.s2 && Number.isFinite(levels.s2) ? levels.s2 : px * 0.92;
      const rawS1 = levels?.s1 && Number.isFinite(levels.s1) ? levels.s1 : px * 0.96;
      const rawR1 = levels?.r1 && Number.isFinite(levels.r1) ? levels.r1 : px * 1.04;
      const rawR2 = levels?.r2 && Number.isFinite(levels.r2) ? levels.r2 : px * 1.1;
      const s2 = scaleFromSpot(px, rawS2, z);
      const s1 = scaleFromSpot(px, rawS1, z);
      const r1 = scaleFromSpot(px, rawR1, z);
      const r2 = scaleFromSpot(px, rawR2, z);
      const tpHi = bullCase && Number.isFinite(bullCase) ? bullCase : r2 * 1.02;
      sl =
        stopLoss && Number.isFinite(stopLoss)
          ? stopLoss
          : bearCase && Number.isFinite(bearCase)
            ? bearCase
            : s2 * 0.98;

      const eps = Math.max(px * 0.0008, 0.01);
      buy = { lo: Math.min(s2, s1), hi: Math.max(s2, s1) };
      add = { lo: buy.hi + eps, hi: buy.hi + eps + Math.max(px * 0.01, (px - buy.hi) * 0.4) };
      hold = { lo: add.hi + eps, hi: Math.max(add.hi + eps + px * 0.01, Math.min(r1, px * 1.02)) };
      takeProfit = { lo: hold.hi + eps, hi: Math.max(hold.hi + eps + px * 0.01, tpHi) };
      reduce = { lo: takeProfit.hi + eps, hi: takeProfit.hi + eps + px * 0.012 };
      exit = { lo: reduce.hi + eps, hi: reduce.hi + eps + px * 0.012 };
    }

    const warnings: string[] = [];
    const ordered = [
      { key: 'BUY', band: buy },
      { key: 'ADD', band: add },
      { key: 'HOLD', band: hold },
      { key: 'TAKE PROFIT', band: takeProfit },
      { key: 'REDUCE', band: reduce },
      { key: 'EXIT', band: exit },
    ] as const;

    for (const z of ordered) {
      if (!(z.band.lo < z.band.hi)) warnings.push(`${z.key} zone has an inverted price range.`);
    }
    for (let i = 0; i < ordered.length; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        if (overlaps(ordered[i].band, ordered[j].band)) {
          warnings.push(`${ordered[i].key} and ${ordered[j].key} ranges overlap.`);
        }
      }
      if (i > 0 && !(ordered[i - 1].band.hi < ordered[i].band.lo)) {
        warnings.push(`Zone order broken: ${ordered[i - 1].key}.max must be < ${ordered[i].key}.min`);
      }
    }
    if (!(sl < buy.lo)) warnings.push('Stop Loss must sit strictly under the BUY zone.');

    // Which band contains live price — used to sync highlight with AI score Do Now
    let priceZoneKey: string | null = null;
    if (px <= sl) priceZoneKey = 'stop';
    else if (inBand(px, exit) || px > exit.hi) priceZoneKey = 'exit';
    else if (inBand(px, reduce)) priceZoneKey = 'reduce';
    else if (inBand(px, takeProfit)) priceZoneKey = 'takeProfit';
    else if (inBand(px, hold)) priceZoneKey = 'hold';
    else if (userHasPosition && inBand(px, add)) priceZoneKey = 'add';
    else if (!userHasPosition && inBand(px, buy)) priceZoneKey = 'buy';
    else if (userHasPosition) priceZoneKey = 'hold';
    else priceZoneKey = 'hold';

    const allCards = [
      {
        key: 'buy' as const,
        emoji: '🟢',
        title: 'BUY ZONE',
        subtitle: 'Best entry for a new position',
        detail: null as string | null,
        price: formatRange(buy.lo, buy.hi, currency),
        className: 'border-emerald-500/35 bg-emerald-500/10',
        titleClass: 'text-emerald-300',
      },
      {
        key: 'add' as const,
        emoji: '🔵',
        title: 'ADD POSITION',
        subtitle: 'Scale in if already holding and thesis intact',
        detail: null,
        price: formatRange(add.lo, add.hi, currency),
        className: 'border-sky-500/35 bg-sky-500/10',
        titleClass: 'text-sky-300',
      },
      {
        key: 'hold' as const,
        emoji: '🟡',
        title: userHasPosition ? 'HOLD' : 'WAIT',
        subtitle: userHasPosition ? 'No action required.' : 'Wait for a better entry — do not chase.',
        detail: userHasPosition ? 'Continue holding existing position.' : 'Prefer BUY zone before opening.',
        price: formatRange(hold.lo, hold.hi, currency),
        className: 'border-amber-500/35 bg-amber-500/10',
        titleClass: 'text-amber-300',
      },
      {
        key: 'takeProfit' as const,
        emoji: '🟣',
        title: 'TAKE PROFIT',
        subtitle: 'Consider taking partial profits.',
        detail: null,
        price: formatRange(takeProfit.lo, takeProfit.hi, currency),
        className: 'border-violet-500/35 bg-violet-500/10',
        titleClass: 'text-violet-300',
      },
      {
        key: 'reduce' as const,
        emoji: '🟠',
        title: 'REDUCE',
        subtitle: 'Trim remaining exposure after extension.',
        detail: null,
        price: formatRange(reduce.lo, reduce.hi, currency),
        className: 'border-orange-500/35 bg-orange-500/10',
        titleClass: 'text-orange-300',
      },
      {
        key: 'exit' as const,
        emoji: '🔴',
        title: 'EXIT',
        subtitle: 'Close remaining position.',
        detail: null,
        price: formatRange(exit.lo, exit.hi, currency),
        className: 'border-rose-500/35 bg-rose-500/10',
        titleClass: 'text-rose-300',
      },
    ];

    const keys =
      visibleZoneKeys ??
      (userHasPosition
        ? (['add', 'hold', 'takeProfit', 'reduce', 'exit', 'stop'] as const)
        : (['buy', 'hold', 'stop'] as const));

    const journey = allCards.filter((c) => keys.includes(c.key));

    return {
      journey,
      stop: { price: formatMoney(sl, currency), raw: sl },
      showStop: keys.includes('stop'),
      warnings: [...new Set(warnings)],
      priceZoneKey,
    };
  }, [
    lastClose,
    levels,
    bullCase,
    bearCase,
    stopLoss,
    currency,
    zoneScale,
    engineZones,
    userHasPosition,
    visibleZoneKeys,
  ]);

  const activeZoneKey = currentAction?.zoneKey || model.priceZoneKey;
  return (
    <GlassCard className="h-full">
      <SectionLabel icon={<Crosshair className="w-3.5 h-3.5 text-emerald-400" />}>
        Trade Management Zones
      </SectionLabel>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-gray-500 leading-relaxed font-mono uppercase tracking-wider">
          {horizonLabel} · synced with AI score Do Now · {userHasPosition ? 'owned: ADD only' : 'flat: BUY only'}
        </p>
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">I own this stock</span>
          <button
            type="button"
            role="switch"
            aria-checked={userHasPosition}
            onClick={() => onUserHasPositionChange?.(!userHasPosition)}
            className={cn(
              'relative h-5 w-9 rounded-full border transition-colors',
              userHasPosition ? 'bg-emerald-500/40 border-emerald-400/50' : 'bg-white/10 border-white/15'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform',
                userHasPosition && 'translate-x-4'
              )}
            />
          </button>
        </label>
      </div>

      {lastClose > 0 && (
        <div className="mb-3 rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-mono uppercase tracking-wider text-cyan-300/90 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              Live {formatMoney(lastClose, currency)}
              {quoteAsOf != null && Number.isFinite(quoteAsOf) && (
                <span className="text-gray-600 normal-case tracking-normal">
                  · {new Date(quoteAsOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </p>
            {currentAction && (
              <span className="text-[11px] font-black tracking-wider uppercase text-white bg-white/10 border border-white/15 px-2 py-0.5 rounded">
                {currentAction.action}
              </span>
            )}
          </div>
          {currentAction && (
            <>
              <p className="mt-1.5 text-[11px] text-gray-300 leading-relaxed">{currentAction.reason}</p>
              <p className="mt-1 text-[10px] font-mono text-gray-500">
                Confidence {currentAction.confidence}% · exactly one live action
              </p>
            </>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={`${horizon}-${userHasPosition ? 'owned' : 'flat'}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.38 }}
          className="space-y-0"
        >
          {model.journey.map((z, idx) => (
            <React.Fragment key={z.key}>
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: idx * 0.04 }}
                className={cn(
                  'rounded-xl border px-3 py-2.5 min-w-0 transition-transform duration-200 hover:scale-[1.01]',
                  z.className,
                  currentAction?.zoneKey === z.key || activeZoneKey === z.key
                    ? 'ring-1 ring-cyan-400/40'
                    : undefined
                )}
              >
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[10px] font-bold uppercase tracking-wider', z.titleClass)}>
                      <span className="mr-1.5" aria-hidden>
                        {z.emoji}
                      </span>
                      {z.title}
                      {(currentAction?.zoneKey === z.key || activeZoneKey === z.key) && (
                        <span className="ml-1.5 text-[8px] font-mono text-cyan-300 normal-case tracking-normal">
                          · live
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-300 leading-snug">{z.subtitle}</p>
                    {z.detail && (
                      <p className="mt-0.5 text-[10px] text-gray-500 leading-snug">{z.detail}</p>
                    )}
                  </div>
                  <p className="font-mono text-[12px] sm:text-[13px] font-bold text-white tabular-nums text-right shrink-0 pt-0.5">
                    {z.price}
                  </p>
                </div>
              </motion.div>
              {idx < model.journey.length - 1 && <JourneyArrow />}
            </React.Fragment>
          ))}
        </motion.div>
      </AnimatePresence>

      {model.showStop && (
        <div className="mt-3 pt-3 border-t border-dashed border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400/80 shrink-0" />
            <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-rose-300/80">
              If the trade fails at any stage
            </p>
          </div>
          <div className="flex justify-center pb-1.5" aria-hidden>
            <span className="text-[11px] leading-none text-rose-400/40 font-mono">⬇</span>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.22 }}
            className={cn(
              'rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2.5 min-w-0',
              (currentAction?.zoneKey === 'stop' || activeZoneKey === 'stop') && 'ring-1 ring-cyan-400/40'
            )}
          >
            <div className="flex items-start justify-between gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
                  <span className="mr-1.5" aria-hidden>
                    🔴
                  </span>
                  Stop Loss Below
                  {(currentAction?.zoneKey === 'stop' || activeZoneKey === 'stop') && (
                    <span className="ml-1.5 text-[8px] font-mono text-cyan-300 normal-case tracking-normal">
                      · live
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[11px] text-gray-300 leading-snug">
                  {userHasPosition
                    ? 'Exit only if price closes below this level.'
                    : 'Invalidation for new entries — do not buy below this level.'}
                </p>
              </div>
              <p className="font-mono text-[12px] sm:text-[13px] font-bold text-rose-200 tabular-nums shrink-0">
                {model.stop.price}
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {model.warnings.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 flex gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            {model.warnings.map((w) => (
              <p key={w} className="text-[10px] text-amber-200/90 leading-snug">
                {w}
              </p>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
