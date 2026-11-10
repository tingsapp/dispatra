import { Truck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { GoogleOverlayMarker } from './GoogleOverlayMarker';
import type { MapVehicle } from './mapLocations';
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover';

export function VehicleMapGlyph({ label, live, count }: { label: string; live: boolean; count: number }) {
  return <div className={`flex h-9 items-center gap-1.5 rounded-lg border-2 border-white px-2 shadow-md ${live ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'}`}>
    <Truck className="size-4" aria-hidden="true" />
    <span className="max-w-24 truncate text-[11px] font-semibold">{count > 1 ? `${count} vehicles` : label}</span>
    {!live && <span className="rounded bg-white/20 px-1 text-[9px] font-bold" aria-hidden="true">P</span>}
  </div>;
}

/** Vehicles sharing a yard use one marker; every vehicle remains reachable in its details. */
export function GoogleVehicleMarkers({ vehicles, onOpenVehicle }: { vehicles: MapVehicle[]; onOpenVehicle?: (id: string) => void }) {
  const map = useMap();
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { const listener = map?.addListener('click', () => setOpen(null)); return () => listener?.remove(); }, [map]);
  const groups = new Map<string, MapVehicle[]>();
  for (const vehicle of vehicles) {
    const key = `${vehicle.lat},${vehicle.lng}`;
    groups.set(key, [...(groups.get(key) ?? []), vehicle]);
  }
  return <>{[...groups.values()].map(group => {
    const key = group.map(vehicle => vehicle.id).sort().join('|');
    const first = group[0];
    const live = group.every(vehicle => vehicle.source === 'GPS');
    const expanded = open === key;
    const markerId = `map-vehicle-${first.id}`;
    return <Popover key={key} open={expanded} onOpenChange={value => setOpen(value ? key : null)}><GoogleOverlayMarker id={markerId} position={{ lat: first.lat, lng: first.lng }}
      label={group.length > 1 ? `${group.length} vehicles at this location` : `Vehicle ${first.label}, ${live ? 'Live GPS' : 'Parking address'}`}
      title={group.map(vehicle => `${vehicle.label} · ${vehicle.source === 'GPS' ? 'Live GPS' : 'Parking address'}`).join('\n')}
      expanded={expanded} zIndex={expanded ? 100 : 30} onSelect={() => setOpen(expanded ? null : key)} onDismiss={() => setOpen(null)}
      className="relative rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
      <PopoverAnchor asChild><div><VehicleMapGlyph label={first.label} live={live} count={group.length} /></div></PopoverAnchor>
      <PopoverContent aria-label="Vehicle location details" side="top" collisionPadding={12} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}
        onCloseAutoFocus={event => { event.preventDefault(); document.getElementById(markerId)?.focus(); }} className="max-h-64 w-60 overflow-y-auto rounded-xl p-3">
        <div className="mb-2 flex items-center justify-between"><strong className="text-sm">{group.length > 1 ? 'Vehicles at this location' : 'Vehicle location'}</strong><button type="button" aria-label="Close vehicle details" onClick={() => setOpen(null)} className="rounded p-1 hover:bg-slate-100"><X className="size-4" /></button></div>
        {group.map(vehicle => <div key={vehicle.id} className="border-t border-slate-100 py-2 first:border-0">
          <div className="flex items-center justify-between gap-2"><span className="font-semibold">{vehicle.label}</span><span className="text-xs text-slate-500">{vehicle.source === 'GPS' ? 'Live GPS' : 'Parking address'}</span></div>
          <p className="mt-1 text-xs text-slate-600">{vehicle.driverName ?? 'No driver attached'}{vehicle.unavailable ? ' · Unavailable' : ''}</p>
          {vehicle.source === 'PARKING' && <><p className="mt-1 text-xs text-slate-600">{vehicle.address}</p><p className="mt-1 text-[11px] text-slate-500">Saved parking location. Live GPS unavailable.</p></>}
          {onOpenVehicle && <button type="button" className="mt-2 text-xs font-medium text-blue-600 hover:underline" onClick={() => { setOpen(null); onOpenVehicle(vehicle.id); }}>View vehicle</button>}
        </div>)}
      </PopoverContent>
    </GoogleOverlayMarker></Popover>;
  })}</>;
}
