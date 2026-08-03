import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crosshair, Loader2, Rocket, Search } from 'lucide-react';
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

const LIST_STORAGE_KEY = 'qn-find-a-trade-list';
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

type FindATradePanelProps = {
  horizon?: HorizonKey;
  onOpenTicker: (ticker: string) => void;
  className?: string;
  compact?: boolean;
};

export function FindATradePanel({
  horizon = '1M',
  onOpenTicker,
  className,
  compact = false,
}: FindATradePanelProps) {
  const [listText, setListText] = useState(loadSavedList);
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

  const parsed = useMemo(() => parseTickerList(listText), [listText]);
  const horizonLabel = HORIZON_OPTIONS.find((o) => o.key === horizon)?.label ?? horizon;

  const runScout = async () => {
    if (scanning) return;
    const tickers = parseTickerList(listText);
    if (!tickers.length) {
      setError('Enter tickers separated by commas or spaces.');
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
        onProgress: setProgress,
      });
      setResult(out);
    } catch (e: any) {
      setError(e?.message || 'Find a Trade failed');
    } finally {
      setScanning(false);
    }
  };

  return (
    <GlassCard className={cn('space-y-3', className)}>
      <SectionLabel icon={<Rocket className="w-3.5 h-3.5 text-emerald-400" />}>
        Find a Trade · {horizonLabel}
      </SectionLabel>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        Paste up to {FIND_A_TRADE_MAX} tickers — your list is saved automatically in this browser.
        Consensus AI scouts for names that clear{' '}
        <span className="text-emerald-300 font-semibold">BUY / STRONG BUY</span> gates — it will not
        force a pick if none qualify.
      </p>

      <textarea
        value={listText}
        onChange={(e) => setListText(e.target.value)}
        rows={compact ? 2 : 3}
        placeholder="AAPL, NVDA, MSFT, 0700.HK"
        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[12px] font-mono text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/40 resize-y min-h-[56px]"
      />

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <p className="text-[10px] font-mono text-gray-500">
          {parsed.length}/{FIND_A_TRADE_MAX} ticker{parsed.length === 1 ? '' : 's'} ready · list memorized
          {scanning && progress
            ? ` · scanning ${progress.done}/${progress.total}${progress.current ? ` (${progress.current})` : ''}`
            : ''}
        </p>
        <button
          type="button"
          disabled={scanning || parsed.length === 0}
          onClick={() => void runScout()}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer',
            scanning || parsed.length === 0
              ? 'bg-white/5 text-gray-500 border border-white/10'
              : 'bg-emerald-500 text-black border border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.35)] hover:bg-emerald-400'
          )}
        >
          {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
          Find a Trade
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

            {result.scanned.some((c) => !c.isBuyCandidate) && (
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
        <p className="text-[10px] text-gray-500 truncate">{c.recommendation} · {c.currentAction}</p>
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
