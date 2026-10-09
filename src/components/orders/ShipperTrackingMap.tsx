import { APIProvider, Map, Polyline, useMap } from '@vis.gl/react-google-maps';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LocateFixed, Maximize, Minus, Plus, Truck } from 'lucide-react';
import { operations, type Address } from '../../operations/api';
import { GoogleOverlayMarker } from '../monitor/GoogleOverlayMarker';
import { StopMarkerCircle } from '../map/StopMarkerCircle';
import type { Tracking } from './trackingPresentation';
import { addressPoint, deviceLocation, initialShipperCenter, resolveShipperLocation, type MapPoint } from './shipperMapLocation';

interface Props { slug: string; tracking?: Tracking; version?: number; warehouse?: Address; timeZone?: string; locationReady?: boolean; }

function TrackingMapContent({ slug, tracking, version, warehouse, timeZone, locationReady = true }: Props) {
  const map = useMap();
  const [home, setHome] = useState<{ point: MapPoint; source: 'warehouse' | 'device' } | null>(null);
  const focused = useRef(false);
  const stops = (tracking?.stops ?? []).flatMap(stop => { const point = addressPoint(stop.address); return point ? [{ ...stop, point }] : []; });
  const road = useQuery({ queryKey: ['tracking-path', slug, tracking?.order_id, version],
    queryFn: () => operations.orderRoadPath(slug, tracking!.order_id), enabled: !!tracking && stops.length > 1,
    staleTime: Infinity, gcTime: 30 * 60_000, retry: false });
  useEffect(() => {
    if (!map || !locationReady) return;
    let active = true;
    void resolveShipperLocation(warehouse, async text => {
      const { Geocoder } = await google.maps.importLibrary('geocoding') as google.maps.GeocodingLibrary;
      const result = await new Geocoder().geocode({ address: text });
      return result.results[0]?.geometry.location.toJSON() ?? null;
    }, () => active ? deviceLocation() : Promise.resolve(null)).then(location => {
      if (!active) return;
      setHome(location);
      if (location && !focused.current) {
        focused.current = true; map.setCenter(location.point); map.setZoom(13);
      }
    });
    return () => { active = false; };
  }, [map, locationReady, warehouse?.text, warehouse?.latitude, warehouse?.longitude]);
  const focusHome = () => { if (map) { map.panTo(home?.point ?? initialShipperCenter(warehouse, timeZone)); map.setZoom(13); } };
  const fitOrder = () => {
    if (!map || !stops.length) return;
    const bounds = new google.maps.LatLngBounds(); stops.forEach(stop => bounds.extend(stop.point));
    if (tracking?.live && tracking.location) bounds.extend({ lat: tracking.location.latitude, lng: tracking.location.longitude });
    const width = map.getDiv().clientWidth;
    map.fitBounds(bounds, width >= 900 ? { top: 80, left: 560, right: 80, bottom: 80 } : { top: 80, left: 32, right: 64, bottom: 80 });
    google.maps.event.addListenerOnce(map, 'idle', () => { if ((map.getZoom() ?? 0) > 15) map.setZoom(15); });
  };
  return <>
    {road.data?.points && <Polyline path={road.data.points.map(([lat, lng]) => ({ lat, lng }))} strokeColor="#171717" strokeWeight={4} strokeOpacity={0.8} clickable={false} />}
    {stops.map(stop => <GoogleOverlayMarker key={stop.id} position={stop.point} label={`${stop.kind === 'PICKUP' ? 'Pickup' : 'Drop-off'}: ${stop.address.text}`}>
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><StopMarkerCircle kind={stop.kind === 'PICKUP' ? 'PICKUP' : 'DROPOFF'} /></svg>
    </GoogleOverlayMarker>)}
    {home && <GoogleOverlayMarker position={home.point} label={home.source === 'warehouse' ? 'Your warehouse' : 'Your device location'}>
      {stops.some(stop => Math.abs(stop.point.lat - home.point.lat) < 0.00001 && Math.abs(stop.point.lng - home.point.lng) < 0.00001)
        ? <span className="block -translate-y-7 whitespace-nowrap rounded-full border border-app-border bg-white px-2 py-1 text-xs shadow-sm">{home.source === 'warehouse' ? 'Your warehouse' : 'Your location'}</span>
        : <span className="block size-4 rounded-full border-[3px] border-white bg-blue-600 shadow-md ring-4 ring-blue-600/15" />}
    </GoogleOverlayMarker>}
    {tracking?.live && tracking.location && <GoogleOverlayMarker position={{ lat: tracking.location.latitude, lng: tracking.location.longitude }} label={`Driver ${tracking.driver?.first_name ?? ''}`}>
      <span className="grid size-9 place-items-center rounded-xl border-2 border-white bg-blue-600 text-white shadow-md"><Truck size={18} /></span>
    </GoogleOverlayMarker>}
    <div className="shipper-map-controls" aria-label="Map controls">
      <button type="button" className="app-metric app-map-icon" onClick={focusHome} aria-label="Focus warehouse or fallback location" title="Your location"><LocateFixed size={18} /></button>
      <button type="button" className="app-metric app-map-icon" onClick={fitOrder} disabled={!stops.length} aria-label="Fit order on map" title="Fit order"><Maximize size={18} /></button>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <button type="button" className="app-metric app-map-icon rounded-none shadow-none" onClick={() => map?.setZoom((map.getZoom() ?? 13) + 1)} aria-label="Zoom in"><Plus size={18} /></button>
        <button type="button" className="app-metric app-map-icon rounded-none shadow-none" onClick={() => map?.setZoom((map.getZoom() ?? 13) - 1)} aria-label="Zoom out"><Minus size={18} /></button>
      </div>
    </div>
  </>;
}

/** Interactive Monitor-style map; only the current viewer's tracking projection is rendered. */
export function ShipperTrackingMap(props: Props) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const onLoad = useCallback(() => setLoaded(true), []);
  const onError = useCallback(() => setFailed(true), []);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  useEffect(() => {
    if (!apiKey || loaded) return;
    const timer = window.setTimeout(onError, 30_000);
    return () => window.clearTimeout(timer);
  }, [apiKey, loaded, onError]);
  return <div className="absolute inset-0 bg-slate-100" data-map-provider="google" aria-label="Shipment map">
    {!apiKey || failed ? <p role="status" className="shipper-map-unavailable text-sm text-app-muted">Map is unavailable. Your order progress and stops are shown in the cards.</p>
      : <APIProvider apiKey={apiKey} language="en" region="CA" onLoad={onLoad} onError={onError}>
        {!loaded && <p role="status" className="shipper-map-unavailable text-sm text-app-muted">Loading map…</p>}
        <Map defaultCenter={initialShipperCenter(props.warehouse, props.timeZone)} defaultZoom={13} minZoom={4} maxZoom={19}
          disableDefaultUI clickableIcons={false} gestureHandling="greedy" keyboardShortcuts aria-label="Shipment map">
          <TrackingMapContent {...props} />
        </Map>
      </APIProvider>}
  </div>;
}
