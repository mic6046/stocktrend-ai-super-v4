import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Zap, TrendingUp, Landmark, Loader2, Bell, BellRing, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { scoutDayTrades, type DayTradeCandidate } from '../../lib/dayTradeScout';
import { findATrade } from '../../lib/findATrade';
import { buildSuggestUniverse, type SuggestMarket } from '../../lib/suggestTradeUniverses';
import type { StockRecommendation } from '../../lib/recommendation';
import { formatRecommendationDisplay } from '../../lib/recommendation';
import { useBuyNowWatcher } from '../../lib/useBuyNowWatcher';
import { usePortfolioProfitWatcher } from '../../lib/usePortfolioProfitWatcher';

const MARKETS: { key: SuggestMarket; label: string }[] = [
  { key: 'US', label: 'United States' },
  { key: 'HK', label: 'Hong Kong' },
  { key: 'JP', label: 'Japan' },
  { key: 'EU', label: 'Europe' },
];

/** Scan a modest slice of the market's universe — enough to surface 3 good
 * picks without the same latency as a full 30-name scan on every page load. */
const SCAN_SIZE = 15;

type PicksState = {
  dayTrades: DayTradeCandidate[];
  oneMonth: StockRecommendation[];
  longTerm: StockRecommendation[];
  loading: boolean;
  error: string | null;
};

const EMPTY_STATE: PicksState = { dayTrades: [], oneMonth: [], longTerm: [], loading: true, error: null };

type FireItem = {
  kind: 'buy' | 'profit';
  ticker: string;
  reason: string;
  at: number;
};

function toneForRecommendation(rec: string): string {
  const r = rec.toUpperCase();
  if (r.includes('STRONG BUY')) return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25';
  if (r.includes('BUY')) return 'text-sky-300 bg-sky-500/10 border-sky-500/25';
  return 'text-gray-300 bg-white/5 border-white/10';
}

function riskTextTone(risk?: string): string {
  const r = (risk || '').toLowerCase();
  if (r === 'very high' || r === 'high') return 'text-rose-400';
  if (r === 'medium') return 'text-amber-400';
  return 'text-gray-400';
}

function toneForBias(bias: string): string {
  if (bias === 'LONG') return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25';
  if (bias === 'SHORT') return 'text-rose-300 bg-rose-500/10 border-rose-500/25';
  return 'text-amber-300 bg-amber-500/10 border-amber-500/25';
}

/**
 * Compact "today's picks" strip for the top of the Dashboard: 3 day-trade
 * candidates, 3 one-month swing picks, and 3 long-term opportunities, with a
 * market selector. The one-month and long-term picks run through the same
 * AI Quantum Score engine as every other screen (findATrade -> the Quantum
 * recommendation engine), so every methodology rule already built (reaching
 * support, resistance framing, STRONG BUY signal priority, the P/E
 * confirmation, etc.) applies automatically. Day-trade picks use the
 * deliberately separate same-session engine (liquidity/ATR/momentum/RSI
 * heat) — a different concern from the swing/position rules.
 */
