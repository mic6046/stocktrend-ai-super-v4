import React, { useEffect, useState } from 'react';
import { Activity, BookOpen, X } from 'lucide-react';
import {
  MANUAL_SECTIONS,
  MANUAL_UPDATED,
  clearManualHash,
  openUserManual,
  parseManualHash,
} from '../lib/userManual';
import { HelpLink } from './HelpForm';

export function ManualLink({
  className,
  label = 'User Manual',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => openUserManual()}
      className={
        className ||
        'text-gray-500 hover:text-emerald-400 underline-offset-2 hover:underline transition-colors cursor-pointer'
      }
    >
      {label}
    </button>
  );
}

export function ManualHost({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(() =>
    typeof window !== 'undefined' ? parseManualHash() : false
  );

  useEffect(() => {
    const sync = () => setOpen(parseManualHash());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  return (
    <>
      {children}
      {open && (
        <UserManualDialog
          onClose={() => {
            clearManualHash();
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function UserManualDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-title"
        className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0c0c0e] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-black" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">
                Quantum Node · Guide
              </p>
              <h2 id="manual-title" className="text-lg font-bold text-white truncate">
                User Manual
              </h2>
              <p className="text-[10px] text-gray-500">Last updated {MANUAL_UPDATED}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-2 text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-sm text-gray-300">
          <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-emerald-100 text-xs leading-relaxed">
            Short version: search tickers for full AI analysis, use Find/Suggest for ideas, keep names
            on Watchlist, and sign in so watchlist, portfolio, signals, and prefs sync across your
            devices.
          </p>

          <nav className="flex flex-wrap gap-1.5">
            {MANUAL_SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#manual-${s.id}`}
                className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide text-gray-400 hover:text-emerald-300 hover:border-emerald-500/30 cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`manual-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                {s.title}
              </a>
            ))}
          </nav>

          {MANUAL_SECTIONS.map((s) => (
            <section key={s.id} id={`manual-${s.id}`} className="scroll-mt-3">
              <h3 className="text-white font-semibold mb-2 text-[13px] flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                {s.title}
              </h3>
              <ul className="space-y-2">
                {s.body.map((line) => (
                  <li key={line.slice(0, 48)} className="text-[13px] leading-relaxed text-gray-400 pl-3 border-l border-white/10">
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
            <p className="text-[13px] text-gray-300">
              Still stuck?{' '}
              <HelpLink
                className="text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline cursor-pointer"
                label="Send a help request"
              />
              {' '}and we’ll follow up at your account email.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
