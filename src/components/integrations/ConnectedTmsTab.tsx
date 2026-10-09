import { useState } from 'react';
import { Card } from '../../portal/ui';
import { previewWebhookUrl, inboundEvents, tmsErrors, type TmsPreview } from '../../integrations/preview';
import { Button } from '../ui/button';
import { Switch } from '../ui/Switch';
import { Select } from '../ui/Select';
import { useSettingsGuard } from '../settings/useSettingsGuard';
import { CopyButton, Field, PreviewSecret } from './IntegrationFields';

const statuses = { not_configured: 'Not configured', connected: 'Connected (mock)', error: 'Connection error (mock)', disabled: 'Disabled' };
export function ConnectedTmsTab({ saved, slug, onSave }: { saved: TmsPreview; slug: string; onSave: (settings: TmsPreview) => void }) {
  const [draft, setDraft] = useState(saved);
  const [credential, setCredential] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved) || !!credential || !!webhookSecret;
  useSettingsGuard(dirty);
  const patch = (changes: Partial<TmsPreview>) => { setDraft(current => ({ ...current, ...changes, status: 'not_configured' })); setNotice(''); };
  const errors = tmsErrors(draft, credential, webhookSecret);
  const webhookUrl = previewWebhookUrl(slug, draft.id);
  const save = () => {
    if (errors.length) return;
    const next = { ...draft, name: draft.name.trim(), tmsName: draft.tmsName.trim(), baseApiUrl: draft.baseApiUrl.trim(),
      credentialConfigured: draft.credentialConfigured || !!credential.trim(), webhookSecretConfigured: draft.webhookSecretConfigured || !!webhookSecret.trim() };
    setDraft(next); onSave(next); setCredential(''); setWebhookSecret('');
    setNotice('Preview settings saved for this workspace session. Credentials were cleared. No synchronization is active.');
  };
  const test = () => {
    if (errors.length || !draft.enabled) return;
    setDraft(current => ({ ...current, status: 'connected' }));
    setNotice('Mock connection test passed. No request was sent to your TMS and no orders were imported.');
  };
  return <Card title="Connected TMS" description="Configure how your transportation system would send orders to Dispatra.">
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Integration name" value={draft.name} maxLength={160} placeholder="Acme TMS" onChange={event => patch({ name: event.target.value })} />
        <Field label="TMS name" value={draft.tmsName} maxLength={160} placeholder="Acme Transportation Management System" onChange={event => patch({ tmsName: event.target.value })} />
      </div>
      <div className="flex items-center justify-between gap-4"><div><h3 className="text-sm font-medium">Enabled</h3><p className="mt-1 text-xs text-app-muted">Enable this configuration in the preview.</p></div>
        <Switch aria-label="Enable TMS integration" checked={draft.enabled} onCheckedChange={enabled => patch({ enabled })} /></div>
      <fieldset className="space-y-3"><legend className="mb-3 text-sm font-medium">Sync method</legend>
        {([{ value: 'webhook', title: 'Events / Webhooks', description: 'Receive order changes in real time when your TMS sends events to Dispatra.' },
          { value: 'polling', title: 'API Polling', description: 'Periodically retrieve new or updated orders from your TMS API.' }] as const).map(method =>
          <label key={method.value} className={`flex cursor-pointer gap-3 rounded-lg border p-4 ${draft.syncMethod === method.value ? 'border-slate-400' : 'border-app-border'}`}>
            <input type="radio" name={`sync-${draft.id}`} value={method.value} checked={draft.syncMethod === method.value} onChange={() => patch({ syncMethod: method.value })} className="mt-0.5 accent-slate-900" />
            <span><span className="block text-sm font-medium">{method.title}</span><span className="mt-1 block text-xs leading-5 text-app-muted">{method.description}</span></span>
          </label>)}
      </fieldset>
      {draft.syncMethod === 'webhook' ? <div className="space-y-5">
        <div className="space-y-2"><div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1"><Field label="Dispatra webhook URL (example)" readOnly value={webhookUrl} className="app-input w-full min-w-0 font-mono text-xs" /></div>
          <div className="pt-6"><CopyButton value={webhookUrl} label="example webhook URL" /></div>
        </div><p className="text-xs text-app-muted">Example address only. A working URL will be issued when webhook support is available.</p></div>
        <PreviewSecret label="Inbound webhook secret" value={webhookSecret} saved={draft.webhookSecretConfigured} generate onChange={value => { setWebhookSecret(value); patch({ webhookSecretConfigured: false }); }} />
        <div><h3 className="text-sm font-medium">Accepted inbound events</h3><p className="mt-1 text-xs text-app-muted">External TMS → Dispatra. Proposed event names; receiving is not active.</p>
          <div className="mt-3 flex flex-wrap gap-2">{inboundEvents.map(event => <code key={event} className="rounded-full border border-app-border px-3 py-1 text-xs">{event}</code>)}</div></div>
      </div> : <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Base API URL" value={draft.baseApiUrl} placeholder="https://api.example-tms.com" onChange={event => patch({ baseApiUrl: event.target.value })} />
          <Field label="Orders endpoint" value={draft.ordersEndpoint} placeholder="/orders" onChange={event => patch({ ordersEndpoint: event.target.value })} />
          <div className="space-y-1.5"><span className="text-sm font-medium text-slate-700">Authentication type</span><Select aria-label="Authentication type" value={draft.authType} onValueChange={value => { setCredential(''); patch({ authType: value as TmsPreview['authType'], credentialConfigured: false }); }} options={[{ value: 'api_key', label: 'API Key' }, { value: 'bearer', label: 'Bearer Token' }]} className="w-full" /></div>
          <div className="space-y-1.5"><span className="text-sm font-medium text-slate-700">Poll interval</span><Select aria-label="Poll interval" value={String(draft.pollIntervalMinutes)} onValueChange={value => patch({ pollIntervalMinutes: Number(value) as TmsPreview['pollIntervalMinutes'] })} options={[1, 5, 15].map(value => ({ value: String(value), label: `Every ${value} minute${value === 1 ? '' : 's'}` }))} className="w-full" /></div>
        </div>
        <PreviewSecret label="Credential" value={credential} saved={draft.credentialConfigured} onChange={value => { setCredential(value); patch({ credentialConfigured: false }); }} />
        <fieldset><legend className="mb-3 text-sm font-medium">Import options</legend><div className="flex flex-wrap gap-4">
          {([{ key: 'importNewOrders', label: 'New orders' }, { key: 'importOrderUpdates', label: 'Order updates' }, { key: 'importOrderCancellations', label: 'Order cancellations' }] as const).map(option =>
            <label key={option.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft[option.key]} onChange={event => patch({ [option.key]: event.target.checked })} className="accent-slate-900" />{option.label}</label>)}
        </div></fieldset>
        <p className="text-xs text-app-muted">Polling is not active. A future connector will require a supported order format.</p>
      </div>}
      <div className="border-t border-app-border pt-5 space-y-4">
        <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm"><div className="flex items-center gap-2"><dt className="text-app-muted">Status</dt><dd className="rounded-full border border-app-border px-2.5 py-1 text-xs">{statuses[draft.enabled ? draft.status : 'disabled']}</dd></div><div className="flex items-center gap-2"><dt className="text-app-muted">Last sync</dt><dd>Never</dd></div></dl>
        {errors.length > 0 && <ul aria-label="Configuration requirements" className="space-y-1 text-xs text-app-muted">{errors.map(error => <li key={error}>{error}</li>)}</ul>}
        {notice && <p role="status" className="text-sm text-app-muted">{notice}</p>}
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!!errors.length || !draft.enabled} onClick={test}>Test connection</Button><Button type="button" disabled={!!errors.length || !dirty} onClick={save}>Save changes</Button></div>
      </div>
    </div>
  </Card>;
}