export function TodaysPicksStrip({ onOpenTicker }: { onOpenTicker: (ticker: string) => void }) {
  const [market, setMarket] = useState<SuggestMarket>('US');
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('qn_todays_picks_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [state, setState] = useState<PicksState>(EMPTY_STATE);
  const [fires, setFires] = useState<FireItem[]>([]);
  const watcher = useBuyNowWatcher((event) =>
    setFires((prev) =>
      [{ kind: 'buy' as const, ticker: event.ticker, reason: event.reason, at: event.at }, ...prev].slice(0, 5)
    )
  );
  // Slower, portfolio-wide sibling of the Buy Now watcher above: same banner
  // stack, but for the exit side — fires when a HELD position's own engine
  // call reaches "TAKE PARTIAL PROFIT" (reaching resistance + outflow),
  // independent of whichever market this strip is currently browsing.
  usePortfolioProfitWatcher((event) =>
    setFires((prev) =>
      [{ kind: 'profit' as const, ticker: event.ticker, reason: event.reason, at: event.at }, ...prev].slice(0, 5)
    )
  );
  const dismissFire = (at: number) => setFires((prev) => prev.filter((f) => f.at !== at));

  useEffect(() => {
    if (collapsed) return; // don't scan while collapsed — no point paying the cost
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const universe = buildSuggestUniverse(market, 'ALL', SCAN_SIZE, { shuffle: false });
        const tickers = universe.map((u) => u.ticker);

        const [dayTradeResult, oneMonthResult, longTermResult] = await Promise.all([
          scoutDayTrades({ market, max: SCAN_SIZE }),
          findATrade({ tickers, horizon: '1M', mode: 'find' }),
          findATrade({ tickers, horizon: '1Y', mode: 'find' }),
        ]);
        if (cancelled) return;

        setState({
          dayTrades: dayTradeResult.candidates.slice(0, 3),
          oneMonth: oneMonthResult.buyCandidates.slice(0, 3),
          longTerm: longTermResult.buyCandidates.slice(0, 3),
          loading: false,
          error: null,
        });
      } catch (err: any) {
        if (!cancelled) {
          setState({ ...EMPTY_STATE, loading: false, error: err?.message || 'Could not load picks' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [market, collapsed]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('qn_todays_picks_collapsed', next ? '1' : '0');
      } catch {
        /* best-effort only */
      }
      return next;
    });
  };

  return (
    <div className="relative rounded-2xl border border-white/10 bg-[#111113]/90 backdrop-blur-md overflow-hidden">
      {fires.length > 0 && (
        <div className="absolute top-2 right-2 z-20 flex flex-col gap-1.5 w-[min(320px,calc(100%-1rem))]">
          {fires.map((f) => (
            <div
              key={f.at}
              className={cn(
                'rounded-xl border backdrop-blur-md px-3 py-2 shadow-lg flex items-start gap-2',
                f.kind === 'buy' ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'
              )}
            >
              <BellRing
                className={cn('w-3.5 h-3.5 shrink-0 mt-0.5', f.kind === 'buy' ? 'text-emerald-400' : 'text-amber-400')}
              />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onOpenTicker(f.ticker)}
                  className={cn(
                    'text-[11px] font-bold hover:underline cursor-pointer',
                    f.kind === 'buy' ? 'text-emerald-300' : 'text-amber-300'
                  )}
                >
                  {f.kind === 'buy' ? 'Buy Now' : 'Take Partial Profit'}: {f.ticker}
                </button>
                <p className="text-[9px] text-gray-300 leading-snug mt-0.5">{f.reason}</p>
              </div>
              <button
                type="button"
                onClick={() => dismissFire(f.at)}
                className="text-gray-500 hover:text-gray-300 cursor-pointer shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={toggleCollapsed}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-200">Today's Picks</span>
          <span className="text-[10px] font-mono text-gray-500 hidden sm:inline">
            AI-scanned day trades, 1-month swings &amp; long-term opportunities
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!collapsed && (
            <div
              className="flex gap-1 bg-black/40 border border-white/10 rounded-lg p-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              {MARKETS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMarket(m.key)}
                  title={m.label}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer',
                    market === m.key
                      ? 'bg-emerald-500 text-black'
                      : 'text-gray-400 hover:text-gray-200'
                  )}
                >
                  {m.key}
                </button>
              ))}
            </div>
          )}
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5">
          {state.loading ? (
            <div className="flex items-center gap-2 text-[11px] text-gray-500 font-mono py-6 justify-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Scanning {market} market for today's picks…
            </div>
          ) : state.error ? (
            <p className="text-[11px] text-rose-400 font-mono py-4 text-center">{state.error}</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <PicksColumn
                icon={<Zap className="w-3.5 h-3.5 text-amber-400" />}
                title="Day Trade"
                subtitle="Same-session setups"
                empty="No names cleared today's day-trade gates."
              >
                {state.dayTrades.map((c) => (
                  <button
                    key={c.ticker}
                    type="button"
                    onClick={() => onOpenTicker(c.ticker)}
                    className="w-full text-left rounded-xl border border-white/5 bg-black/30 hover:border-emerald-500/30 hover:bg-black/50 p-2.5 transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-white text-[12px] truncate">{c.ticker}</span>
                      <span className={cn('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border', toneForBias(c.bias))}>
                        {c.bias}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-gray-500 truncate">{c.name}</p>
                    <p className="mt-1 text-[9px] font-mono text-gray-400">
                      score {c.score} · ATR {c.atrPct}% · RVOL {c.rvol}x
                    </p>
                  </button>
                ))}
              </PicksColumn>

              <PicksColumn
                icon={<TrendingUp className="w-3.5 h-3.5 text-sky-400" />}
                title="1-Month Trade"
                subtitle="AI Quantum Score · 1M horizon"
                empty="No BUY / STRONG BUY names cleared this scan."
              >
                {state.oneMonth.map((c) => (
                  <PickCard key={c.ticker} candidate={c} onOpenTicker={onOpenTicker} watcher={watcher} />
                ))}
              </PicksColumn>

              <PicksColumn
                icon={<Landmark className="w-3.5 h-3.5 text-violet-400" />}
                title="Long-Term Opportunity"
                subtitle="AI Quantum Score · 1Y horizon"
                empty="No BUY / STRONG BUY names cleared this scan."
              >
                {state.longTerm.map((c) => (
                  <PickCard key={c.ticker} candidate={c} onOpenTicker={onOpenTicker} watcher={watcher} />
                ))}
              </PicksColumn>
            </div>
          )}
          <p className="mt-3 text-[9px] text-gray-600 text-center leading-relaxed">
            AI-generated screening, not personalized investment advice. Snapshot of current market data — verify before acting.
          </p>
        </div>
      )}
    </div>
  );
}

