import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Compass, Loader2, ListPlus, Search, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassCard, SectionLabel } from './GlassCard';
import { formatMoney, type HorizonKey, HORIZON_OPTIONS } from './analysisTheme';
import {
  TRADE_SUGGESTIONS_MAX,
  parseSuggestionTickers,
  scanTradeSuggestions,
  type MarketSentimentLight,
  type TradeSuggestionCandidate,
  type TradeSuggestionsProgress,
  type TradeSuggestionsResult,
  type WarningLevel,
} from '../../lib/tradeSuggestions';
import {
  SUGGEST_MARKETS,
  SUGGEST_THEMES,
  buildSuggestUniverse,
  universeTickers,
  type SuggestMarket,
  type SuggestTheme,
} from '../../lib/suggestTradeUniverses';

const LIST_KEY = 'qn-trade-suggestions-list';
const MARKET_KEY = 'qn-trade-suggestions-market';
const THEME_KEY = 'qn-trade-suggestions-theme';

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

function loadInitialList(market: SuggestMarket, theme: SuggestTheme): string {
  const curated = universeTickers(market, theme, TRADE_SUGGESTIONS_MAX);
  try {
    const raw = localStorage.getItem(LIST_KEY);
    if (raw != null && raw.trim()) {
      const parsed = parseSuggestionTickers(raw, TRADE_SUGGESTIONS_MAX);
      if (parsed.length) return parsed.join(', ');
    }
  } catch {
    /* ignore */
  }
  return curated.join(', ');
}

function warnTone(level: WarningLevel): string {
  if (level >= 3) return 'text-rose-300 border-rose-500/40 bg-rose-500/10';
  if (level === 2) return 'text-amber-200 border-amber-500/40 bg-amber-500/10';
  if (level === 1) return 'text-yellow-200 border-yellow-500/35 bg-yellow-500/10';
  return 'text-gray-500 border-white/10 bg-black/20';
}

function sentimentTone(light: MarketSentimentLight): string {
  if (light === 'Green') return 'text-emerald-300 border-emerald-500/40 bg-emerald-500/15';
  if (light === 'Red') return 'text-rose-300 border-rose-500/40 bg-rose-500/15';
  return 'text-amber-200 border-amber-500/40 bg-amber-500/15';
}

function sentimentDot(light: MarketSentimentLight): string {
  if (light === 'Green') return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]';
  if (light === 'Red') return 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.7)]';
  return 'bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.7)]';
}

function SentimentLight({
  light,
  score,
  size = 'md',
}: {
  light: MarketSentimentLight;
  score?: number | null;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-mono',
        sentimentTone(light),
        size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]'
      )}
      title={`Market sentiment ${light}${score != null ? ` (${Math.round(score)}/100)` : ''}`}
    >
      <span className={cn('rounded-full', sentimentDot(light), size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      <span className="font-bold uppercase tracking-wider">{light}</span>
      {score != null && Number.isFinite(score) && (
        <span className="opacity-80">{Math.round(score)}</span>
      )}
    </div>
  );
}

type TradeSuggestionsPanelProps = {
  horizon?: HorizonKey;
  onOpenTicker: (ticker: string) => void;
  className?: string;
};

