import React from 'react';
import { cn } from '../../lib/utils';
import type { UniverseName } from '../../lib/suggestTradeUniverses';

type UniverseNameChipsProps = {
  names: UniverseName[];
  className?: string;
};

/** Curated ticker + company name chips that follow the selected market. */
export function UniverseNameChips({ names, className }: UniverseNameChipsProps) {
  if (!names.length) return null;
  return (
    <div className={cn('flex flex-wrap gap-1.5 max-h-28 overflow-y-auto', className)}>
      {names.map((u) => (
        <span
          key={u.ticker}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/30 px-2 py-1"
        >
          <span className="text-[10px] font-bold font-mono text-white">{u.ticker}</span>
          <span className="text-[10px] text-gray-400 truncate max-w-[9rem]">{u.name}</span>
        </span>
      ))}
    </div>
  );
}
