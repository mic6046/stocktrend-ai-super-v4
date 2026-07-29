import React, { useEffect, useState } from 'react';
import { Activity, X } from 'lucide-react';
import {
  LEGAL_SECTIONS,
  LEGAL_TITLES,
  LEGAL_UPDATED,
  clearLegalHash,
  openLegalDoc,
  parseLegalHash,
  type LegalDocId,
} from '../lib/legal';
import { cn } from '../lib/utils';

export function LegalLinks({
  className,
  linkClassName,
}: {
  className?: string;
  linkClassName?: string;
}) {
  const link =
    linkClassName ||
    'text-gray-500 hover:text-emerald-400 underline-offset-2 hover:underline transition-colors cursor-pointer';
  return (
    <nav className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-sans', className)}>
      {(['risk', 'terms', 'privacy'] as LegalDocId[]).map((id) => (
        <button key={id} type="button" className={link} onClick={() => openLegalDoc(id)}>
          {LEGAL_TITLES[id]}
        </button>
      ))}
    </nav>
  );
}

export function LegalHost({ children }: { children: React.ReactNode }) {
  const [doc, setDoc] = useState<LegalDocId | null>(() =>
    typeof window !== 'undefined' ? parseLegalHash() : null
  );

  useEffect(() => {
    const sync = () => setDoc(parseLegalHash());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  return (
    <>
      {children}
      {doc && (
        <LegalPage
          doc={doc}
          onClose={() => {
            clearLegalHash();
            setDoc(null);
          }}
          onNavigate={(next) => {
            openLegalDoc(next);
            setDoc(next);
          }}
        />
      )}
    </>
  );
}

function LegalPage({
  doc,
  onClose,
  onNavigate,
}: {
  doc: LegalDocId;
  onClose: () => void;
  onNavigate: (id: LegalDocId) => void;
}) {
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

  const sections = LEGAL_SECTIONS[doc];

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-title"
        className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0c0c0e] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-black" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">
                Quantum Node · Legal
              </p>
              <h2 id="legal-title" className="text-lg font-bold text-white truncate">
                {LEGAL_TITLES[doc]}
              </h2>
              <p className="text-[10px] text-gray-500">Last updated {LEGAL_UPDATED}</p>
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

        <div className="flex gap-1 px-4 pt-3 shrink-0 overflow-x-auto">
          {(['risk', 'terms', 'privacy'] as LegalDocId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[10px] font-sans font-semibold uppercase tracking-wide whitespace-nowrap cursor-pointer',
                doc === id
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent'
              )}
            >
              {LEGAL_TITLES[id]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-sm text-gray-300">
          {doc === 'risk' && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-100 text-xs leading-relaxed">
              Short version: Quantum Node is an analysis tool, not a financial adviser. Markets involve
              risk. AI and market data can be wrong. You alone own your decisions.
            </p>
          )}
          {sections.map((s) => (
            <section key={s.heading}>
              <h3 className="text-white font-semibold mb-2 text-[13px]">{s.heading}</h3>
              <div className="space-y-2 text-[13px] leading-relaxed text-gray-400">
                {s.body.map((p) => (
                  <p key={p.slice(0, 48)}>{p}</p>
                ))}
              </div>
            </section>
          ))}
          <p className="text-[11px] text-gray-600 pt-2 border-t border-white/5">
            This text is a plain-language product notice, not a substitute for advice from a licensed
            lawyer. Have counsel review before large-scale commercial launch.
          </p>
        </div>

        <div className="shrink-0 border-t border-white/10 px-5 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-400 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
