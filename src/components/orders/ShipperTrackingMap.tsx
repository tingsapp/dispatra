import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { useCallback, useEffect, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { LocateFixed, Maximize, Minus, Plus, Truck } from 'lucide-react';
import { operations, type Address, type Order } from '../../operations/api';
import { GoogleOverlayMarker } from '../monitor/GoogleOverlayMarker';
import { GoogleRoundedRoute } from '../map/GoogleRoundedRoute';
import { ShipperStopMarker } from './ShipperStopMarker';
import { useShipperStopCaptions } from './useShipperStopCaptions';
import { useShipperMapCamera } from './useShipperMapCamera';
import type { Tracking } from './trackingPresentation';
import { addressPoint, deviceLocation, initialShipperCenter, resolveShipperLocation, type MapPoint } from './shipperMapLocation';

interface Props { slug: string; tracking?: Tracking; orders: Order[]; selectedOrderId?: string; onSelect: (id: string) => void; warehouse?: Address; timeZone?: string; locationReady?: boolean; viewReady: boolean; }

function TrackingMapContent({ slug, tracking, orders, selectedOrderId, onSelect, warehouse, timeZone, locationReady = true, viewReady }: Props) {
  const map = useMap();
  const [home, setHome] = useState<{ point: MapPoint; source: 'warehouse' | 'device' } | null>(null);
  const [homeReady, setHomeReady] = useState(false);
  const openOrders = orders.filter(order => ['NEW', 'ASSIGNED', 'IN_PROGRESS'].includes(order.status));
  const stops = openOrders.flatMap(order => order.facts.stops.flatMap(stop => {
    const point = addressPoint(stop.address);
    const matching = order.facts.stops.filter(item => item.kind === stop.kind);
    const ordinal = matching.length > 1 ? matching.findIndex(item => item.id === stop.id) + 1 : undefined;
    return point ? [{ ...stop, point, ordinal, orderId: order.id, number: order.number }] : [];
  }));
  const roads = useQueries({ queries: openOrders.map(order => ({
    queryKey: ['tracking-path', slug, order.id, order.version],
    queryFn: () => operations.orderRoadPath(slug, order.id),
    enabled: order.facts.stops.filter(stop => addressPoint(stop.address)).length > 1,
    staleTime: Infinity, gcTime: 30 * 60_000, retry: false,
  })) });
  const liveTracking = tracking && openOrders.some(order => order.id === tracking.order_id) ? tracking : undefined;
  useShipperStopCaptions(map, `${selectedOrderId ?? ''}:${stops.map(stop => `${stop.orderId}:${stop.id}:${stop.number}:${stop.ordinal ?? ''}:${stop.point.lat}:${stop.point.lng}`).join('|')}`);
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
      setHomeReady(true);
    });
    return () => { active = false; };
  }, [map, locationReady, warehouse?.text, warehouse?.latitude, warehouse?.longitude]);
  const routePoints = roads.flatMap(road => (road.data?.points ?? []).map(([lat, lng]) => ({ lat, lng })));
  const points = [...stops.map(stop => stop.point), ...routePoints];
  if (home) points.push(home.point);
  if (liveTracking?.live && liveTracking.location) points.push({ lat: liveTracking.location.latitude, lng: liveTracking.location.longitude });
  const { focusHome, fitOrders, markManual } = useShipperMapCamera(map, points, home?.point ?? initialShipperCenter(warehouse, timeZone),
    viewReady && homeReady && !roads.some(road => road.isFetching));
  return <>
    {roads.map((road, index) => road.data?.points && <GoogleRoundedRoute key={openOrders[index].id}
      id={openOrders[index].id} points={road.data.points} selected={openOrders[index].id === selectedOrderId} />)}
    {stops.map(stop => <ShipperStopMarker key={`${stop.orderId}:${stop.id}`} position={stop.point}
      kind={stop.kind} number={stop.number} address={stop.address.text} ordinal={stop.ordinal}
      selected={stop.orderId === selectedOrderId} onSelect={() => onSelect(stop.orderId)} />)}
    {liveTracking?.live && liveTracking.location && <GoogleOverlayMarker position={{ lat: liveTracking.location.latitude, lng: liveTracking.location.longitude }} label={`Driver ${liveTracking.driver?.first_name ?? ''}`} zIndex={30}>
      <span className="grid size-9 place-items-center rounded-xl border-2 border-white bg-blue-600 text-white shadow-md"><Truck size={18} /></span>
    </GoogleOverlayMarker>}
    <div className="shipper-map-controls" aria-label="Map controls">
      <button type="button" className="app-metric app-map-icon" onClick={focusHome} aria-label="Focus warehouse or fallback location" title="Your location"><LocateFixed size={18} /></button>
      <button type="button" className="app-metric app-map-icon" onClick={fitOrders} disabled={!stops.length} aria-label="Fit open orders on map" title="Fit open orders"><Maximize size={18} /></button>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <button type="button" className="app-metric app-map-icon rounded-none shadow-none" onClick={() => { markManual(); map?.setZoom((map.getZoom() ?? 13) + 1); }} aria-label="Zoom in"><Plus size={18} /></button>
        <button type="button" className="app-metric app-map-icon rounded-none shadow-none" onClick={() => { markManual(); map?.setZoom((map.getZoom() ?? 13) - 1); }} aria-label="Zoom out"><Minus size={18} /></button>
      </div>
    </div>
  </>;
}

/** Own open orders from the authorized feed; live location remains tracking-API controlled. */
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
    {!apiKey || failed ? <p role="status" className="shipper-map-unavailable text-sm text-app-muted">Map is unavailable. Your order progress and stops are shown in the card.</p>
      : <APIProvider apiKey={apiKey} language="en" region="CA" onLoad={onLoad} onError={onError}>
        {!loaded && <p role="status" className="shipper-map-unavailable text-sm text-app-muted">Loading map…</p>}
        <Map defaultCenter={initialShipperCenter(props.warehouse, props.timeZone)} defaultZoom={13} maxZoom={19}
          disableDefaultUI clickableIcons={false} gestureHandling="greedy" keyboardShortcuts aria-label="Shipment map">
          <TrackingMapContent {...props} />
        </Map>
      </APIProvider>}
  </div>;
}
