import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Mic, SquarePen } from 'lucide-react';
import { api } from '../../portal/api';
import { Button } from '../ui/button';
import { usePublicChatScroll } from './usePublicChatScroll';
import { usePublicChatTyping } from './usePublicChatTyping';

type Turn = { role: 'user' | 'assistant'; content: string };
type Props = { onStartVoice?: () => void };
function boundedHistory(turns: Turn[]) {
  const result = turns.slice(-10);
  while (result.reduce((total, turn) => total + turn.content.length, 0) > 12000) result.shift();
  return result;
}

export function PublicChatAssistant(props: Props) {
  const [cache] = useState(() => new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } }));
  return <QueryClientProvider client={cache}><ChatContent {...props} /></QueryClientProvider>;
}

function ChatContent({ onStartVoice }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const started = turns.length > 0;
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useLayoutEffect(() => {
    const field = input.current;
    if (!field) return;
    field.style.height = '0px';
    field.style.height = `${Math.min(160, Math.max(24, field.scrollHeight))}px`;
  }, [draft]);
  const ask = useMutation({
    mutationFn: (body: { message: string; history: Turn[] }) => {
      controller.current = new AbortController();
      return api.publicAssistant(body, controller.current.signal);
    },
    onSuccess: reply => setTurns(current => [...current, { role: 'assistant' as const, content: reply.message }].slice(-40)),
  });
  const latest = turns.at(-1);
  const typing = usePublicChatTyping(latest?.role === 'assistant' ? latest : undefined);
  const busy = ask.isPending || typing.isTyping;
  const scrolling = usePublicChatScroll(started, turns, ask.status, typing.text.length);
  function send() {
    const message = draft.trim();
    if (!message || busy || ask.isError) return;
    scrolling.followLatest();
    input.current?.focus({ preventScroll: true });
    const history = boundedHistory(turns);
    setTurns(current => [...current, { role: 'user' as const, content: message }].slice(-40));
    setDraft('');
    ask.mutate({ message, history });
  }
  function clear() { scrolling.followLatest(); setTurns([]); setDraft(''); ask.reset(); input.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
  return <section aria-labelledby="dispatra-chat-title" className={`public-chat-shell ${started ? 'public-chat-shell--started' : ''}`}>
    <div className="mx-auto flex h-12 w-full max-w-4xl shrink-0 items-center justify-end gap-4 px-5 sm:px-8">
      <h2 id="dispatra-chat-title" className="sr-only">Dispatra Chat</h2>
      {started && <button type="button" onClick={clear} disabled={ask.isPending} aria-label="New chat" title="New chat" className="flex size-10 items-center justify-center rounded-full text-app-muted hover:bg-slate-100 hover:text-app-text disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-app-accent"><SquarePen className="size-4" aria-hidden="true" /></button>}
    </div>
    <div className={`public-chat-body ${started ? 'public-chat-body--started' : ''}`}>
      <h1 className={started ? 'sr-only' : 'mb-8 text-center text-[30px] font-medium leading-tight tracking-tight sm:mb-9 sm:text-4xl'}>How can I help you?</h1>
      {started && <div role="log" aria-label="Dispatra Chat conversation" aria-live="polite" aria-busy={busy} aria-relevant="additions text" className="public-chat-transcript space-y-8">
        {turns.map((turn, index) => <div key={index} className={turn.role === 'user' ? 'ml-auto w-fit max-w-[85%] rounded-3xl bg-[#f4f4f4] px-5 py-3' : 'max-w-full py-1'}>
          <span className="sr-only">{turn.role === 'user' ? 'You' : 'Dispatra'}: </span><p className="whitespace-pre-wrap break-words text-[15px] leading-7 sm:text-base">{turn === latest && turn.role === 'assistant' ? typing.text : turn.content}{turn === latest && typing.isTyping && <span className="public-chat-typing-cursor" aria-hidden="true" />}</p>
        </div>)}
        {ask.isPending && <p role="status" className="flex items-center gap-2 text-sm text-app-muted"><span className="size-2 rounded-full bg-app-text motion-safe:animate-pulse" aria-hidden="true" />Thinking…</p>}
      </div>}
      {started && <div ref={scrolling.end} aria-hidden="true" className="h-px shrink-0" />}
      <div ref={scrolling.dock} className="public-chat-dock">
      <div className="public-chat-dock-content">
      {scrolling.showLatest && <button type="button" onClick={scrolling.jumpToLatest} aria-label="Jump to latest" title="Jump to latest" className="public-chat-latest"><ArrowDown className="size-4" aria-hidden="true" /></button>}
      {ask.isError && <div role="alert" className="mb-4 shrink-0 px-1 text-sm leading-6 text-app-muted">
        <p>{ask.error.message || 'Chat is unavailable. Please try again or email our team.'}</p>
        <button type="button" className="mt-2 rounded font-medium text-app-text underline underline-offset-4" onClick={() => ask.variables && ask.mutate(ask.variables)}>Try again</button>
        <span className="px-2" aria-hidden="true">·</span><a href="mailto:dispatra@tingsapp.com" className="rounded underline underline-offset-4">Email our team instead</a>
      </div>}
      <form onSubmit={event => { event.preventDefault(); send(); }} className="public-chat-composer">
        <label htmlFor="public-chat-question" className="sr-only">Ask Dispatra a question</label>
        <textarea ref={input} id="public-chat-question" rows={1} maxLength={2000} value={draft} disabled={ask.isError} onChange={event => setDraft(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }}
          placeholder="Ask Dispatra" className="public-chat-input" />
        <Button type="button" size="icon" variant="ghost" aria-label="Start voice chat" title={onStartVoice ? 'Start voice chat' : 'Voice agent not connected yet'} onClick={onStartVoice} disabled={!onStartVoice || busy} className="public-chat-mic"><Mic className="size-5" strokeWidth={1.75} aria-hidden="true" /></Button>
        <Button type="submit" size="icon" aria-label="Send question" disabled={!draft.trim() || busy || ask.isError} className="public-chat-send"><ArrowUp className="size-[18px]" aria-hidden="true" /></Button>
      </form>
      </div>
      </div>
    </div>
  </section>;
}
