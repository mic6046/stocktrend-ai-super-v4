import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Compass, ListPlus, Loader2, Plus, Search, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassCard, SectionLabel } from './GlassCard';
import { formatMoney, formatPct, type HorizonKey, HORIZON_OPTIONS } from './analysisTheme';
import {
  FIND_A_TRADE_MAX,
  findATrade,
  parseTickerList,
  type FindATradeCandidate,
  type FindATradeProgress,
  type FindATradeResult,
} from '../../lib/findATrade';
import {
  SUGGEST_FACTOR_ORDER,
  type SuggestFactorRating,
  type SuggestRating,
} from '../../lib/suggestTradeEngine';
import {
  SUGGEST_MARKETS,
  SUGGEST_THEMES,
  buildSuggestUniverse,
  universeTickers,
  type SuggestMarket,
  type SuggestTheme,
} from '../../lib/suggestTradeUniverses';

const MARKET_KEY = 'qn-suggest-market';
const THEME_KEY = 'qn-suggest-theme';
const LIST_KEY = 'qn-suggest-trade-list';

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

function loadInitialList(market: SuggestMarket, theme: SuggestTheme): string {
  const curated = universeTickers(market, theme, FIND_A_TRADE_MAX);
  try {
    const raw = localStorage.getItem(LIST_KEY);
    if (raw != null && raw.trim()) {
      const parsed = parseTickerList(raw, FIND_A_TRADE_MAX);
      if (parsed.length) return parsed.join(', ');
    }
  } catch {
    /* ignore */
  }
  return curated.join(', ');
}

function normalizeAddTicker(raw: string): string | null {
  const t = raw.trim().toUpperCase().replace(/^\$/, '');
  if (!/^[A-Z0-9.-]{1,16}$/.test(t)) return null;
  return t;
}

type SuggestATradePanelProps = {
  horizon?: HorizonKey;
  onOpenTicker: (ticker: string) => void;
  className?: string;
  /**
   * Increment from the header Suggest button so each press starts a new search
   * even when the panel is already open.
   */
  runToken?: number;
};

