import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crosshair, Loader2, Rocket, Search, ListPlus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassCard, SectionLabel } from './GlassCard';
import { formatMoney, formatPct, type HorizonKey, HORIZON_OPTIONS } from './analysisTheme';
import {
  FIND_A_TRADE_MAX,
  findATrade,
  parseTickerList,
  type FindATradeCandidate,
  type FindATradeKnownHint,
  type FindATradeProgress,
  type FindATradeResult,
} from '../../lib/findATrade';
import {
  SUGGEST_MARKETS,
  SUGGEST_THEMES,
  buildSuggestUniverse,
  universeTickers,
  type SuggestMarket,
  type SuggestTheme,
} from '../../lib/suggestTradeUniverses';

const LIST_STORAGE_KEY = 'qn-find-a-trade-list';
const MARKET_KEY = 'qn-find-market';
const THEME_KEY = 'qn-find-theme';
const DEFAULT_LIST = 'AAPL, NVDA, MSFT, TSLA, 0700.HK';

function loadSavedList(): string {
  try {
    const raw = localStorage.getItem(LIST_STORAGE_KEY);
    if (raw != null && raw.trim()) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LIST;
}

function loadMarket(): SuggestMarket {
  try {
    const v =
      (localStorage.getItem(MARKET_KEY) as SuggestMarket | null) ||
      (localStorage.getItem('qn-suggest-market') as SuggestMarket | null);
    if (v && SUGGEST_MARKETS.some((m) => m.key === v)) return v;
  } catch {
    /* ignore */
  }
  return 'US';
}

function loadTheme(): SuggestTheme {
  try {
    const v =
      (localStorage.getItem(THEME_KEY) as SuggestTheme | null) ||
      (localStorage.getItem('qn-suggest-theme') as SuggestTheme | null);
    if (v && SUGGEST_THEMES.some((t) => t.key === v)) return v;
  } catch {
    /* ignore */
  }
  return 'ALL';
}

type FindATradePanelProps = {
  horizon?: HorizonKey;
  onOpenTicker: (ticker: string) => void;
  /** Open Recommendation card + predict-cache hints so scout matches BUY labels users already see. */
  knownByTicker?: Record<string, FindATradeKnownHint>;
  className?: string;
  compact?: boolean;
};

export function FindATradePanel({
  horizon = '1M',
  onOpenTicker,
  knownByTicker,
  className,
  compact = false,
}: FindATradePanelProps) {
  const [listText, setListText] = useState(loadSavedList);
  const [market, setMarket] = useState<SuggestMarket>(loadMarket);
  const [theme, setTheme] = useState<SuggestTheme>(loadTheme);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<FindATradeProgress | null>(null);
  const [result, setResult] = useState<FindATradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(LIST_STORAGE_KEY, listText);
    } catch {
      /* ignore */
    }
  }, [listText]);

  useEffect(() => {
    try {
      localStorage.setItem(MARKET_KEY, market);
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [market, theme]);

  const parsed = useMemo(() => parseTickerList(listText), [listText]);
  const universe = useMemo(
    () => buildSuggestUniverse(market, theme, FIND_A_TRADE_MAX),
    [market, theme]
  );
  const horizonLabel = HORIZON_OPTIONS.find((o) => o.key === horizon)?.label ?? horizon;
  const marketLabel = SUGGEST_MARKETS.find((m) => m.key === market)?.label ?? market;
  const themeLabel = SUGGEST_THEMES.find((t) => t.key === theme)?.label ?? theme;

  const fillFromMarketTheme = () => {
    const tickers = universeTickers(market, theme, FIND_A_TRADE_MAX);
    if (!tickers.length) {
      setError('No names in this market/theme combo. Try All themes.');
      return;
    }
    setError(null);
    setListText(tickers.join(', '));
  };

  const runScout = async () => {
    if (scanning) return;

    // Paste list wins when non-empty; otherwise scout curated market × theme.
    const pasted = parseTickerList(listText);
    const tickers =
      pasted.length > 0
        ? pasted
        : universe.map((u) => u.ticker).slice(0, FIND_A_TRADE_MAX);

    if (!tickers.length) {
      setError(
        pasted.length === 0
          ? 'Paste tickers or pick a market/theme with names, then scan.'
          : 'Enter tickers separated by commas or spaces.'
      );
      return;
    }

    setError(null);
    setScanning(true);
    setProgress({ done: 0, total: tickers.length });
    setResult(null);
    try {
      const out = await findATrade({
        tickers,
        horizon,
        concurrency: 3,
        knownByTicker,
        onProgress: setProgress,
      });
      setResult(out);
    } catch (e: any) {
      setError(e?.message || 'Find a Trade + failed');
    } finally {
      setScanning(false);
    }
  };

  const canScan = !scanning && (parsed.length > 0 || universe.length > 0);
  const scoutSource =
    parsed.length > 0
      ? `paste list · ${parsed.length} ticker${parsed.length === 1 ? '' : 's'}`
      : `market/theme · ${universe.length} name${universe.length === 1 ? '' : 's'}`;

  return (
    <GlassCard className={cn('space-y-3', className)}>
      <SectionLabel icon={<Rocket className="w-3.5 h-3.5 text-emerald-400" />}>
        Find a Trade + · {horizonLabel}
      </SectionLabel>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        Paste up to {FIND_A_TRADE_MAX} tickers (memorized in this browser), or leave the list empty and
        scout a curated <span className="text-emerald-300 font-semibold">market × theme</span> universe.
        Surfaces names with{' '}
        <span className="text-emerald-300 font-semibold">BUY / STRONG BUY</span> — matching the
        Recommendation card score bands (70+) and any open/cached analysis.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">Market</span>
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value as SuggestMarket)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[12px] text-gray-100 focus:outline-none focus:border-emerald-500/40"
          >
            {SUGGEST_MARKETS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">Theme</span>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as SuggestTheme)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[12px] text-gray-100 focus:outline-none focus:border-emerald-500/40"
          >
            {SUGGEST_THEMES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <p className="text-[10px] font-mono text-gray-500">
          {marketLabel} · {themeLabel} · curated {universe.length}/{FIND_A_TRADE_MAX}
        </p>
        <button
          type="button"
          onClick={fillFromMarketTheme}
          disabled={universe.length === 0}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer',
            universe.length === 0
              ? 'bg-white/5 text-gray-500 border-white/10'
              : 'bg-white/5 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10'
          )}
        >
          <ListPlus className="w-3.5 h-3.5" />
          Fill from market/theme
        </button>
      </div>

      <textarea
        value={listText}
        onChange={(e) => setListText(e.target.value)}
        rows={compact ? 2 : 3}
        placeholder="AAPL, NVDA, MSFT, 0700.HK — or clear to use market/theme"
        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[12px] font-mono text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/40 resize-y min-h-[56px]"
      />

      {parsed.length === 0 && universe.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-black/25 px-3 py-2">
          <p className="text-[9px] font-mono uppercase tracking-wider text-gray-500 mb-1.5">
            Will scout market/theme · {universe.length} names
          </p>
          <p className="text-[10px] font-mono text-gray-400 leading-relaxed break-words">
            {universe.map((u) => u.ticker).join(' · ')}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <p className="text-[10px] font-mono text-gray-500">
          {scoutSource} · list memorized
          {scanning && progress
            ? ` · scanning ${progress.done}/${progress.total}${progress.current ? ` (${progress.current})` : ''}`
            : ''}
        </p>
        <button
          type="button"
          disabled={!canScan}
          onClick={() => void runScout()}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer',
            !canScan
              ? 'bg-white/5 text-gray-500 border border-white/10'
              : 'bg-emerald-500 text-black border border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.35)] hover:bg-emerald-400'
          )}
        >
          {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
          Find a Trade +
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
            key={result.message}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {result.topPick ? (
              <TopPickCard pick={result.topPick} onOpen={onOpenTicker} />
            ) : (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-3">
                <p className="text-[12px] text-amber-100 font-semibold">No trade found</p>
                <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">{result.message}</p>
                <p className="mt-1 text-[10px] text-gray-500">
                  Scout looks for horizon BUY / STRONG BUY (same label as the Recommendation card). Live WAIT
                  still counts — it only means wait for a better entry, not “skip the name.”
                </p>
              </div>
            )}

            {result.buyCandidates.length > 1 && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-2">
                  Other BUY candidates ({result.buyCandidates.length - 1})
                </p>
                <div className="space-y-1.5">
                  {result.buyCandidates.slice(1, 12).map((c) => (
                    <CandidateRow key={c.ticker} c={c} onOpen={onOpenTicker} />
                  ))}
                </div>
              </div>
            )}

            {result.scanned.length > 0 && (
              <details className="rounded-xl border border-white/8 bg-black/25 px-3 py-2">
                <summary className="text-[10px] font-mono uppercase tracking-wider text-gray-500 cursor-pointer">
                  Full scout log ({result.scanned.length})
                </summary>
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {result.scanned.map((c) => (
                    <p key={`log-${c.ticker}`} className="text-[10px] font-mono text-gray-500">
                      {c.ticker}: {c.error ? `ERR ${c.error}` : `${c.recommendation} · ${c.currentAction}`}
                    </p>
                  ))}
                </div>
              </details>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

function TopPickCard({
  pick,
  onOpen,
}: {
  pick: FindATradeCandidate;
  onOpen: (t: string) => void;
}) {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-wider text-emerald-300/80">Top pick</p>
          <p className="text-lg font-black text-white tracking-wide">{pick.ticker}</p>
          <p className="text-[11px] text-gray-400 truncate max-w-[220px]">{pick.name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[12px] font-bold text-emerald-300">{pick.recommendation}</p>
          <p className="text-[10px] font-mono text-cyan-200">Do now: {pick.currentAction}</p>
          <p className="text-[11px] font-mono text-white mt-1">{formatMoney(pick.price)}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
        <div className="rounded-lg bg-black/30 border border-white/8 px-2 py-1.5">
          <p className="text-gray-500 uppercase text-[8px]">Conf</p>
          <p className="text-white">{pick.confidence}%</p>
        </div>
        <div className="rounded-lg bg-black/30 border border-white/8 px-2 py-1.5">
          <p className="text-gray-500 uppercase text-[8px]">Score</p>
          <p className="text-white">{pick.score}</p>
        </div>
        <div className="rounded-lg bg-black/30 border border-white/8 px-2 py-1.5">
          <p className="text-gray-500 uppercase text-[8px]">ER</p>
          <p className={pick.expectedReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
            {formatPct(pick.expectedReturn)}
          </p>
        </div>
      </div>
      <p className="text-[11px] text-gray-300 leading-relaxed">{pick.why}</p>
      <button
        type="button"
        onClick={() => onOpen(pick.ticker)}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black py-2 text-[11px] font-bold uppercase tracking-wider hover:bg-emerald-100 transition-colors cursor-pointer"
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
  c: FindATradeCandidate;
  onOpen: (t: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(c.ticker)}
      className="w-full flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/30 px-3 py-2 text-left hover:border-emerald-500/30 transition-colors cursor-pointer"
    >
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-white">{c.ticker}</p>
        <p className="text-[10px] text-gray-500 truncate">
          {c.recommendation} · {c.currentAction}
        </p>
      </div>
      <div className="text-right shrink-0 font-mono text-[10px]">
        <p className="text-emerald-300">{c.confidence}%</p>
        <p className={c.expectedReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
          {formatPct(c.expectedReturn)}
        </p>
      </div>
    </button>
  );
}
