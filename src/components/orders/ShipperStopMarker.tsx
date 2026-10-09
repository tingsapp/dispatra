import { GoogleOverlayMarker } from '../monitor/GoogleOverlayMarker';
import { StopMarkerCircle } from '../map/StopMarkerCircle';
import type { MapPoint } from './shipperMapLocation';

/** Keep circles on their stops, with captions outside the route's endpoints. */
export function ShipperStopMarker({ position, kind, number, address, ordinal, selected, onSelect }: {
  position: MapPoint; kind: 'PICKUP' | 'DROPOFF'; number: string; address: string;
  ordinal?: number; selected: boolean; onSelect: () => void;
}) {
  const caption = `${kind === 'PICKUP' ? 'Pickup' : 'Delivery'}${ordinal ? ` ${ordinal}` : ''}`;
  return <GoogleOverlayMarker position={position} title={`${number} · ${caption}: ${address}`}
    label={`${number} · ${kind === 'PICKUP' ? 'Pickup' : 'Drop-off'}${ordinal ? ` ${ordinal}` : ''}: ${address}`}
    current={selected} zIndex={selected ? 20 : 10} className={`shipper-stop-marker ${kind === 'PICKUP' ? 'shipper-stop-marker-pickup' : ''}`} onSelect={onSelect}>
    <span className={`shipper-stop-caption ${selected ? 'shipper-stop-caption-selected' : ''}`} aria-hidden="true">
      <span className="shrink-0 font-medium">{caption}</span>
      {selected && <><span className="h-3 border-l border-slate-200" />
      <span className="min-w-0 truncate text-slate-500">{number}</span></>}
    </span>
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><StopMarkerCircle kind={kind} /></svg>
  </GoogleOverlayMarker>;
}
