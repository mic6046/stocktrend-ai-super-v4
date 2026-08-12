import React from 'react';
import { Bot, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GlassCard, SectionLabel } from '../analysis/GlassCard';
import { cn } from '../../lib/utils';

export type AiSignalRow = {
  ticker: string;
  name?: string;
  recommendation: string;
  confidence: number;
  trend?: string;
  smartMoney?: string;
  fundFlow?: string;
  rsi?: number | null;
  momentum?: string;
  technicalTrend?: string;
  risk?: string;
  price?: number;
  changePct?: number;
};

const EXPLAIN: Record<string, string> = {
  smartMoney: 'Large institutional-style buying or selling activity detected.',
  fundFlow: 'Net money moving into or out of the stock recently.',
  rsi: 'RSI near 30 can mean oversold; near 70 can mean overbought.',
  momentum: 'How strongly price has been moving in one direction.',
  technicalTrend: 'Short-term chart direction from moving averages and structure.',
  risk: 'How volatile or fragile the setup looks for a typical investor.',
};

type AiSignalsPageProps = {
  signals: AiSignalRow[];
  onOpenTicker: (ticker: string) => void;
  onRefreshHint?: () => void;
};

function DirIcon({ v }: { v?: string }) {
  const s = (v || '').toLowerCase();
  if (s.includes('up') || s.includes('bull') || s.includes('inflow') || s === '↑') {
    return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
  }
  if (s.includes('down') || s.includes('bear') || s.includes('outflow') || s === '↓') {
    return <TrendingDown className="h-3.5 w-3.5 text-rose-400" />;
  }
  return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

export function AiSignalsPage({ signals, onOpenTicker, onRefreshHint }: AiSignalsPageProps) {
  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-400">Intelligence</p>
          <h2 className="mt-1 text-2xl font-sans font-bold text-white">AI Signals</h2>
          <p className="mt-1 text-[13px] text-gray-500 max-w-2xl">
            Each card translates AI output into a clear recommendation. Tap a stock for the full analysis workspace.
          </p>
        </div>
        {onRefreshHint && (
          <button
            type="button"
            onClick={onRefreshHint}
            className="min-h-[40px] rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 text-[11px] font-bold uppercase tracking-wide text-cyan-300 hover:bg-cyan-500/20 cursor-pointer"
          >
            Open Find Trades
          </button>
        )}
      </div>

      {!signals.length ? (
        <GlassCard>
          <p className="text-[13px] text-gray-400 text-center py-8">
            No cached signals yet. Run <span className="text-emerald-400 font-semibold">Find Trades</span> or{' '}
            <span className="text-sky-400 font-semibold">Suggest</span> to populate AI recommendations.
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {signals.map((s) => (
            <button
              key={s.ticker}
              type="button"
              onClick={() => onOpenTicker(s.ticker)}
              className="text-left cursor-pointer"
            >
              <GlassCard hover className="h-full border-white/10">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono font-bold text-white text-[15px]">{s.ticker}</p>
                    <p className="text-[11px] text-gray-500 truncate">{s.name || '—'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={cn(
                        'text-[13px] font-black uppercase tracking-wide',
                        /buy|add/i.test(s.recommendation) && 'text-emerald-400',
                        /sell|trim|reduce/i.test(s.recommendation) && 'text-rose-400',
                        /wait|hold|indiffer|indecision/i.test(s.recommendation) && 'text-amber-300'
                      )}
                    >
                      {s.recommendation}
                    </p>
                    <p className="text-[11px] font-mono text-cyan-300 mt-0.5">
                      AI Confidence: {Math.round(s.confidence)}%
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <Metric label="Trend" value={s.trend || '—'} />
                  <Metric
                    label="Smart Money"
                    value={s.smartMoney || '—'}
                    icon={<DirIcon v={s.smartMoney} />}
                    tip={EXPLAIN.smartMoney}
                  />
                  <Metric
                    label="Fund Flow"
                    value={s.fundFlow || '—'}
                    icon={<DirIcon v={s.fundFlow} />}
                    tip={EXPLAIN.fundFlow}
                  />
                  <Metric
                    label="RSI"
                    value={s.rsi != null ? String(Math.round(s.rsi)) : '—'}
                    tip={EXPLAIN.rsi}
                  />
                  <Metric label="Momentum" value={s.momentum || '—'} tip={EXPLAIN.momentum} />
                  <Metric
                    label="Technical Trend"
                    value={s.technicalTrend || '—'}
                    tip={EXPLAIN.technicalTrend}
                  />
                  <Metric label="Risk" value={s.risk || '—'} tip={EXPLAIN.risk} />
                  <Metric
                    label="Change"
                    value={
                      s.changePct != null
                        ? `${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`
                        : '—'
                    }
                  />
                </div>
              </GlassCard>
            </button>
          ))}
        </div>
      )}

      <GlassCard padding="sm" className="border-cyan-500/15">
        <SectionLabel icon={<Bot className="w-3.5 h-3.5 text-cyan-400" />}>How to read this</SectionLabel>
        <ul className="mt-2 space-y-1 text-[11px] text-gray-400">
          <li>Smart Money ↑ — {EXPLAIN.smartMoney}</li>
          <li>Fund Flow ↑ — {EXPLAIN.fundFlow}</li>
          <li>Risk — {EXPLAIN.risk}</li>
        </ul>
      </GlassCard>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  tip,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tip?: string;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/25 px-2 py-1.5 min-w-0" title={tip}>
      <p className="text-[9px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-0.5 flex items-center gap-1 font-semibold text-gray-200 truncate">
        {icon}
        <span className="truncate">{value}</span>
      </p>
    </div>
  );
}
