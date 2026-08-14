import React from 'react';
import { cn } from '../../lib/utils';

type GlassCardProps = {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
};

const padMap = {
  none: 'p-0',
  sm: 'p-3 sm:p-3.5',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
};

export function GlassCard({
  children,
  className,
  hover = true,
  glow = false,
  padding = 'md',
}: GlassCardProps) {
  return (
    <div
      className={cn(
        'glass-panel rounded-2xl border border-white/10 bg-[color:var(--qn-bg-panel-solid)]/85 backdrop-blur-xl',
        'shadow-[0_8px_40px_var(--qn-shadow)]',
        hover && 'transition-all duration-300 hover:border-white/15 hover:-translate-y-0.5',
        glow && 'neon-glow',
        padMap[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

export function SectionLabel({
  icon,
  children,
  className,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2 mb-3 min-w-0', className)}>
      {icon}
      <h3 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-gray-300 font-mono truncate">
        {children}
      </h3>
    </div>
  );
}
