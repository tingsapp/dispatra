import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { operations, type AssistantReply, type AssistantQuestion } from '../../operations/api';
import { briefingKey } from './useLiveBriefing';

/** `key` is the proposal's idempotency key; `password` is a new account's one-time sign-in, kept off the chat text and history. */
export type ActionState = { status: 'open' | 'saving' | 'done' | 'cancelled'; error?: string; key?: string; password?: string };
export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; reply?: AssistantReply; action?: ActionState };

/** Ephemeral company-scoped conversation, retained through panel close/reopen, never browser-persisted. */
export function useAssistantChat(slug: string) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const request = useRef<AbortController | null>(null);
  const failed = useRef<AssistantQuestion | null>(null);
  useEffect(() => {
    setMessages([]); setDraft(''); setError(undefined); setPending(false); failed.current = null;
    return () => { request.current?.abort(); request.current = null; };
  }, [slug]);
  const append = (row: ChatMessage) => setMessages(rows => [...rows.slice(-59), row]);
  const setAction = (id: string, action: ActionState) => setMessages(rows => rows.map(row => row.id === id ? { ...row, action } : row));

  const submit = async (retry = false, automatic = false, prompt?: string) => {
    if (request.current) return;
    const message = prompt ?? (automatic ? 'Give me the current daily operational briefing.' : draft.trim());
    if (!retry && !message) return;
    const body = retry ? failed.current : { message, kind: automatic ? 'BRIEFING' as const : 'CHAT' as const, history: messages.slice(-10).map(row => ({ role: row.role, content: [row.content, ...(row.reply?.references ?? []).map(ref => `${ref.kind}: ${ref.label}`)].join('\n').slice(0, 1000) })) };
    if (!body) return;
    const controller = new AbortController();
    request.current = controller;
    failed.current = null;
    setError(undefined); setPending(true); if (body.kind !== 'BRIEFING') setDraft('');
    if (!retry && body.kind !== 'BRIEFING') append({ id: crypto.randomUUID(), role: 'user', content: body.message });
    try {
      const reply = await operations.assistant(slug, body, controller.signal);
      if (controller.signal.aborted) return;
      const action = reply.action ? { status: 'open' as const } : reply.change ? { status: 'open' as const, key: `cc-${crypto.randomUUID()}` } : undefined;
      append({ id: crypto.randomUUID(), role: 'assistant', content: reply.message, reply, ...(action ? { action } : {}) });
    } catch (failure) {
      if (controller.signal.aborted) return;
      failed.current = body;
      if (body.kind !== 'BRIEFING') setDraft(body.message);
      setError(failure instanceof Error ? failure.message : 'Unable to answer right now. Try again.');
    } finally {
      if (!controller.signal.aborted) { request.current = null; setPending(false); }
    }
  };

  /** Saves a proposed assignment the dispatcher confirmed; the API re-checks it and refusals stay on the card. */
  const confirmAssignment = async (row: ChatMessage) => {
    const action = row.reply?.action;
    if (!action || row.action?.status !== 'open') return;
    setAction(row.id, { status: 'saving' });
    try {
      const result = await operations.confirmAssistantAction(slug, action);
      setAction(row.id, { status: 'done' });
      append({ id: crypto.randomUUID(), role: 'assistant', content: result.message });
      await Promise.all([...['orders', 'routes', 'monitor'].map(name => queryClient.invalidateQueries({ queryKey: ['operations', slug, name] })),
        queryClient.invalidateQueries({ queryKey: briefingKey(slug) })]);
    } catch (failure) {
      setAction(row.id, { status: 'open', error: failure instanceof Error ? failure.message : 'I couldn’t save that change. Try again.' });
    }
  };
  /** Saves a drafted record change the dispatcher confirmed; the API re-validates it through the workspace command. */
  const confirmChange = async (row: ChatMessage) => {
    const change = row.reply?.change;
    const state = row.action;
    if (!change || !state?.key || state.status !== 'open') return;
    setAction(row.id, { ...state, status: 'saving', error: undefined });
    try {
      const result = await operations.confirmAssistantChange(slug, change, state.key);
      setAction(row.id, { status: 'done', key: state.key, password: result.initial_password ?? undefined });
      append({ id: crypto.randomUUID(), role: 'assistant', content: result.message });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['operations', slug] }), queryClient.invalidateQueries({ queryKey: briefingKey(slug) })]);
    } catch (failure) {
      setAction(row.id, { ...state, status: 'open', error: failure instanceof Error ? failure.message : 'I couldn’t save that change. Try again.' });
    }
  };
  const cancelAction = (row: ChatMessage) => {
    const action = row.reply?.action;
    const change = row.reply?.change;
    if ((!action && !change) || row.action?.status !== 'open') return;
    setAction(row.id, { status: 'cancelled' });
    append({ id: crypto.randomUUID(), role: 'assistant', content: action ? `Okay, I left order ${action.order_number} as it was.` : `Okay, I didn’t change ${change!.subject}.` });
  };
  const confirmAction = (row: ChatMessage) => row.reply?.change ? confirmChange(row) : confirmAssignment(row);
  return { messages, draft, setDraft, pending, error, submit, confirmAction, cancelAction, canRetry: !!failed.current };
}
