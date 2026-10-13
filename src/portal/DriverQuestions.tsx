import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type OperationalQuestion, type OperationalReply } from './api';
import { Button, Field, Notice, useOperationKey } from './ui';

function QuestionReply({ slug, question }: { slug: string; question: OperationalQuestion }) {
  const [reason, setReason] = useState<OperationalReply['reason'] | ''>('');
  const [details, setDetails] = useState('');
  const [minutes, setMinutes] = useState('');
  const key = useOperationKey();
  const attempt = useRef<{ signature: string; body: OperationalReply }>(undefined);
  const cache = useQueryClient();
  const reply = useMutation({ mutationFn: () => {
    if (!reason) throw new Error('Choose a reason.');
    const signature = JSON.stringify([question.version, reason, details, minutes]);
    if (attempt.current?.signature !== signature) attempt.current = { signature, body: { version: question.version, reason, details,
      estimated_ready_at: minutes ? new Date(Date.now() + Number(minutes) * 60_000).toISOString() : null } };
    const body = attempt.current.body;
    return api.replyToOperationalQuestion(slug, question.id, body, key(body));
  }, onSuccess: () => cache.invalidateQueries({ queryKey: ['driver-operational-questions', slug] }) });
  return <form onSubmit={event => { event.preventDefault(); reply.mutate(); }} className="space-y-3 rounded-xl border border-app-border bg-white p-4">
    <h3 className="text-sm font-medium">{question.order_number} · Progress update</h3><p className="text-sm text-app-muted">{question.prompt}</p>
    <fieldset disabled={reply.isPending} className="flex flex-wrap gap-2"><legend className="sr-only">What is happening?</legend>
      {question.choices.map(choice => <Button key={choice.value} type="button" size="sm" variant={reason === choice.value ? 'default' : 'outline'} aria-pressed={reason === choice.value} onClick={() => setReason(choice.value)}>{choice.label}</Button>)}
    </fieldset>
    <Field label="Additional details" value={details} maxLength={1000} onChange={event => setDetails(event.target.value)} disabled={reply.isPending} />
    <Field label="Expected ready in minutes (optional)" type="number" min={1} max={1440} step={1} value={minutes} onChange={event => setMinutes(event.target.value)} disabled={reply.isPending} />
    <Notice error={reply.error} /><Button type="submit" disabled={reply.isPending || !reason || (reason === 'OTHER' && details.trim().length < 3)}>{reply.isPending ? 'Sending update…' : 'Send progress update'}</Button>
  </form>;
}

export function DriverQuestions({ slug, driverId }: { slug: string; driverId: string }) {
  const query = useQuery({ queryKey: ['driver-operational-questions', slug, driverId], queryFn: () => api.driverOperationalQuestions(slug), refetchInterval: 15_000 });
  if (query.error) return <Notice error={query.error} />;
  if (!query.data?.length) return null;
  return <section aria-label="Operational agent questions" className="mb-5 space-y-3">{query.data.map(question => <QuestionReply key={`${question.id}:${question.version}`} slug={slug} question={question} />)}</section>;
}
