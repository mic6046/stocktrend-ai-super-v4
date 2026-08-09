import React, { useEffect, useMemo, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { cn } from '../lib/utils';

const DISMISS_KEY = 'qn-install-dismissed-v1';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = (navigator as any).standalone === true;
  return mq || iosStandalone;
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const chrome = /CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit && !chrome;
}

/**
 * Install CTA for PC (Chrome/Edge), Android, and iPhone (Add to Home Screen tip).
 */
export function InstallAppBanner({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [busy, setBusy] = useState(false);

  const alreadyInstalled = useMemo(() => isStandalone(), []);

  useEffect(() => {
    if (alreadyInstalled) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      /* ignore */
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
      setIosHint(false);
    };
    window.addEventListener('beforeinstallprompt', onBip);

    // iPhone / iPad Safari has no beforeinstallprompt — show Add to Home Screen tip
    if (isIosSafari()) {
      setIosHint(true);
      setVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, [alreadyInstalled]);

  if (!visible || alreadyInstalled) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      setVisible(false);
    } catch {
      /* user closed */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        'fixed z-[80] left-3 right-3 sm:left-auto sm:right-4 sm:max-w-sm',
        'bottom-[calc(var(--mobile-dock-h)+0.75rem)] lg:bottom-6',
        'rounded-2xl border border-emerald-500/30 bg-[#0c0c0e]/95 backdrop-blur-xl shadow-2xl',
        'px-4 py-3 flex items-start gap-3',
        className
      )}
      role="dialog"
      aria-label="Install Quantum Node"
    >
      <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-[0_0_18px_rgba(16,185,129,0.35)]">
        <Download className="w-5 h-5 text-black" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold text-white tracking-wide">Install Quantum Node</p>
        {iosHint ? (
          <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">
            On iPhone: tap <Share className="inline w-3.5 h-3.5 text-sky-300 align-text-bottom" /> Share, then{' '}
            <span className="text-emerald-300 font-semibold">Add to Home Screen</span>.
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">
            Add to your PC, Android, or desktop for a full-screen app shortcut.
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap gap-2">
          {!iosHint && deferred && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void install()}
              className="touch-manipulation min-h-10 rounded-xl bg-emerald-500 px-3.5 text-[11px] font-bold uppercase tracking-wider text-black hover:bg-emerald-400 disabled:opacity-60"
            >
              {busy ? 'Opening…' : 'Install'}
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="touch-manipulation min-h-10 rounded-xl border border-white/10 px-3.5 text-[11px] font-semibold text-gray-300 hover:bg-white/5"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="touch-target touch-manipulation rounded-lg p-1.5 text-gray-500 hover:text-white shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
