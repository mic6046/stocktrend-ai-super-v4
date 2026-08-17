import React, { useState, Suspense, lazy } from 'react';
import { cn } from '../../lib/utils';
import { GlassCard } from '../analysis/GlassCard';
import type { HorizonKey } from '../analysis/analysisTheme';

const FindATradePanel = lazy(() =>
  import('../analysis/FindATradePanel').then((m) => ({ default: m.FindATradePanel }))
);
const SuggestATradePanel = lazy(() =>
  import('../analysis/SuggestATradePanel').then((m) => ({ default: m.SuggestATradePanel }))
);
const DayTradePanel = lazy(() =>
  import('../analysis/DayTradePanel').then((m) => ({ default: m.DayTradePanel }))
);

const CATEGORIES = [
  { id: 'STRONG_BUY', label: 'Strong Buy', hint: 'Highest conviction AI buy setups' },
  { id: 'BREAKOUT', label: 'Breakout', hint: 'Price pushing through resistance' },
  { id: 'WHALE', label: 'Whale Accumulation', hint: 'Large-block buying pressure' },
  { id: 'SMART', label: 'Smart Money', hint: 'Institutional-style flow' },
  { id: 'FUND', label: 'Fund Flow', hint: 'Net money flowing into the name' },
  { id: 'OVERSOLD', label: 'Oversold', hint: 'Stretched lower — possible bounce' },
  { id: 'MOMENTUM', label: 'Momentum', hint: 'Trend strength accelerating' },
  { id: 'VOLUME', label: 'High Volume', hint: 'Unusual participation' },
  { id: 'UNUSUAL', label: 'Unusual Activity', hint: 'Activity outside the normal range' },
] as const;

type Tab = 'find' | 'suggest' | 'day';

type FindTradesPageProps = {
  horizon?: HorizonKey;
  onOpenTicker: (ticker: string) => void;
};

export function FindTradesPage({
  horizon = '1M',
  onOpenTicker,
}: FindTradesPageProps) {
  const [tab, setTab] = useState<Tab>('find');
  const [category, setCategory] = useState<string>('STRONG_BUY');

  return (
    <div className="space-y-4 min-w-0">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-emerald-400">Discovery</p>
        <h2 className="mt-1 text-2xl font-sans font-bold text-white">Find Trades</h2>
        <p className="mt-1 text-[13px] text-gray-500 max-w-2xl">
          Scan for setups with plain-language categories. Pick a style, then open any ticker for full analysis.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'find' as const, label: 'Find', color: 'emerald' },
            { id: 'suggest' as const, label: 'Suggest', color: 'sky' },
            { id: 'day' as const, label: 'Day', color: 'orange' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'min-h-[40px] rounded-full px-4 text-[11px] font-bold uppercase tracking-wider border cursor-pointer',
              tab === t.id && t.color === 'emerald' && 'bg-emerald-500 text-black border-emerald-400',
              tab === t.id && t.color === 'sky' && 'bg-sky-500 text-black border-sky-400',
              tab === t.id && t.color === 'orange' && 'bg-orange-500 text-black border-orange-400',
              tab !== t.id && 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <GlassCard padding="sm">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">AI discovery categories</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.hint}
              onClick={() => setCategory(c.id)}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border cursor-pointer',
                category === c.id
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                  : 'bg-black/20 text-gray-400 border-white/10 hover:text-white'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-gray-500">
          {CATEGORIES.find((c) => c.id === category)?.hint}. Filters for market, sector, and risk live inside each scanner below.
        </p>
      </GlassCard>

      <Suspense
        fallback={
          <div className="rounded-2xl border border-white/10 bg-[#121214]/80 p-8 text-center text-gray-500 text-sm">
            Loading scanner…
          </div>
        }
      >
        {tab === 'find' && (
          <FindATradePanel horizon={horizon} onOpenTicker={onOpenTicker} />
        )}
        {tab === 'suggest' && (
          <SuggestATradePanel horizon={horizon} onOpenTicker={onOpenTicker} />
        )}
        {tab === 'day' && (
          <DayTradePanel onOpenTicker={onOpenTicker} />
        )}
      </Suspense>
    </div>
  );
}
