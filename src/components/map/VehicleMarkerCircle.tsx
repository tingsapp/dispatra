import { Truck } from 'lucide-react';
import type { ReactNode } from 'react';

/** Shared vehicle glyph for operational maps: blue circle, white border, centered truck. */
export function VehicleMarkerCircle({ heading, badge, className = '' }: { heading?: number; badge?: ReactNode; className?: string }) {
  return <div className={`relative grid size-9 place-items-center rounded-full border-2 border-white bg-app-accent text-white shadow-md ${className}`}>
    <Truck className="size-[18px]" aria-hidden="true" style={heading == null ? undefined : { transform: `rotate(${heading - 90}deg)` }} />
    {badge != null && <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full border border-white bg-slate-900 px-1 text-[9px] font-bold leading-none" aria-hidden="true">{badge}</span>}
  </div>;
}
