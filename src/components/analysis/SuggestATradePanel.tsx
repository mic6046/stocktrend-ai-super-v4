import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Compass, Loader2, Search, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassCard, SectionLabel } from './GlassCard';
import { formatMoney, formatPct, type HorizonKey, HORIZON_OPTIONS } from './analysisTheme';
import {
  FIND_A_TRADE_MAX,
  findATrade,
  type FindATradeCandidate,
  type FindATradeProgress,
  type FindATradeResult,
} from '../../lib/findATrade';
import {
  SUGGEST_MARKETS,
  SUGGEST_THEMES,
  buildSuggestUniverse,
  type SuggestMarket,
  type SuggestTheme,
} from '../../lib/suggestTradeUniverses';

const MARKET_KEY = 'qn-suggest-market';
const THEME_KEY = 'qn-suggest-theme';

function loadMarket(): SuggestMarket {
  try {
    const v = localStorage.getItem(MARKET_KEY) as SuggestMarket | null;
    if (v && SUGGEST_MARKETS.some((m) => m.key === v)) return v;
  } catch {
    /* ignore */
  }
  return 'US';
}

function loadTheme(): SuggestTheme {
  try {
    const v = localStorage.getItem(THEME_KEY) as SuggestTheme | null;
    if (v && SUGGEST_THEMES.some((t) => t.key === v)) return v;
  } catch {
    /* ignore */
  }
  return 'ALL';
}

type SuggestATradePanelProps = {
  horizon?: HorizonKey;
  onOpenTicker: (ticker: string) => void;
  className?: string;
};

export function SuggestATradePanel({
  horizon = '1M',
  onOpenTicker,
  className,
}: SuggestATradePanelProps) {
  const [market, setMarket] = useState<SuggestMarket>(loadMarket);
  const [theme, setTheme] = useState<SuggestTheme>(loadTheme);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<FindATradeProgress | null>(null);
  const [result, setResult] = useState<FindATradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(MARKET_KEY, market);
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [market, theme]);

  const universe = useMemo(
    () => buildSuggestUniverse(market, theme, FIND_A_TRADE_MAX),
    [market, theme]
  );
  const horizonLabel = HORIZON_OPTIONS.find((o) => o.key === horizon)?.label ?? horizon;
  const marketLabel = SUGGEST_MARKETS.find((m) => m.key === market)?.label ?? market;
  const themeLabel = SUGGEST_THEMES.find((t) => t.key === theme)?.label ?? theme;

  const runSuggest = async () => {
    if (scanning) return;
    if (!universe.length) {
      setError('No names in this market/theme combo. Try All themes.');
      return;
    }
    setError(null);
    setScanning(true);
    setProgress({ done: 0, total: universe.length });
    setResult(null);
    try {
      const out = await findATrade({
        tickers: universe.map((u) => u.ticker),
        horizon,
        concurrency: 3,
        onProgress: setProgress,
      });
      setResult(out);
    } catch (e: any) {
      setError(e?.message || 'Suggest a Trade failed');
    } finally {
      setScanning(false);
    }
  };

  return (
    <GlassCard className={cn('space-y-3', className)}>
      <SectionLabel icon={<Compass className="w-3.5 h-3.5 text-sky-400" />}>
        Suggest a Trade · {horizonLabel}
      </SectionLabel>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        Pick a popular market universe. Consensus AI scouts liquid names and suggests a{' '}
        <span className="text-emerald-300 font-semibold">BUY</span> only if gates clear — never forced.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">Market</span>
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value as SuggestMarket)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[12px] text-gray-100 focus:outline-none focus:border-sky-500/40"
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
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[12px] text-gray-100 focus:outline-none focus:border-sky-500/40"
          >
            {SUGGEST_THEMES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-white/8 bg-black/25 px-3 py-2">
        <p className="text-[9px] font-mono uppercase tracking-wider text-gray-500 mb-1.5">
          Scout universe · {universe.length} names
        </p>
        <p className="text-[10px] font-mono text-gray-400 leading-relaxed break-words">
          {universe.length
            ? universe.map((u) => u.ticker).join(' · ')
            : 'No tickers for this filter'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <p className="text-[10px] font-mono text-gray-500">
          {marketLabel} · {themeLabel}
          {scanning && progress
            ? ` · scanning ${progress.done}/${progress.total}${progress.current ? ` (${progress.current})` : ''}`
            : ''}
        </p>
        <button
          type="button"
          disabled={scanning || universe.length === 0}
          onClick={() => void runSuggest()}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer',
            scanning || universe.length === 0
              ? 'bg-white/5 text-gray-500 border border-white/10'
              : 'bg-sky-500 text-black border border-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.35)] hover:bg-sky-400'
          )}
        >
          {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Suggest a Trade
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
              <TopPickCard pick={result.topPick} onOpen={onOpenTicker} marketLabel={marketLabel} />
            ) : (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-3">
                <p className="text-[12px] text-amber-100 font-semibold">No trade suggested</p>
                <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">{result.message}</p>
                <p className="mt-1 text-[10px] text-gray-500">
                  Try another market/theme, or wait for better setups.
                </p>
              </div>
            )}

            {result.buyCandidates.length > 1 && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-2">
                  Other BUY candidates
                </p>
                <div className="space-y-1.5">
                  {result.buyCandidates.slice(1, 5).map((c) => (
                    <CandidateRow key={c.ticker} c={c} onOpen={onOpenTicker} />
                  ))}
                </div>
              </div>
            )}

            <details className="rounded-xl border border-white/8 bg-black/25 px-3 py-2">
              <summary className="text-[10px] font-mono uppercase tracking-wider text-gray-500 cursor-pointer">
                Scout log ({result.scanned.length})
              </summary>
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {result.scanned.map((c) => (
                  <p key={`slog-${c.ticker}`} className="text-[10px] font-mono text-gray-500">
                    {c.ticker}: {c.error ? `ERR ${c.error}` : `${c.recommendation} · ${c.currentAction}`}
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
  pick: FindATradeCandidate;
  onOpen: (t: string) => void;
  marketLabel: string;
}) {
  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-wider text-sky-300/80">
            Suggested trade · {marketLabel}
          </p>
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
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black py-2 text-[11px] font-bold uppercase tracking-wider hover:bg-sky-100 transition-colors cursor-pointer"
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
      className="w-full flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/30 px-3 py-2 text-left hover:border-sky-500/30 transition-colors cursor-pointer"
    >
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-white">{c.ticker}</p>
        <p className="text-[10px] text-gray-500 truncate">{c.recommendation} · {c.currentAction}</p>
      </div>
      <div className="text-right shrink-0 font-mono text-[10px]">
        <p className="text-sky-300">{c.confidence}%</p>
        <p className={c.expectedReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
          {formatPct(c.expectedReturn)}
        </p>
      </div>
    </button>
  );
}
