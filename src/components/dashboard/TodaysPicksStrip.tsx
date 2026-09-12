import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Zap, TrendingUp, Landmark, Loader2, BellRing, X, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { scoutDayTrades, type DayTradeCandidate } from '../../lib/dayTradeScout';
import { findATrade } from '../../lib/findATrade';
import { buildSuggestUniverse, type SuggestMarket } from '../../lib/suggestTradeUniverses';
import type { StockRecommendation } from '../../lib/recommendation';
import { formatRecommendationDisplay } from '../../lib/recommendation';
import { scanForBuyNow, type BuyNowPick } from '../../lib/buyNowScan';
import { usePortfolioProfitWatcher } from '../../lib/usePortfolioProfitWatcher';
import { useSuggestedBuyFadeWatcher } from '../../lib/useSuggestedBuyFadeWatcher';
import { recordSuggestedBuy } from '../../lib/suggestedBuysStore';
import { fetchIndexChange2dPct, findMarketLeaders, type MarketLeader } from '../../lib/marketLeaders';

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
  buyNow: BuyNowPick[];
  buyNowLoading: boolean;
  loading: boolean;
  error: string | null;
  marketLeaders: MarketLeader[];
  indexChange2dPct: number | null;
};

const EMPTY_STATE: PicksState = {
  dayTrades: [],
  oneMonth: [],
  longTerm: [],
  buyNow: [],
  buyNowLoading: true,
  loading: true,
  error: null,
  marketLeaders: [],
  indexChange2dPct: null,
};

