import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { operations, allOperations } from '../operations/api';
import { Button, Card, Notice } from './ui';
import type { components } from './schema';

type Route = components['schemas']['RouteView'];
type Visit = components['schemas']['RouteVisitView'];
const position = () => new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 }));
const contentBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] ?? ''); reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

function VisitControls({ slug, route, visit, onChange }: { slug: string; route: Route; visit: Visit; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [recipient, setRecipient] = useState('');
  const [unattended, setUnattended] = useState(false);
  const [safePlacement, setSafePlacement] = useState(false);
  const cache = useQueryClient();
  const evidenceQuery = useQuery({ queryKey: ['driver-evidence', slug, visit.stop_id], queryFn: () => operations.stopEvidence(slug, visit.stop_id), enabled: visit.stop.kind === 'DROPOFF' && route.status === 'IN_PROGRESS' && !!visit.arrived_at });
  const evidence = evidenceQuery.data ?? [];
  const [issueKind, setIssueKind] = useState<'FAILED_PICKUP' | 'FAILED_DELIVERY' | 'SHORT_LOAD' | 'WRONG_ADDRESS' | 'UNSAFE' | 'VEHICLE' | 'OTHER'>('OTHER');
  const [issueText, setIssueText] = useState('');
  const [issueOpen, setIssueOpen] = useState(false);
  const current = route.stops.find(item => item.status !== 'COMPLETED')?.id === visit.id;
  const call = async (action: () => Promise<unknown>) => { setBusy(true); setError(undefined); try { await action(); await onChange(); } catch (cause) { setError(cause); } finally { setBusy(false); } };
  const upload = async (kind: 'PHOTO' | 'SIGNATURE', file?: File) => {
    if (!file) return;
    if (file.size > 2_000_000 || !['image/png','image/jpeg'].includes(file.type)) { setError(new Error('Choose a PNG or JPEG image up to 2 MB.')); return; }
    setBusy(true); setError(undefined);
    try { const saved = await operations.uploadEvidence(slug, visit.stop_id, kind, await contentBase64(file), file.type as 'image/png' | 'image/jpeg'); if (typeof saved.id !== 'string' || typeof saved.kind !== 'string') throw new Error('Evidence response was incomplete.'); await cache.invalidateQueries({ queryKey: ['driver-evidence', slug, visit.stop_id] }); }
    catch (cause) { setError(cause); } finally { setBusy(false); }
  };
  const linked = route.items?.filter(item => visit.stop.kind === 'PICKUP' ? item.pickup_id === visit.stop_id : item.delivery_id === visit.stop_id) ?? [];
  const quantities = Object.fromEntries(linked.map(item => [item.id, item.quantity]));
  return <li className="rounded-lg border border-slate-200 p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{visit.position + 1}. {visit.stop.kind === 'PICKUP' ? 'Pickup' : 'Delivery'}</p><p className="text-sm text-slate-600">{visit.stop.address.text}</p></div><span className="text-xs text-slate-500">{visit.status.replaceAll('_',' ')}</span></div>
    <p className="text-xs text-slate-500">{linked.map(item => `${item.quantity} × ${item.description || 'package'}`).join(', ')}</p>
    <Notice error={error || evidenceQuery.error} />
    {current && route.status === 'IN_PROGRESS' && <div className="space-y-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setIssueOpen(value => !value)}>Report issue</Button>{issueOpen && <div className="flex flex-wrap gap-2"><select aria-label="Issue type" className="app-input" value={issueKind} onChange={event => setIssueKind(event.target.value as typeof issueKind)}><option value="OTHER">Other</option><option value="FAILED_PICKUP">Failed pickup</option><option value="FAILED_DELIVERY">Failed delivery</option><option value="SHORT_LOAD">Short load</option><option value="WRONG_ADDRESS">Wrong address</option><option value="UNSAFE">Unsafe location</option><option value="VEHICLE">Vehicle issue</option></select><input aria-label="Issue details" className="app-input flex-1" minLength={3} value={issueText} onChange={event => setIssueText(event.target.value)} placeholder="Describe the issue" /><Button type="button" disabled={busy || issueText.trim().length < 3} onClick={() => call(async () => { await operations.reportStopIssue(slug, visit.stop_id, issueKind, issueText.trim()); setIssueOpen(false); setIssueText(''); })}>Submit issue</Button></div>}</div>}
    {current && route.status === 'IN_PROGRESS' && !visit.arrived_at && <Button type="button" disabled={busy} onClick={() => call(() => operations.arriveStop(slug, route, visit.id))}>Record arrival</Button>}
    {current && route.status === 'IN_PROGRESS' && visit.arrived_at && <div className="space-y-3">
      {visit.stop.kind === 'DROPOFF' && <>
        {visit.stop.unattended_allowed && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unattended} onChange={event => setUnattended(event.target.checked)} />Leave unattended</label>}
        {unattended ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={safePlacement} onChange={event => setSafePlacement(event.target.checked)} />Safe placement confirmed</label>
          : <label className="block text-sm">Recipient name<input className="app-input mt-1 w-full" value={recipient} onChange={event => setRecipient(event.target.value)} required /></label>}
        <label className="block text-sm">{unattended ? 'Delivery photo' : 'Signature image'}<input className="app-input mt-1 w-full" type="file" accept="image/png,image/jpeg" disabled={busy} onChange={event => void upload(unattended ? 'PHOTO' : 'SIGNATURE', event.target.files?.[0])} /></label>
        {visit.stop.photo_required && !unattended && <label className="block text-sm">Required delivery photo<input className="app-input mt-1 w-full" type="file" accept="image/png,image/jpeg" disabled={busy} onChange={event => void upload('PHOTO', event.target.files?.[0])} /></label>}
        {evidence.length > 0 && <p className="text-xs text-emerald-700">{evidence.map(item => item.kind).join(', ')} uploaded</p>}
      </>}
      <Button type="button" disabled={busy || visit.stop.kind === 'DROPOFF' && (unattended ? !safePlacement || !evidence.some(item => item.kind === 'PHOTO') : !recipient.trim() || !evidence.some(item => item.kind === 'SIGNATURE') || visit.stop.photo_required && !evidence.some(item => item.kind === 'PHOTO'))} onClick={() => call(() => operations.completeStop(slug, route, visit.id, { quantities, recipient_name: unattended ? '' : recipient.trim(), unattended, safe_placement: unattended && safePlacement, evidence_ids: evidence.map(item => item.id) }))}>Confirm {visit.stop.kind === 'PICKUP' ? 'pickup' : 'delivery'}</Button>
    </div>}
  </li>;
}

export function DriverPortal({ slug }: { slug: string }) {
  const cache = useQueryClient();
  const profile = useQuery({ queryKey: ['driver-profile', slug], queryFn: () => operations.driverProfile(slug) });
  const routes = useQuery({ queryKey: ['driver-routes', slug], queryFn: () => allOperations.driverRoutes(slug) });
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const refresh = async () => { await Promise.all([cache.invalidateQueries({ queryKey: ['driver-profile', slug] }), cache.invalidateQueries({ queryKey: ['driver-routes', slug] })]); };
  const call = async (action: () => Promise<unknown>) => { setBusy(true); setError(undefined); try { await action(); } catch (cause) { setError(cause); } finally { await refresh(); setBusy(false); } };
  return <div className="space-y-6">
    <Notice error={profile.error || routes.error || error} />
    {profile.isPending && <p role="status">Loading your driver profile…</p>}
    {profile.data && <Card title={profile.data.name} description={`${profile.data.service_city} · ${profile.data.email}`}>
      <div className="space-y-3 text-sm"><p>{profile.data.address.text}</p><p>Status: {profile.data.duty ? 'On duty' : 'Off duty'}</p>
        {profile.data.duty ? <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => call(() => operations.endDuty(slug, profile.data!.duty!))}>End duty</Button><Button type="button" disabled={busy} onClick={() => call(async () => operations.driverLocation(slug, profile.data!.duty!.id, await position()))}>Share current location</Button></div>
          : <Button type="button" disabled={busy} onClick={() => call(async () => { await position(); const duty = await operations.startDuty(slug); await operations.driverLocation(slug, duty.id, await position()); })}>Start duty</Button>}
      </div>
    </Card>}
    <Card title="My routes" description="Complete stops in the planned order. Record arrival before confirming cargo.">
      {routes.isPending && <p role="status" className="text-sm text-slate-500">Loading routes…</p>}
      <div className="space-y-4">{routes.data?.filter(route => route.status === 'PLANNED' || route.status === 'IN_PROGRESS').map(route => <section key={route.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-medium">Route {route.id.slice(0, 8)}</h3><p className="text-sm text-slate-500">{route.status.replaceAll('_',' ')} · {route.stops.length} stops</p></div>
          {route.status === 'PLANNED' && <Button type="button" disabled={busy || !profile.data?.duty} onClick={() => call(() => operations.startRoute(slug, route))}>Start route</Button>}
          {route.status === 'IN_PROGRESS' && route.stops.every(visit => visit.status === 'COMPLETED') && <Button type="button" disabled={busy} onClick={() => call(() => operations.finishRoute(slug, route))}>Finish route</Button>}
        </div>
        <ol className="space-y-3">{route.stops.map(visit => <VisitControls key={visit.id} slug={slug} route={route} visit={visit} onChange={refresh} />)}</ol>
      </section>)}</div>
      {routes.data?.filter(route => route.status === 'PLANNED' || route.status === 'IN_PROGRESS').length === 0 && <p className="text-sm text-slate-500">No active routes assigned.</p>}
    </Card>
  </div>;
}
