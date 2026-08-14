import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  PAGE_LABELS,
  postAssistantChat,
  type AssistantChatContext,
  type AssistantChatMessage,
} from '../../lib/assistantChatApi';
import type { UsageSnapshot } from '../../lib/usageApi';
import type { AppPage } from './navTypes';

type SidebarAiChatProps = {
  activePage: AppPage;
  collapsed: boolean;
  onExpandSidebar: () => void;
  userEmail?: string | null;
  onSignIn: () => void;
  chatContext: AssistantChatContext;
  onUsageUpdate?: (usage: UsageSnapshot) => void;
};

const MAX_VISIBLE = 2;

export function SidebarAiChat({
  activePage,
  collapsed,
  onExpandSidebar,
  userEmail,
  onSignIn,
  chatContext,
  onUsageUpdate,
}: SidebarAiChatProps) {
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusAfterExpand = useRef(false);

  useEffect(() => {
    setMessages([]);
    setDraft('');
    setError(null);
  }, [activePage]);

  useEffect(() => {
    if (!collapsed && focusAfterExpand.current) {
      focusAfterExpand.current = false;
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [collapsed]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const pageLabel = PAGE_LABELS[activePage] || activePage;

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    if (!userEmail) {
      onSignIn();
      return;
    }

    setError(null);
    setDraft('');
    const nextHistory = [...messages, { role: 'user' as const, content: text }];
    setMessages(nextHistory);
    setSending(true);

    try {
      const result = await postAssistantChat({
        email: userEmail,
        message: text,
        context: { ...chatContext, page: activePage, pageLabel },
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
          content: msg.includes('usage is out') || e?.code === 'analysis_quota_exceeded'
            ? `${msg}\nNot financial advice.`
            : `Could not reply: ${msg}\nNot financial advice.`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (collapsed) {
    return (
      <button
        type="button"
        title="Ask AI"
        aria-label="Open Ask AI"
        onClick={() => {
          focusAfterExpand.current = true;
          onExpandSidebar();
        }}
        className="w-full inline-flex h-10 items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
      >
        <MessageCircle className="h-4 w-4" />
      </button>
    );
  }

  const visible = messages.slice(-MAX_VISIBLE);

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden flex flex-col min-h-0">
      <div className="px-2.5 py-1.5 border-b border-white/5 flex items-center gap-1.5 shrink-0">
        <MessageCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 truncate">
          Ask AI · {pageLabel}
        </p>
      </div>

      <div
        ref={listRef}
        className="h-[4.5rem] overflow-y-auto px-2 py-1.5 space-y-1.5 text-[11px] leading-snug"
      >
        {visible.length === 0 && !sending && (
          <p className="text-gray-600 italic">Ask about this page…</p>
        )}
        {visible.map((m, i) => (
          <div
            key={`${m.role}-${i}-${m.content.slice(0, 12)}`}
            className={cn(
              'rounded-lg px-2 py-1 whitespace-pre-wrap break-words',
              m.role === 'user'
                ? 'bg-emerald-500/15 text-emerald-100 ml-2'
                : 'bg-white/5 text-gray-300 mr-1'
            )}
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <div className="inline-flex items-center gap-1.5 text-gray-500 px-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Thinking…
          </div>
        )}
      </div>

      {error && (
        <p className="px-2 pb-1 text-[10px] text-rose-400 leading-tight line-clamp-2">{error}</p>
      )}

      {!userEmail ? (
        <button
          type="button"
          onClick={onSignIn}
          className="m-1.5 min-h-[36px] rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
        >
          Sign in to ask
        </button>
      ) : (
        <form
          className="flex items-center gap-1 p-1.5 border-t border-white/5"
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
            placeholder="Ask… (1 credit)"
            className="min-w-0 flex-1 h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[11px] text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label="Send"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40 cursor-pointer"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </form>
      )}
    </div>
  );
}
