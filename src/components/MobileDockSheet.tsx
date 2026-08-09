import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

type MobileDockSheetProps = {
  open: boolean;
  title: string;
  accentClassName?: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
};

function useIsPhoneSheet() {
  const [isPhone, setIsPhone] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isPhone;
}

/**
 * Phone/tablet: full-width bottom sheet with scroll lock + safe-area.
 * Desktop (lg+): inline block so docks stay in the dashboard flow.
 * Children mount once (no dual state).
 */
export function MobileDockSheet({
  open,
  title,
  accentClassName = 'text-emerald-400',
  onClose,
  children,
  className,
}: MobileDockSheetProps) {
  const isPhone = useIsPhoneSheet();

  useEffect(() => {
    if (!open || !isPhone) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, isPhone, onClose]);

  if (!open) return null;

  if (!isPhone) {
    return <div className={cn('mb-6', className)}>{children}</div>;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px] touch-manipulation"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative w-full max-h-[min(88dvh,88vh)] flex flex-col rounded-t-2xl border border-white/10 bg-[#0c0c0e] shadow-2xl',
          'pb-[env(safe-area-inset-bottom)] overscroll-contain',
          className
        )}
      >
        <div className="relative flex items-center justify-between gap-3 px-4 pt-4 pb-2 border-b border-white/8 shrink-0">
          <div
            className="absolute left-1/2 -translate-x-1/2 top-2 w-9 h-1 rounded-full bg-white/20"
            aria-hidden
          />
          <p className={cn('text-[11px] font-sans font-bold uppercase tracking-wider truncate pt-1', accentClassName)}>
            {title}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="touch-target touch-manipulation rounded-xl border border-white/10 p-2 text-gray-400 hover:text-white hover:bg-white/5"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}
