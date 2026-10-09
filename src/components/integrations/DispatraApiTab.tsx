import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, Field } from '../../portal/ui';
import { exampleBooking, httpsUrlError, outboundEvents, testSecret, type OutboundPreview } from '../../integrations/preview';
import { Button } from '../ui/button';
import { confirmDialog } from '../ui/ConfirmDialog';
import { useSettingsGuard } from '../settings/useSettingsGuard';
import { CopyButton, PreviewSecret } from './IntegrationFields';

function ApiAccessCard({ apiKey, onRegenerate }: { apiKey: string; onRegenerate: (key: string) => void }) {
  const [notice, setNotice] = useState('');
  const regenerate = async () => {
    if (!(await confirmDialog({ title: 'Regenerate test API key?', message: 'Only the key in this preview will change. This does not create or revoke live API access.', confirmLabel: 'Regenerate test key' }))) return;
    onRegenerate(testSecret('api')); setNotice('A new test key is ready. It cannot authorize API requests.');
  };
  return <Card title="API Access" description="Use the Dispatra API to create and manage orders from your existing TMS or other business systems.">
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2"><div className="min-w-0 flex-1"><Field label="API key (preview only)" type="password" readOnly value={apiKey} autoComplete="off" /></div>
        <CopyButton value={apiKey} label="test API key" /><Button type="button" variant="outline" size="sm" onClick={regenerate}>Regenerate</Button></div>
      <p className="text-xs leading-5 text-app-muted">API-key access is not available yet. This generated test key is kept only in memory and does not work with the live API.</p>
      {notice && <p role="status" className="text-sm text-app-muted">{notice}</p>}
    </div>
  </Card>;
}

function ApiEndpointsCard({ slug }: { slug: string }) {
  const base = `/api/v1/companies/${slug}/orders`;
  const endpoints = [
    { method: 'POST', path: base, description: 'Create an order.', detail: 'Multiple pickups and drop-offs are supported. Each cargo item links one pickup to one delivery. Replace the example UUIDs with your company’s Shipper, service and vehicle-type IDs and use verified addresses.' },
    { method: 'GET', path: `${base}/{id}`, description: 'Retrieve an order.', detail: 'Use the internal Order UUID, not its public order number. Access is restricted to the authenticated company and account.' },
    { method: 'PUT', path: `${base}/{id}`, description: 'Update an existing order.', detail: 'Send the current version and the complete booking as { "version": 1, "booking": { ... } }. The API enforces which orders can be edited.' },
    { method: 'POST', path: `${base}/{id}/cancel`, description: 'Cancel an order.', detail: 'Send the current record version, for example { "version": 1 }. Cancellation remains subject to the existing order and route rules.' },
  ];
  return <Card title="Order API" description="These are the existing company-scoped order endpoints.">
    <div className="space-y-4">
      <p className="text-xs leading-5 text-app-muted">The current API uses authenticated browser sessions. Mutations require Idempotency-Key, X-Requested-With: Dispatra and an allowed Origin. The preview key above does not replace authentication.</p>
      <div className="divide-y divide-app-border">{endpoints.map((endpoint, index) => <details key={endpoint.path + endpoint.method} className="group py-3">
        <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden"><span className="min-w-0 flex-1 space-y-2"><span className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-app-border px-2.5 py-1 text-xs font-medium">{endpoint.method}</span><code className="min-w-0 break-all text-xs sm:text-sm">{endpoint.path}</code></span><span className="block text-sm text-app-muted">{endpoint.description}</span></span><ChevronDown aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 transition-transform group-open:rotate-180" /></summary>
        <div className="mt-4 space-y-3"><p className="text-xs leading-5 text-app-muted">{endpoint.detail}</p>
          {index === 0 && <><p className="text-xs text-app-muted">Example request. These addresses and UUIDs are illustrative; no request is sent.</p><pre className="max-w-full overflow-x-auto rounded-lg bg-app-sidebar p-4 text-xs leading-5" aria-label="Example create-order request"><code>{JSON.stringify(exampleBooking, null, 2)}</code></pre></>}
        </div>
      </details>)}</div>
    </div>
  </Card>;
}

function OutboundWebhooksCard({ saved, onSave }: { saved: OutboundPreview; onSave: (settings: OutboundPreview) => void }) {
  const [url, setUrl] = useState(saved.url);
  const [secret, setSecret] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = url !== saved.url || !!secret;
  useSettingsGuard(dirty);
  const error = url.trim() ? httpsUrlError(url.trim()) : 'Enter a destination webhook URL.';
  const secretMissing = !secret.trim() && !saved.secretConfigured;
  const save = () => {
    if (error || secretMissing) return;
    const next = url.trim(); setUrl(next); onSave({ url: next, secretConfigured: true, saved: true }); setSecret('');
    setNotice('Outbound webhook preview saved for this workspace session. The secret was cleared. No events will be delivered.');
  };
  return <Card title="Webhooks" description="Receive real-time operational updates from Dispatra in your TMS.">
    <div className="space-y-5">
      <Field label="Destination webhook URL" value={url} maxLength={2048} placeholder="https://customer-tms.com/webhooks/dispatra" onChange={event => { setUrl(event.target.value); setNotice(''); }} />
      <PreviewSecret label="Outbound webhook secret" value={secret} saved={saved.secretConfigured} generate onChange={value => { setSecret(value); setNotice(''); }} />
      <div><h3 className="text-sm font-medium">Proposed outbound events</h3><p className="mt-1 text-xs leading-5 text-app-muted">Dispatra → External TMS. These are planned integration event names; they are not a list of currently delivered events.</p>
        <div className="mt-3 flex flex-wrap gap-2">{outboundEvents.map(event => <code key={event} className="rounded-full border border-app-border px-3 py-1 text-xs">{event}</code>)}</div></div>
      <p className="text-xs text-app-muted">Status: {saved.saved ? 'Configured in preview' : 'Not configured'} · Delivery is not active.</p>
      {(error || secretMissing) && <p className="text-xs text-app-muted">{error || 'Generate or enter a test webhook secret.'}</p>}
      {notice && <p role="status" className="text-sm text-app-muted">{notice}</p>}
      <Button type="button" disabled={!!error || secretMissing || !dirty} onClick={save}>Save webhook changes</Button>
    </div>
  </Card>;
}

export function DispatraApiTab({ slug, apiKey, outbound, onRegenerate, onSave }: { slug: string; apiKey: string; outbound: OutboundPreview; onRegenerate: (key: string) => void; onSave: (settings: OutboundPreview) => void }) {
  return <div className="space-y-6"><ApiAccessCard apiKey={apiKey} onRegenerate={onRegenerate} /><ApiEndpointsCard slug={slug} /><OutboundWebhooksCard saved={outbound} onSave={onSave} /></div>;
}
