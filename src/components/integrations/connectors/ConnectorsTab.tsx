import { Button } from '../../ui/button';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, RefreshCw, Plus } from 'lucide-react';
import { connectors, type Connector } from '../../../integrations/connectors';
import { confirmDialog } from '../../ui/ConfirmDialog';
import { ConnectorDialog } from './ConnectorDialog';
import { DispatraConnectorCard } from './DispatraConnectorCard';
import { useWorkspaceAccount } from '../../../portal/WorkspaceAccount';

const LABELS: Record<Connector['status'], string> = {
  ACTIVATION_REQUIRED: 'Activation required', NOT_CONNECTED: 'Not connected', CONNECTING: 'Connecting…', CONNECTED: 'Connected',
  SYNCING: 'Syncing…', RECONNECT_REQUIRED: 'Reconnect required', SYNC_FAILED: 'Sync failed', DISCONNECTED: 'Disconnected',
};

const ICON_COLORS: Record<string, string> = {
  'rose-rocket': 'bg-rose-500 text-white', cartoncloud: 'bg-sky-600 text-white',
  truckmate: 'bg-blue-700 text-white', mcleod: 'bg-red-700 text-white',
  aljex: 'bg-indigo-600 text-white', turvo: 'bg-teal-600 text-white',
};

export function ConnectorsTab({ slug }: { slug: string }) {
  const workspace = useWorkspaceAccount();
  const nativeTms = workspace ? !workspace.settings.data.tms_workspace : false;
  const cache = useQueryClient(); const queryKey = ['operations', slug, 'connectors'];
  const query = useQuery({ queryKey, queryFn: () => connectors.list(slug), enabled: !nativeTms, refetchInterval: data => data.state.data?.some(row => ['CONNECTING', 'SYNCING'].includes(row.status)) ? 3000 : 15000, refetchIntervalInBackground: false });
  const [selected, setSelected] = useState<Connector | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [review, setReview] = useState<{ provider: string; rows: Awaited<ReturnType<typeof connectors.review>> } | null>(null);
  const retries = useRef(new Map<string, string>());
  const refresh = () => { void cache.invalidateQueries({ queryKey }); };
  const act = async (row: Connector, disconnect = false) => {
    if (disconnect && !await confirmDialog({ title: `Disconnect ${row.name}?`, message: 'Synchronization will stop. Previously imported records stay in Dispatra.', confirmLabel: 'Disconnect' })) return;
    const operation = `${row.id}:${row.version}:${disconnect}`;
    const key = retries.current.get(operation) ?? crypto.randomUUID(); retries.current.set(operation, key);
    setPending(row.id); setError('');
    try {
      if (disconnect) await connectors.disconnect(slug, row, key); else await connectors.sync(slug, row, key);
      retries.current.delete(operation); refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not update this connection.'); }
    finally { setPending(null); }
  };
  return <section aria-label="Connectors" className="space-y-5">
    <p className="text-sm text-app-muted">Choose how you manage your transportation operations.</p>
    {!nativeTms && query.isPending && <p role="status" className="text-sm text-app-muted">Loading connectors…</p>}
    {!nativeTms && query.error && <div role="alert" className="space-y-2 text-sm"><p>Connectors could not be loaded.</p><Button type="button" variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    <div className="grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2">
      <DispatraConnectorCard />
      {(!nativeTms ? query.data ?? [] : []).map(row => {
        const busy = ['CONNECTING', 'SYNCING'].includes(row.status); const connected = row.status === 'CONNECTED';
        const hasConnection = row.version != null && row.status !== 'DISCONNECTED';
        const actionLabel = connected || row.status === 'SYNC_FAILED' ? `Sync ${row.name}`
          : row.status === 'RECONNECT_REQUIRED' ? `Reconnect ${row.name}` : busy ? `${LABELS[row.status]} ${row.name}` : `Connect ${row.name}`;
        return <article key={row.id} aria-label={row.name} className="min-w-0 rounded-xl bg-white px-3 py-4 transition-colors hover:bg-app-hover">
          <div className="flex items-center gap-3.5">
            <div aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${ICON_COLORS[row.id] ?? 'bg-app-hover text-app-text'}`}>{row.initials}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="text-base font-medium text-app-text">{row.name}</h3>
                <p role="status" className={`flex items-center gap-1 text-xs ${connected ? 'text-emerald-700' : 'text-app-muted'}`}>
                  {connected && <Check className="h-3 w-3" aria-hidden="true" />}{LABELS[row.status]}
                </p>
              </div>
              <p className="mt-1 text-xs text-app-muted">{row.description}</p>
              {row.account && <p className="mt-1 break-words text-xs text-app-muted">{row.account}</p>}
              {row.last_sync_at && <p className="mt-1 text-xs text-app-muted">Last synced {new Date(row.last_sync_at).toLocaleString()}</p>}
            </div>
            <Button type="button" variant="ghost" size="icon-lg" aria-label={actionLabel} title={actionLabel}
              disabled={busy || pending === row.id}
              className="text-app-muted"
              onClick={() => {
                if (connected || row.status === 'SYNC_FAILED') void act(row);
                else { setSelected(row); setError(''); }
              }}>
              {connected || row.status === 'SYNC_FAILED' || busy
                ? <RefreshCw className={`size-5 ${busy ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
                : <Plus className="size-5" aria-hidden="true" />}
            </Button>
          </div>
          {(hasConnection || row.review_count > 0) && <div className="mt-2 flex flex-wrap items-center gap-2 pl-[54px]">
            {hasConnection && <Button type="button" variant="ghost" disabled={pending === row.id} onClick={() => void act(row, true)}>Disconnect</Button>}
            {row.review_count > 0 && <Button type="button" variant="ghost" onClick={async () => {
              try { setReview({ provider: row.name, rows: await connectors.review(slug, row.id) }); }
              catch { setError('Could not load the records needing review.'); }
            }}>Review {row.review_count}</Button>}
          </div>}
          {row.message && row.ready && <p className="mt-2 pl-[54px] text-xs text-app-muted">{row.message}</p>}
        </article>;
      })}
    </div>
    {!nativeTms && review && <section aria-label={`${review.provider} records needing review`} className="space-y-3 rounded-xl border border-app-border p-4">
      <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium">{review.provider}: records needing review</h3><Button type="button" variant="ghost" onClick={() => setReview(null)}>Close review</Button></div>
      {!review.rows.length && <p className="text-sm text-app-muted">No orders need review.</p>}
      {review.rows.map(item => <div key={item.id} className="text-sm"><p className="font-medium">{item.reference}</p><ul className="list-disc pl-5 text-xs text-app-muted">{item.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul></div>)}
    </section>}
    {!nativeTms && selected && <ConnectorDialog key={selected.id} slug={slug} connector={selected} onClose={() => setSelected(null)} onSaved={refresh} />}
  </section>;
}
