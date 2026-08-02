import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, ArrowDownRight, ArrowUpRight, Minus, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassCard, SectionLabel } from './GlassCard';
import { formatPct } from './analysisTheme';
import {
  confidenceTrend,
  directionMeta,
  type ChangeLogState,
  type RecommendationChangeEntry,
} from '../../lib/recommendationChangeLog';

type RecommendationChangeLogPanelProps = {
  state: ChangeLogState | null;
  horizonLabel?: string;
  currentConfidence?: number;
};

function toneClass(tone: ReturnType<typeof directionMeta>['tone']) {
  switch (tone) {
    case 'upgrade':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'mild':
      return 'border-orange-500/30 bg-orange-500/10 text-orange-300';
    case 'major':
      return 'border-rose-500/35 bg-rose-500/10 text-rose-300';
    case 'none':
      return 'border-sky-500/25 bg-sky-500/5 text-sky-300';
    default:
      return 'border-amber-500/25 bg-amber-500/5 text-amber-300';
  }
}

function formatStamp(ts: number) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatDay(ts: number) {
  try {
    return new Date(ts).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  } catch {
    return '—';
  }
}

export function RecommendationChangeLogPanel({
  state,
  horizonLabel,
  currentConfidence = 0,
}: RecommendationChangeLogPanelProps) {
  const latest = state?.latestStatus ?? null;
  const history = state?.history ?? [];
  const meta = latest ? directionMeta(latest.direction) : directionMeta('no_change');
  const trend = useMemo(
    () => confidenceTrend(history, currentConfidence || latest?.confidenceAfter || 0),
    [history, currentConfidence, latest?.confidenceAfter]
  );

  return (
    <GlassCard className="space-y-4">
      <SectionLabel icon={<History className="w-3.5 h-3.5 text-cyan-400" />}>
        Recommendation Change Log{horizonLabel ? ` · ${horizonLabel}` : ''}
      </SectionLabel>

      <AnimatePresence mode="wait">
        <motion.div
          key={latest?.id || 'empty'}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
          className="space-y-3"
        >
          {!latest ? (
            <p className="text-[12px] text-gray-500">
              Change history will appear after the first consensus recommendation is produced.
            </p>
          ) : latest.direction === 'no_change' ? (
            <NoChangeCard entry={latest} meta={meta} />
          ) : (
            <ChangeCard entry={latest} meta={meta} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Confidence trend */}
      <div className="rounded-xl border border-white/8 bg-black/25 px-3 py-2.5">
        <p className="text-[8px] uppercase tracking-wider text-gray-500 mb-2">AI Confidence Trend</p>
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[12px]">
          {trend.map((c, i) => (
            <React.Fragment key={`${c}-${i}`}>
              <span className="text-white tabular-nums">{c}%</span>
              {i < trend.length - 1 && <span className="text-gray-600">↓</span>}
            </React.Fragment>
          ))}
          {trend.length <= 1 && (
            <span className="text-[11px] text-gray-500 font-sans ml-1">— building history</span>
          )}
        </div>
      </div>

      {/* History newest first */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-2">
          History · latest {Math.min(20, history.length)} of 20
        </p>
        {history.length === 0 ? (
          <p className="text-[11px] text-gray-500">
            No recommendation changes recorded yet for this horizon.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
            {history.map((h) => {
              const m = directionMeta(h.direction);
              return (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-[10px] font-mono text-gray-500 shrink-0 w-12">
                      {formatDay(h.timestamp)}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0',
                        toneClass(m.tone)
                      )}
                    >
                      {m.arrow}
                    </span>
                    <p className="text-[11px] text-gray-200 truncate">
                      <span className="text-gray-500">{h.oldRecommendation}</span>
                      {' → '}
                      <span className="font-semibold text-white">{h.newRecommendation}</span>
                    </p>
                  </div>
                  <span className="text-[9px] font-mono text-gray-500 shrink-0">
                    {h.confidenceBefore}%→{h.confidenceAfter}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function NoChangeCard({
  entry,
  meta,
}: {
  entry: RecommendationChangeEntry;
  meta: ReturnType<typeof directionMeta>;
}) {
  return (
    <div className={cn('rounded-xl border px-3 py-3 space-y-2', toneClass(meta.tone))}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Minus className="w-3.5 h-3.5" />
          <p className="text-[11px] font-bold uppercase tracking-wider">No Recommendation Change</p>
        </div>
        <span className="text-[10px] font-mono opacity-80">{entry.newRecommendation}</span>
      </div>
      <p className="text-[11px] text-gray-300 leading-relaxed">{entry.whyChanged}</p>
      <ul className="space-y-0.5">
        {entry.secondaryReasons.map((r) => (
          <li key={r} className="text-[10px] text-gray-400">
            • {r}
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-gray-400">
        Suggested action: <span className="text-gray-200 font-semibold">{entry.suggestedAction}</span>
      </p>
    </div>
  );
}

function ChangeCard({
  entry,
  meta,
}: {
  entry: RecommendationChangeEntry;
  meta: ReturnType<typeof directionMeta>;
}) {
  const Icon = meta.tone === 'upgrade' ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={cn('rounded-xl border px-3 py-3 space-y-3', toneClass(meta.tone).replace(/text-\S+/, 'text-inherit'))}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">
            {formatStamp(entry.timestamp)} · {entry.horizonLabel}
          </p>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold text-gray-400">{entry.oldRecommendation}</span>
            <span className={cn('text-[12px] font-black px-1.5 py-0.5 rounded border', toneClass(meta.tone))}>
              <Icon className="w-3 h-3 inline mr-0.5" />
              {meta.arrow} {meta.label}
            </span>
            <span className="text-[13px] font-bold text-white">{entry.newRecommendation}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
        <Delta label="Confidence" before={`${entry.confidenceBefore}%`} after={`${entry.confidenceAfter}%`} />
        <Delta
          label="Expected Return"
          before={formatPct(entry.expectedReturnBefore)}
          after={formatPct(entry.expectedReturnAfter)}
        />
        <Delta label="Risk" before={entry.riskBefore} after={entry.riskAfter} />
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-mono uppercase tracking-wider text-violet-300/80 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" /> Why it changed
        </p>
        <p className="text-[12px] text-gray-200 leading-relaxed">{entry.whyChanged}</p>
        <p className="text-[11px] text-gray-400">
          <span className="text-gray-500">What changed:</span> {entry.whatChanged}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-lg border border-white/8 bg-black/30 px-2.5 py-2">
          <p className="text-[8px] uppercase tracking-wider text-gray-500">Primary Reason</p>
          <p className="mt-1 text-[11px] text-gray-200 leading-snug">{entry.primaryReason}</p>
        </div>
        <div className="rounded-lg border border-white/8 bg-black/30 px-2.5 py-2">
          <p className="text-[8px] uppercase tracking-wider text-gray-500">Greatest Influence</p>
          <p className="mt-1 text-[11px] text-gray-200 leading-snug">{entry.greatestInfluence}</p>
        </div>
      </div>

      {entry.secondaryReasons.length > 0 && (
        <div>
          <p className="text-[8px] uppercase tracking-wider text-gray-500 mb-1">Secondary Reasons</p>
          <ul className="space-y-0.5">
            {entry.secondaryReasons.map((r) => (
              <li key={r} className="text-[10px] text-gray-400">
                • {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {entry.unchangedFactors.length > 0 && (
        <div>
          <p className="text-[8px] uppercase tracking-wider text-gray-500 mb-1">Unchanged</p>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            {entry.unchangedFactors.join(' · ')}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
        <Impact label="Risk Impact" value={entry.riskImpact} />
        <Impact label="Expected Return Impact" value={entry.expectedReturnImpact} />
        <Impact label="Confidence Impact" value={entry.confidenceImpact} />
      </div>

      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-2">
        <p className="text-[8px] uppercase tracking-wider text-cyan-300/80">Suggested Action</p>
        <p className="mt-1 text-[12px] text-gray-200 font-semibold leading-snug">
          {entry.suggestedAction}
        </p>
      </div>
    </div>
  );
}

function Delta({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/30 px-2 py-1.5">
      <p className="text-[8px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-0.5 text-gray-400">
        {before} <span className="text-gray-600">↓</span> <span className="text-white">{after}</span>
      </p>
    </div>
  );
}

function Impact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/20 px-2 py-1.5">
      <p className="text-[8px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-0.5 text-gray-300 leading-snug">{value}</p>
    </div>
  );
}
