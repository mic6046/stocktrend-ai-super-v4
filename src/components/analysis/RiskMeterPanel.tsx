import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield } from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassCard, SectionLabel } from './GlassCard';
import { formatPct, type HorizonKey } from './analysisTheme';
import { AnimatedNumber } from './AnimatedNumber';

type RiskMeterPanelProps = {
  riskScore: number; // 0-100 higher = riskier
  riskLabel?: string;
  volatility?: number | null;
  liquidityLabel?: string;
  drawdown?: number | null;
  sharpe?: number | null;
  horizon?: HorizonKey;
  horizonLabel?: string;
};

export function RiskMeterPanel({
  riskScore,
  riskLabel,
  volatility,
  liquidityLabel = 'Moderate',
  drawdown,
  sharpe,
  horizon = '1M',
  horizonLabel = '1 Month',
}: RiskMeterPanelProps) {
  const clamped = Math.min(100, Math.max(0, riskScore));
  const label =
    riskLabel ||
    (clamped >= 70 ? 'High' : clamped >= 40 ? 'Medium' : 'Low');

  const barColor =
    clamped >= 70 ? 'bg-rose-500' : clamped >= 40 ? 'bg-amber-400' : 'bg-emerald-400';

  return (
    <GlassCard className="h-full">
      <SectionLabel icon={<Shield className="w-3.5 h-3.5 text-amber-400" />}>Risk Meter</SectionLabel>
      <p className="mb-3 text-[10px] font-mono uppercase tracking-wider text-gray-500">
        Calibrated to {horizonLabel}
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={horizon}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.38 }}
        >
          <div className="mb-4">
            <div className="flex items-end justify-between gap-2 mb-2">
              <p className="text-[10px] uppercase tracking-wider text-gray-500">Risk Level</p>
              <p
                className={cn(
                  'font-display text-xl font-bold',
                  clamped >= 70 ? 'text-rose-400' : clamped >= 40 ? 'text-amber-400' : 'text-emerald-400'
                )}
              >
                {label}
              </p>
            </div>
            <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden border border-white/10">
              <motion.div
                className={cn('h-full rounded-full', barColor)}
                initial={{ width: 0 }}
                animate={{ width: `${clamped}%` }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              />
            </div>
            <p className="mt-1.5 text-[10px] font-mono text-gray-500 tabular-nums">
              <AnimatedNumber value={clamped} resetKey={horizon} durationMs={420} format={(n) => String(Math.round(n))} />
              {' / 100'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <MetricChip
              label="Volatility"
              value={
                volatility != null ? (
                  <AnimatedNumber
                    value={volatility}
                    resetKey={horizon}
                    durationMs={420}
                    format={(n) => `${n.toFixed(1)}%`}
                  />
                ) : (
                  '—'
                )
              }
            />
            <MetricChip label="Liquidity" value={liquidityLabel} />
            <MetricChip
              label="Drawdown"
              value={
                drawdown != null ? (
                  <AnimatedNumber
                    value={drawdown}
                    resetKey={horizon}
                    durationMs={420}
                    format={(n) => formatPct(n)}
                  />
                ) : (
                  '—'
                )
              }
              danger={drawdown != null && drawdown < 0}
            />
            <MetricChip
              label="Sharpe Ratio"
              value={
                sharpe != null ? (
                  <AnimatedNumber
                    value={sharpe}
                    resetKey={horizon}
                    durationMs={420}
                    format={(n) => n.toFixed(2)}
                  />
                ) : (
                  '—'
                )
              }
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </GlassCard>
  );
}

function MetricChip({
  label,
  value,
  danger,
}: {
  label: string;
  value: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/30 px-2.5 py-2 min-w-0">
      <p className="text-[8px] uppercase tracking-wider text-gray-500">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-[13px] font-bold font-mono tabular-nums break-words leading-tight',
          danger ? 'text-rose-400' : 'text-white'
        )}
      >
        {value}
      </p>
    </div>
  );
}
