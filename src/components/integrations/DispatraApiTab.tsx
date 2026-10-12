import { useState } from 'react';
import { Field } from '../../portal/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ORDER_EVENTS, apiResources, exampleBooking, httpsUrlError, type ApiResource } from '../../integrations/preview';
import { operations, type ApiWebhookView } from '../../operations/api';
import { dateTime } from '../../lib/dateTimeFormat';
import { Button } from '../ui/button';
import { confirmDialog } from '../ui/ConfirmDialog';
import { useSettingsGuard } from '../settings/useSettingsGuard';
import { SettingsDisclosure } from '../settings/SettingsLayout';
import { CopyButton, SecretField } from './IntegrationFields';

/** The full key is shown once, right after it is created; afterwards only its prefix is known. */
function ApiKeyCard({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const queryKey = ['operations', slug, 'api-key'];
  const query = useQuery({ queryKey, queryFn: () => operations.apiKey(slug) });
  const [created, setCreated] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const configured = !!query.data?.configured;
  const create = async () => {
    if (configured && !(await confirmDialog({ title: 'Regenerate API key?', message: 'The current key stops working now. Systems using it must switch to the new one.', confirmLabel: 'Regenerate key' }))) return;
    setBusy(true);
    try {
      const result = await operations.createApiKey(slug);
      setCreated(result.key); queryClient.setQueryData(queryKey, { ...result, key: undefined });
      setNotice('New API key created. Copy it now; it will not be shown again.');
    } catch (error) { setNotice(failure(error)); } finally { setBusy(false); }
  };
  return <SettingsDisclosure title="API key" description="Authenticates requests from your systems.">
    {query.error ? <p role="alert" className="text-sm text-rose-700">{query.error.message}</p> : <>
      {created ? <div className="flex flex-wrap items-end gap-2"><div className="min-w-0 flex-1"><Field label="Dispatra API key" readOnly value={created} autoComplete="off" className="app-input font-mono text-xs" /></div>
        <CopyButton value={created} label="Dispatra API key" /></div>
        : <p className="text-sm">{configured ? <>Key <code>{query.data!.prefix}…</code> created {dateTime(query.data!.created_at)}{query.data!.last_used_at ? `, last used ${dateTime(query.data!.last_used_at)}` : ', not used yet'}.</> : 'No API key yet.'}</p>}
      <p className="text-xs text-app-muted">Send it as <code>Authorization: Bearer &lt;key&gt;</code> with an <code>Idempotency-Key</code> on changes. It can use the endpoints listed below.</p>
      <div><Button type="button" variant="outline" size="sm" disabled={busy || query.isPending} onClick={create}>{configured ? 'Regenerate' : 'Create API key'}</Button></div>
      {notice && <p role="status" className="text-sm text-app-muted">{notice}</p>}
    </>}
  </SettingsDisclosure>;
}

function ResourceCard({ resource }: { resource: ApiResource }) {
  return <SettingsDisclosure title={resource.title} description={resource.description}>
    <table aria-label={resource.title} className="w-full text-left text-sm"><tbody>{resource.endpoints.map(endpoint => <tr key={endpoint.method + endpoint.path}>
      <td className="w-16 py-1.5 align-top"><span className="rounded-full border border-app-border px-2 py-0.5 text-xs font-medium">{endpoint.method}</span></td>
      <td className="py-1.5"><code className="break-all text-xs">{endpoint.path}</code><div className="text-xs text-app-muted">{endpoint.label}</div></td>
    </tr>)}</tbody></table>
    {resource.id === 'orders' && <details className="group">
      <summary className="cursor-pointer text-sm font-medium">Example create request</summary>
      <pre aria-label="Example create-order request" className="mt-3 max-w-full overflow-x-auto rounded-lg bg-app-sidebar p-4 text-xs leading-5"><code>{JSON.stringify(exampleBooking, null, 2)}</code></pre>
    </details>}
  </SettingsDisclosure>;
}

const failure = (error: unknown) => error instanceof Error ? error.message : 'Could not reach Dispatra. Try again.';

function WebhooksForm({ saved, onSave }: { saved: ApiWebhookView | null; onSave: (url: string, secret: string) => Promise<ApiWebhookView> }) {
  const [url, setUrl] = useState(saved?.url ?? '');
  const [secret, setSecret] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const dirty = url !== (saved?.url ?? '') || !!secret;
  useSettingsGuard(dirty);
  const ready = !httpsUrlError(url.trim()) && (!!secret.trim() || !!saved?.secret_configured);
  const save = async () => {
    setBusy(true);
    try { const next = await onSave(url.trim(), secret.trim()); setUrl(next.url); setSecret(''); setNotice('Saved.'); }
    catch (error) { setNotice(failure(error)); } finally { setBusy(false); }
  };
  return <>
    <Field label="Destination URL" value={url} maxLength={2048} placeholder="https://your-system.com/webhooks/dispatra" onChange={event => { setUrl(event.target.value); setNotice(''); }} />
    <SecretField label="Signing secret" value={secret} saved={!!saved?.secret_configured} generate onChange={value => { setSecret(value); setNotice(''); }} />
    <p className="text-xs text-app-muted">Each request is signed with HMAC-SHA256 of the body in the X-Signature header. Orders from your TMS also carry the TMS order ID.</p>
    <table aria-label="Order events" className="w-full text-left text-sm">
      <thead><tr className="text-xs text-app-muted"><th scope="col" className="pb-2 font-normal">Event</th><th scope="col" className="pb-2 font-normal">Sent when</th></tr></thead>
      <tbody>{ORDER_EVENTS.map(item => <tr key={item.event}><td className="py-1 pr-4"><code className="text-xs">{item.event}</code></td><td className="py-1 text-app-muted">{item.label}</td></tr>)}</tbody>
    </table>
    {saved?.last_delivery_at && <p className="text-xs text-app-muted">Last delivery {dateTime(saved.last_delivery_at)}{saved.last_error ? ' failed; retrying.' : '.'}</p>}
    {notice && <p role="status" className="text-sm text-app-muted">{notice}</p>}
    <Button type="button" disabled={!ready || !dirty || busy} onClick={save}>Save webhook</Button>
  </>;
}

/** Loads the company webhook; the form mounts after the API answers so its draft starts from saved values. */
function WebhooksCard({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const queryKey = ['operations', slug, 'api-webhook'];
  const query = useQuery({ queryKey, queryFn: () => operations.apiWebhook(slug) });
  const save = async (url: string, secret: string) => {
    const view = await operations.saveApiWebhook(slug, { url, secret: secret || null, enabled: true, version: query.data?.version ?? null });
    queryClient.setQueryData(queryKey, view);
    return view;
  };
  return <SettingsDisclosure title="Webhooks" description="Dispatra sends order events to your system.">
    {query.isPending ? <p role="status" className="text-sm text-app-muted">Loading…</p>
      : query.error ? <p role="alert" className="text-sm text-rose-700">{query.error.message}</p>
      : <WebhooksForm saved={query.data ?? null} onSave={save} />}
  </SettingsDisclosure>;
}

export function DispatraApiTab({ slug }: { slug: string }) {
  return <>
    <ApiKeyCard slug={slug} />
    {apiResources(slug).map(resource => <ResourceCard key={resource.id} resource={resource} />)}
    <WebhooksCard slug={slug} />
  </>;
}
