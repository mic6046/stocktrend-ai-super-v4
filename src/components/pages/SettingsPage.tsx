import React from 'react';
import { Settings as SettingsIcon, Shield } from 'lucide-react';
import { GlassCard, SectionLabel } from '../analysis/GlassCard';
import { MarketDataRefreshBar } from '../analysis/MarketDataRefreshBar';
import type { MarketDataStatus, RefreshMode, AutoRefreshIntervalSec } from '../../lib/marketDataRefresh';

type SettingsPageProps = {
  lastUpdatedAt: number | null;
  marketDataStatus: MarketDataStatus;
  refreshMode: RefreshMode;
  autoRefreshIntervalSec: AutoRefreshIntervalSec;
  onModeChange: (mode: RefreshMode) => void;
  onIntervalChange: (sec: AutoRefreshIntervalSec) => void;
  onRefresh: () => void;
  disabled?: boolean;
  userEmail?: string | null;
  onSignOut: () => void;
  selfLearningSlot?: React.ReactNode;
  quantTuningSlot?: React.ReactNode;
};

export function SettingsPage({
  lastUpdatedAt,
  marketDataStatus,
  refreshMode,
  autoRefreshIntervalSec,
  onModeChange,
  onIntervalChange,
  onRefresh,
  disabled,
  userEmail,
  onSignOut,
  selfLearningSlot,
  quantTuningSlot,
}: SettingsPageProps) {
  return (
    <div className="space-y-4 min-w-0">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-gray-400">Preferences</p>
        <h2 className="mt-1 text-2xl font-sans font-bold text-white">Settings</h2>
        <p className="mt-1 text-[13px] text-gray-500">
          Market refresh, calibration, and account controls in one place.
        </p>
      </div>

      <GlassCard>
        <SectionLabel icon={<SettingsIcon className="w-3.5 h-3.5 text-emerald-400" />}>
          Market data refresh
        </SectionLabel>
        <div className="mt-3">
          <MarketDataRefreshBar
            lastUpdatedAt={lastUpdatedAt}
            status={marketDataStatus}
            mode={refreshMode}
            intervalSec={autoRefreshIntervalSec}
            onModeChange={onModeChange}
            onIntervalChange={onIntervalChange}
            onRefresh={onRefresh}
            disabled={disabled}
          />
        </div>
      </GlassCard>

      <GlassCard>
        <SectionLabel icon={<Shield className="w-3.5 h-3.5 text-cyan-400" />}>Account</SectionLabel>
        <p className="mt-2 text-[13px] text-gray-300 font-mono">{userEmail || 'Not signed in'}</p>
        {userEmail && (
          <button
            type="button"
            onClick={onSignOut}
            className="mt-3 min-h-[44px] rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 text-[12px] font-bold text-rose-300 hover:bg-rose-500/20 cursor-pointer"
          >
            Sign out
          </button>
        )}
      </GlassCard>

      {quantTuningSlot && (
        <GlassCard>
          <SectionLabel>Quant tuning</SectionLabel>
          <div className="mt-3">{quantTuningSlot}</div>
        </GlassCard>
      )}

      {selfLearningSlot && (
        <GlassCard>
          <SectionLabel>Self-learning / calibration</SectionLabel>
          <p className="mt-1 text-[11px] text-gray-500 mb-3">
            Adjust how much weight the AI gives to trend, smart money, and other factors. Plain language: higher weight = that factor matters more in the score.
          </p>
          <div className="mt-2">{selfLearningSlot}</div>
        </GlassCard>
      )}
    </div>
  );
}