type FireItem = {
  kind: 'profit' | 'fade';
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

function setupTagStyle(tag: 'PULLBACK BUY' | 'BREAKOUT BUY'): { label: string; className: string } {
  return tag === 'BREAKOUT BUY'
    ? { label: '🚀 Breakout Buy', className: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/25' }
    : { label: '↩ Pullback Buy', className: 'text-violet-300 bg-violet-500/10 border-violet-500/25' };
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
  // Portfolio-wide watcher for the exit side: fires when a HELD position's
  // own engine call reaches "TAKE PARTIAL PROFIT" (reaching resistance +
  // outflow), independent of whichever market this strip is browsing. No
  // background timer — re-checked only on the same refresh cycle Buy Now
  // uses below (mount, market switch, or re-expanding the strip).
  const { scanNow: scanProfitWatch } = usePortfolioProfitWatcher((event) =>
    setFires((prev) =>
      [{ kind: 'profit' as const, ticker: event.ticker, reason: event.reason, at: event.at }, ...prev].slice(0, 5)
    )
  );
  // Watches previously-suggested BUY/STRONG BUY picks (from this same strip)
  // for signs the setup has faded since they were shown — see
  // suggestedBuyFadeWatcher.ts for why every check is a leading signal, never
  // a "price already broke the stop" one (too late to act on by then).
  const { scanNow: scanFadeWatch } = useSuggestedBuyFadeWatcher((event) =>
    setFires((prev) =>
      [{ kind: 'fade' as const, ticker: event.ticker, reason: event.reason, at: event.at }, ...prev].slice(0, 5)
    )
  );
  const dismissFire = (at: number) => setFires((prev) => prev.filter((f) => f.at !== at));

  useEffect(() => {
    if (collapsed) return; // don't scan while collapsed — no point paying the cost
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, buyNowLoading: true, error: null }));
    void scanProfitWatch();
    void scanFadeWatch();

    (async () => {
      try {
        const universe = buildSuggestUniverse(market, 'ALL', SCAN_SIZE, { shuffle: false });
        const tickers = universe.map((u) => u.ticker);

        const [dayTradeResult, oneMonthResult, longTermResult, indexChange2dPct] = await Promise.all([
          scoutDayTrades({ market, max: SCAN_SIZE }),
          findATrade({ tickers, horizon: '1M', mode: 'find' }),
          findATrade({ tickers, horizon: '1Y', mode: 'find' }),
          fetchIndexChange2dPct(market),
        ]);
        if (cancelled) return;

        const oneMonth = oneMonthResult.buyCandidates.slice(0, 3);
        const longTerm = longTermResult.buyCandidates.slice(0, 3);
        // Market Leaders draws from the FULL scanned candidate pool (not just
        // the top-3-by-score picks above) — the best relative-strength story
        // today isn't necessarily the same name as the best overall score.
        const marketLeaders = findMarketLeaders(
          [...oneMonthResult.buyCandidates, ...longTermResult.buyCandidates],
          indexChange2dPct
        ).slice(0, 6);

        // Track every BUY/STRONG BUY pick shown here so the fade watcher has
        // a snapshot to compare fresh scans against later.
        for (const c of [...oneMonth, ...longTerm]) {
          if (c.recommendation !== 'BUY' && c.recommendation !== 'STRONG BUY') continue;
          recordSuggestedBuy({
            ticker: c.ticker,
            companyName: c.companyName,
            suggestedAt: Date.now(),
            verdict: c.recommendation,
            confidence: c.confidence,
            setupTag: c.engine?.setupTag ?? null,
            price: c.engine?.currentPrice ?? 0,
            fundFlow: c.boardMetrics?.fundFlow ?? 'Flat',
          });
        }

        setState({
          dayTrades: dayTradeResult.candidates.slice(0, 3),
          oneMonth,
          longTerm,
          buyNow: [],
          buyNowLoading: true,
          loading: false,
          error: null,
          marketLeaders,
          indexChange2dPct,
        });

        // Re-check the picks already selected above against a fresh live
        // quote — this is what actually answers "is one of these a good
        // entry right now," not the daily-bar data the picks themselves
        // were chosen from.
        const buyNow = await scanForBuyNow([...oneMonth, ...longTerm]);
        if (!cancelled) {
          setState((s) => ({ ...s, buyNow, buyNowLoading: false }));
        }
      } catch (err: any) {
        if (!cancelled) {
          setState({ ...EMPTY_STATE, loading: false, buyNowLoading: false, error: err?.message || 'Could not load picks' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [market, collapsed, scanProfitWatch]);

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
                f.kind === 'fade'
                  ? 'border-rose-500/30 bg-rose-500/10'
                  : 'border-amber-500/30 bg-amber-500/10'
              )}
            >
              {f.kind === 'fade' ? (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
              ) : (
                <BellRing className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
              )}
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onOpenTicker(f.ticker)}
                  className={cn(
                    'text-[11px] font-bold hover:underline cursor-pointer',
                    f.kind === 'fade' ? 'text-rose-300' : 'text-amber-300'
                  )}
                >
                  {f.kind === 'fade' ? 'Pick Weakening' : 'Take Partial Profit'}: {f.ticker}
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
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <PicksColumn
                icon={<BellRing className="w-3.5 h-3.5 text-emerald-400" />}
                title="Buy Now"
                subtitle="Live re-check of the picks below"
                empty="None of today's picks are at a fresh entry right now — refresh to re-check."
              >
                {state.buyNowLoading ? (
                  <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-mono py-2 justify-center">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Checking live price &amp; volume…
                  </div>
                ) : (
                  state.buyNow.map((p) => (
                    <button
                      key={p.ticker}
                      type="button"
                      onClick={() => onOpenTicker(p.ticker)}
                      className="w-full text-left rounded-xl border border-emerald-500/25 bg-emerald-500/5 hover:border-emerald-500/40 hover:bg-emerald-500/10 p-2.5 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-white text-[12px] truncate">{p.ticker}</span>
                        <span className={cn('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border', toneForRecommendation(p.recommendation))}>
                          {p.recommendation}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-gray-500 truncate">{p.companyName}</p>
                      <p className="mt-1 text-[9px] font-mono text-emerald-400/80 leading-snug">{p.reason}</p>
                    </button>
                  ))
                )}
              </PicksColumn>

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
                  <PickCard key={c.ticker} candidate={c} onOpenTicker={onOpenTicker} />
                ))}
              </PicksColumn>

              <PicksColumn
                icon={<Landmark className="w-3.5 h-3.5 text-violet-400" />}
                title="Long-Term Opportunity"
                subtitle="AI Quantum Score · 1Y horizon"
                empty="No BUY / STRONG BUY names cleared this scan."
              >
                {state.longTerm.map((c) => (
                  <PickCard key={c.ticker} candidate={c} onOpenTicker={onOpenTicker} />
                ))}
              </PicksColumn>
            </div>
          )}

          {state.marketLeaders.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/10">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">Market Leaders</span>
                <span className="text-[9px] text-gray-600 font-mono">
                  index {state.indexChange2dPct != null ? state.indexChange2dPct.toFixed(1) : '—'}% over 2 days — these are holding up or rising anyway
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
                {state.marketLeaders.map((l) => (
                  <button
                    key={l.ticker}
                    type="button"
                    onClick={() => onOpenTicker(l.ticker)}
                    className="text-left rounded-xl border border-emerald-500/25 bg-emerald-500/5 hover:border-emerald-500/40 hover:bg-emerald-500/10 p-2 transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono font-bold text-white text-[11px] truncate">{l.ticker}</span>
                      <span className={cn('text-[8px] font-bold uppercase px-1 py-0.5 rounded border shrink-0', toneForRecommendation(l.recommendation))}>
                        {l.recommendation}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[9px] font-mono text-emerald-400/90">
                      +{l.outperformancePts.toFixed(1)}pt vs index ({l.change2dPct >= 0 ? '+' : ''}{l.change2dPct.toFixed(1)}%)
                    </p>
                    {l.nearResistance && (
                      <p className="mt-0.5 flex items-center gap-1 text-[9px] font-mono text-amber-400">
                        <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                        Near resistance
                      </p>
                    )}
                  </button>
                ))}
              </div>
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
}: {
  candidate: StockRecommendation;
  onOpenTicker: (ticker: string) => void;
}) {
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
        <span className={cn('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0', toneForRecommendation(c.recommendation))}>
          {formatRecommendationDisplay(c)}
        </span>
      </div>
      <p className="mt-0.5 text-[10px] text-gray-500 truncate">{c.companyName}</p>
      {c.engine?.setupTag && (
        <span
          className={cn(
            'mt-1 inline-block text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border',
            setupTagStyle(c.engine.setupTag).className
          )}
        >
          {setupTagStyle(c.engine.setupTag).label}
        </span>
      )}
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
      {c.boardMetrics?.fundFlow === 'Outflow' && (
        <p className="mt-1 flex items-center gap-1 text-[9px] font-mono text-rose-400">
          <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
          Funds outflowing — institutional/whale flow net negative
        </p>
      )}
    </div>
  );
}
