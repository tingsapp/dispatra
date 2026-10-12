import { useState, type ReactNode } from 'react';
import { fleetSummary, tmsErrors, tmsWebhookUrl, type TmsFieldMap, type TmsForm, type TmsRecord } from '../../integrations/preview';
import type { FleetSyncResult } from '../../operations/api';
import { dateTime } from '../../lib/dateTimeFormat';
import { Button } from '../ui/button';
import { Switch } from '../ui/Switch';
import { Select } from '../ui/Select';
import { useSettingsGuard } from '../settings/useSettingsGuard';
import { SettingsDisclosure } from '../settings/SettingsLayout';
import { CopyButton, Field, SecretField } from './IntegrationFields';
import { EndpointField, FieldMapButton } from './TmsFieldMap';

const intervalLabel = (minutes: number) => minutes % 60 ? `Every ${minutes} minute${minutes === 1 ? '' : 's'}` : `Every ${minutes / 60} hour${minutes === 60 ? '' : 's'}`;

const failure = (error: unknown) => error instanceof Error ? error.message : 'Could not reach Dispatra. Try again.';

/** Saved settings come from the API; `onSave` returns the saved form and `onTest` checks the saved connection. */
export function ConnectedTmsTab({ saved, slug, importedRateCard, lastSync, statusDelivery, review, onSave, onTest, onSync }: {
  saved: TmsForm; slug: string; importedRateCard?: string; lastSync?: { at: string; result: FleetSyncResult } | null;
  statusDelivery?: { at: string; failing: boolean } | null; review?: ReactNode;
  onSave: (settings: TmsForm, credential: string, webhookSecret: string) => Promise<TmsForm>; onTest: () => Promise<{ ok: boolean; message: string }>;
  onSync: () => Promise<FleetSyncResult>;
}) {
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [credential, setCredential] = useState('');
  const [secret, setSecret] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved) || !!credential || !!secret;
  useSettingsGuard(dirty);
  const patch = (changes: Partial<TmsForm>) => { setDraft(current => ({ ...current, ...changes })); setNotice(''); };
  const mapFields = (record: TmsRecord) => (map: TmsFieldMap) => patch({ fieldMaps: { ...draft.fieldMaps, [record]: map } });
  const errors = tmsErrors(draft, credential, secret);
  const webhookUrl = tmsWebhookUrl(window.location.origin, slug);
  const savedReady = saved.version !== null && saved.enabled && !dirty;
  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    try { setNotice(await action()); } catch (error) { setNotice(failure(error)); } finally { setBusy(false); }
  };
  const save = () => run(async () => {
    const next = await onSave(draft, credential, secret);
    setDraft(next); setCredential(''); setSecret('');
    return 'Saved.';
  });
  return <>
    <SettingsDisclosure title="Connection" description="Your TMS API address and key.">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Base API URL" value={draft.baseApiUrl} placeholder="https://api.your-tms.com" onChange={event => patch({ baseApiUrl: event.target.value })} />
        <div className="space-y-1.5"><span className="text-sm font-medium text-slate-700">Authentication type</span><Select aria-label="Authentication type" value={draft.authType} onValueChange={value => { setCredential(''); patch({ authType: value as TmsForm['authType'], credentialConfigured: false }); }} options={[{ value: 'api_key', label: 'API Key' }, { value: 'bearer', label: 'Bearer Token' }]} className="w-full" /></div>
      </div>
      <SecretField label={draft.authType === 'api_key' ? 'API key' : 'Bearer token'} value={credential} saved={draft.credentialConfigured} onChange={value => { setCredential(value); patch({ credentialConfigured: false }); }} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" disabled={!savedReady || busy} onClick={() => run(async () => (await onTest()).message)}>Test connection</Button>
        <label className="flex items-center gap-3 text-sm"><span>{draft.enabled ? 'Enabled' : 'Disabled'}</span>
          <Switch aria-label="Enable TMS integration" checked={draft.enabled} onCheckedChange={enabled => patch({ enabled })} /></label>
      </div>
    </SettingsDisclosure>
    <SettingsDisclosure title="Driver & Vehicle APIs" description="Where Dispatra reads your drivers and vehicles.">
      <div className="grid gap-5 sm:grid-cols-2">
        <EndpointField label="Drivers endpoint" record="driver" value={draft.driversEndpoint} map={draft.fieldMaps.driver} placeholder="/drivers" onChange={driversEndpoint => patch({ driversEndpoint })} onMap={mapFields('driver')} />
        <EndpointField label="Vehicles endpoint" record="vehicle" value={draft.vehiclesEndpoint} map={draft.fieldMaps.vehicle} placeholder="/vehicles" onChange={vehiclesEndpoint => patch({ vehiclesEndpoint })} onMap={mapFields('vehicle')} />
        <div className="space-y-1.5"><span className="text-sm font-medium text-slate-700">Sync interval</span><Select aria-label="Sync interval" value={String(draft.fleetSyncMinutes)} onValueChange={value => patch({ fleetSyncMinutes: Number(value) as TmsForm['fleetSyncMinutes'] })} options={[15, 60, 360, 1440].map(value => ({ value: String(value), label: intervalLabel(value) }))} className="w-full" /></div>
      </div>
      <p className="text-xs text-app-muted">Drivers get a login and receive orders after signing in to the driver app.</p>
      <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" disabled={!savedReady || busy} onClick={() => run(async () => fleetSummary(await onSync()))}>Sync now</Button>
        {!savedReady && <span className="text-xs text-app-muted">Save first.</span>}</div>
      {lastSync && <div className="space-y-1 text-xs text-app-muted">
        <p>Last sync {dateTime(lastSync.at)}: {fleetSummary(lastSync.result)}</p>
        {lastSync.result.issues.length > 0 && <ul aria-label="Sync issues" className="space-y-0.5">
          {lastSync.result.issues.slice(0, 5).map((issue, index) => <li key={index}>{issue.kind === 'driver' ? 'Driver' : 'Vehicle'} {issue.id || '(no ID)'}: {issue.reason}</li>)}
          {lastSync.result.issues.length > 5 && <li>and {lastSync.result.issues.length - 5} more</li>}
        </ul>}
      </div>}
    </SettingsDisclosure>
    <SettingsDisclosure title="Order webhook/polling" description={draft.syncMethod === 'webhook' ? 'Webhoook' : `API Polling, ${intervalLabel(draft.pollIntervalMinutes).toLowerCase()}`}>
      <fieldset className="space-y-3"><legend className="mb-3 text-sm font-medium">Receive orders by</legend>
        {([{ value: 'webhook', title: 'Webhoook', description: 'Your TMS sends orders to Dispatra.' },
          { value: 'polling', title: 'API Polling', description: 'Dispatra checks your TMS for orders.' }] as const).map(method =>
          <label key={method.value} className={`flex cursor-pointer gap-3 rounded-lg border p-4 ${draft.syncMethod === method.value ? 'border-slate-400' : 'border-app-border'}`}>
            <input type="radio" name="tms-sync-method" value={method.value} checked={draft.syncMethod === method.value} onChange={() => patch({ syncMethod: method.value })} className="mt-0.5 accent-slate-900" />
            <span><span className="block text-sm font-medium">{method.title}</span><span className="mt-1 block text-xs leading-5 text-app-muted">{method.description}</span></span>
          </label>)}
      </fieldset>
      {draft.syncMethod === 'webhook' ? <>
        <div className="space-y-2"><div className="flex flex-wrap items-start gap-2">
          <div className="grid min-w-0 flex-1 gap-1.5 text-sm text-slate-700">
            <div className="flex h-5 items-center gap-1"><label htmlFor="tms-webhook-url">Webhook URL</label><FieldMapButton record="order" map={draft.fieldMaps.order} onMap={mapFields('order')} /></div>
            <input id="tms-webhook-url" readOnly value={webhookUrl} className="app-input w-full min-w-0 font-mono text-xs" /></div>
          <div className="pt-6"><CopyButton value={webhookUrl} label="Webhook URL" /></div>
        </div><p className="text-xs text-app-muted">Add this URL and the secret to your TMS webhook settings. The TMS signs each request with HMAC-SHA256 of the body in the X-Signature header.</p></div>
        <SecretField label="Webhook secret" value={secret} saved={draft.webhookSecretConfigured} generate onChange={value => { setSecret(value); patch({ webhookSecretConfigured: false }); }} />
      </> : <div className="grid gap-5 sm:grid-cols-2">
        <EndpointField label="Orders endpoint" record="order" value={draft.ordersEndpoint} map={draft.fieldMaps.order} placeholder="/orders" onChange={ordersEndpoint => patch({ ordersEndpoint })} onMap={mapFields('order')} />
        <div className="space-y-1.5"><span className="text-sm font-medium text-slate-700">Poll interval</span><Select aria-label="Poll interval" value={String(draft.pollIntervalMinutes)} onValueChange={value => patch({ pollIntervalMinutes: Number(value) as TmsForm['pollIntervalMinutes'] })} options={[1, 5, 15].map(value => ({ value: String(value), label: intervalLabel(value) }))} className="w-full" /></div>
      </div>}
      <Field label="Status endpoint" value={draft.statusEndpoint} placeholder="/orders/{id}/status" spellCheck={false} onChange={event => patch({ statusEndpoint: event.target.value })} />
      <p className="text-xs leading-5 text-app-muted">Order status is sent back to your TMS at this endpoint; {'{id}'} is the TMS order ID. {importedRateCard ? `Orders use the ${importedRateCard} rate card.` : 'Add an Imported price rate card to keep TMS prices.'}</p>
      {statusDelivery && <p className="text-xs text-app-muted">{statusDelivery.failing ? `The TMS did not accept the last status update (${dateTime(statusDelivery.at)}). Retrying.` : `Last status update ${dateTime(statusDelivery.at)}.`}</p>}
      {review}
    </SettingsDisclosure>
    <div className="space-y-4">
      {notice && <p role="status" className="text-sm text-app-muted">{notice}</p>}
      <Button type="button" disabled={!!errors.length || !dirty || busy} onClick={save}>Save changes</Button>
    </div>
  </>;
}
