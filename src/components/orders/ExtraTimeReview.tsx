import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../ui/button';
import { operations } from '../../operations/api';
import type { Job } from '../../types';

const STATUS = { CHARGED: 'Charged', EXCLUDED: 'Not charged: carrier reason', WAIVED: 'Waived' } as const;

/** Extra time per stop on a completed Order: why it is charged or not, and the dispatcher's waive/charge decision. */
export function ExtraTimeReview({ slug, job }: { slug: string; job: Job }) {
  const extra = job.pricing?.extraTime;
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  if (!extra?.stops.length) return null;
  const decide = async (stopId: string, charge: boolean) => {
    setPending(stopId); setError('');
    try {
      await operations.decideExtraTime(slug, { id: job.id, version: job.version! }, stopId, charge);
      await Promise.all(['orders', 'monitor'].map(name => queryClient.invalidateQueries({ queryKey: ['operations', slug, name] })));
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not update Extra time.'); }
    finally { setPending(null); }
  };
  return <section className="rounded-xl border border-slate-200 p-5 space-y-3 text-sm" aria-label="Extra time">
    <div><h4 className="app-section-title">Extra time</h4>
      <p className="text-xs text-slate-500">First {extra.minutes_free} minutes free at each stop, then ${Number(extra.amount).toFixed(2)} for each started {extra.minutes_free} minutes. Stops with a carrier reason are not charged.</p></div>
    <ul className="divide-y divide-slate-100">{extra.stops.map(stop => <li key={stop.stop_id} className="flex flex-wrap items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{stop.stop} · {stop.minutes_over} min over · ${Number(stop.amount).toFixed(2)}</p>
        <p className="text-xs text-slate-500">{stop.reasons.length ? `Driver: ${stop.reasons.join(', ')}` : 'No reason reported'} · {STATUS[stop.status]}{stop.decided_by_dispatcher ? ' by dispatcher' : ''}</p>
      </div>
      {stop.status === 'CHARGED'
        ? <Button type="button" size="xs" variant="outline" loading={pending === stop.stop_id} disabled={!!pending} onClick={() => decide(stop.stop_id, false)}>Waive</Button>
        : <Button type="button" size="xs" variant="outline" loading={pending === stop.stop_id} disabled={!!pending} onClick={() => decide(stop.stop_id, true)}>Charge</Button>}
    </li>)}</ul>
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
  </section>;
}
