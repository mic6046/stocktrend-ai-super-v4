import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, RotateCcw, Save } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ModelWeights = {
  trend: number;
  smartMoney: number;
  volume: number;
  momentum: number;
  fundamentals: number;
  earnings: number;
  sentiment: number;
  catalyst: number;
  capitalPreservation: number;
};

export const DEFAULT_MODEL_WEIGHTS: ModelWeights = {
  trend: 15,
  smartMoney: 20,
  volume: 10,
  momentum: 10,
  fundamentals: 15,
  earnings: 10,
  sentiment: 5,
  catalyst: 5,
  capitalPreservation: 10,
};

type SelfLearningSettingsProps = {
  weights: ModelWeights;
  onSave: (weights: ModelWeights) => void | Promise<void>;
};

function weightsEqual(a: ModelWeights, b: ModelWeights): boolean {
  return (Object.keys(a) as (keyof ModelWeights)[]).every((k) => a[k] === b[k]);
}

export function SelfLearningSettings({ weights, onSave }: SelfLearningSettingsProps) {
  const [draft, setDraft] = useState<ModelWeights>(weights);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setDraft(weights);
  }, [weights]);

  const dirty = useMemo(() => !weightsEqual(draft, weights), [draft, weights]);
  const sum = useMemo(
    () => (Object.keys(draft) as (keyof ModelWeights)[]).reduce((s, k) => s + (Number(draft[k]) || 0), 0),
    [draft]
  );

  const handleSave = async () => {
    setSaving(true);
    setSavedFlash(false);
    try {
      await onSave(draft);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setDraft({ ...DEFAULT_MODEL_WEIGHTS });
  };

  const handleRebalance = () => {
    const total = sum || 1;
    const scale = 100 / total;
    const keys = Object.keys(draft) as (keyof ModelWeights)[];
    const next = { ...draft };
    let allocated = 0;
    keys.forEach((k, i) => {
      if (i === keys.length - 1) {
        next[k] = Math.max(0, 100 - allocated);
      } else {
        const v = Math.round((Number(draft[k]) || 0) * scale);
        next[k] = v;
        allocated += v;
      }
    });
    setDraft(next);
  };

  return (
    <div className="space-y-3">
      {(Object.keys(draft) as (keyof ModelWeights)[]).map((key) => (
        <label key={String(key)} className="block">
          <div className="flex justify-between text-[11px] text-gray-400 mb-1">
            <span className="capitalize">{String(key).replace(/([A-Z])/g, ' $1')}</span>
            <span className="font-mono text-emerald-300">{draft[key]}</span>
          </div>
          <input
            type="range"
            min={0}
            max={40}
            value={draft[key]}
            onChange={(e) => {
              const value = Number(e.target.value);
              setDraft((prev) => ({ ...prev, [key]: value }));
            }}
            className="w-full"
          />
        </label>
      ))}

      <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
        <span>
          Total allocation:{' '}
          <span className={cn('font-mono', sum === 100 ? 'text-emerald-400' : 'text-amber-300')}>{sum}</span>
          {sum !== 100 ? ' (ideal 100)' : ''}
        </span>
        {dirty && <span className="text-amber-300/90">Unsaved changes</span>}
      </div>

      <p className="text-[11px] text-gray-500">
        Higher weight = that factor matters more in the AI score. Click Save to apply on the next analysis.
      </p>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void handleSave()}
          className={cn(
            'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-4 text-[12px] font-bold cursor-pointer disabled:opacity-50',
            savedFlash
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-emerald-500 text-black hover:bg-emerald-400'
          )}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : savedFlash ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {saving ? 'Saving…' : savedFlash ? 'Saved' : 'Save'}
        </button>
        <button
          type="button"
          onClick={handleRebalance}
          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-[12px] font-medium text-gray-300 hover:bg-white/10 cursor-pointer"
        >
          Balance to 100
        </button>
        <button
          type="button"
          onClick={handleResetDefaults}
          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-transparent px-3 text-[12px] font-medium text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Defaults
        </button>
      </div>
    </div>
  );
}
