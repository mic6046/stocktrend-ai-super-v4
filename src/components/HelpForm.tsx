import React, { useEffect, useState } from 'react';
import { LifeBuoy, Loader2, Send, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { HELP_TOPICS, clearHelpHash, openHelpForm, parseHelpHash, type HelpTopic } from '../lib/helpForm';
import { submitHelpRequest } from '../lib/helpFormApi';
import { cn } from '../lib/utils';

export function HelpLink({
  className,
  label = 'Contact support',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => openHelpForm()}
      className={
        className ||
        'text-gray-500 hover:text-emerald-400 underline-offset-2 hover:underline transition-colors cursor-pointer'
      }
    >
      {label}
    </button>
  );
}

export function HelpHost({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(() =>
    typeof window !== 'undefined' ? parseHelpHash() : false
  );

  useEffect(() => {
    const sync = () => setOpen(parseHelpHash());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  return (
    <>
      {children}
      {open && (
        <HelpFormDialog
          onClose={() => {
            clearHelpHash();
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function HelpFormDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const signedInEmail = user?.email || '';
  const [topic, setTopic] = useState<HelpTopic>('how-to');
  const [email, setEmail] = useState(signedInEmail);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (signedInEmail) setEmail(signedInEmail);
  }, [signedInEmail]);

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await submitHelpRequest({
        email,
        topic,
        subject,
        message,
        page: typeof window !== 'undefined' ? window.location.pathname : null,
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'Could not send the help request. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-form-title"
        className="relative w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0c0c0e] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
              <LifeBuoy className="w-4 h-4 text-black" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">
                Quantum Node · Support
              </p>
              <h2 id="help-form-title" className="text-lg font-bold text-white truncate">
                Contact support
              </h2>
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

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {done ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-5 space-y-2">
              <p className="text-[15px] font-bold text-emerald-200">Request sent</p>
              <p className="text-[13px] text-gray-300 leading-relaxed">
                We saved your message to this account. We’ll follow up at{' '}
                <span className="text-white font-medium">{email.trim()}</span>.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 min-h-[40px] rounded-xl bg-emerald-500 px-4 text-[12px] font-bold text-black hover:bg-emerald-400 cursor-pointer"
              >
                Close
              </button>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={(e) => void submit(e)}>
              <p className="text-[12px] text-gray-400 leading-relaxed">
                Ask about billing, sign-in, or how a screen works. For trading decisions, use Analysis —
                this form is for product help only.
              </p>

              <label className="block space-y-1.5">
                <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">Topic</span>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value as HelpTopic)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[13px] text-gray-100 focus:outline-none focus:border-emerald-500/40"
                >
                  {HELP_TOPICS.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  readOnly={Boolean(signedInEmail)}
                  placeholder="you@email.com"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[13px] text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/40 read-only:opacity-80"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">Subject</span>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Short summary"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[13px] text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/40"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">Message</span>
                <textarea
                  required
                  rows={5}
                  maxLength={4000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What happened, which screen, and what you expected…"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-[13px] text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/40 resize-y min-h-[120px]"
                />
              </label>

              {error && (
                <p className="text-[12px] text-rose-300 border border-rose-500/20 bg-rose-500/5 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className={cn(
                  'w-full inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl text-[12px] font-bold uppercase tracking-wider cursor-pointer',
                  busy
                    ? 'bg-white/10 text-gray-500'
                    : 'bg-emerald-500 text-black hover:bg-emerald-400'
                )}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {busy ? 'Sending…' : 'Send help request'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
