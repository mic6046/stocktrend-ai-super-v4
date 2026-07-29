import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

type AnimatedNumberProps = {
  value: number | null | undefined;
  format?: (n: number) => string;
  className?: string;
  durationMs?: number;
  /** Remount key — typically the active horizon */
  resetKey?: string | number;
};

/** Smooth count-up/down when numeric values change with the Investment Horizon. */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  className,
  durationMs = 420,
  resetKey,
}: AnimatedNumberProps) {
  const target = value != null && Number.isFinite(value) ? value : null;
  const [display, setDisplay] = useState<number | null>(target);

  useEffect(() => {
    if (target == null) {
      setDisplay(null);
      return;
    }
    const from = display != null && Number.isFinite(display) ? display : target;
    if (Math.abs(from - target) < 1e-9) {
      setDisplay(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate from last displayed value
  }, [target, durationMs, resetKey]);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={`${resetKey ?? ''}-${target == null ? 'na' : 'n'}`}
        initial={{ opacity: 0.35, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0.2, y: -3 }}
        transition={{ duration: 0.28 }}
        className={className}
      >
        {display == null ? '—' : format(display)}
      </motion.span>
    </AnimatePresence>
  );
}