export function SuggestATradePanel({
  horizon = '1M',
  onOpenTicker,
  className,
  runToken = 0,
}: SuggestATradePanelProps) {
  const [market, setMarket] = useState<SuggestMarket>(loadMarket);
  const [theme, setTheme] = useState<SuggestTheme>(loadTheme);
  const [listText, setListText] = useState(() => loadInitialList(loadMarket(), loadTheme()));
  const [addDraft, setAddDraft] = useState('');
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<FindATradeProgress | null>(null);
  const [result, setResult] = useState<FindATradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchId, setSearchId] = useState(0);
  const scanningRef = useRef(false);
  const lastRunTokenRef = useRef(0);
  const skipMarketSync = useRef(true);

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

  // Market/theme change reloads curated popular names (user can still edit afterward)
  useEffect(() => {
    if (skipMarketSync.current) {
      skipMarketSync.current = false;
      return;
    }
    const curated = universeTickers(market, theme, FIND_A_TRADE_MAX);
    setListText(curated.join(', '));
    setResult(null);
  }, [market, theme]);

  const parsed = useMemo(() => parseTickerList(listText, FIND_A_TRADE_MAX), [listText]);
  const popularUniverse = useMemo(
    () => buildSuggestUniverse(market, theme, FIND_A_TRADE_MAX),
    [market, theme]
  );
  const horizonLabel = HORIZON_OPTIONS.find((o) => o.key === horizon)?.label ?? horizon;
  const marketLabel = SUGGEST_MARKETS.find((m) => m.key === market)?.label ?? market;
  const themeLabel = SUGGEST_THEMES.find((t) => t.key === theme)?.label ?? theme;

  const fillFromMarketTheme = () => {
    const tickers = universeTickers(market, theme, FIND_A_TRADE_MAX);
    setListText(tickers.join(', '));
    setResult(null);
    setError(null);
  };

  const addTickerToList = (raw?: string) => {
    const ticker = normalizeAddTicker(raw ?? addDraft);
    if (!ticker) {
      setError('Enter a valid ticker (e.g. AAPL, 0700.HK, 7203.T).');
      return;
    }
    const existing = parseTickerList(listText, FIND_A_TRADE_MAX);
    if (existing.includes(ticker)) {
      setError(`${ticker} is already in the search list.`);
      return;
    }
    if (existing.length >= FIND_A_TRADE_MAX) {
      setError(`Search list is full (max ${FIND_A_TRADE_MAX}). Remove one to add ${ticker}.`);
      return;
    }
    setListText([...existing, ticker].join(', '));
    setAddDraft('');
    setError(null);
    setResult(null);
  };

  const runSuggest = async () => {
    if (scanningRef.current) return;
    let tickers = parseTickerList(listText, FIND_A_TRADE_MAX);
    if (!tickers.length) {
      tickers = universeTickers(market, theme, FIND_A_TRADE_MAX);
      if (tickers.length) setListText(tickers.join(', '));
    }
    if (!tickers.length) {
      setError('Add tickers to the search list, or load popular names from market/theme.');
      return;
    }
    setError(null);
    scanningRef.current = true;
    setScanning(true);
    setProgress({ done: 0, total: tickers.length });
    setResult(null);
    setSearchId((n) => n + 1);
    try {
      const out = await findATrade({
        tickers,
        horizon,
        concurrency: 3,
        bypassCache: true,
        mode: 'suggest',
        onProgress: setProgress,
      });
      setResult(out);
    } catch (e: any) {
      setError(e?.message || 'Suggest a Trade failed');
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  };

  // Header Suggest presses bump runToken → always start a new search
  useEffect(() => {
    if (!runToken || runToken === lastRunTokenRef.current) return;
    lastRunTokenRef.current = runToken;
    void runSuggest();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only when runToken changes
  }, [runToken]);

  const canScan = !scanning && (parsed.length > 0 || popularUniverse.length > 0);

  return (
    <GlassCard className={cn('space-y-3', className)}>
      <SectionLabel icon={<Compass className="w-3.5 h-3.5 text-sky-400" />}>
        Suggest a Trade · {horizonLabel}
      </SectionLabel>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        Factor search engine (priority): whale accumulation → institutional inflow → momentum /
        support → fundamentals, with RSI overheat and Bollinger stretch warnings. Each factor is rated{' '}
        <span className="text-sky-300 font-semibold">1–5</span>. Fresh prices on every search.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">Market</span>
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value as SuggestMarket)}
            disabled={scanning}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[12px] text-gray-100 focus:outline-none focus:border-sky-500/40 disabled:opacity-60"
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
            disabled={scanning}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[12px] text-gray-100 focus:outline-none focus:border-sky-500/40 disabled:opacity-60"
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
          {marketLabel} · {themeLabel} · up to {FIND_A_TRADE_MAX} tickers
          {searchId > 0 ? ` · search #${searchId}` : ''}
        </p>
        <button
          type="button"
          onClick={fillFromMarketTheme}
          disabled={scanning || popularUniverse.length === 0}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer',
            scanning || popularUniverse.length === 0
              ? 'bg-white/5 text-gray-500 border-white/10'
              : 'bg-white/5 text-sky-300 border-sky-500/30 hover:bg-sky-500/10'
          )}
        >
          <ListPlus className="w-3.5 h-3.5" />
          Load {Math.min(popularUniverse.length, FIND_A_TRADE_MAX)} popular
        </button>
      </div>

      <textarea
        value={listText}
        onChange={(e) => {
          setListText(e.target.value);
          setResult(null);
        }}
        rows={3}
        disabled={scanning}
        placeholder="AAPL, MSFT, NVDA, 0700.HK — edit or paste tickers"
        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[12px] font-mono text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-sky-500/40 resize-y min-h-[72px] disabled:opacity-60"
      />

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={addDraft}
          onChange={(e) => setAddDraft(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTickerToList();
            }
          }}
          disabled={scanning}
          placeholder="Add ticker (e.g. 2318.HK)"
          className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] font-mono text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-sky-500/40 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => addTickerToList()}
          disabled={scanning || !addDraft.trim()}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-wider border transition-all cursor-pointer shrink-0',
            scanning || !addDraft.trim()
              ? 'bg-white/5 text-gray-500 border-white/10'
              : 'bg-sky-500/15 text-sky-300 border-sky-500/40 hover:bg-sky-500/25'
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          Add to list
        </button>
      </div>

      <p className="text-[10px] font-mono text-gray-500">
        {parsed.length}/{FIND_A_TRADE_MAX} in search list · saved in this browser · edit to add your own
      </p>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <p className="text-[10px] font-mono text-gray-500">
          {scanning && progress
            ? `scanning ${progress.done}/${progress.total}${progress.current ? ` (${progress.current})` : ''}`
            : result
              ? 'press again for a new search'
              : 'fresh prices each search'}
        </p>
        <button
          type="button"
          disabled={!canScan}
          onClick={() => void runSuggest()}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer',
            !canScan
              ? 'bg-white/5 text-gray-500 border border-white/10'
              : 'bg-sky-500 text-black border border-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.35)] hover:bg-sky-400'
          )}
        >
          {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {scanning ? 'Searching…' : result ? 'New search' : 'Suggest a Trade'}
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
            key={`suggest-${searchId}-${result.message}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
              <p className="text-[11px] text-gray-300 leading-relaxed">{result.message}</p>
              <p className="mt-1 text-[10px] font-mono text-gray-500">
                Ranked by factor composite · whale / funds weighted highest · RSI &amp; BB are safety
                ratings (5 = safer).
              </p>
            </div>

            {result.topPick ? (
              <TopPickCard pick={result.topPick} onOpen={onOpenTicker} marketLabel={marketLabel} />
            ) : (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-3">
                <p className="text-[12px] text-amber-100 font-semibold">No factor clear this search</p>
                <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                  None of the {result.scannedCount} names cleared whale / funds / momentum gates without
                  severe RSI or Bollinger warnings. Check the watchlist or press New search.
                </p>
              </div>
            )}

            {result.buyCandidates.length > 1 && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-2">
                  Other factor clears ({result.buyCandidates.length - 1})
                </p>
                <div className="space-y-1.5">
                  {result.buyCandidates.slice(1, 5).map((c) => (
                    <CandidateRow key={`${searchId}-${c.ticker}`} c={c} onOpen={onOpenTicker} />
                  ))}
                </div>
              </div>
            )}

            {result.watchlistCandidates.length > 0 && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-amber-200/80 mb-1">
                  Near-miss watchlist (did not clear factors)
                </p>
                <p className="text-[10px] text-gray-500 mb-2 leading-relaxed">
                  Closest names by whale / funds / composite — not trade suggestions.
                </p>
                <div className="space-y-1.5">
                  {result.watchlistCandidates.map((c) => (
                    <CandidateRow key={`${searchId}-w-${c.ticker}`} c={c} onOpen={onOpenTicker} />
                  ))}
                </div>
              </div>
            )}

            <details className="rounded-xl border border-white/8 bg-black/25 px-3 py-2">
              <summary className="text-[10px] font-mono uppercase tracking-wider text-gray-500 cursor-pointer">
                Scout log ({result.scanned.length}) · {result.buyCleared} factor clears
              </summary>
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {result.scanned.map((c) => (
                  <p
                    key={`slog-${searchId}-${c.ticker}`}
                    className={cn(
                      'text-[10px] font-mono',
                      c.isBuyCandidate ? 'text-emerald-300/90' : 'text-gray-500'
                    )}
                  >
                    {c.ticker}:{' '}
                    {c.error
                      ? `ERR ${c.error}`
                      : `${c.factorStrip || `${c.recommendation} · ${c.currentAction}`} · ${c.score}${
                          c.buyZones?.length
                            ? ` · BZ1 ${formatMoney(c.buyZones[0].lo)}-${formatMoney(c.buyZones[0].hi)} · BZ3 ${formatMoney(c.buyZones[2].lo)}-${formatMoney(c.buyZones[2].hi)}`
                            : c.buyZone
                              ? ` · buy ${formatMoney(c.buyZone.lo)}-${formatMoney(c.buyZone.hi)}`
                              : ''
                        }`}
                    {c.isBuyCandidate ? ' · clear ✓' : ''}
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

function formatZoneRange(lo?: number, hi?: number): string | null {
  if (lo == null || hi == null || !Number.isFinite(lo) || !Number.isFinite(hi) || lo <= 0 || hi <= 0) {
    return null;
  }
  return `${formatMoney(lo)} – ${formatMoney(hi)}`;
}

function priceInBuyZone(price: number, lo?: number, hi?: number): boolean {
  if (lo == null || hi == null || !Number.isFinite(price)) return false;
  return price >= lo && price <= hi;
}

function SuggestedBuyZoneCard({ pick }: { pick: FindATradeCandidate }) {
  const zones = pick.buyZones;
  if (zones && zones.length >= 3) {
    const envelopeLo = zones[2].lo;
    const envelopeHi = zones[0].hi;
    const stance =
      pick.activeBuyLevel != null
        ? `Live price is inside Buy Zone ${pick.activeBuyLevel} — take that scale-in tranche`
        : pick.price > envelopeHi
          ? 'Live price is above Buy Zone 1 — wait for pullback into Zone 1 → 3'
          : 'Live price is below Buy Zone 3 — watch support / stop';

    return (
      <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-2 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[9px] font-mono uppercase tracking-wider text-emerald-300/90">
              Suggested buy zones · 3 entry chances
              {pick.buyZoneWidthPct != null ? ` · ~${pick.buyZoneWidthPct}% span` : ''}
            </p>
            <p className="text-[10px] text-emerald-100/70 mt-0.5">
              Scale in 30% / 40% / 30% across Zone 1 → 3
            </p>
          </div>
          <div className="text-right shrink-0 font-mono text-[10px]">
            <p className="text-gray-500 uppercase text-[8px]">Live</p>
            <p className="text-white">{formatMoney(pick.price)}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          {zones.map((z) => {
            const live = pick.activeBuyLevel === z.level;
            const tone =
              z.level === 1
                ? 'border-emerald-400/40 bg-emerald-500/15'
                : z.level === 2
                  ? 'border-sky-400/35 bg-sky-500/10'
                  : 'border-violet-400/35 bg-violet-500/10';
            return (
              <div
                key={z.level}
                className={cn(
                  'rounded-md border px-2 py-1.5',
                  tone,
                  live && 'ring-1 ring-white/30'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold text-white">
                    {z.label}
                    <span className="ml-1.5 text-[9px] font-mono font-normal text-gray-400">
                      ~{z.sizePct}% size
                    </span>
                    {live && (
                      <span className="ml-1.5 text-[8px] font-mono uppercase tracking-wider text-emerald-200">
                        · live
                      </span>
                    )}
                  </p>
                  <p className="text-[12px] font-black font-mono text-emerald-100">
                    {formatMoney(z.lo)} – {formatMoney(z.hi)}
                  </p>
                </div>
                <p className="text-[9px] text-gray-400 mt-0.5 truncate">via {z.anchor}</p>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-emerald-100/85 leading-relaxed">{stance}</p>
        {(pick.stopLoss != null || pick.takeProfit != null) && (
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <div className="rounded-md bg-black/25 border border-white/8 px-2 py-1">
              <p className="text-[8px] font-mono uppercase text-gray-500">Stop (under Z3)</p>
              <p className="text-[11px] font-mono text-rose-300">{formatMoney(pick.stopLoss)}</p>
            </div>
            <div className="rounded-md bg-black/25 border border-white/8 px-2 py-1">
              <p className="text-[8px] font-mono uppercase text-gray-500">Take profit</p>
              <p className="text-[11px] font-mono text-violet-300">{formatMoney(pick.takeProfit)}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  const range = formatZoneRange(pick.buyZone?.lo, pick.buyZone?.hi);
  if (!range || !pick.buyZone) return null;
  const inZone = priceInBuyZone(pick.price, pick.buyZone.lo, pick.buyZone.hi);
  const above = pick.price > pick.buyZone.hi;
  const stance = inZone
    ? `Live price is inside the BUY zone${pick.buyZoneAnchor ? ` (${pick.buyZoneAnchor})` : ''}`
    : above
      ? `Live price is above BUY zone — wait for pullback${pick.buyZoneAnchor ? ` to ${pick.buyZoneAnchor}` : ''}`
      : `Live price is below BUY zone — watch support / stop`;

  return (
    <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-2 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-wider text-emerald-300/90">
            Suggested buy zone
            {pick.buyZoneWidthPct != null ? ` · ~${pick.buyZoneWidthPct}% wide` : ''}
          </p>
          <p className="text-[15px] font-black text-emerald-200 tracking-wide mt-0.5">{range}</p>
          {pick.buyZoneAnchor && (
            <p className="text-[10px] text-emerald-100/70 mt-0.5">Anchored to {pick.buyZoneAnchor}</p>
          )}
        </div>
        <div className="text-right shrink-0 font-mono text-[10px]">
          <p className="text-gray-500 uppercase text-[8px]">Live</p>
          <p className="text-white">{formatMoney(pick.price)}</p>
        </div>
      </div>
      <p className="text-[10px] text-emerald-100/85 leading-relaxed">{stance}</p>
      {(pick.stopLoss != null || pick.takeProfit != null) && (
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <div className="rounded-md bg-black/25 border border-white/8 px-2 py-1">
            <p className="text-[8px] font-mono uppercase text-gray-500">Stop</p>
            <p className="text-[11px] font-mono text-rose-300">{formatMoney(pick.stopLoss)}</p>
          </div>
          <div className="rounded-md bg-black/25 border border-white/8 px-2 py-1">
            <p className="text-[8px] font-mono uppercase text-gray-500">Take profit</p>
            <p className="text-[11px] font-mono text-violet-300">{formatMoney(pick.takeProfit)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ratingTone(rating: SuggestRating, isWarning: boolean): string {
  if (isWarning) {
    if (rating <= 2) return 'text-rose-300 border-rose-500/30 bg-rose-500/10';
    if (rating === 3) return 'text-amber-200 border-amber-500/25 bg-amber-500/10';
    return 'text-emerald-300 border-emerald-500/25 bg-emerald-500/10';
  }
  if (rating >= 4) return 'text-emerald-300 border-emerald-500/25 bg-emerald-500/10';
  if (rating === 3) return 'text-sky-200 border-sky-500/25 bg-sky-500/10';
  return 'text-rose-300 border-rose-500/30 bg-rose-500/10';
}

function FactorRatingsGrid({ factors }: { factors: SuggestFactorRating[] }) {
  const ordered = SUGGEST_FACTOR_ORDER.map((k) => factors.find((f) => f.key === k)).filter(
    Boolean
  ) as SuggestFactorRating[];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
      {ordered.map((f) => (
        <div
          key={f.key}
          title={f.detail}
          className={cn(
            'rounded-lg border px-2 py-1.5 min-w-0',
            ratingTone(f.rating, f.isWarning)
          )}
        >
          <p className="text-[8px] font-mono uppercase tracking-wider opacity-80 truncate">
            {f.shortLabel}
            {f.isWarning ? ' warn' : ''}
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
    <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-3 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-wider text-sky-300/80">
            Suggested trade · {marketLabel} · factor engine
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

      <SuggestedBuyZoneCard pick={pick} />

      {pick.factorRatings && pick.factorRatings.length > 0 && (
        <FactorRatingsGrid factors={pick.factorRatings} />
      )}

      {pick.warnings && pick.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-2">
          <p className="text-[9px] font-mono uppercase tracking-wider text-amber-200/90 mb-1">
            Warnings
          </p>
          {pick.warnings.map((w) => (
            <p key={w} className="text-[10px] text-amber-100/90 leading-relaxed">
              {w}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
        <div className="rounded-lg bg-black/30 border border-white/8 px-2 py-1.5">
          <p className="text-gray-500 uppercase text-[8px]">Conf</p>
          <p className="text-white">{pick.confidence}%</p>
        </div>
        <div className="rounded-lg bg-black/30 border border-white/8 px-2 py-1.5">
          <p className="text-gray-500 uppercase text-[8px]">Factor</p>
          <p className="text-white">{pick.suggestComposite ?? pick.score}</p>
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
  const whale = c.factorRatings?.find((f) => f.key === 'whaleAccumulation')?.rating;
  const funds = c.factorRatings?.find((f) => f.key === 'institutionalInflow')?.rating;
  const buyRange =
    c.buyZones && c.buyZones.length >= 3
      ? `BZ1 ${formatMoney(c.buyZones[0].lo)}–${formatMoney(c.buyZones[0].hi)} · BZ3 ${formatMoney(c.buyZones[2].lo)}–${formatMoney(c.buyZones[2].hi)}`
      : formatZoneRange(c.buyZone?.lo, c.buyZone?.hi);
  return (
    <button
      type="button"
      onClick={() => onOpen(c.ticker)}
      className="w-full flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/30 px-3 py-2 text-left hover:border-sky-500/30 transition-colors cursor-pointer"
    >
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-white">{c.ticker}</p>
        <p className="text-[10px] text-gray-500 truncate">
          {c.factorStrip || `${c.recommendation} · ${c.currentAction}`}
        </p>
        {buyRange && (
          <p className="text-[10px] font-mono text-emerald-300/90 mt-0.5 truncate">
            {typeof buyRange === 'string' && buyRange.startsWith('BZ')
              ? buyRange
              : `Buy zone ${buyRange}`}
          </p>
        )}
      </div>
      <div className="text-right shrink-0 font-mono text-[10px]">
        <p className="text-sky-300">
          {c.suggestComposite ?? c.score}
          {whale != null && funds != null ? ` · W${whale} F${funds}` : ''}
        </p>
        <p className={c.expectedReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
          {formatPct(c.expectedReturn)}
        </p>
      </div>
    </button>
  );
}
