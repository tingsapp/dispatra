import { Truck } from 'lucide-react';
import type { ReactNode } from 'react';
import { MAP_MARKER_SHADOW } from './StopMarkerCircle';

/** Shared vehicle glyph for operational maps: compact accent-blue circle, thick white border, centered truck. */
export function VehicleMarkerCircle({ heading, badge, className = '' }: { heading?: number; badge?: ReactNode; className?: string }) {
  return <div className={`relative grid size-7 place-items-center rounded-full border-[3px] border-white bg-app-accent text-white ${MAP_MARKER_SHADOW} ${className}`}>
    <Truck className="size-3.5" aria-hidden="true" style={heading == null ? undefined : { transform: `rotate(${heading - 90}deg)` }} />
    {badge != null && <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full border border-white bg-slate-900 px-1 text-[9px] font-bold leading-none" aria-hidden="true">{badge}</span>}
  </div>;
}
