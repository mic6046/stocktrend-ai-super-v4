import React from 'react';
import { Bell, Plus, Trash2, Volume2, BellRing } from 'lucide-react';
import { GlassCard, SectionLabel } from '../analysis/GlassCard';
import { cn } from '../../lib/utils';

export type AlertRow = {
  id: string;
  ticker: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  isTriggered?: boolean;
  triggeredAt?: number | string | null;
};

type AlertsPageProps = {
  alerts: AlertRow[];
  alertTicker: string;
  setAlertTicker: (v: string) => void;
  alertTargetPrice: string;
  setAlertTargetPrice: (v: string) => void;
  alertCondition: 'ABOVE' | 'BELOW';
  setAlertCondition: (v: 'ABOVE' | 'BELOW') => void;
  priceAlertSound: string;
  setPriceAlertSound: (v: string) => void;
  playAlertSound: (id: string) => void;
  onAddAlert: (e: React.FormEvent) => void;
  onDeleteAlert: (id: string) => void;
  onClearTriggered: () => void;
  autoAlertRsiDivergence: boolean;
  setAutoAlertRsiDivergence: (v: boolean) => void;
  currentTicker?: string | null;
  currentPrice?: number | null;
  onOpenTicker: (ticker: string) => void;
};

export function AlertsPage({
  alerts,
  alertTicker,
  setAlertTicker,
  alertTargetPrice,
  setAlertTargetPrice,
  alertCondition,
  setAlertCondition,
  priceAlertSound,
  setPriceAlertSound,
  playAlertSound,
  onAddAlert,
  onDeleteAlert,
  onClearTriggered,
  autoAlertRsiDivergence,
  setAutoAlertRsiDivergence,
  currentTicker,
  currentPrice,
  onOpenTicker,
}: AlertsPageProps) {
  const active = alerts.filter((a) => !a.isTriggered);
  const triggered = alerts.filter((a) => a.isTriggered);

  return (
    <div className="space-y-4 min-w-0">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-400">Notifications</p>
        <h2 className="mt-1 text-2xl font-sans font-bold text-white">Alerts</h2>
        <p className="mt-1 text-[13px] text-gray-500 max-w-2xl">
          Get notified when price enters a level you care about — for example, when a stock enters your buy zone.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <SectionLabel icon={<Plus className="w-3.5 h-3.5 text-cyan-400" />}>New price alert</SectionLabel>
          <form onSubmit={onAddAlert} className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-left">
                <span className="text-[10px] uppercase text-gray-500">Ticker</span>
                <input
                  value={alertTicker}
                  onChange={(e) => setAlertTicker(e.target.value.toUpperCase())}
                  placeholder={currentTicker || 'NVDA'}
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#111113] px-3 text-base text-white font-mono focus:outline-none focus:border-cyan-500/50"
                  required
                />
              </label>
              <label className="block text-left">
                <span className="text-[10px] uppercase text-gray-500">Target $</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={alertTargetPrice}
                  onChange={(e) => setAlertTargetPrice(e.target.value)}
                  placeholder={currentPrice != null ? String(currentPrice.toFixed(2)) : 'Price'}
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#111113] px-3 text-base text-white font-mono focus:outline-none focus:border-cyan-500/50"
                  required
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-left">
                <span className="text-[10px] uppercase text-gray-500">Condition</span>
                <select
                  value={alertCondition}
                  onChange={(e) => setAlertCondition(e.target.value as 'ABOVE' | 'BELOW')}
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#111113] px-3 text-sm text-gray-200 cursor-pointer"
                >
                  <option value="ABOVE">Price goes ABOVE</option>
                  <option value="BELOW">Price goes BELOW</option>
                </select>
              </label>
              <label className="block text-left">
                <span className="text-[10px] uppercase text-gray-500">Sound</span>
                <div className="mt-1 flex gap-2">
                  <select
                    value={priceAlertSound}
                    onChange={(e) => {
                      setPriceAlertSound(e.target.value);
                      playAlertSound(e.target.value);
                    }}
                    className="flex-1 min-h-[44px] rounded-xl border border-white/10 bg-[#111113] px-3 text-sm text-cyan-300 cursor-pointer"
                  >
                    <option value="classic">Classic</option>
                    <option value="double_beep">Beeps</option>
                    <option value="scifi">Sci-fi</option>
                    <option value="warning">Warning</option>
                    <option value="arpeggio">Arpeggio</option>
                    <option value="cosmic">Cosmic</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => playAlertSound(priceAlertSound)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-cyan-400 cursor-pointer"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>
              </label>
            </div>
            <button
              type="submit"
              className="w-full min-h-[48px] rounded-xl bg-cyan-500 text-black font-bold text-[12px] uppercase tracking-wide hover:bg-cyan-400 cursor-pointer"
            >
              Create alert
            </button>
          </form>
          <label className="mt-4 flex items-center gap-2 text-[12px] text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoAlertRsiDivergence}
              onChange={(e) => setAutoAlertRsiDivergence(e.target.checked)}
              className="rounded border-white/20"
            />
            Also watch for RSI divergence (technical reversal hint)
          </label>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between gap-2">
            <SectionLabel icon={<Bell className="w-3.5 h-3.5 text-cyan-400" />}>
              Active ({active.length})
            </SectionLabel>
            {triggered.length > 0 && (
              <button
                type="button"
                onClick={onClearTriggered}
                className="text-[11px] text-amber-300 hover:underline cursor-pointer"
              >
                Clear triggered ({triggered.length})
              </button>
            )}
          </div>
          <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto">
            {!alerts.length && (
              <p className="text-[13px] text-gray-500 text-center py-8">No alerts yet.</p>
            )}
            {alerts.map((a) => (
              <div
                key={a.id}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2.5',
                  a.isTriggered
                    ? 'border-amber-500/30 bg-amber-500/10'
                    : 'border-white/10 bg-black/30'
                )}
              >
                {a.isTriggered ? (
                  <BellRing className="h-4 w-4 text-amber-300 shrink-0" />
                ) : (
                  <Bell className="h-4 w-4 text-cyan-400 shrink-0" />
                )}
                <button
                  type="button"
                  onClick={() => onOpenTicker(a.ticker)}
                  className="font-mono font-bold text-white text-[13px] hover:text-emerald-400 cursor-pointer"
                >
                  {a.ticker}
                </button>
                <span className="text-[11px] text-gray-400 flex-1">
                  {a.condition} ${a.targetPrice.toFixed(2)}
                  {a.isTriggered ? ' · triggered' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteAlert(a.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:text-rose-400 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard padding="sm" className="border-white/5">
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Common alerts: <span className="text-gray-300">Entered Buy Zone</span>, breakout levels, unusual volume
          reactions, and AI signal changes — start with a simple price target, then refine after you review Analysis.
        </p>
      </GlassCard>
    </div>
  );
}
