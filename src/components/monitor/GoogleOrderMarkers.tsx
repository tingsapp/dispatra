import { Clock3, Package, UserX } from 'lucide-react';
import type { Job } from '../../types';
import { StopMarkerCircle } from '../map/StopMarkerCircle';
import { GoogleOverlayMarker } from './GoogleOverlayMarker';

export interface LocatedOrderStop {
  id: string;
  type: 'PICKUP' | 'DROPOFF';
  label: string;
  lat: number;
  lng: number;
  sequence?: number;
  offset?: { x: number; y: number };
}

interface GoogleOrderMarkersProps {
  job: Job;
  stops: LocatedOrderStop[];
  onSelect: (number: string, position: [number, number]) => void;
}

/** Stop circles retain order selection and the status tag without overlapping a package pin. */
export function GoogleOrderMarkers({ job, stops, onSelect }: GoogleOrderMarkersProps) {
  const risk = job.status === 'at_risk';
  const late = job.status === 'late_start';
  const unassigned = job.status === 'no_driver';
  const color = risk ? 'bg-rose-600' : late ? 'bg-amber-500' : unassigned ? 'bg-slate-700' : 'bg-app-accent';
  const label = risk ? 'At Risk' : late ? 'Late Start' : unassigned ? 'No Driver' : job.statusLabel;
  const Icon = risk ? Package : late ? Clock3 : unassigned ? UserX : Package;
  const statusStop = [...stops].reverse().find(stop => stop.lat === job.lat && stop.lng === job.lng) ?? stops.at(-1);
  const statusTone = risk ? 'text-rose-700' : late ? 'text-amber-700' : unassigned ? 'text-slate-500' : 'text-blue-600';
  const statusTag = <div className="absolute bottom-full mb-0.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-md border border-black/10 bg-white/95 px-2 py-1 text-[10px] leading-3 shadow-sm whitespace-nowrap pointer-events-none">
    <span className="font-semibold tracking-tight text-slate-800">{job.jobNumber}</span>
    <span className="h-2.5 w-px bg-slate-200" aria-hidden="true" />
    <span className={`font-medium ${statusTone}`}>{label}</span>
  </div>;

  return <>
    {stops.map(stop => {
      const typeLabel = stop.type === 'PICKUP' ? 'Pickup' : 'Drop-off';
      const hasStatus = stop.id === statusStop?.id;
      const accessibleLabel = `Order ${job.jobNumber}, ${typeLabel}${stop.sequence ? `, stop ${stop.sequence}` : ''}${stop.label ? `, ${stop.label}` : ''}${hasStatus ? `, ${label}` : ''}`;
      return <GoogleOverlayMarker key={stop.id} position={{ lat: stop.lat, lng: stop.lng }}
        label={accessibleLabel} title={`${job.jobNumber} · ${typeLabel}${stop.sequence ? ` · Stop ${stop.sequence}` : ''}\n${stop.label}`}
        className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
        onSelect={() => onSelect(job.jobNumber, [stop.lng, stop.lat])}>
        <div className="relative flex size-9 items-center justify-center" style={stop.offset ? { transform: `translate(${stop.offset.x}px, ${stop.offset.y}px)` } : undefined}>
          <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
            <StopMarkerCircle kind={stop.type} number={stop.sequence} />
          </svg>
          {hasStatus && statusTag}
        </div>
      </GoogleOverlayMarker>;
    })}
    {!statusStop && Number.isFinite(job.lat) && Number.isFinite(job.lng) && <GoogleOverlayMarker position={{ lat: job.lat, lng: job.lng }}
      label={`Order ${job.jobNumber}, ${label}`} onSelect={() => onSelect(job.jobNumber, [job.lng, job.lat])}>
      <div className="relative flex items-center justify-center w-9 h-9 group">
        {risk && <div className="absolute inset-0 rounded-full bg-rose-500/30 animate-radar-ping-fast pointer-events-none" />}
        <div className={`relative w-8 h-8 rounded-full ${color} text-white ring-2 ring-white shadow-lg grid place-items-center group-hover:scale-110 transition-transform`}><Icon className="w-4 h-4" /></div>
        {statusTag}
      </div>
    </GoogleOverlayMarker>}
  </>;
}