function PicksColumn({
  icon,
  title,
  subtitle,
  empty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = React.Children.count(children) > 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">{title}</span>
      </div>
      <p className="text-[9px] text-gray-600 font-mono -mt-1">{subtitle}</p>
      <div className="space-y-1.5">
        {hasChildren ? children : <p className="text-[10px] text-gray-600 italic py-2">{empty}</p>}
      </div>
    </div>
  );
}

function PickCard({
  candidate: c,
  onOpenTicker,
  watcher,
}: {
  candidate: StockRecommendation;
  onOpenTicker: (ticker: string) => void;
  watcher: ReturnType<typeof useBuyNowWatcher>;
}) {
  const armed = watcher.isArmed(c.ticker);
  const hasZone = !!c.entryZone && c.entryZone.hi > 0;
  const status = watcher.statuses[c.ticker];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenTicker(c.ticker)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpenTicker(c.ticker);
      }}
      className="w-full text-left rounded-xl border border-white/5 bg-black/30 hover:border-emerald-500/30 hover:bg-black/50 p-2.5 transition-all cursor-pointer"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-bold text-white text-[12px] truncate">{c.ticker}</span>
        <div className="flex items-center gap-1 shrink-0">
          <span className={cn('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border', toneForRecommendation(c.recommendation))}>
            {formatRecommendationDisplay(c)}
          </span>
          {hasZone && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (armed) {
                  watcher.disarm(c.ticker);
                } else {
                  watcher.arm({ ticker: c.ticker, zone: { low: c.entryZone.lo, high: c.entryZone.hi } });
                }
              }}
              title={
                armed
                  ? 'Stop watching for entry'
                  : `Watch for Buy Now entry (zone ${c.entryZone.lo}-${c.entryZone.hi})`
              }
              className={cn(
                'rounded p-0.5 transition-colors cursor-pointer',
                armed ? 'text-emerald-400' : 'text-gray-600 hover:text-gray-400'
              )}
            >
              {armed ? <BellRing className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>
      <p className="mt-0.5 text-[10px] text-gray-500 truncate">{c.companyName}</p>
      <p className="mt-1 text-[9px] font-mono text-gray-400">
        score {c.overallScore} · conf {c.confidence}% · {c.expectedReturn >= 0 ? '+' : ''}
        {c.expectedReturn.toFixed(1)}%
        {c.riskLabel && (
          <>
            {' '}
            · <span className={riskTextTone(c.riskLabel)}>{c.riskLabel} risk</span>
          </>
        )}
      </p>
      {armed && status && (
        <p className="mt-1 text-[8.5px] font-mono text-emerald-400/70 truncate" title={status.reason}>
          watching: {status.error || status.reason}
        </p>
      )}
    </div>
  );
}
