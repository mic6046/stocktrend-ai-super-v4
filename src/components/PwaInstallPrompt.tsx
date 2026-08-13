import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'qn-pwa-install-dismissed';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

function isPhoneViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px)').matches || window.matchMedia('(pointer: coarse)').matches;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Soft install prompt for phone users — Android uses native prompt; iOS shows Share guidance. */
export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || !isPhoneViewport()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      /* ignore */
    }

    if (isIos()) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

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
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-emerald-500/25 bg-[#0c0c0e]/95 backdrop-blur-md shadow-[0_-8px_40px_rgba(0,0,0,0.45)] px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-10 w-10 shrink-0 rounded-xl bg-emerald-500 flex items-center justify-center">
            <Download className="h-5 w-5 text-black" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-white tracking-tight">Install Quantum Node</p>
            {iosHint ? (
              <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                Tap <Share className="inline h-3 w-3 text-emerald-400 align-text-bottom" /> Share, then{' '}
                <span className="text-emerald-400">Add to Home Screen</span> for a full-screen app.
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                Add to your home screen for faster launch and a full-screen trading terminal.
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              {!iosHint && deferred && (
                <button
                  type="button"
                  onClick={() => void install()}
                  className="rounded-xl bg-emerald-500 px-3.5 min-h-[40px] inline-flex items-center text-[11px] font-bold uppercase tracking-wide text-black hover:bg-emerald-400 cursor-pointer"
                >
                  Install
                </button>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="rounded-xl border border-white/10 px-3.5 min-h-[40px] inline-flex items-center text-[11px] font-semibold text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-lg p-2 min-h-[40px] min-w-[40px] inline-flex items-center justify-center text-gray-500 hover:text-white cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
