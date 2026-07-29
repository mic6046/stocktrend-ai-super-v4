import React from 'react';
import { motion } from 'motion/react';
import { Activity } from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassCard, SectionLabel } from './GlassCard';

type RadialMetric = {
  id: string;
  label: string;
  value: number;
  accent: string;
};

type MetricRadialRowProps = {
  metrics: RadialMetric[];
};

function MiniRadial({ label, value, accent }: { label: string; value: number; accent: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  return (
    <div className="flex flex-col items-center min-w-0 px-1">
      <div className="relative w-[76px] h-[76px]">
        <svg viewBox="0 0 76 76" className="w-full h-full -rotate-90">
          <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <motion.circle
            cx="38"
            cy="38"
            r={r}
            fill="none"
            stroke={accent}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-[15px] font-bold text-white tabular-nums">{Math.round(clamped)}</span>
        </div>
      </div>
      <p className="mt-1.5 text-[9px] uppercase tracking-wider text-gray-400 text-center leading-tight">{label}</p>
    </div>
  );
}

export function MetricRadialRow({ metrics }: MetricRadialRowProps) {
  const list = metrics.filter((m) => Number.isFinite(m.value));

  if (!list.length) return null;

  return (
    <GlassCard>
      <SectionLabel icon={<Activity className="w-3.5 h-3.5 text-cyan-400" />}>AI Confidence Gauges</SectionLabel>
      <div className={cn('flex flex-wrap justify-around gap-y-4 gap-x-2')}>
        {list.map((m) => (
          <MiniRadial key={m.id} label={m.label} value={m.value} accent={m.accent} />
        ))}
      </div>
    </GlassCard>
  );
}
