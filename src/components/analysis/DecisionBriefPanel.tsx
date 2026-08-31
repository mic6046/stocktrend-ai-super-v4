import React from 'react';
import { motion } from 'motion/react';
import { Brain, CheckCircle2, XCircle, Scale, Shield, Target, Users, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassCard, SectionLabel } from './GlassCard';
import { formatPct, formatMoney } from './analysisTheme';
import type { QuantumEngineOutput } from '../../lib/quantumRecommendationEngine';

type DecisionBriefPanelProps = {
  decision: QuantumEngineOutput;
};

function px(n: number) {
  return formatMoney(n);
}

export function DecisionBriefPanel({ decision }: DecisionBriefPanelProps) {
  const scores = [
    { label: 'Technical', value: decision.componentScores.technical },
    { label: 'Fundamental', value: decision.componentScores.fundamental },
    { label: 'Whale', value: decision.componentScores.whale },
    { label: 'Sentiment', value: decision.componentScores.news },
    { label: 'Risk', value: decision.componentScores.risk },
    { label: 'Momentum', value: decision.componentScores.momentum },
  ];

  return (
    <GlassCard className="space-y-4">
      <SectionLabel icon={<Brain className="w-3.5 h-3.5 text-violet-400" />}>
        Consensus AI · {decision.horizonLabel}
      </SectionLabel>

      {/* STEP 11 — Final output header */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Metric label="Horizon Recommendation" value={decision.finalVerdict} tone={decision.chartStance} />
        <Metric label="Confidence" value={`${decision.confidence}%`} />
        <Metric
          label="Expected Return"
          value={formatPct(decision.expectedReturn)}
          tone={decision.expectedReturn >= 0 ? 'bull' : 'bear'}
        />
        <Metric label="Risk Level" value={decision.riskLevel} />
        <Metric label="Primary Action" value={decision.currentAction.displayLabel || decision.currentAction.action} tone={decision.chartStance} />
        <Metric label="Suggested Action" value={decision.suggestedAction} tone={decision.chartStance} />
      </div>

      <p className="text-[10px] text-gray-500 font-mono leading-relaxed">
        One current price = one primary action. Horizon thesis ({decision.finalVerdict}) is separate from
        live action. Buy Zones are future opportunities unless confirmation selects BUY/ADD.
      </p>

      <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-3 py-2.5 space-y-2">
        <p className="text-[8px] uppercase tracking-wider text-cyan-300/80">
          Primary Action · {decision.userHasPosition ? 'Position held' : 'No position'}
        </p>
        <p className="text-[15px] font-black text-white uppercase tracking-wide">
          {decision.currentAction.displayLabel || decision.currentAction.action}
        </p>
        <p className="text-[10px] font-mono text-gray-400">
          CURRENT PRICE ·{' '}
          <span className="text-white font-bold">{px(decision.currentPrice)}</span>
        </p>
        {(decision.currentAction.priceLocation || decision.currentAction.confirmationStatus) && (
          <p className="text-[10px] font-mono text-gray-500">
            {decision.currentAction.priceLocation
              ? `LOCATION ${decision.currentAction.priceLocation.replace(/_/g, ' ')}`
              : ''}
            {decision.currentAction.priceLocation && decision.currentAction.confirmationStatus
              ? ' · '
              : ''}
            {decision.currentAction.confirmationStatus
              ? `CONFIRMATION ${decision.currentAction.confirmationStatus}`
              : ''}
          </p>
        )}
        {decision.criticalCaveat && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-2">
            <p className="text-[8px] uppercase tracking-wider text-amber-300 font-bold">⚠ Important</p>
            <p className="mt-0.5 text-[12px] font-bold text-amber-100 leading-relaxed">
              {decision.criticalCaveat}
            </p>
          </div>
        )}
        <div>
          <p className="text-[8px] uppercase tracking-wider text-gray-500">Why</p>
          <p className="mt-0.5 text-[11px] text-gray-300 leading-relaxed">
            {decision.currentAction.why || decision.currentAction.reason}
          </p>
        </div>
        {decision.currentAction.nextOpportunity && !decision.currentAction.whatToWatch && (
          <div>
            <p className="text-[8px] uppercase tracking-wider text-gray-500">Next opportunity</p>
            <p className="mt-0.5 text-[11px] text-amber-200/90 leading-relaxed">
              {decision.currentAction.nextOpportunity}
            </p>
          </div>
        )}
        {decision.currentAction.conflictingFactors &&
          decision.currentAction.conflictingFactors.length > 0 && (
            <div>
              <p className="text-[8px] uppercase tracking-wider text-rose-300/80">
                What is conflicting
              </p>
              <ul className="mt-0.5 space-y-0.5">
                {decision.currentAction.conflictingFactors.slice(0, 4).map((f) => (
                  <li key={f} className="text-[11px] text-rose-100/85 leading-relaxed">
                    · {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        {decision.currentAction.whatToWatch && (
          <div>
            <p className="text-[8px] uppercase tracking-wider text-gray-500">What to watch</p>
            <p className="mt-0.5 text-[11px] text-amber-200/90 leading-relaxed">
              {decision.currentAction.whatToWatch}
            </p>
          </div>
        )}
        {decision.currentAction.confidenceBand && (
          <p className="text-[10px] font-mono text-gray-400">
            CONFIDENCE BAND · {decision.currentAction.confidenceBand}
          </p>
        )}
        {(decision.reEntryZone || decision.currentAction.futureReEntryZone) &&
          decision.currentAction.action !== 'INDECISION' && (
          <div>
            <p className="text-[8px] uppercase tracking-wider text-gray-500">
              Future re-entry zone · not a current buy
            </p>
            <p className="mt-0.5 text-[12px] font-mono font-bold text-emerald-300">
              {px(
                Math.min(
                  (decision.reEntryZone || decision.currentAction.futureReEntryZone)!.lo,
                  (decision.reEntryZone || decision.currentAction.futureReEntryZone)!.hi
                )
              )}{' '}
              –{' '}
              {px(
                Math.max(
                  (decision.reEntryZone || decision.currentAction.futureReEntryZone)!.lo,
                  (decision.reEntryZone || decision.currentAction.futureReEntryZone)!.hi
                )
              )}
            </p>
          </div>
        )}
        <p className="text-[10px] font-mono text-gray-500">
          Confidence {decision.currentAction.confidence}% · zones → location → position → priority →
          one action
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric label="Bullish Score" value={`${decision.bullishScore}`} tone="bull" />
        <Metric label="Bearish Score" value={`${decision.bearishScore}`} tone="bear" />
        <Metric label="Risk Score" value={`${decision.riskScore}`} />
        <Metric label="Overall AI Score" value={`${decision.componentScores.overall}`} />
      </div>

      {/* STEP 2 — AI Investment Committee */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-3.5 h-3.5 text-violet-300" />
          <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
            AI Investment Committee
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {decision.committee.map((m) => (
            <div key={m.seat} className="rounded-xl border border-white/8 bg-black/30 px-3 py-2.5">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
                    {m.seat} AI
                  </p>
                  <p className="text-[11px] font-bold text-white mt-0.5">{m.recommendation}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[15px] font-bold font-mono text-violet-200 tabular-nums">{m.score}</p>
                  <p className="text-[8px] font-mono text-gray-500">
                    {m.confidence}% conf · {Math.round(m.weight * 100)}% wt
                  </p>
                </div>
              </div>
              <p className="mt-1.5 text-[10px] text-gray-400 leading-snug">{m.reason}</p>
              <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-violet-400/80"
                  initial={{ width: 0 }}
                  animate={{ width: `${m.score}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-gray-500 font-mono leading-relaxed">{decision.consensusNote}</p>
      </div>

      {/* Transparency scores */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-2">
          Transparency Scores
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {scores.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/8 bg-black/30 px-2.5 py-2">
              <p className="text-[8px] uppercase tracking-wider text-gray-500">{s.label}</p>
              <p className="text-[15px] font-bold font-mono text-white tabular-nums mt-0.5">{s.value}</p>
              <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-violet-400/80"
                  initial={{ width: 0 }}
                  animate={{ width: `${s.value}%` }}
                  transition={{ duration: 0.45 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conflicts — never hide */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <FactorColumn
          title="Bullish Factors"
          icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          items={decision.bullishFactors.map((f) => f.label)}
          tone="bull"
        />
        <FactorColumn
          title="Bearish Factors"
          icon={<XCircle className="w-3.5 h-3.5 text-rose-400" />}
          items={decision.bearishFactors.map((f) => f.label)}
          tone="bear"
        />
        <FactorColumn
          title="Neutral Factors"
          icon={<Minus className="w-3.5 h-3.5 text-sky-400" />}
          items={decision.neutralFactors.map((f) => f.label)}
          tone="neutral"
        />
      </div>

      <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Scale className="w-3.5 h-3.5 text-violet-300" />
          <p className="text-[10px] font-mono uppercase tracking-wider text-violet-300">
            Why the AI Chose {decision.finalVerdict}
          </p>
        </div>
        <p className="text-[12px] text-gray-200 leading-relaxed">{decision.whyWins}</p>
      </div>

      {decision.rejectedOpposite && (
        <div className="rounded-xl border border-white/8 bg-black/25 p-3 space-y-1.5">
          <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
            Why Opposite Signals Were Rejected
          </p>
          <p className="text-[11px] text-gray-400 leading-relaxed whitespace-pre-wrap">
            {decision.rejectedOpposite}
          </p>
        </div>
      )}

      {/* S/R + plan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/8 bg-black/30 px-3 py-2.5">
          <p className="text-[8px] uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <Shield className="w-3 h-3" /> Support / Resistance Odds
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] font-mono">
            <p className="text-emerald-300">Support hold {decision.supportHoldProbability}%</p>
            <p className="text-rose-300">Support fail {decision.supportFailureProbability}%</p>
            <p className="text-emerald-300">Resist break {decision.resistanceBreakProbability}%</p>
            <p className="text-rose-300">Resist reject {decision.resistanceRejectionProbability}%</p>
          </div>
          <p className="mt-2 text-[10px] text-gray-500">
            Support ≠ automatic BUY · Resistance ≠ automatic SELL
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-black/30 px-3 py-2.5">
          <p className="text-[8px] uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <Target className="w-3 h-3" /> Trade Plan
          </p>
          <div className="mt-2 space-y-1 text-[11px] font-mono text-gray-300">
            <p>
              Entry{' '}
              <span className="text-white">
                {px(decision.entryZone.lo)} – {px(decision.entryZone.hi)}
              </span>
            </p>
            <p>
              T1 <span className="text-emerald-300">{px(decision.target1)}</span>
              {' · '}T2 <span className="text-emerald-300">{px(decision.target2)}</span>
              {' · '}T3 <span className="text-emerald-300">{px(decision.target3)}</span>
            </p>
            <p>
              Stop <span className="text-rose-300">{px(decision.stopLoss)}</span>
            </p>
            {decision.supportLevels.length > 0 && (
              <p className="text-gray-500">
                Supports {decision.supportLevels.map((l) => px(l)).join(' · ')}
              </p>
            )}
            {decision.resistanceLevels.length > 0 && (
              <p className="text-gray-500">
                Resistances {decision.resistanceLevels.map((l) => px(l)).join(' · ')}
              </p>
            )}
          </div>
        </div>
      </div>

      {decision.explainedSignals.length > 0 && (
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-2">
            Classified Signals (signal ≠ order)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {decision.explainedSignals.slice(0, 6).map((sig) => (
              <div
                key={sig.title}
                className={cn(
                  'rounded-xl border px-3 py-2.5',
                  sig.polarity === 'bull' && 'border-emerald-500/25 bg-emerald-500/5',
                  sig.polarity === 'bear' && 'border-rose-500/25 bg-rose-500/5',
                  sig.polarity === 'neutral' && 'border-white/8 bg-white/[0.02]'
                )}
              >
                <div className="flex justify-between gap-2 items-start">
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-wider text-violet-300/80">
                      {sig.signalClass}
                    </p>
                    <p className="text-[11px] font-bold text-white leading-snug mt-0.5">{sig.title}</p>
                  </div>
                  <div className="text-right shrink-0 font-mono text-[10px] text-gray-400">
                    <p>{sig.confidence}% conf</p>
                    <p>{sig.expectedProbability}% prob</p>
                  </div>
                </div>
                <p className="mt-1.5 text-[10px] text-gray-500">Trigger: {sig.trigger}</p>
                <ul className="mt-1 space-y-0.5">
                  {sig.reasons.map((r) => (
                    <li key={r} className="text-[10px] text-gray-400">
                      • {r}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 grid grid-cols-2 gap-1 text-[9px] text-gray-500">
                  <p>Risk: {sig.risk}</p>
                  <p>Hold: {sig.holdingPeriod}</p>
                  <p>Downside: {sig.maxDownside}</p>
                  <p>Upside: {sig.potentialUpside}</p>
                </div>
                <p className="mt-2 text-[10px] text-violet-200">
                  Suggested action: <span className="font-semibold">{sig.suggestedAction}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <p className="text-[8px] uppercase tracking-wider text-amber-300/80">Invalidation Level</p>
          <p className="mt-1 text-gray-300 leading-relaxed">{decision.invalidationLevel}</p>
        </div>
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2">
          <p className="text-[8px] uppercase tracking-wider text-sky-300/80">Review Trigger</p>
          <p className="mt-1 text-gray-300 leading-relaxed">{decision.nextReviewTrigger}</p>
        </div>
      </div>

      <p className="text-[9px] font-mono text-violet-300/70">{decision.validationStatus}</p>
    </GlassCard>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'bull' | 'bear' | 'neutral';
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/30 px-2.5 py-2 min-w-0">
      <p className="text-[8px] uppercase tracking-wider text-gray-500">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-[13px] font-bold font-mono break-words leading-tight',
          tone === 'bull' && 'text-emerald-400',
          tone === 'bear' && 'text-rose-400',
          (!tone || tone === 'neutral') && 'text-white'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FactorColumn({
  title,
  icon,
  items,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  tone: 'bull' | 'bear' | 'neutral';
}) {
  const mark = tone === 'bull' ? '✔' : tone === 'bear' ? '✖' : '•';
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2.5 min-h-[96px]',
        tone === 'bull' && 'border-emerald-500/20 bg-emerald-500/5',
        tone === 'bear' && 'border-rose-500/20 bg-rose-500/5',
        tone === 'neutral' && 'border-sky-500/15 bg-sky-500/5'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400">{title}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-gray-500">None material on this horizon.</p>
      ) : (
        <ul className="space-y-1">
          {items.slice(0, 6).map((item) => (
            <li key={item} className="text-[11px] text-gray-200 leading-snug">
              {mark} {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
