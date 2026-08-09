import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Crosshair, ShieldAlert, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassCard, SectionLabel } from './GlassCard';
import { formatMoney, type HorizonKey } from './analysisTheme';
import type { LiveActionBrief, QuantumEngineOutput } from '../../lib/quantumRecommendationEngine';
import { buildRealisticSuggestEntry, type SuggestBuyBand } from '../../lib/suggestTradeEngine';
import type { TechnicalBreakdown } from '../../lib/technical';

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
  /** True when the feed is exchange-delayed (e.g. Yahoo HK ~15m). */
  quoteDelayed?: boolean;
  zoneScale?: number;
  horizon?: HorizonKey;
  horizonLabel?: string;
  userHasPosition?: boolean;
  onUserHasPositionChange?: (owns: boolean) => void;
  currentAction?: LiveActionBrief | null;
  visibleZoneKeys?: QuantumEngineOutput['visibleZoneKeys'];
  /** Used to build realistic Buy Zone 1/2/3 scale-in bands. */
  technical?: TechnicalBreakdown | null;
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

/** Fallback: split a single buy envelope into 3 descending tranches. */
function splitBuyEnvelope(buy: ZoneBand, px: number): SuggestBuyBand[] {
  const lo = Math.min(buy.lo, buy.hi);
  const hi = Math.max(buy.lo, buy.hi);
  const span = Math.max(hi - lo, px * 0.024);
  const top = hi;
  const bot = Math.min(lo, hi - span);
  const t1Hi = top;
  const t1Lo = top - span / 3;
  const t2Hi = t1Lo - px * 0.0015;
  const t2Lo = t2Hi - span / 3;
  const t3Hi = t2Lo - px * 0.0015;
  const t3Lo = bot;
  return [
    { level: 1, label: 'Buy Zone 1', sizePct: 30, anchor: 'upper entry', lo: t1Lo, hi: t1Hi },
    { level: 2, label: 'Buy Zone 2', sizePct: 40, anchor: 'core entry', lo: t2Lo, hi: t2Hi },
    { level: 3, label: 'Buy Zone 3', sizePct: 30, anchor: 'deep entry', lo: t3Lo, hi: t3Hi },
  ];
}

type JourneyCard = {
  key: string;
  emoji: string;
  title: string;
  subtitle: string;
  detail: string | null;
  price: string;
  className: string;
  titleClass: string;
  matchKeys: string[];
};

