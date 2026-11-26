import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { Dialog, DialogBody, DialogHeader } from '../components/ui/Dialog';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import { api, type OperationalQuestion, type OperationalReply } from './api';
import { DriverChoiceBadges } from './DriverChoiceBadges';
import { Button, Field, Notice } from './ui';

type Draft = { reason: OperationalReply['reason'] | ''; details: string; minutes: string };
type ReplySession = { draft: Draft; attempt?: { signature: string; body: OperationalReply; key: string } };
const questionKey = (question: OperationalQuestion) => `${question.id}:${question.version}`;

function ReplySurface({ inline, title, busy, onClose, children }: { inline: boolean; title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  if (inline) return <section aria-label={title} className="mt-3 space-y-4 rounded-xl border border-app-border bg-white p-4">
    <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-medium">{title}</h3><Button type="button" size="sm" variant="outline" disabled={busy} onClick={onClose}>Close</Button></div>
    <p className="text-sm text-app-muted">Send an update when you are safely stopped.</p>
    {children}
  </section>;
  return createPortal(<Dialog size="form" onClose={onClose}>
    <DialogHeader title={title} description="Send an update when you are safely stopped." onClose={onClose} closeDisabled={busy} />
    <DialogBody className="overscroll-contain">{children}</DialogBody>
  </Dialog>, document.body);
}

function QuestionReply({ slug, question, session, position, total, onPrevious, onNext, onClose, inline }: {
  slug: string; question: OperationalQuestion; session: ReplySession; position: number; total: number;
  onPrevious: () => void; onNext: () => void; onClose: () => void; inline: boolean;
}) {
  const [draft, setDraft] = useState(session.draft);
  const { reason, details, minutes } = draft;
  // The company's rules for the chosen reason; the web portal has no report camera, so photo reasons need the app.
  const choice = question.choices.find(option => option.value === reason);
  const problem = choice?.photo_required ? `${choice.label} needs a photo. Answer from the driver app.`
    : choice?.notes_required && details.trim().length < 3 ? `Describe the issue when choosing ${choice.label}.` : null;
  const update = (change: Partial<Draft>) => { session.draft = { ...draft, ...change }; setDraft(session.draft); };
  const cache = useQueryClient();
  const reply = useMutation({ mutationFn: () => {
    if (!reason) throw new Error('Choose a reason.');
    const signature = JSON.stringify([question.version, reason, details, minutes]);
    if (session.attempt?.signature !== signature) session.attempt = { signature, key: crypto.randomUUID(), body: {
      version: question.version, reason, details,
      estimated_ready_at: minutes ? new Date(Date.now() + Number(minutes) * 60_000).toISOString() : null,
    } };
    return api.replyToOperationalQuestion(slug, question.id, session.attempt.body, session.attempt.key);
  }, onSuccess: () => {
    // Remove the confirmed reply immediately, even if the subsequent refresh fails.
    cache.setQueriesData<OperationalQuestion[]>({ queryKey: ['driver-operational-questions', slug] }, rows => rows?.filter(row => row.id !== question.id));
    return cache.invalidateQueries({ queryKey: ['driver-operational-questions', slug] });
  } });
  const close = () => { if (!reply.isPending) onClose(); };
  useEffect(() => {
    if (inline) return;
    const root = document.getElementById('root');
    const canvas = document.querySelector<HTMLElement>('.app-page');
    const wasInert = root?.inert ?? false;
    const overflow = canvas?.style.overflow ?? '';
    if (root) root.inert = true;
    if (canvas) canvas.style.overflow = 'hidden';
    return () => {
      if (root) root.inert = wasInert;
      if (canvas) canvas.style.overflow = overflow;
    };
  }, [inline]);
  useEntityDialog(!inline, close, `${question.order_number} · Progress update`);
  return <ReplySurface inline={inline} title={`${question.order_number} · Progress update`} busy={reply.isPending} onClose={close}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-xs text-app-muted" aria-live="polite">Request {position + 1} of {total}</p>
        {total > 1 && <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={reply.isPending || position === 0} onClick={onPrevious}>Previous</Button>
          <Button type="button" size="sm" variant="outline" disabled={reply.isPending || position === total - 1} onClick={onNext}>Next</Button>
        </div>}
      </div>
      <form onSubmit={event => { event.preventDefault(); reply.mutate(); }} className="space-y-4">
        <p className="text-sm text-app-muted">{question.prompt}</p>
        <DriverChoiceBadges choices={question.choices} value={reason} disabled={reply.isPending} onSelect={reason => update({ reason })} />
        {problem && reason && <p className="text-sm text-slate-600">{problem}</p>}
        <Field label="Additional details" value={details} maxLength={1000} onChange={event => update({ details: event.target.value })} disabled={reply.isPending} />
        <Field label="Expected ready in minutes (optional)" type="number" min={1} max={1440} step={1} value={minutes} onChange={event => update({ minutes: event.target.value })} disabled={reply.isPending} />
        <Notice error={reply.error} /><Button loading={reply.isPending} type="submit" disabled={reply.isPending || !reason || !!problem}>{reply.isPending ? 'Sending update…' : 'Send progress update'}</Button>
      </form>
  </ReplySurface>;
}

export function DriverQuestions({ slug, driverId, inline = false, compact = false }: { slug: string; driverId: string; inline?: boolean; compact?: boolean }) {
  const query = useQuery({ queryKey: ['driver-operational-questions', slug, driverId], queryFn: () => api.driverOperationalQuestions(slug), refetchInterval: 15_000 });
  const [selected, setSelected] = useState<string | null>(null);
  // Keep drafts and retry identities through Previous/Next and closing/reopening the popup.
  const sessions = useRef(new Map<string, ReplySession>());
  const reviewButton = useRef<HTMLButtonElement>(null);
  const wasReviewing = useRef(false);
  const questions = query.data ?? [];
  const position = Math.max(0, questions.findIndex(question => question.id === selected));
  const current = selected !== null ? questions[position] : undefined;
  useEffect(() => {
    if (!current && wasReviewing.current) reviewButton.current?.focus();
    wasReviewing.current = !!current;
  }, [!!current]);
  const orderCount = new Set(questions.map(question => question.order_id)).size;
  let session: ReplySession | undefined;
  if (current) {
    const key = `${slug}:${driverId}:${questionKey(current)}`;
    session = sessions.current.get(key);
    if (!session) { session = { draft: { reason: '', details: '', minutes: '' } }; sessions.current.set(key, session); }
  }
  // End a completed review so a later incoming request never opens a popup by itself.
  if (selected !== null && query.isSuccess && questions.length === 0) setSelected(null);
  return <>
    <Notice error={query.error} />
    {!!questions.length && (compact
      ? <Button ref={reviewButton} type="button" size="sm" variant="outline" aria-label="Review updates" onClick={() => setSelected(questions[0].id)}>
        <MessageSquare className="mr-2 h-4 w-4" aria-hidden="true" />Review updates ({questions.length})
      </Button>
      : <section aria-label="Supervisor agent questions" className="flex flex-wrap items-center gap-3 rounded-xl border border-app-border bg-white px-4 py-3">
      <MessageSquare className="h-5 w-5 shrink-0 text-app-muted" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-medium">Progress updates requested</h2>
        <p className="mt-0.5 text-xs text-app-muted">{questions.length} pending {questions.length === 1 ? 'request' : 'requests'} · {orderCount} {orderCount === 1 ? 'order' : 'orders'}</p>
      </div>
      <Button ref={reviewButton} type="button" size="sm" variant="outline" onClick={() => setSelected(questions[0].id)}>Review updates</Button>
    </section>)}
    {current && session && <QuestionReply key={questionKey(current)} slug={slug} question={current} session={session} position={position} total={questions.length} inline={inline}
      onPrevious={() => setSelected(questions[position - 1].id)} onNext={() => setSelected(questions[position + 1].id)} onClose={() => setSelected(null)} />}
  </>;
}
