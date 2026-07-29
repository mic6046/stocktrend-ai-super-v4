import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

type FitTextProps = {
  children: React.ReactNode;
  className?: string;
  maxPx?: number;
  minPx?: number;
  maxLines?: number;
  as?: 'p' | 'span' | 'div' | 'h3' | 'h4';
};

/**
 * Auto-sizes text to fit its container width.
 * Priority: shrink font → grow height / wrap (up to maxLines) → never overflow.
 */
export function FitText({
  children,
  className,
  maxPx = 22,
  minPx = 10,
  maxLines = 2,
  as: Tag = 'p',
}: FitTextProps) {
  const boxRef = useRef<HTMLElement>(null);
  const [fontSize, setFontSize] = useState(maxPx);
  const [wrapped, setWrapped] = useState(false);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    const fit = () => {
      const width = el.clientWidth;
      if (width <= 0) return;

      let size = maxPx;
      let useWrap = false;
      el.style.fontSize = `${size}px`;
      el.style.whiteSpace = 'nowrap';
      el.style.display = 'block';
      el.style.webkitLineClamp = '';
      el.style.overflow = 'visible';

      while (size > minPx && el.scrollWidth > width + 0.5) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }

      if (el.scrollWidth > width + 0.5 && maxLines > 1) {
        useWrap = true;
        el.style.whiteSpace = 'normal';
        el.style.wordBreak = 'normal';
        el.style.overflowWrap = 'break-word';
        const lineH = size * 1.2;
        while (size > minPx && el.scrollHeight > lineH * maxLines + 2) {
          size -= 0.5;
          el.style.fontSize = `${size}px`;
        }
      }

      setFontSize(size);
      setWrapped(useWrap);
    };

    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [children, maxPx, minPx, maxLines]);

  return (
    <Tag
      ref={boxRef as any}
      className={cn(
        'w-full min-w-0 max-w-full leading-tight',
        wrapped ? 'whitespace-normal break-words overflow-visible' : 'whitespace-nowrap overflow-hidden',
        className
      )}
      style={{ fontSize: `${fontSize}px` }}
    >
      {children}
    </Tag>
  );
}

/** Split at word boundaries only — never mid-word. First word / remainder. */
export function splitStatusLabel(label: string): { line1: string; line2: string } {
  const parts = label.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (parts.length === 0) return { line1: '', line2: '' };
  if (parts.length === 1) return { line1: '', line2: parts[0] };
  return { line1: parts[0], line2: parts.slice(1).join(' ') };
}

export type StatusVisual = {
  icon: string;
  text: string;
  bg: string;
  border: string;
  glow: string;
  dot: string;
};

/** Color + icon rules for valuation / recommendation statuses */
export function resolveStatusVisual(label: string): StatusVisual {
  const s = label.trim().toLowerCase();

  if (s.includes('deeply undervalued')) {
    return {
      icon: '🟢',
      text: 'text-emerald-600',
      bg: 'bg-emerald-950/45',
      border: 'border-emerald-700/45',
      glow: 'shadow-[0_0_20px_rgba(5,150,105,0.14)]',
      dot: 'bg-emerald-700',
    };
  }
  if (s.includes('exceptional') || s.includes('strong buy') || s.includes('very strong')) {
    return {
      icon: '🟢',
      text: 'text-emerald-300',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-400/40',
      glow: 'shadow-[0_0_22px_rgba(52,211,153,0.2)]',
      dot: 'bg-emerald-300',
    };
  }
  if (s === 'buy' || s === 'undervalued') {
    return {
      icon: '🟢',
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      glow: 'shadow-[0_0_16px_rgba(16,185,129,0.12)]',
      dot: 'bg-emerald-400',
    };
  }
  if (s.includes('fair') || s === 'hold' || s.includes('neutral')) {
    return {
      icon: '🔵',
      text: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/30',
      glow: 'shadow-[0_0_16px_rgba(34,211,238,0.12)]',
      dot: 'bg-cyan-400',
    };
  }
  if (s.includes('slightly') || s === 'reduce') {
    return {
      icon: '🟡',
      text: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      glow: 'shadow-[0_0_16px_rgba(251,146,60,0.12)]',
      dot: 'bg-orange-400',
    };
  }
  if (s.includes('strong sell') || s.includes('avoid')) {
    return {
      icon: '🔴',
      text: 'text-red-600',
      bg: 'bg-red-950/45',
      border: 'border-red-700/45',
      glow: 'shadow-[0_0_20px_rgba(220,38,38,0.16)]',
      dot: 'bg-red-700',
    };
  }
  if (s === 'sell' || s.includes('overvalued')) {
    return {
      icon: '🔴',
      text: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30',
      glow: 'shadow-[0_0_16px_rgba(244,63,94,0.12)]',
      dot: 'bg-rose-400',
    };
  }

  return {
    icon: '🔵',
    text: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    glow: 'shadow-[0_0_12px_rgba(56,189,248,0.1)]',
    dot: 'bg-sky-400',
  };
}

