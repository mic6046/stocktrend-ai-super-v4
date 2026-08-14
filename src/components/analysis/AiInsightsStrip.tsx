import React, { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { GlassCard, SectionLabel } from './GlassCard';

type Insight = { id: string; text: string; tone?: 'bull' | 'risk' | 'neutral' };

type AiInsightsStripProps = {
  bullishFactors?: string[];
  bearishFactors?: string[];
  keyRisks?: string[];
  technical?: {
    rsi?: number | null;
    macdBullish?: boolean | null;
    trend?: string | null;
    volatility?: number | null;
  };
  whaleScore?: number | null;
  institutionalScore?: number | null;
  riskLabel?: string;
  fullAnalysis?: string | null;
  whyBuyNow?: string | null;
  whySellNow?: string | null;
  /** Horizon-specific lead sentence — single source of truth */
  horizonLead?: string;
  horizonLabel?: string;
  horizonKey?: string;
  /** Master engine key reasons (must agree with recommendation) */
  keyReasons?: string[];
  recommendationTone?: 'bull' | 'bear' | 'neutral';
  /** Support / resistance proximity from Quantum engine */
  srSignal?: string | null;
  srDetail?: string | null;
};

function cleanFactor(s: string): string {
  return s.replace(/[*_#`~]/g, '').replace(/\s+/g, ' ').trim();
}

export function AiInsightsStrip({
  bullishFactors = [],
  bearishFactors = [],
  keyRisks = [],
  technical,
  whaleScore,
  institutionalScore,
  riskLabel,
  fullAnalysis,
  whyBuyNow,
  whySellNow,
  horizonLead,
  horizonLabel,
  horizonKey = '1M',
  keyReasons,
  recommendationTone = 'neutral',
  srSignal,
  srDetail,
}: AiInsightsStripProps) {
  const [expanded, setExpanded] = useState(false);

  const insights = useMemo(() => {
    const items: Insight[] = [];

    if (horizonLabel) {
      items.push({
        id: 'horizon',
        text: `${horizonLabel} Investment Horizon active`,
        tone: 'neutral',
      });
    }

    if (srSignal && srSignal !== '—' && srSignal !== 'Mid Range') {
      const tone: Insight['tone'] = /support/i.test(srSignal)
        ? 'bull'
        : /resistance/i.test(srSignal)
          ? 'risk'
          : 'neutral';
      items.push({
        id: 'sr',
        text: (srDetail ? `${srSignal}: ${srDetail}` : `S/R · ${srSignal}`).slice(0, 72),
        tone,
      });
    } else if (srSignal === 'Mid Range') {
      items.push({
        id: 'sr',
        text: (srDetail || 'Price mid-range between support and resistance').slice(0, 72),
        tone: 'neutral',
      });
    }

    // Show both sides — do not force indicators to agree with the final call
    for (const f of bullishFactors.slice(0, 3)) {
      const text = cleanFactor(f);
      if (text && !items.some((i) => i.text === text)) {
        items.push({ id: `b-${items.length}`, text: text.slice(0, 72), tone: 'bull' });
      }
    }
    for (const f of bearishFactors.slice(0, 3)) {
      const text = cleanFactor(f);
      if (text && !items.some((i) => i.text === text)) {
        items.push({ id: `be-${items.length}`, text: text.slice(0, 72), tone: 'risk' });
      }
    }

    if (keyReasons && keyReasons.length > 0 && items.length < 6) {
      const tone: Insight['tone'] =
        recommendationTone === 'bull' ? 'bull' : recommendationTone === 'bear' ? 'risk' : 'neutral';
      for (let i = 0; i < keyReasons.length && items.length < 7; i++) {
        const text = cleanFactor(keyReasons[i]);
        if (text && !items.some((x) => x.text === text)) {
          items.push({ id: `kr-${i}`, text: text.slice(0, 72), tone });
        }
      }
    }

    if (items.length >= 5) {
      return items.slice(0, 7);
    }

    if (technical?.rsi != null) {
      if (technical.rsi < 35) items.push({ id: 'rsi', text: 'RSI Oversold Bounce Setup', tone: 'bull' });
      else if (technical.rsi > 70) items.push({ id: 'rsi', text: 'RSI Overbought Caution', tone: 'risk' });
      else if (technical.rsi >= 45 && technical.rsi <= 65) items.push({ id: 'rsi', text: 'RSI Bullish Recovery', tone: 'bull' });
      else items.push({ id: 'rsi', text: `RSI Neutral (${Math.round(technical.rsi)})`, tone: 'neutral' });
    }

    if (technical?.macdBullish === true) {
      items.push({ id: 'macd', text: 'MACD Golden Cross', tone: 'bull' });
    } else if (technical?.macdBullish === false) {
      items.push({ id: 'macd', text: 'MACD Bearish Cross', tone: 'risk' });
    }

    if (technical?.trend) {
      const t = String(technical.trend).toUpperCase();
      if (t.includes('BULL')) items.push({ id: 'trend', text: 'Uptrend Structure Intact', tone: 'bull' });
      else if (t.includes('BEAR')) items.push({ id: 'trend', text: 'Downtrend Pressure', tone: 'risk' });
    }

    if (whaleScore != null && whaleScore >= 60) {
      items.push({ id: 'whale', text: 'Whale Accumulation', tone: 'bull' });
    } else if (whaleScore != null && whaleScore < 40) {
      items.push({ id: 'whale', text: 'Whale Distribution Risk', tone: 'risk' });
    }

    if (institutionalScore != null && institutionalScore >= 60) {
      items.push({ id: 'inst', text: 'Institutional Buying', tone: 'bull' });
    }

    for (const f of bullishFactors.slice(0, 4)) {
      const text = cleanFactor(f);
      if (text && items.length < 7 && !items.some((i) => i.text === text)) {
        items.push({ id: `b-${items.length}`, text: text.slice(0, 64), tone: 'bull' });
      }
    }

    if (riskLabel) {
      items.push({
        id: 'risk',
        text: `${riskLabel} Risk · ${horizonLabel || 'selected horizon'}`,
        tone: riskLabel.toLowerCase().includes('high') ? 'risk' : 'neutral',
      });
    } else if (keyRisks[0]) {
      items.push({ id: 'risk0', text: cleanFactor(keyRisks[0]).slice(0, 64), tone: 'risk' });
    }

    for (const f of bearishFactors.slice(0, 2)) {
      if (items.length >= 7) break;
      const text = cleanFactor(f);
      if (text) items.push({ id: `be-${items.length}`, text: text.slice(0, 64), tone: 'risk' });
    }

    return items.slice(0, 7);
  }, [
    bullishFactors,
    bearishFactors,
    keyRisks,
    technical,
    whaleScore,
    institutionalScore,
    riskLabel,
    horizonLabel,
    keyReasons,
    recommendationTone,
    srSignal,
    srDetail,
  ]);

  const narrative = [horizonLead, fullAnalysis].filter(Boolean).join('\n\n');

  return (
    <GlassCard>
      <SectionLabel icon={<Brain className="w-3.5 h-3.5 text-violet-400" />}>AI Summary</SectionLabel>

      <AnimatePresence mode="wait">
        <motion.div
          key={horizonKey}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.38 }}
        >
          {horizonLead && (
            <p className="mb-3 text-[12px] text-gray-300 leading-relaxed border border-violet-500/20 bg-violet-500/5 rounded-xl px-3 py-2.5">
              {horizonLead}
            </p>
          )}

          {insights.length === 0 ? (
            <p className="text-[12px] text-gray-500">Insights will appear after analysis completes.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {insights.map((ins) => (
                <div
                  key={ins.id}
                  className={cn(
                    'flex items-start gap-2 rounded-xl border px-3 py-2 min-w-0',
                    ins.tone === 'bull' && 'border-emerald-500/20 bg-emerald-500/5',
                    ins.tone === 'risk' && 'border-rose-500/20 bg-rose-500/5',
                    (!ins.tone || ins.tone === 'neutral') && 'border-white/8 bg-white/[0.02]'
                  )}
                >
                  <CheckCircle2
                    className={cn(
                      'w-3.5 h-3.5 shrink-0 mt-0.5',
                      ins.tone === 'bull' && 'text-emerald-400',
                      ins.tone === 'risk' && 'text-rose-400',
                      (!ins.tone || ins.tone === 'neutral') && 'text-sky-400'
                    )}
                  />
                  <span className="text-[12px] text-gray-200 leading-snug break-words">{ins.text}</span>
                </div>
              ))}
            </div>
          )}

          {narrative && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[11px] font-bold text-violet-200 hover:bg-violet-500/15 transition-colors cursor-pointer"
              >
                Read Full AI Analysis
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 rounded-xl border border-white/8 bg-black/30 p-4 max-h-[280px] overflow-y-auto">
                      <p className="text-[12px] text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                        {narrative.replace(/[*_#`~]/g, '')}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </GlassCard>
  );
}