export function TradeSuggestionsPanel({
  horizon = '1M',
  onOpenTicker,
  className,
}: TradeSuggestionsPanelProps) {
  const [market, setMarket] = useState<SuggestMarket>(loadMarket);
  const [theme, setTheme] = useState<SuggestTheme>(loadTheme);
  const [listText, setListText] = useState(() => loadInitialList(loadMarket(), loadTheme()));
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<TradeSuggestionsProgress | null>(null);
  const [result, setResult] = useState<TradeSuggestionsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const skipSync = useRef(true);

  useEffect(() => {
    try {
      localStorage.setItem(MARKET_KEY, market);
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [market, theme]);

  useEffect(() => {
    try {
      localStorage.setItem(LIST_KEY, listText);
    } catch {
      /* ignore */
    }
  }, [listText]);

  // Refresh curated 30 when market/theme changes (unless user is mid-edit on first mount)
  useEffect(() => {
    if (skipSync.current) {
      skipSync.current = false;
      return;
    }
    const curated = universeTickers(market, theme, TRADE_SUGGESTIONS_MAX);
    setListText(curated.join(', '));
    setResult(null);
  }, [market, theme]);

  const parsed = useMemo(
    () => parseSuggestionTickers(listText, TRADE_SUGGESTIONS_MAX),
    [listText]
  );
  const universe = useMemo(
    () => buildSuggestUniverse(market, theme, TRADE_SUGGESTIONS_MAX),
    [market, theme]
  );
  const horizonLabel = HORIZON_OPTIONS.find((o) => o.key === horizon)?.label ?? horizon;
  const marketLabel = SUGGEST_MARKETS.find((m) => m.key === market)?.label ?? market;
  const themeLabel = SUGGEST_THEMES.find((t) => t.key === theme)?.label ?? theme;

  const fillFromMarketTheme = () => {
    const tickers = universeTickers(market, theme, TRADE_SUGGESTIONS_MAX);
    setListText(tickers.join(', '));
    setResult(null);
  };

  const runScan = async () => {
    if (scanning) return;
    let tickers = parseSuggestionTickers(listText, TRADE_SUGGESTIONS_MAX);
    if (!tickers.length) {
      tickers = universeTickers(market, theme, TRADE_SUGGESTIONS_MAX);
      if (tickers.length) setListText(tickers.join(', '));
    }
    if (!tickers.length) {
      setError('Pick a market/theme or paste tickers (up to 30).');
      return;
    }
    setError(null);
    setScanning(true);
    setProgress({ done: 0, total: tickers.length });
    setResult(null);
    try {
      const out = await scanTradeSuggestions({
        tickers,
        concurrency: 4,
        onProgress: setProgress,
      });
      setResult(out);
    } catch (e: any) {
      setError(e?.message || 'Trade Suggestions failed');
    } finally {
      setScanning(false);
    }
  };

  const canScan = !scanning && (parsed.length > 0 || universe.length > 0);

  return (
    <GlassCard className={cn('space-y-3', className)}>
      <SectionLabel icon={<Compass className="w-3.5 h-3.5 text-sky-400" />}>
        Trade Suggestions · {horizonLabel}
      </SectionLabel>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        Flow engine (not Quantum AI Score): filters on{' '}
        <span className="text-sky-300 font-semibold">sentiment</span> (
        <span className="text-emerald-400 font-semibold">Green</span> /{' '}
        <span className="text-amber-300 font-semibold">Yellow</span> /{' '}
        <span className="text-rose-400 font-semibold">Red</span>), institutional, whale, smart money,
        constructive fundamentals, and fund/capital inflow. Warns on RSI overbought, Bollinger upper
        stretch, and nearby resistance (levels 1–3).
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

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <p className="text-[10px] font-mono text-gray-500">
          {marketLabel} · {themeLabel} · up to {TRADE_SUGGESTIONS_MAX} popular names
        </p>
        <button
          type="button"
          onClick={fillFromMarketTheme}
          disabled={universe.length === 0}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer',
            universe.length === 0
              ? 'bg-white/5 text-gray-500 border-white/10'
              : 'bg-white/5 text-sky-300 border-sky-500/30 hover:bg-sky-500/10'
          )}
        >
          <ListPlus className="w-3.5 h-3.5" />
          Load {Math.min(universe.length, TRADE_SUGGESTIONS_MAX)} popular
        </button>
      </div>

      <textarea
        value={listText}
        onChange={(e) => setListText(e.target.value)}
        rows={3}
        placeholder="AAPL, MSFT, NVDA… add more tickers if needed (max 30)"
        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[12px] font-mono text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-sky-500/40 resize-y min-h-[72px]"
      />
      <p className="text-[10px] font-mono text-gray-500">
        {parsed.length} ticker{parsed.length === 1 ? '' : 's'} in list · edit to add your own
      </p>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <p className="text-[10px] font-mono text-gray-500">
          {scanning && progress
            ? `scanning ${progress.done}/${progress.total}${progress.current ? ` (${progress.current})` : ''}`
            : 'stock data only · no AI analysis credits'}
        </p>
        <button
          type="button"
          disabled={!canScan}
          onClick={() => void runScan()}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer',
            !canScan
              ? 'bg-white/5 text-gray-500 border border-white/10'
              : 'bg-sky-500 text-black border border-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.35)] hover:bg-sky-400'
          )}
        >
          {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Trade Suggestions
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
              <TopSuggestionCard pick={result.topPick} onOpen={onOpenTicker} marketLabel={marketLabel} />
            ) : (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-3">
                <p className="text-[12px] text-amber-100 font-semibold">No constructive setups</p>
                <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">{result.message}</p>
              </div>
            )}

            {result.candidates.length > 1 && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-2">
                  Other suggestions ({result.candidates.length - 1})
                </p>
                <div className="space-y-1.5">
                  {result.candidates.slice(1, 12).map((c) => (
                    <CandidateRow key={c.ticker} c={c} onOpen={onOpenTicker} />
                  ))}
                </div>
              </div>
            )}

            <details className="rounded-xl border border-white/8 bg-black/25 px-3 py-2">
              <summary className="text-[10px] font-mono uppercase tracking-wider text-gray-500 cursor-pointer">
                Full scout log ({result.scanned.length})
              </summary>
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {result.scanned.map((c) => (
                  <p key={`tslog-${c.ticker}`} className="text-[10px] font-mono text-gray-500">
                    {c.ticker}:{' '}
                    {c.error
                      ? `ERR ${c.error}`
                      : `${c.isCandidate ? 'IN' : 'out'} · ${c.marketSentiment} · flow ${c.score} · warn L${c.warning.overall} · ${c.signals.slice(0, 2).join(', ') || '—'}`}
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

function WarningBadges({ c }: { c: TradeSuggestionCandidate }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={cn('rounded-md border px-1.5 py-0.5 text-[9px] font-mono', warnTone(c.warning.rsi))}>
        RSI L{c.warning.rsi}
      </span>
      <span
        className={cn('rounded-md border px-1.5 py-0.5 text-[9px] font-mono', warnTone(c.warning.bollinger))}
      >
        BB L{c.warning.bollinger}
      </span>
      <span
        className={cn(
          'rounded-md border px-1.5 py-0.5 text-[9px] font-mono',
          warnTone(c.warning.resistance)
        )}
      >
        Res L{c.warning.resistance}
      </span>
    </div>
  );
}

function TopSuggestionCard({
  pick,
  onOpen,
  marketLabel,
}: {
  pick: TradeSuggestionCandidate;
  onOpen: (t: string) => void;
  marketLabel: string;
}) {
  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-wider text-sky-300/80">
            Top suggestion · {marketLabel}
          </p>
          <p className="text-lg font-black text-white tracking-wide">{pick.ticker}</p>
          <p className="text-[11px] text-gray-400 truncate max-w-[220px]">{pick.name}</p>
        </div>
        <div className="text-right shrink-0 space-y-1.5">
          <SentimentLight light={pick.marketSentiment} score={pick.sentimentScore} />
          <p className="text-[12px] font-bold text-sky-300">Flow {pick.score}</p>
          <p className="text-[11px] font-mono text-white">{formatMoney(pick.price)}</p>
        </div>
      </div>

      <div className="rounded-lg border border-white/8 bg-black/25 px-2.5 py-2 flex flex-wrap items-center gap-2 justify-between">
        <p className="text-[10px] text-gray-400">
          Market sentiment:{' '}
          <span
            className={cn(
              'font-semibold',
              pick.marketSentiment === 'Green'
                ? 'text-emerald-300'
                : pick.marketSentiment === 'Red'
                  ? 'text-rose-300'
                  : 'text-amber-200'
            )}
          >
            {pick.marketSentiment}
          </span>
          {pick.sentimentScore != null ? ` · ${Math.round(pick.sentimentScore)}/100` : ''}
          {' · '}
          {pick.marketSentiment === 'Green'
            ? 'constructive'
            : pick.marketSentiment === 'Red'
              ? 'defensive'
              : 'mixed / neutral'}
        </p>
        <div
          className="flex items-center gap-1"
          title={`Market sentiment ${pick.marketSentiment}${
            pick.sentimentScore != null ? ` (${Math.round(pick.sentimentScore)}/100)` : ''
          } · Green ≥58 · Yellow 40–57 · Red <40`}
        >
          <span className={cn('w-2.5 h-2.5 rounded-full', sentimentDot(pick.marketSentiment))} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {pick.signals.map((s) => (
          <span
            key={s}
            className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-200"
          >
            {s}
          </span>
        ))}
      </div>

      {pick.warning.overall > 0 && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-2.5 py-2 space-y-1.5">
          <p className="text-[10px] font-semibold text-amber-200 inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Stretch warnings (overall L{pick.warning.overall})
          </p>
          <WarningBadges c={pick} />
          <ul className="space-y-0.5">
            {pick.warning.reasons.map((r) => (
              <li key={r} className="text-[10px] text-amber-100/85 leading-relaxed">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
      {pick.warning.overall === 0 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-gray-500">No RSI / Bollinger / resistance stretch</p>
          <WarningBadges c={pick} />
        </div>
      )}

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
  c: TradeSuggestionCandidate;
  onOpen: (t: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(c.ticker)}
      className="w-full flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/30 px-3 py-2 text-left hover:border-sky-500/30 transition-colors cursor-pointer"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-[12px] font-bold text-white">{c.ticker}</p>
          <SentimentLight light={c.marketSentiment} score={c.sentimentScore} size="sm" />
        </div>
        <p className="text-[10px] text-gray-500 truncate">
          Flow {c.score} · {c.signals[0] || 'constructive'}
        </p>
      </div>
      <div className="text-right shrink-0 space-y-1">
        <WarningBadges c={c} />
      </div>
    </button>
  );
}