export function TradeZonesPanel({
  lastClose,
  levels,
  bullCase,
  bearCase,
  stopLoss,
  currency,
  quoteAsOf,
  quoteDelayed = false,
  zoneScale = 1,
  horizon = '1M',
  horizonLabel = '1 Month',
  engineZones = null,
  technical = null,
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

    const entry =
      technical && px > 0
        ? buildRealisticSuggestEntry({
            technical,
            price: px,
            targetHint: takeProfit.hi,
          })
        : null;
    const buyZones: SuggestBuyBand[] = entry?.buyZones?.length
      ? entry.buyZones
      : splitBuyEnvelope(buy, px);

    // Prefer realistic stop under BZ3 when available
    if (entry?.stopLoss != null && entry.stopLoss < buyZones[2].lo) {
      sl = entry.stopLoss;
    } else if (!(sl < buyZones[2].lo)) {
      sl = buyZones[2].lo * 0.985;
    }

    const warnings: string[] = [];
    for (const z of buyZones) {
      if (!(z.lo < z.hi)) warnings.push(`${z.label} has an inverted price range.`);
    }
    for (let i = 1; i < buyZones.length; i++) {
      if (!(buyZones[i].hi < buyZones[i - 1].lo)) {
        warnings.push(`${buyZones[i].label} should sit below ${buyZones[i - 1].label}.`);
      }
    }
    const ladder = [
      { key: 'ADD', band: add },
      { key: 'HOLD', band: hold },
      { key: 'TAKE PROFIT', band: takeProfit },
      { key: 'REDUCE', band: reduce },
      { key: 'EXIT', band: exit },
    ] as const;
    for (const z of ladder) {
      if (!(z.band.lo < z.band.hi)) warnings.push(`${z.key} zone has an inverted price range.`);
    }
    for (let i = 0; i < ladder.length; i++) {
      for (let j = i + 1; j < ladder.length; j++) {
        if (overlaps(ladder[i].band, ladder[j].band)) {
          warnings.push(`${ladder[i].key} and ${ladder[j].key} ranges overlap.`);
        }
      }
      if (i > 0 && !(ladder[i - 1].band.hi < ladder[i].band.lo)) {
        warnings.push(`Zone order broken: ${ladder[i - 1].key}.max must be < ${ladder[i].key}.min`);
      }
    }
    if (!(sl < buyZones[2].lo)) warnings.push('Stop Loss must sit strictly under Buy Zone 3.');

    const activeBuy = buyZones.find((z) => inBand(px, z));
    let priceZoneKey: string | null = null;
    if (px <= sl) priceZoneKey = 'stop';
    else if (inBand(px, exit) || px > exit.hi) priceZoneKey = 'exit';
    else if (inBand(px, reduce)) priceZoneKey = 'reduce';
    else if (inBand(px, takeProfit)) priceZoneKey = 'takeProfit';
    else if (inBand(px, hold)) priceZoneKey = 'hold';
    else if (userHasPosition && inBand(px, add)) priceZoneKey = 'add';
    else if (!userHasPosition && activeBuy) priceZoneKey = `buy${activeBuy.level}`;
    else if (userHasPosition) priceZoneKey = 'hold';
    else priceZoneKey = 'hold';

    const buyTone = [
      {
        emoji: '🟢',
        className: 'border-emerald-500/35 bg-emerald-500/10',
        titleClass: 'text-emerald-300',
        subtitle: 'First entry chance · nearest pullback',
      },
      {
        emoji: '🟢',
        className: 'border-sky-500/35 bg-sky-500/10',
        titleClass: 'text-sky-300',
        subtitle: 'Core entry · primary scale-in',
      },
      {
        emoji: '🟢',
        className: 'border-violet-500/35 bg-violet-500/10',
        titleClass: 'text-violet-300',
        subtitle: 'Deep value entry · best average if filled',
      },
    ] as const;

    const buyCards: JourneyCard[] = buyZones.map((z, i) => ({
      key: `buy${z.level}`,
      emoji: buyTone[i].emoji,
      title: `BUY ZONE ${z.level}`,
      subtitle: `${buyTone[i].subtitle} · ~${z.sizePct}% size`,
      detail: `via ${z.anchor}`,
      price: formatRange(z.lo, z.hi, currency),
      className: buyTone[i].className,
      titleClass: buyTone[i].titleClass,
      matchKeys: [`buy${z.level}`, 'buy'],
    }));

    const otherCards: JourneyCard[] = [
      {
        key: 'add',
        emoji: '🔵',
        title: 'ADD POSITION',
        subtitle: 'Scale in if already holding and thesis intact',
        detail: null,
        price: formatRange(add.lo, add.hi, currency),
        className: 'border-sky-500/35 bg-sky-500/10',
        titleClass: 'text-sky-300',
        matchKeys: ['add'],
      },
      {
        key: 'hold',
        emoji: '🟡',
        title: userHasPosition ? 'HOLD' : 'WAIT',
        subtitle: userHasPosition ? 'No action required.' : 'Wait for a better entry — do not chase.',
        detail: userHasPosition
          ? 'Continue holding existing position.'
          : 'Prefer Buy Zone 1–3 before opening.',
        price: formatRange(hold.lo, hold.hi, currency),
        className: 'border-amber-500/35 bg-amber-500/10',
        titleClass: 'text-amber-300',
        matchKeys: ['hold'],
      },
      {
        key: 'takeProfit',
        emoji: '🟣',
        title: 'TAKE PROFIT',
        subtitle: 'Consider taking partial profits.',
        detail: null,
        price: formatRange(takeProfit.lo, takeProfit.hi, currency),
        className: 'border-violet-500/35 bg-violet-500/10',
        titleClass: 'text-violet-300',
        matchKeys: ['takeProfit'],
      },
      {
        key: 'reduce',
        emoji: '🟠',
        title: 'REDUCE',
        subtitle: 'Trim remaining exposure after extension.',
        detail: null,
        price: formatRange(reduce.lo, reduce.hi, currency),
        className: 'border-orange-500/35 bg-orange-500/10',
        titleClass: 'text-orange-300',
        matchKeys: ['reduce'],
      },
      {
        key: 'exit',
        emoji: '🔴',
        title: 'EXIT',
        subtitle: 'Close remaining position.',
        detail: null,
        price: formatRange(exit.lo, exit.hi, currency),
        className: 'border-rose-500/35 bg-rose-500/10',
        titleClass: 'text-rose-300',
        matchKeys: ['exit'],
      },
    ];

    const keys =
      visibleZoneKeys ??
      (userHasPosition
        ? (['add', 'hold', 'takeProfit', 'reduce', 'exit', 'stop'] as const)
        : (['buy', 'hold', 'stop'] as const));

    const wantBuy = keys.includes('buy');
    const journey: JourneyCard[] = [
      ...(wantBuy ? buyCards : []),
      ...otherCards.filter((c) => keys.includes(c.key as (typeof keys)[number])),
    ];

    return {
      journey,
      stop: { price: formatMoney(sl, currency), raw: sl },
      showStop: keys.includes('stop'),
      warnings: [...new Set(warnings)],
      priceZoneKey,
      activeBuyLevel: activeBuy?.level ?? null,
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
    technical,
    userHasPosition,
    visibleZoneKeys,
  ]);

  const activeZoneKey = currentAction?.zoneKey || model.priceZoneKey;

  const cardIsLive = (z: JourneyCard) => {
    if (z.matchKeys.includes(activeZoneKey || '')) return true;
    if (activeZoneKey === 'buy' && z.key.startsWith('buy')) {
      // Engine still reports zoneKey 'buy' — highlight the tranche that contains live price
      return model.priceZoneKey === z.key || model.activeBuyLevel === Number(z.key.replace('buy', ''));
    }
    return false;
  };

  return (
    <GlassCard className="h-full">
      <SectionLabel icon={<Crosshair className="w-3.5 h-3.5 text-emerald-400" />}>
        Trade Management Zones
      </SectionLabel>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-gray-500 leading-relaxed font-mono uppercase tracking-wider">
          {horizonLabel} · synced with AI score Do Now ·{' '}
          {userHasPosition ? 'owned: ADD only' : 'flat: Buy Zone 1–3'}
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
              {quoteDelayed ? 'Delayed' : 'Live'} {formatMoney(lastClose, currency)}
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
                {model.activeBuyLevel != null ? ` · inside Buy Zone ${model.activeBuyLevel}` : ''}
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
                  cardIsLive(z) ? 'ring-1 ring-cyan-400/40' : undefined
                )}
              >
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[10px] font-bold uppercase tracking-wider', z.titleClass)}>
                      <span className="mr-1.5" aria-hidden>
                        {z.emoji}
                      </span>
                      {z.title}
                      {cardIsLive(z) && (
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
                  Stop Loss Below Buy Zone 3
                  {(currentAction?.zoneKey === 'stop' || activeZoneKey === 'stop') && (
                    <span className="ml-1.5 text-[8px] font-mono text-cyan-300 normal-case tracking-normal">
                      · live
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[11px] text-gray-300 leading-snug">
                  {userHasPosition
                    ? 'Exit only if price closes below this level.'
                    : 'Invalidation for new entries — do not buy below Buy Zone 3 / this stop.'}
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
