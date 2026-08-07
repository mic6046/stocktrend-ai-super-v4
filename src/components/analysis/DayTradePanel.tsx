import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, Loader2, Search, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassCard, SectionLabel } from './GlassCard';
import { formatMoney, formatPct } from './analysisTheme';
import {
  DAY_TRADE_FACTOR_ORDER,
  type DayTradeBias,
  type DayTradeFactor,
  type DayTradeRating,
} from '../../lib/dayTradeEngine';
import {
  DAY_TRADE_MAX,
  scoutDayTrades,
  type DayTradeCandidate,
  type DayTradeProgress,
  type DayTradeResult,
} from '../../lib/dayTradeScout';
import {
  SUGGEST_MARKETS,
  type SuggestMarket,
} from '../../lib/suggestTradeUniverses';

const MARKET_KEY = 'qn-day-trade-market';

function loadMarket(): SuggestMarket {
  try {
    const v = localStorage.getItem(MARKET_KEY) as SuggestMarket | null;
    if (v && SUGGEST_MARKETS.some((m) => m.key === v)) return v;
  } catch {
    /* ignore */
  }
  return 'US';
}

type DayTradePanelProps = {
  onOpenTicker: (ticker: string) => void;
  className?: string;
  /** Increment from header Day Trade button to force a new scout. */
  runToken?: number;
};

function biasTone(bias: DayTradeBias): string {
  if (bias === 'LONG') return 'text-emerald-300';
  if (bias === 'SHORT') return 'text-rose-300';
  if (bias === 'FADE') return 'text-amber-200';
  return 'text-gray-400';
}

function ratingTone(rating: DayTradeRating): string {
  if (rating >= 4) return 'text-emerald-300 border-emerald-500/25 bg-emerald-500/10';
  if (rating === 3) return 'text-sky-200 border-sky-500/25 bg-sky-500/10';
  return 'text-rose-300 border-rose-500/30 bg-rose-500/10';
}

function FactorGrid({ factors }: { factors: DayTradeFactor[] }) {
  const ordered = DAY_TRADE_FACTOR_ORDER.map((k) => factors.find((f) => f.key === k)).filter(
    Boolean
  ) as DayTradeFactor[];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
      {ordered.map((f) => (
        <div
          key={f.key}
          title={f.detail}
          className={cn('rounded-lg border px-2 py-1.5 min-w-0', ratingTone(f.rating))}
        >
          <p className="text-[8px] font-mono uppercase tracking-wider opacity-80 truncate">
            {f.shortLabel}
          </p>
          <p className="text-[13px] font-black leading-none mt-0.5">
            {f.rating}
            <span className="text-[9px] font-mono opacity-70">/5</span>
          </p>
        </div>
      ))}
    </div>
  );
}

