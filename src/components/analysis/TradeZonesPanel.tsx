import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Crosshair, ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassCard, SectionLabel } from './GlassCard';
import { formatMoney, type HorizonKey } from './analysisTheme';

type Levels = {
  s1?: number;
  s2?: number;
  r1?: number;
  r2?: number;
} | null;

type TradeZonesPanelProps = {
  lastClose: number;
  levels?: Levels;
  bullCase?: number | null;
  bearCase?: number | null;
  stopLoss?: number | null;
  currency?: string;
  /** Epoch ms of last live quote refresh (optional) */
  quoteAsOf?: number | null;
  /** Scales support/resistance distance from spot for the active Investment Horizon */
  zoneScale?: number;
  horizon?: HorizonKey;
  horizonLabel?: string;
};

function scaleFromSpot(px: number, level: number, scale: number) {
  return px + (level - px) * scale;
}

type ZoneBand = { lo: number; hi: number };

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
  // Shared boundary is allowed; interior overlap is not
  return aLo < bHi - 1e-9 && bLo < aHi - 1e-9 && !(nearlyEqual(aHi, bLo) || nearlyEqual(bHi, aLo));
}

function JourneyArrow() {
  return (
    <div className="flex justify-center py-0.5" aria-hidden>
      <span className="text-[11px] leading-none text-white/25 font-mono">↓</span>
    </div>
  );
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
}: TradeZonesPanelProps) {
  const model = useMemo(() => {
    // Zone geometry follows Investment Horizon via zoneScale + horizon-adjusted cases.
    const px = lastClose > 0 ? lastClose : 100;
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
    const sl =
      stopLoss && Number.isFinite(stopLoss)
        ? stopLoss
        : bearCase && Number.isFinite(bearCase)
          ? bearCase
          : s2 * 0.98;

    const buy: ZoneBand = { lo: Math.min(s2, s1), hi: Math.max(s2, s1) };
    const add: ZoneBand = {
      lo: Math.min(s1, (s1 + px) / 2),
      hi: Math.max(s1, (s1 + px) / 2),
    };
    const hold: ZoneBand = {
      lo: Math.min(px * 0.99, r1),
      hi: Math.max(px * 0.99, r1),
    };
    const takeProfit: ZoneBand = {
      lo: Math.min(r1, tpHi),
      hi: Math.max(r1, tpHi),
    };

    const warnings: string[] = [];
    const ordered = [
      { key: 'BUY', band: buy },
      { key: 'ADD', band: add },
      { key: 'HOLD', band: hold },
      { key: 'TAKE PROFIT', band: takeProfit },
    ] as const;

    for (const z of ordered) {
      if (!(z.band.lo < z.band.hi) && !nearlyEqual(z.band.lo, z.band.hi)) {
        warnings.push(`${z.key} zone has an inverted price range.`);
      }
    }

    for (let i = 0; i < ordered.length; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        if (overlaps(ordered[i].band, ordered[j].band)) {
          warnings.push(`${ordered[i].key} and ${ordered[j].key} ranges overlap.`);
        }
      }
    }

    // Expect ascending structure: BUY < ADD < HOLD < TAKE PROFIT (by zone lows / midpoints)
    const mids = ordered.map((z) => (z.band.lo + z.band.hi) / 2);
    for (let i = 1; i < mids.length; i++) {
      if (mids[i] + 1e-9 < mids[i - 1]) {
        warnings.push(`Zone order inconsistent: expected BUY < ADD < HOLD < TAKE PROFIT.`);
        break;
      }
    }

    if (!(sl < buy.lo - 1e-9) && !nearlyEqual(sl, buy.lo)) {
      warnings.push('Stop Loss Below should sit under the BUY zone for long trades.');
    }

    const journey = [
      {
        key: 'buy',
        emoji: '🟢',
        title: 'BUY ZONE',
        subtitle: 'Best entry price',
        detail: null as string | null,
        price: formatRange(buy.lo, buy.hi, currency),
        className: 'border-emerald-500/35 bg-emerald-500/10',
        titleClass: 'text-emerald-300',
      },
      {
        key: 'add',
        emoji: '🔵',
        title: 'ADD POSITION',
        subtitle: 'If already holding and the trend remains bullish',
        detail: null,
        price: formatRange(add.lo, add.hi, currency),
        className: 'border-sky-500/35 bg-sky-500/10',
        titleClass: 'text-sky-300',
      },
      {
        key: 'hold',
        emoji: '🟡',
        title: 'HOLD',
        subtitle: 'No action required.',
        detail: 'Continue holding existing position.',
        price: formatRange(hold.lo, hold.hi, currency),
        className: 'border-amber-500/35 bg-amber-500/10',
        titleClass: 'text-amber-300',
      },
      {
        key: 'tp',
        emoji: '🟣',
        title: 'TAKE PROFIT',
        subtitle: 'Consider taking partial profits.',
        detail: null,
        price: formatRange(takeProfit.lo, takeProfit.hi, currency),
        className: 'border-violet-500/35 bg-violet-500/10',
        titleClass: 'text-violet-300',
      },
    ];

    return {
      journey,
      stop: {
        price: formatMoney(sl, currency),
        raw: sl,
      },
      warnings: [...new Set(warnings)],
    };
  }, [lastClose, levels, bullCase, bearCase, stopLoss, currency, zoneScale]);

  return (
    <GlassCard className="h-full">
      <SectionLabel icon={<Crosshair className="w-3.5 h-3.5 text-emerald-400" />}>
        Trade Management Zones
      </SectionLabel>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-gray-500 leading-relaxed font-mono uppercase tracking-wider">
          {horizonLabel} · long trade journey
        </p>
        {lastClose > 0 && (
          <p className="text-[10px] font-mono text-emerald-400/90 tabular-nums flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            Live {formatMoney(lastClose, currency)}
            {quoteAsOf != null && Number.isFinite(quoteAsOf) && (
              <span className="text-gray-600 normal-case tracking-normal">
                · {new Date(quoteAsOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </p>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={horizon}
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
                  z.className
                )}
              >
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[10px] font-bold uppercase tracking-wider', z.titleClass)}>
                      <span className="mr-1.5" aria-hidden>
                        {z.emoji}
                      </span>
                      {z.title}
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

      {/* Contingency path — visually separated so it is not read as conflicting advice */}
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
          className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2.5 min-w-0"
        >
          <div className="flex items-start justify-between gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
                <span className="mr-1.5" aria-hidden>
                  🔴
                </span>
                Stop Loss Below
              </p>
              <p className="mt-1 text-[11px] text-gray-300 leading-snug">
                Exit only if price closes below this level.
              </p>
              <p className="mt-0.5 text-[10px] text-gray-500 leading-snug">
                This protects capital if the trade fails.
              </p>
              <div className="mt-2 rounded-lg border border-rose-500/25 bg-rose-500/10 px-2.5 py-2">
                <p className="text-[10px] text-rose-200/90 leading-snug">
                  For investors who have already opened a position. This is a risk-exit level —{' '}
                  <span className="font-semibold text-rose-100">not an entry signal</span>.
                </p>
              </div>
            </div>
            <div className="text-right shrink-0 pt-0.5">
              <p className="font-mono text-[12px] sm:text-[13px] font-bold text-white tabular-nums">
                {model.stop.price}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {model.warnings.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 flex gap-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
              Zone consistency warning
            </p>
            {model.warnings.map((w) => (
              <p key={w} className="text-[10px] text-amber-100/80 leading-snug">
                {w}
              </p>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-[10px] text-gray-500 leading-relaxed border-t border-white/5 pt-3">
        Zones and stop are calibrated to the <span className="text-gray-400">{horizonLabel}</span> Investment
        Horizon only. Stop Loss Below applies to investors who already hold a position — protective exit,
        not an entry signal.
      </p>
    </GlassCard>
  );
}
