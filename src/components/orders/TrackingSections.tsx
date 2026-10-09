import { AlertTriangle, Check } from 'lucide-react';
import { formatWhen } from './OrderDossierSections';
import { ago, STEP_INDEX, STEPS, time, trackingHeadline, trackingMoving, type Tracking } from './trackingPresentation';
import { TrackingDriverContact } from './TrackingDriverContact';

/** Shared tracking presentation for the dispatcher dialog and floating Shipper cards. */
export function TrackingSummary({ tracking: t, timeZone, title, showDriverContact = false }: { tracking: Tracking; timeZone: string; title: string; showDriverContact?: boolean }) {
  const step = STEP_INDEX[t.stage];
  const target = t.stops.find(s => s.eta);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h4 className="app-section-title">{title}</h4><p className="mt-1 text-base font-medium text-slate-900">{trackingHeadline(t, timeZone)}</p>
        {!showDriverContact && t.driver && t.stage !== 'DELIVERED' && <p className="text-xs text-slate-500">Driver {t.driver.first_name}{t.driver.vehicle_type ? ` · ${t.driver.vehicle_type}` : ''}</p>}</div>
      {t.eta && trackingMoving(t) && <div className="text-right"><p className="text-xs text-slate-500">{target?.kind === 'PICKUP' ? 'Pickup ETA' : 'Delivery ETA'}</p><p className="text-lg font-semibold text-slate-900">{time(t.eta, timeZone)}</p>
        {t.late ? <p className="text-xs font-medium text-rose-700">Running late</p> : t.delay_minutes >= 10 ? <p className="text-xs text-amber-700">About {t.delay_minutes} min behind schedule</p> : null}</div>}
    </div>
    {showDriverContact && t.driver && <TrackingDriverContact driver={t.driver} />}
    {step >= 0 && <ol className="grid grid-cols-5 gap-1" aria-label="Shipment progress">{STEPS.map((label, index) => {
      const done = index < step || t.stage === 'DELIVERED'; const current = index === step && t.stage !== 'DELIVERED';
      return <li key={label} aria-current={current ? 'step' : undefined} className="space-y-1.5">
        <div className={`h-1.5 rounded-full ${done ? 'bg-emerald-500' : current ? 'bg-blue-600' : 'bg-slate-200'}`} />
        <p className={`text-[11px] leading-tight ${done || current ? 'font-medium text-slate-800' : 'text-slate-400'}`}>{label}</p>
      </li>;
    })}</ol>}
    {t.open_issue === true && <p role="status" className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />The driver reported an issue with this order. Dispatch is handling it.</p>}
  </div>;
}

export function TrackingDetails({ tracking: t, timeZone, now, showLocationStatus = true }: { tracking: Tracking; timeZone: string; now: number; showLocationStatus?: boolean }) {
  const active = !['BOOKED', 'DELIVERED', 'CANCELLED'].includes(t.stage);
  return <div className="space-y-4">
    {showLocationStatus && active && <p className="text-xs text-slate-500">
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
  </div>;
}