export function DayTradePanel({ onOpenTicker, className, runToken = 0 }: DayTradePanelProps) {
  const [market, setMarket] = useState<SuggestMarket>(loadMarket);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<DayTradeProgress | null>(null);
  const [result, setResult] = useState<DayTradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchId, setSearchId] = useState(0);
  const scanningRef = useRef(false);
  const lastRunTokenRef = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(MARKET_KEY, market);
    } catch {
      /* ignore */
    }
  }, [market]);

  const marketLabel = SUGGEST_MARKETS.find((m) => m.key === market)?.label ?? market;
  const popularCount = useMemo(
    () => Math.min(DAY_TRADE_MAX, market === 'ALL' ? DAY_TRADE_MAX : DAY_TRADE_MAX),
    [market]
  );

  const runScout = async () => {
    if (scanningRef.current) return;
    setError(null);
    scanningRef.current = true;
    setScanning(true);
    setProgress({ done: 0, total: popularCount });
    setResult(null);
    setSearchId((n) => n + 1);
    try {
      const out = await scoutDayTrades({
        market,
        max: DAY_TRADE_MAX,
        concurrency: 3,
        bypassCache: true,
        shuffle: true,
        onProgress: setProgress,
      });
      setResult(out);
    } catch (e: any) {
      setError(e?.message || 'Day Trade scout failed');
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  };

  useEffect(() => {
    if (!runToken || runToken === lastRunTokenRef.current) return;
    lastRunTokenRef.current = runToken;
    void runScout();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only when runToken changes
  }, [runToken]);

  const canScan = !scanning;

  return (
    <GlassCard className={cn('space-y-3', className)}>
      <SectionLabel icon={<Flame className="w-3.5 h-3.5 text-orange-400" />}>
        Day Trade · {marketLabel}
      </SectionLabel>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        Scouts popular liquid names in the market you select for{' '}
        <span className="text-orange-300 font-semibold">same-session</span> setups: liquidity / RVOL,
        ATR range, momentum bias, volatility structure, and RSI heat (each rated 1–5). Not investment
        holds — day-trade candidates only.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">Market</span>
          <select
            value={market}
            onChange={(e) => {
              setMarket(e.target.value as SuggestMarket);
              setResult(null);
            }}
            disabled={scanning}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[12px] text-gray-100 focus:outline-none focus:border-orange-500/40 disabled:opacity-60"
          >
            {SUGGEST_MARKETS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <p className="text-[10px] font-mono text-gray-500 pb-2.5">
            up to {DAY_TRADE_MAX} popular tickers · fresh data each search
            {searchId > 0 ? ` · search #${searchId}` : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <p className="text-[10px] font-mono text-gray-500">
          {scanning && progress
            ? `scanning ${progress.done}/${progress.total}${progress.current ? ` (${progress.current})` : ''}`
            : result
              ? 'press again for a new day-trade scout'
              : 'gates: liquidity · ATR range · bias'}
        </p>
        <button
          type="button"
          disabled={!canScan}
          onClick={() => void runScout()}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer',
            !canScan
              ? 'bg-white/5 text-gray-500 border border-white/10'
              : 'bg-orange-500 text-black border border-orange-400 shadow-[0_0_18px_rgba(249,115,22,0.35)] hover:bg-orange-400'
          )}
        >
          {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {scanning ? 'Scanning…' : result ? 'New search' : 'Day Trade scout'}
        </button>
      </div>

      {error && (
        <p className="text-[11px] text-rose-300 border border-rose-500/20 bg-rose-500/5 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={`day-${searchId}-${result.message}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
              <p className="text-[11px] text-gray-300 leading-relaxed">{result.message}</p>
              <p className="mt-1 text-[10px] font-mono text-gray-500">
                Ranked by day-trade composite · LONG / SHORT / FADE bias · not overnight holds.
              </p>
            </div>

            {result.topPick ? (
              <TopPickCard pick={result.topPick} onOpen={onOpenTicker} marketLabel={marketLabel} />
            ) : (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-3">
                <p className="text-[12px] text-amber-100 font-semibold">No day-trade clears</p>
                <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                  None of the {result.scannedCount} popular names cleared liquidity / range / bias
                  gates. Try another market or New search.
                </p>
              </div>
            )}

            {result.candidates.length > 1 && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-2">
                  Other day-trade clears ({result.candidates.length - 1})
                </p>
                <div className="space-y-1.5">
                  {result.candidates.slice(1, 6).map((c) => (
                    <CandidateRow key={`${searchId}-${c.ticker}`} c={c} onOpen={onOpenTicker} />
                  ))}
                </div>
              </div>
            )}

            {result.watchlist.length > 0 && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-amber-200/80 mb-1">
                  Near-miss watchlist
                </p>
                <p className="text-[10px] text-gray-500 mb-2 leading-relaxed">
                  Close on score but did not clear day-trade gates.
                </p>
                <div className="space-y-1.5">
                  {result.watchlist.map((c) => (
                    <CandidateRow key={`${searchId}-w-${c.ticker}`} c={c} onOpen={onOpenTicker} />
                  ))}
                </div>
              </div>
            )}

            <details className="rounded-xl border border-white/8 bg-black/25 px-3 py-2">
              <summary className="text-[10px] font-mono uppercase tracking-wider text-gray-500 cursor-pointer">
                Scout log ({result.scanned.length}) · {result.cleared} cleared
              </summary>
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {result.scanned.map((c) => (
                  <p
                    key={`dlog-${searchId}-${c.ticker}`}
                    className={cn(
                      'text-[10px] font-mono',
                      c.isDayTradeCandidate ? 'text-orange-300/90' : 'text-gray-500'
                    )}
                  >
                    {c.ticker}:{' '}
                    {c.error
                      ? `ERR ${c.error}`
                      : `${c.bias} · ${c.factorStrip || `score ${c.score}`} · ATR ${c.atrPct}% · RVOL ${c.rvol}×`}
                    {c.isDayTradeCandidate ? ' · clear ✓' : ''}
                  </p>
                ))}
              </div>
            </details>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

function TopPickCard({
  pick,
  onOpen,
  marketLabel,
}: {
  pick: DayTradeCandidate;
  onOpen: (t: string) => void;
  marketLabel: string;
}) {
  return (
    <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-3 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-wider text-orange-300/80">
            Day trade pick · {marketLabel}
          </p>
          <p className="text-lg font-black text-white tracking-wide">{pick.ticker}</p>
          <p className="text-[11px] text-gray-400 truncate max-w-[220px]">{pick.name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={cn('text-[12px] font-bold', biasTone(pick.bias))}>{pick.bias}</p>
          <p className="text-[11px] font-mono text-white mt-1">{formatMoney(pick.price)}</p>
        </div>
      </div>

      {pick.factorRatings && pick.factorRatings.length > 0 && (
        <FactorGrid factors={pick.factorRatings} />
      )}

      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
        <div className="rounded-lg bg-black/30 border border-white/8 px-2 py-1.5">
          <p className="text-gray-500 uppercase text-[8px]">Score</p>
          <p className="text-white">{pick.score}</p>
        </div>
        <div className="rounded-lg bg-black/30 border border-white/8 px-2 py-1.5">
          <p className="text-gray-500 uppercase text-[8px]">ATR</p>
          <p className="text-orange-200">{pick.atrPct}%</p>
        </div>
        <div className="rounded-lg bg-black/30 border border-white/8 px-2 py-1.5">
          <p className="text-gray-500 uppercase text-[8px]">RVOL</p>
          <p className="text-sky-300">{pick.rvol}×</p>
        </div>
      </div>
      <p className="text-[11px] text-gray-300 leading-relaxed">{pick.why}</p>
      <button
        type="button"
        onClick={() => onOpen(pick.ticker)}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black py-2 text-[11px] font-bold uppercase tracking-wider hover:bg-orange-100 transition-colors cursor-pointer"
      >
        <Search className="w-3.5 h-3.5" />
        Open full analysis
      </button>
    </div>
  );
}

function CandidateRow({
  c,
  onOpen,
}: {
  c: DayTradeCandidate;
  onOpen: (t: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(c.ticker)}
      className="w-full flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/30 px-3 py-2 text-left hover:border-orange-500/30 transition-colors cursor-pointer"
    >
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-white">{c.ticker}</p>
        <p className="text-[10px] text-gray-500 truncate">
          {c.factorStrip || `score ${c.score}`} · ATR {c.atrPct}%
        </p>
      </div>
      <div className="text-right shrink-0 font-mono text-[10px]">
        <p className={biasTone(c.bias)}>{c.bias}</p>
        <p className="text-sky-300">{c.score}</p>
      </div>
    </button>
  );
}