type StatusBadgeCardProps = {
  /** Full status label, e.g. "Deeply Undervalued" / "Strong Buy" */
  label: string;
  /** Optional eyebrow above the badge stack */
  title?: string;
  /** Override emoji; otherwise derived from label */
  icon?: string;
  className?: string;
  /** sm = meter tiles, md = strip cards, lg = recommendation hero */
  size?: 'sm' | 'md' | 'lg';
  visual?: Partial<StatusVisual>;
};

/**
 * Premium two-line status badge:
 *   🟢
 * Deeply
 * Undervalued
 */
export function StatusBadgeCard({
  label,
  title,
  icon,
  className,
  size = 'md',
  visual: visualOverride,
}: StatusBadgeCardProps) {
  const visual = { ...resolveStatusVisual(label), ...visualOverride };
  const { line1, line2 } = splitStatusLabel(label);
  const emoji = icon ?? visual.icon;

  const pad =
    size === 'lg' ? 'px-4 py-4 min-h-[112px]' : size === 'sm' ? 'px-2.5 py-3 min-h-[92px]' : 'px-3 py-3.5 min-h-[100px]';
  const iconSize = size === 'lg' ? 'text-[22px]' : size === 'sm' ? 'text-[15px]' : 'text-[18px]';
  const line1Size = size === 'lg' ? 'text-[12px] sm:text-[13px]' : size === 'sm' ? 'text-[10px]' : 'text-[11px]';
  const line2Size =
    size === 'lg' ? 'text-[17px] sm:text-[19px]' : size === 'sm' ? 'text-[13px]' : 'text-[14px] sm:text-[15px]';

  return (
    <div
      className={cn(
        'rounded-xl border w-full min-w-0 overflow-hidden flex flex-col items-stretch justify-center transition-colors duration-300',
        pad,
        visual.bg,
        visual.border,
        visual.glow,
        className
      )}
    >
      {title && (
        <p className="text-[8px] font-mono uppercase tracking-wider text-gray-500 text-center mb-2 leading-none shrink-0">
          {title}
        </p>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={label}
          initial={{ opacity: 0, scale: 0.94, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -4 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center justify-center text-center gap-1.5 min-w-0 w-full"
        >
          <span className={cn('leading-none select-none drop-shadow-sm', iconSize)} aria-hidden>
            {emoji}
          </span>

          <div className={cn('flex flex-col items-center justify-center min-w-0 w-full px-0.5', visual.text)}>
            {line1 ? (
              <>
                <span
                  className={cn(
                    'font-semibold tracking-wide leading-tight max-w-full text-center whitespace-normal break-keep',
                    line1Size,
                    'opacity-90'
                  )}
                >
                  {line1}
                </span>
                <span
                  className={cn(
                    'font-bold tracking-tight leading-tight max-w-full text-center whitespace-normal break-keep mt-0.5',
                    line2Size
                  )}
                >
                  {line2}
                </span>
              </>
            ) : (
              <span
                className={cn(
                  'font-bold tracking-tight leading-tight max-w-full text-center whitespace-normal break-keep',
                  line2Size
                )}
              >
                {line2}
              </span>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** @deprecated Prefer StatusBadgeCard — kept for call-site compatibility */
export function StatusLabelCard({
  title,
  label,
  icon,
  className,
}: {
  title?: string;
  label: string;
  icon?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  labelClassName?: string;
  maxPx?: number;
  minPx?: number;
}) {
  return (
    <StatusBadgeCard
      title={title}
      label={label}
      icon={typeof icon === 'string' ? icon : undefined}
      className={className}
      size="sm"
    />
  );
}

type HeroLabelProps = {
  children: React.ReactNode;
  className?: string;
  maxPx?: number;
  minPx?: number;
};

/** Large recommendation / rating hero that never overflows its card. */
export function HeroLabel({ children, className }: HeroLabelProps) {
  const text = typeof children === 'string' ? children : String(children ?? '');
  if (text.trim()) {
    return <StatusBadgeCard label={text} size="lg" className={className} />;
  }
  return null;
}
