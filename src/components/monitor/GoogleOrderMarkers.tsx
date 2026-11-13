import { Clock3, Package, UserX } from 'lucide-react';
import type { Job } from '../../types';
import { MAP_MARKER_SHADOW, StopMarkerCircle } from '../map/StopMarkerCircle';
import { MapMarkerLabel, type MapMarkerTone } from '../map/MapMarkerLabel';
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

/** Stop circles keep order selection; order details appear only in the shared hover/focus label. */
export function GoogleOrderMarkers({ job, stops, onSelect }: GoogleOrderMarkersProps) {
  const risk = job.status === 'at_risk';
  const late = job.status === 'late_start';
  const unassigned = job.status === 'no_driver';
  const color = risk ? 'bg-rose-600' : late ? 'bg-amber-500' : unassigned ? 'bg-slate-700' : 'bg-app-accent';
  const label = risk ? 'At Risk' : late ? 'Late Start' : unassigned ? 'No Driver' : job.statusLabel;
  const tone: MapMarkerTone = risk ? 'risk' : late ? 'late' : unassigned ? 'muted' : 'accent';
  const Icon = risk ? Package : late ? Clock3 : unassigned ? UserX : Package;

  return <>
    {stops.map(stop => {
      const typeLabel = stop.type === 'PICKUP' ? 'Pickup' : 'Drop-off';
      const meta = `${typeLabel}${stop.sequence ? ` · Stop ${stop.sequence}` : ''}`;
      return <GoogleOverlayMarker key={stop.id} position={{ lat: stop.lat, lng: stop.lng }}
        label={`Order ${job.jobNumber}, ${typeLabel}${stop.sequence ? `, stop ${stop.sequence}` : ''}${stop.label ? `, ${stop.label}` : ''}, ${label}`}
        className="group/marker rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
        onSelect={() => onSelect(job.jobNumber, [stop.lng, stop.lat])}>
        <div className="relative flex size-9 items-center justify-center" style={stop.offset ? { transform: `translate(${stop.offset.x}px, ${stop.offset.y}px)` } : undefined}>
          <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" className={MAP_MARKER_SHADOW}>
            <StopMarkerCircle kind={stop.type} />
          </svg>
          <MapMarkerLabel title={job.jobNumber} status={label} tone={tone} meta={meta} detail={stop.label || undefined} />
        </div>
      </GoogleOverlayMarker>;
    })}
    {!stops.length && Number.isFinite(job.lat) && Number.isFinite(job.lng) && <GoogleOverlayMarker position={{ lat: job.lat, lng: job.lng }}
      label={`Order ${job.jobNumber}, ${label}`} className="group/marker rounded-full" onSelect={() => onSelect(job.jobNumber, [job.lng, job.lat])}>
      <div className="relative flex items-center justify-center w-9 h-9 group">
        {risk && <div className="absolute inset-0 rounded-full bg-rose-500/30 animate-radar-ping-fast pointer-events-none" />}
        <div className={`relative w-8 h-8 rounded-full ${color} text-white ring-2 ring-white shadow-lg grid place-items-center group-hover:scale-110 transition-transform`}><Icon className="w-4 h-4" /></div>
        <MapMarkerLabel title={job.jobNumber} status={label} tone={tone} />
      </div>
    </GoogleOverlayMarker>}
  </>;
}
