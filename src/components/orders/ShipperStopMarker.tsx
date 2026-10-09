import { useEffect, useId, useState } from 'react';
import { GoogleOverlayMarker } from '../monitor/GoogleOverlayMarker';
import { StopMarkerCircle } from '../map/StopMarkerCircle';
import type { MapPoint } from './shipperMapLocation';

/** Keep circles on their stops, with captions outside the route's endpoints. */
export function ShipperStopMarker({ position, kind, number, address, contactName, ordinal, selected, onSelect }: {
  position: MapPoint; kind: 'PICKUP' | 'DROPOFF'; number: string; address: string;
  contactName?: string; ordinal?: number; selected: boolean; onSelect: () => void;
}) {
  const [inspected, setInspected] = useState(false);
  const descriptionId = useId();
  useEffect(() => { if (!selected) setInspected(false); }, [selected]);
  const caption = `${kind === 'PICKUP' ? 'Pickup' : 'Delivery'}${ordinal ? ` ${ordinal}` : ''}`;
  const persistent = selected && kind === 'PICKUP' && (!ordinal || ordinal === 1);
  const shown = persistent || inspected;
  const inspect = () => setInspected(true);
  return <GoogleOverlayMarker position={position}
    label={`${number} · ${kind === 'PICKUP' ? 'Pickup' : 'Drop-off'}${ordinal ? ` ${ordinal}` : ''}: ${address}`}
    current={selected} zIndex={shown ? 25 : selected ? 20 : 10} expanded={shown} descriptionId={shown ? descriptionId : undefined}
    onFocus={inspect} onBlur={() => setInspected(false)} onDismiss={() => setInspected(false)}
    className={`shipper-stop-marker ${kind === 'PICKUP' ? 'shipper-stop-marker-pickup' : ''}`} onSelect={() => { inspect(); onSelect(); }}>
    {shown && <div id={descriptionId} role="tooltip" className="shipper-stop-caption">
      <div className="flex items-center gap-1.5"><span className="shrink-0 font-medium">{caption}</span><span className="min-w-0 truncate text-slate-500">{number}</span></div>
      <p className="mt-1 line-clamp-3 whitespace-normal text-slate-600">{address}</p>
      {contactName && <p className="mt-1 truncate text-slate-500">Contact: {contactName}</p>}
    </div>}
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><StopMarkerCircle kind={kind} /></svg>
  </GoogleOverlayMarker>;
}
