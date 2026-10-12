import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { operations } from '../../operations/api';
import { dateTime } from '../../lib/dateTimeFormat';
import { Button } from '../ui/button';

/** TMS orders that could not become Dispatra orders. Retry after fixing the field map, catalogue or TMS data. */
export function TmsReview({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const queryKey = ['operations', slug, 'tms-inbox'];
  const query = useQuery({ queryKey, queryFn: () => operations.tmsInbox(slug) });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const act = async (id: string, run: () => Promise<unknown>) => {
    setBusy(id); setError('');
    try { await run(); await queryClient.invalidateQueries({ queryKey }); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not update the TMS order.'); }
    finally { setBusy(''); }
  };
  const rows = query.data ?? [];
  if (!rows.length) return null;
  return <section aria-label="Orders needing review" className="space-y-3">
    <h4 className="text-sm font-medium">Orders needing review</h4>
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    <ul className="space-y-3">{rows.map(row => <li key={row.id} className="rounded-lg border border-app-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-sm font-medium">TMS order {row.external_id}</p><p className="text-xs text-app-muted">Received {dateTime(row.received_at)}</p></div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!!busy} aria-label={`Retry TMS order ${row.external_id}`} onClick={() => act(row.id, () => operations.retryTmsOrder(slug, row.id))}>Retry</Button>
          <Button type="button" variant="outline" size="sm" disabled={!!busy} aria-label={`Dismiss TMS order ${row.external_id}`} onClick={() => act(row.id, () => operations.dismissTmsOrder(slug, row.id))}>Dismiss</Button>
        </div>
      </div>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-app-muted">{(row.missing.length ? row.missing : ['Could not be processed. Retry, or check the TMS data.']).map(reason => <li key={reason}>{reason}</li>)}</ul>
    </li>)}</ul>
  </section>;
}
