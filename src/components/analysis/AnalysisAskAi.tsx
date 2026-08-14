import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  postAssistantChat,
  type AssistantChatContext,
  type AssistantChatMessage,
} from '../../lib/assistantChatApi';
import type { UsageSnapshot } from '../../lib/usageApi';

type AnalysisAskAiProps = {
  userEmail?: string | null;
  onSignIn: () => void;
  chatContext: AssistantChatContext;
  onUsageUpdate?: (usage: UsageSnapshot) => void;
  ticker?: string | null;
};

const MAX_VISIBLE = 8;

export function AnalysisAskAi({
  userEmail,
  onSignIn,
  chatContext,
  onUsageUpdate,
  ticker,
}: AnalysisAskAiProps) {
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMessages([]);
    setDraft('');
    setError(null);
  }, [ticker]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    if (!userEmail) {
      onSignIn();
      return;
    }

    setError(null);
    setDraft('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setSending(true);

    try {
      const result = await postAssistantChat({
        email: userEmail,
        message: text,
        context: chatContext,
        history: messages,
      });
      if (result.usage && onUsageUpdate) onUsageUpdate(result.usage);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: result.reply || 'No reply.' },
      ]);
    } catch (e: any) {
      if (e?.usage && onUsageUpdate) onUsageUpdate(e.usage);
      const msg =
        typeof e?.message === 'string' && e.message
          ? e.message
          : 'Failed to reach the assistant.';
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            e?.code === 'analysis_quota_exceeded' || msg.includes('usage is out')
              ? `${msg}\nNot financial advice.`
              : `Could not reply: ${msg}\nNot financial advice.`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const visible = messages.slice(-MAX_VISIBLE);
  const sym = ticker || chatContext.ticker || 'this ticker';

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-[#0c0c0e]/95 overflow-hidden flex flex-col min-h-0 shadow-[0_0_28px_rgba(16,185,129,0.08)]">
      <div className="px-4 py-3 border-b border-white/5 flex items-start gap-3">
        <div className="mt-0.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 shrink-0">
          <MessageCircle className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400">
            Ask AI · Analysis
          </p>
          <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
            Questions about {String(sym).toUpperCase()}
          </h3>
          <p className="mt-0.5 text-[11px] text-gray-500 leading-snug">
            Uses this page’s score, action, RSI/MACD, risk, and outlook. Each question uses 1 analysis credit.
          </p>
        </div>
      </div>

      <div
        ref={listRef}
        className="h-[11rem] sm:h-[13rem] overflow-y-auto px-4 py-3 space-y-2 text-[12px] leading-relaxed"
      >
        {visible.length === 0 && !sending && (
          <div className="space-y-2 text-gray-500">
            <p className="italic">Try asking:</p>
            <ul className="space-y-1 text-[11px] text-gray-400">
              <li>· Why is the current action what it is?</li>
              <li>· What does RSI / MACD say on this page?</li>
              <li>· What are the main risks shown here?</li>
            </ul>
          </div>
        )}
        {visible.map((m, i) => (
          <div
            key={`${m.role}-${i}-${m.content.slice(0, 16)}`}
            className={cn(
              'rounded-xl px-3 py-2 whitespace-pre-wrap break-words max-w-[95%]',
              m.role === 'user'
                ? 'bg-emerald-500/15 text-emerald-100 ml-auto'
                : 'bg-white/5 text-gray-300'
            )}
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <div className="inline-flex items-center gap-1.5 text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Reading this analysis…
          </div>
        )}
      </div>

      {error && (
        <p className="px-4 pb-2 text-[11px] text-rose-400 leading-tight line-clamp-2">{error}</p>
      )}

      {!userEmail ? (
        <button
          type="button"
          onClick={onSignIn}
          className="m-3 min-h-[44px] rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-[13px] font-bold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
        >
          Sign in to ask about this analysis
        </button>
      ) : (
        <form
          className="flex items-center gap-2 p-3 border-t border-white/5"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={600}
            disabled={sending}
            placeholder={`Ask about ${String(sym).toUpperCase()}… (1 credit)`}
            className="min-w-0 flex-1 h-11 rounded-xl bg-black/50 border border-white/10 px-3 text-[13px] text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label="Send"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40 cursor-pointer"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      )}
    </div>
  );
}
