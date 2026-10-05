import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { APIProvider, Map, Marker, Polyline, useMap } from '@vis.gl/react-google-maps';
import { AlertTriangle, Check, Truck } from 'lucide-react';
import { operations } from '../../operations/api';
import type { components } from '../../portal/schema';
import { GoogleOverlayMarker } from '../monitor/GoogleOverlayMarker';
import { formatWhen } from './OrderDossierSections';

type Tracking = components['schemas']['TrackingView'];
const STEPS = ['Booked', 'Driver assigned', 'Picked up', 'On the way', 'Delivered'];
const STEP_INDEX: Record<Tracking['stage'], number> = { BOOKED: 0, ASSIGNED: 1, TO_PICKUP: 1, IN_TRANSIT: 3, OUT_FOR_DELIVERY: 3, DELIVERED: 4, CANCELLED: -1 };
const time = (iso: string | null | undefined, timeZone: string) => iso ? new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone }) : '';
const ago = (iso: string, now: number) => { const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000)); return minutes < 1 ? 'just now' : `${minutes} min ago`; };

/** A live ETA exists only once the driver has started the route; before that the plan is shown instead. */
export const trackingMoving = (t: Tracking) => ['TO_PICKUP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(t.stage);

/** One-line state of the shipment, as a carrier tracking page would phrase it. */
export function trackingHeadline(t: Tracking, timeZone: string): string {
  const name = t.driver?.first_name;
  switch (t.stage) {
    case 'BOOKED': return 'Booked – waiting for a driver';
    case 'ASSIGNED': { const pickup = t.stops.find(s => s.kind === 'PICKUP')?.planned_at; return `${name ? `${name} is` : 'A driver is'} assigned${pickup ? ` · pickup planned ${formatWhen(pickup, timeZone)}` : ''}`; }
    case 'TO_PICKUP': return t.stops_before_next ? `Driver is on the route · ${t.stops_before_next} ${t.stops_before_next === 1 ? 'stop' : 'stops'} before your pickup` : `${name ?? 'The driver'} is heading to your pickup`;
    case 'IN_TRANSIT': return `Picked up · ${t.stops_before_next ?? 0} ${t.stops_before_next === 1 ? 'stop' : 'stops'} before your delivery`;
    case 'OUT_FOR_DELIVERY': return 'Out for delivery – your stop is next';
    case 'DELIVERED': { const last = [...t.stops].reverse().find(s => s.kind === 'DROPOFF'); return `Delivered${last?.completed_at ? ` ${formatWhen(last.completed_at, timeZone)}` : ''}`; }
    case 'CANCELLED': return 'Order cancelled';
  }
}

/** Live tracking for one Order: progress, ETA, a map (live driver position when allowed), stops and timeline. */
export function OrderTracking({ slug, orderId, timeZone, version }: { slug: string; orderId: string; timeZone: string; version?: number }) {
  const query = useQuery({ queryKey: ['tracking', slug, orderId], queryFn: () => operations.orderTracking(slug, orderId),
    refetchInterval: data => data.state.data && ['DELIVERED', 'CANCELLED'].includes(data.state.data.stage) ? false : 30_000 });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const t = query.data;
  if (query.isPending) return <section className="rounded-xl border border-slate-200 p-5 text-sm"><h4 className="app-section-title">Tracking</h4><p role="status" className="mt-2 text-slate-500">Loading tracking…</p></section>;
  if (!t) return <section className="rounded-xl border border-slate-200 p-5 text-sm"><h4 className="app-section-title">Tracking</h4><p role="alert" className="mt-2 text-red-700">{query.error instanceof Error ? query.error.message : 'Tracking is unavailable.'}</p></section>;
  const step = STEP_INDEX[t.stage];
  const active = !['BOOKED', 'DELIVERED', 'CANCELLED'].includes(t.stage);
  const target = t.stops.find(s => s.eta);
  return <section className="rounded-xl border border-slate-200 p-5 space-y-4 text-sm" aria-label="Tracking">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h4 className="app-section-title">Tracking</h4><p className="mt-1 text-base font-medium text-slate-900">{trackingHeadline(t, timeZone)}</p>
        {t.driver && t.stage !== 'DELIVERED' && <p className="text-xs text-slate-500">Driver {t.driver.first_name}{t.driver.vehicle_type ? ` · ${t.driver.vehicle_type}` : ''}</p>}</div>
      {t.eta && trackingMoving(t) && <div className="text-right"><p className="text-xs text-slate-500">{target?.kind === 'PICKUP' ? 'Pickup ETA' : 'Delivery ETA'}</p><p className="text-lg font-semibold text-slate-900">{time(t.eta, timeZone)}</p>
        {t.late ? <p className="text-xs font-medium text-rose-700">Running late</p> : t.delay_minutes >= 10 ? <p className="text-xs text-amber-700">About {t.delay_minutes} min behind schedule</p> : null}</div>}
    </div>
    {step >= 0 && <ol className="grid grid-cols-5 gap-1" aria-label="Shipment progress">{STEPS.map((label, index) => {
      const done = index < step || t.stage === 'DELIVERED'; const current = index === step && t.stage !== 'DELIVERED';
      return <li key={label} aria-current={current ? 'step' : undefined} className="space-y-1.5">
        <div className={`h-1.5 rounded-full ${done ? 'bg-emerald-500' : current ? 'bg-blue-600' : 'bg-slate-200'}`} />
        <p className={`text-[11px] leading-tight ${done || current ? 'font-medium text-slate-800' : 'text-slate-400'}`}>{label}</p>
      </li>;
    })}</ol>}
    {t.open_issue && <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />The driver reported an issue with this order. Dispatch is handling it.</p>}
    {t.stage !== 'BOOKED' && t.stage !== 'CANCELLED' && <TrackingMap slug={slug} tracking={t} version={version} />}
    {active && <p className="text-xs text-slate-500">
      {t.location ? <>Live location updated {ago(t.location.captured_at, now)}.</> : t.location_stale ? 'Live location is temporarily unavailable.' : t.stage === 'ASSIGNED' ? 'Live location starts when the driver begins the route.' : 'Live location appears when the driver is heading to your stop.'}
      {' '}Tracking refreshes every 30 seconds.</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <div><p className="app-label">Stops</p><ul className="mt-1 space-y-2">{t.stops.map((stop, index) => <li key={stop.id} className="flex gap-2">
        <span className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full text-[10px] font-semibold text-white ${stop.completed_at ? 'bg-emerald-500' : stop.kind === 'PICKUP' ? 'bg-slate-700' : 'bg-blue-600'}`}>{stop.completed_at ? <Check className="h-3 w-3" /> : stop.kind === 'PICKUP' ? 'P' : 'D'}</span>
        <div className="min-w-0"><p className="truncate text-slate-800">{index + 1}. {stop.address.text}</p>
          <p className="text-xs text-slate-500">{stop.completed_at ? `${stop.kind === 'PICKUP' ? 'Picked up' : 'Delivered'} ${formatWhen(stop.completed_at, timeZone)}` : stop.arrived_at ? `Driver arrived ${time(stop.arrived_at, timeZone)}` : stop.eta && trackingMoving(t) ? `ETA ${time(stop.eta, timeZone)}` : stop.planned_at ? `Planned ${formatWhen(stop.planned_at, timeZone)}` : 'Not yet scheduled'}</p></div>
      </li>)}</ul></div>
      <div><p className="app-label">Timeline</p><ol className="mt-1 space-y-2 border-l border-slate-200 pl-3">{[...t.events].reverse().map((event, index) => <li key={`${event.kind}-${event.at}`} className="relative">
        <span className={`absolute -left-[17px] top-1.5 h-2 w-2 rounded-full ${index === 0 ? 'bg-blue-600' : event.kind === 'ISSUE' ? 'bg-amber-500' : 'bg-slate-300'}`} />
        <p className={index === 0 ? 'font-medium text-slate-900' : 'text-slate-700'}>{event.label}</p><p className="text-xs text-slate-500">{formatWhen(event.at, timeZone)}</p>
      </li>)}</ol></div>
    </div>
  </section>;
}

function TrackingMap(props: { slug: string; tracking: Tracking; version?: number }) {
  const apiKey = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY?.trim();
  const [failed, setFailed] = useState(false);
  if (!apiKey || failed || !props.tracking.stops.some(stop => stop.address.latitude != null && stop.address.longitude != null)) return null;
  return <TrackingGoogleMap {...props} apiKey={apiKey} onError={() => setFailed(true)} />;
}

function TrackingGoogleMap({ slug, tracking, version, apiKey, onError }: { slug: string; tracking: Tracking; version?: number; apiKey: string; onError: () => void }) {
  const stops = tracking.stops.filter(stop => stop.address.latitude != null && stop.address.longitude != null);
  const path = useQuery({ queryKey: ['tracking-path', slug, tracking.order_id, version], queryFn: () => operations.orderRoadPath(slug, tracking.order_id),
    enabled: stops.length > 1, staleTime: Infinity, gcTime: 30 * 60_000, retry: false });
  const center = { lat: stops[0].address.latitude!, lng: stops[0].address.longitude! };
  return <div className="h-64 overflow-hidden rounded-xl border border-slate-200 bg-slate-100" data-map-provider="google">
    <APIProvider apiKey={apiKey} language="en" region="CA" onError={onError}>
      <Map defaultCenter={center} defaultZoom={12} disableDefaultUI zoomControl clickableIcons={false} gestureHandling="cooperative">
        <FitTracking tracking={tracking} />
        {path.data && path.data.points.length > 1 && <Polyline path={path.data.points.map(([lat, lng]) => ({ lat, lng }))} strokeColor="#2563eb" strokeOpacity={0.8} strokeWeight={4} clickable={false} />}
        {stops.map(stop => <Marker key={stop.id} position={{ lat: stop.address.latitude!, lng: stop.address.longitude! }} label={stop.kind === 'PICKUP' ? 'P' : 'D'} title={stop.address.text} />)}
        {tracking.location && <GoogleOverlayMarker position={{ lat: tracking.location.latitude, lng: tracking.location.longitude }} label={`Driver ${tracking.driver?.first_name ?? ''}`.trim()}>
          <div className="relative grid h-10 w-10 place-items-center">
            <div className="absolute inset-0 rounded-full bg-blue-500/25 animate-radar-ping pointer-events-none" />
            <div className="relative grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-white shadow-lg ring-2 ring-white"><Truck className="h-4 w-4" /></div>
          </div>
        </GoogleOverlayMarker>}
      </Map>
    </APIProvider>
  </div>;
}

/** Frame the stops and the driver once, then again only when the driver first appears. */
function FitTracking({ tracking }: { tracking: Tracking }) {
  const map = useMap();
  const framed = useRef('');
  const points = [...tracking.stops.filter(s => s.address.latitude != null).map(s => ({ lat: s.address.latitude!, lng: s.address.longitude! })),
    ...(tracking.location ? [{ lat: tracking.location.latitude, lng: tracking.location.longitude }] : [])];
  const key = `${tracking.order_id}:${!!tracking.location}`;
  useEffect(() => {
    if (!map || framed.current === key || !points.length) return;
    framed.current = key;
    if (points.length === 1) { map.setCenter(points[0]); map.setZoom(14); return; }
    const bounds = new google.maps.LatLngBounds(); points.forEach(point => bounds.extend(point));
    map.fitBounds(bounds, 40);
  }, [map, key, points.length]);
  return null;
}
