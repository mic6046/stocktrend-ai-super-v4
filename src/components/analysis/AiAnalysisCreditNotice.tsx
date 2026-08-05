import React from 'react';
import { Coins } from 'lucide-react';
import { cn } from '../../lib/utils';

/** Reminder: Find a Trade / Suggest a Trade = AI analysis, −1 credit per scan. */
export function AiAnalysisCreditNotice({
  feature = 'Find a Trade',
  className,
}: {
  feature?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex items-start gap-2',
        className
      )}
    >
      <Coins className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
      <p className="text-[11px] text-amber-100/95 leading-relaxed">
        <span className="font-semibold text-amber-200">{feature}</span> is AI analysis and deducts{' '}
        <span className="font-semibold text-amber-200">1 analysis credit</span> per scan (same daily
        quota as stock search). Make sure you have credits remaining before you run it.
      </p>
    </div>
  );
}
