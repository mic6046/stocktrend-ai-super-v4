import React, { useState } from 'react';
import { MessageCircle, Send, Loader2, LineChart } from 'lucide-react';
import { GlassCard, SectionLabel } from '../analysis/GlassCard';
import { cn } from '../../lib/utils';
import {
  postAssistantChat,
  type AnalysisAskSnapshot,
  type AssistantChatMessage,
} from '../../lib/assistantChatApi';

type ConversationState = {
  messages: AssistantChatMessage[];
  /** Whether the first (billed) message has already been sent for this ticker —
   * every message after that is chargeCredit: false. Resets per ticker, not per app session. */
  charged: boolean;
};

type AiChatPageProps = {
  ticker: string | null | undefined;
  snapshot: AnalysisAskSnapshot | null;
  email: string | null | undefined;
  onGoToAnalysis: () => void;
};

export function AiChatPage({ ticker, snapshot, email, onGoToAnalysis }: AiChatPageProps) {
  const [conversations, setConversations] = useState<Record<string, ConversationState>>({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTicker = ticker ? ticker.toUpperCase() : null;
  const conversation = activeTicker ? conversations[activeTicker] : undefined;
  const messages = conversation?.messages ?? [];

  const send = async () => {
    const message = input.trim();
    if (!message || !activeTicker || !email || sending) return;

    setError(null);
    setSending(true);
    setInput('');

    const priorMessages = messages;
    const chargeCredit = !conversation?.charged;

    setConversations((prev) => ({
      ...prev,
      [activeTicker]: {
        messages: [...priorMessages, { role: 'user', content: message }],
        charged: prev[activeTicker]?.charged ?? false,
      },
    }));

    try {
      const result = await postAssistantChat({
        email,
        message,
        context: {
          page: 'AI_CHAT',
          pageLabel: 'AI Chat',
          ticker: activeTicker,
          analysis: snapshot,
        },
        history: priorMessages,
        chargeCredit,
      });

      setConversations((prev) => ({
        ...prev,
        [activeTicker]: {
          messages: [...(prev[activeTicker]?.messages ?? []), { role: 'assistant', content: result.reply }],
          charged: true,
        },
      }));
    } catch (err: any) {
      setError(err?.message || 'Could not reach the assistant. Try again.');
      // Roll back the optimistic user message so a failed send doesn't sit
      // there unanswered and doesn't skip the charge for the retry.
      setConversations((prev) => ({
        ...prev,
        [activeTicker]: { messages: priorMessages, charged: conversation?.charged ?? false },
      }));
    } finally {
      setSending(false);
    }
  };

  if (!activeTicker || !snapshot) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <GlassCard className="text-center py-12">
          <MessageCircle className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-4">
            Open a stock's analysis first, then come back here to ask about it.
          </p>
          <button
            type="button"
            onClick={onGoToAnalysis}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 text-black text-xs font-bold uppercase tracking-wide hover:bg-emerald-400 transition-colors cursor-pointer"
          >
            <LineChart className="w-3.5 h-3.5" />
            Go to Analysis
          </button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-4 px-4 flex flex-col h-full">
      <GlassCard className="flex flex-col flex-1 min-h-[60vh]" padding="none">
        <div className="px-4 sm:px-5 py-3 border-b border-white/10">
          <SectionLabel icon={<MessageCircle className="w-3.5 h-3.5 text-emerald-400" />}>
            AI Chat · {activeTicker}
          </SectionLabel>
          <p className="text-[10px] text-gray-500 mt-1">
            Answers are grounded in {activeTicker}'s current on-screen analysis — not a second opinion.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-[11px] text-gray-500 italic text-center py-6">
              Ask anything about {activeTicker}'s score, risk, indicators, or why it's rated the way it is.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap',
                  m.role === 'user'
                    ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-100'
                    : 'bg-white/5 border border-white/10 text-gray-200'
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-xl px-3 py-2 bg-white/5 border border-white/10 text-gray-400 text-[11px] flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Thinking…
              </div>
            </div>
          )}
          {error && <p className="text-[11px] text-rose-400 text-center">{error}</p>}
        </div>

        <div className="px-4 sm:px-5 py-3 border-t border-white/10 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={`Ask about ${activeTicker}…`}
            maxLength={600}
            disabled={sending}
            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/40 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !input.trim()}
            className="shrink-0 p-2 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
