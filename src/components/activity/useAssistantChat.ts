import { useEffect, useRef, useState } from 'react';
import { operations, type AssistantReply, type AssistantQuestion } from '../../operations/api';

export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; reply?: AssistantReply };

/** Ephemeral company-scoped conversation, retained through panel close/reopen, never browser-persisted. */
export function useAssistantChat(slug: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const request = useRef<AbortController | null>(null);
  const failed = useRef<AssistantQuestion | null>(null);
  useEffect(() => () => { request.current?.abort(); }, [slug]);

  const submit = async (retry = false) => {
    if (request.current) return;
    const message = draft.trim();
    if (!retry && !message) return;
    const body = retry ? failed.current : { message, history: messages.slice(-10).map(row => ({ role: row.role, content: [row.content, ...(row.reply?.references ?? []).map(ref => `${ref.kind}: ${ref.label}`)].join('\n').slice(0, 1000) })) };
    if (!body) return;
    const controller = new AbortController();
    request.current = controller;
    failed.current = null;
    setError(undefined); setPending(true); setDraft('');
    if (!retry) setMessages(rows => [...rows.slice(-59), { id: crypto.randomUUID(), role: 'user', content: body.message }]);
    try {
      const reply = await operations.assistant(slug, body, controller.signal);
      if (controller.signal.aborted) return;
      setMessages(rows => [...rows.slice(-59), { id: crypto.randomUUID(), role: 'assistant', content: reply.message, reply }]);
    } catch (failure) {
      if (controller.signal.aborted) return;
      failed.current = body;
      setDraft(body.message);
      setError(failure instanceof Error ? failure.message : 'Unable to answer right now. Try again.');
    } finally {
      if (!controller.signal.aborted) { request.current = null; setPending(false); }
    }
  };
  return { messages, draft, setDraft, pending, error, submit, canRetry: !!failed.current };
}
