import { APIProvider, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Maximize, Minus, Plus } from 'lucide-react';
import { ShipperStopMarker } from '../components/orders/ShipperStopMarker';
import { initialShipperCenter } from '../components/orders/shipperMapLocation';
import { GoogleRoundedRoute } from '../components/map/GoogleRoundedRoute';
import { GoogleVehicleMarkers } from '../components/monitor/GoogleVehicleMarkers';
import { operations } from '../operations/api';
import { driverRouteSequence, type DriverDayStop, type DriverRoute } from './driverDayPlan';

interface Props {
  slug: string;
  stops: DriverDayStop[];
  routes: DriverRoute[];
  selectedId?: string;
  timeZone?: string;
  onSelect: (id: string) => void;
  panelRef: RefObject<HTMLElement | null>;
}

function savedVehicleParkingPoint(vehicle: DriverRoute['vehicle']) {
  if (!vehicle || typeof vehicle !== 'object') return null;
  const details = vehicle as {
    parking_address?: { latitude?: number | null; longitude?: number | null } | null;
    data?: { parking_address?: { latitude?: number | null; longitude?: number | null } | null };
  };
  const address = details.data?.parking_address ?? details.parking_address;
  const lat = address?.latitude, lng = address?.longitude;
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat: lat!, lng: lng! } : null;
}

function StopMap({ slug, stops, routes: assignedRoutes, selectedId, onSelect, panelRef }: Props) {
  const map = useMap();
  const [controlsBottom, setControlsBottom] = useState<number>();
  const mapped = stops.filter(row => row.point);
  const stopById = new Map(stops.map(row => [row.stop.id, row]));
  const routes = assignedRoutes.filter(route => route.status !== 'CANCELLED' && route.stops.some(visit => stopById.has(visit.stop_id)));
  const routeQueries = useQueries({ queries: routes.map(route => ({
    queryKey: ['driver-route-road-path', slug, route.id, route.version, route.generation],
    queryFn: () => operations.driverRouteRoadPath(slug, route.id),
    staleTime: 60_000,
  })) });
  const lines = routes.map((route, index) => {
    const sequence = driverRouteSequence(route, stops);
    const path = routeQueries[index].data;
    // Road-path points are map geometry even when the provider cannot attest a
    // truck profile. Render the returned route, as the shipper map does.
    const road = path?.points?.map(([lat, lng]) => ({ lat, lng })) ?? [];
    const active = route.status === 'PLANNED' || route.status === 'IN_PROGRESS';
    const parkingOrigin = active && !sequence.origin ? savedVehicleParkingPoint(route.vehicle) : null;
    const hasRoad = road.length > 1;
    const orderedStops = sequence.points.map(point => ({ lat: point.lat, lng: point.lng }));
    const displayPoints = hasRoad ? road : orderedStops;
    return { route, points: displayPoints.length > 1 ? displayPoints : [], hasRoad, dashed: !hasRoad,
      origin: sequence.origin ?? parkingOrigin,
      originSource: route.map_origin?.source ?? (parkingOrigin ? 'PARKING' : undefined) };
  });
  const vehicleMarkers = lines.flatMap(({ route, origin, originSource }) => {
    if (!origin || !originSource) return [];
    const vehicle = route.vehicle as { name?: string; plate?: string; parking_address?: { text?: string } | null } | null;
    return [{ id: route.vehicle_id, label: vehicle?.name || vehicle?.plate || 'Assigned vehicle',
      driverName: 'You', lat: origin.lat, lng: origin.lng, source: originSource,
      address: originSource === 'PARKING' ? vehicle?.parking_address?.text : undefined, unavailable: false }];
  });
  const routeUnavailable = lines.some((line, index) => routeQueries[index].error ||
    routeQueries[index].isSuccess && !line.hasRoad);
  const attributions = [...new Set(routeQueries
    .filter((_, index) => lines[index].hasRoad)
    .map(query => query.data?.attribution)
    .filter((value): value is string => !!value))];
  const geometry = JSON.stringify({ stops: mapped.map(row => [row.id, row.point]), lines: lines.map(line => [line.points, line.origin]) });
  const previous = useRef<{ selectedId?: string; geometry: string; map: google.maps.Map | null }>({ geometry: '', map: null });
  const padding = () => {
    const canvas = map?.getDiv().getBoundingClientRect();
    const panel = panelRef.current?.getBoundingClientRect();
    if (!canvas || !panel) return { top: 88, right: 56, bottom: 80, left: 48 };
    return window.innerWidth <= 767
      ? { top: 88, right: 32, bottom: Math.round(canvas.bottom - panel.top + 20), left: 32 }
      : { top: 88, right: 56, bottom: 80, left: Math.round(panel.right - canvas.left + 32) };
  };
  const fit = () => {
    if (!map) return;
    const bounds = new google.maps.LatLngBounds();
    let count = 0;
    const extend = (point: google.maps.LatLngLiteral) => { bounds.extend(point); count++; };
    mapped.forEach(row => extend(row.point!));
    lines.forEach(line => {
      line.points.forEach(extend);
      if (line.origin) extend(line.origin);
    });
    if (!count) return;
    map.fitBounds(bounds, padding());
    if (count === 1) map.setZoom(15);
  };
  useEffect(() => {
    if (previous.current.map !== map || previous.current.geometry !== geometry) fit();
    else if (previous.current.selectedId !== selectedId) {
      const point = stops.find(row => row.id === selectedId)?.point;
      if (point && map) { const inset = padding(); map.panTo(point); map.panBy((inset.right - inset.left) / 2, (inset.bottom - inset.top) / 2); }
    }
    previous.current = { selectedId, geometry, map };
  }, [map, selectedId, geometry]);
  useEffect(() => {
    if (!map || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      fit();
      setControlsBottom(window.innerWidth <= 767 ? padding().bottom : undefined);
    });
    observer.observe(map.getDiv());
    if (panelRef.current) observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, [map, geometry]);
  return <>
    {lines.map(({ route, points, dashed }) => points.length > 1 && <GoogleRoundedRoute key={route.id} id={route.id}
      points={points.map(point => [point.lat, point.lng])} selected={route.stops.some(visit => stopById.get(visit.stop_id)?.id === selectedId)} dashed={dashed} />)}
    <GoogleVehicleMarkers vehicles={vehicleMarkers} />
    {stops.map(row => {
      const matching = row.order.stops.filter(stop => stop.kind === row.stop.kind);
      return row.point && (row.stop.kind === 'PICKUP' || row.stop.kind === 'DROPOFF') && <ShipperStopMarker key={row.id} position={row.point} kind={row.stop.kind}
        number={row.order.number} address={row.stop.address.text} contactName={row.stop.contact_name}
        ordinal={matching.length > 1 ? matching.findIndex(stop => stop.id === row.stop.id) + 1 : undefined}
        selected={row.id === selectedId} onSelect={() => onSelect(row.id)} />;
    })}
    <div className="shipper-map-controls" aria-label="Map controls" style={{ bottom: controlsBottom }}>
      <button type="button" className="app-metric app-map-icon" disabled={!mapped.length} onClick={fit} aria-label="Fit today's stops on map"><Maximize size={18} /></button>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <button type="button" className="app-metric app-map-icon rounded-none shadow-none" onClick={() => map?.setZoom((map.getZoom() ?? 13) + 1)} aria-label="Zoom in"><Plus size={18} /></button>
        <button type="button" className="app-metric app-map-icon rounded-none shadow-none" onClick={() => map?.setZoom((map.getZoom() ?? 13) - 1)} aria-label="Zoom out"><Minus size={18} /></button>
      </div>
    </div>
    {routeUnavailable && <p role="status" className="driver-map-route-note">Road route unavailable. Showing the stop order.</p>}
    {!!attributions.length && <p className="driver-map-attribution">{attributions.join(' · ')}</p>}
  </>;
}

export function DriverDashboardMap(props: Props) {
  const apiKey = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY?.trim();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!apiKey || loaded) return;
    const timer = window.setTimeout(() => setFailed(true), 30_000);
    return () => window.clearTimeout(timer);
  }, [apiKey, loaded]);
  return <section className="driver-dashboard-map" aria-label="Today's order map" data-map-provider="google">
    {!apiKey || failed ? <p role="status" className="driver-map-message">Map is unavailable. All stops are listed in the timeline.</p>
      : <APIProvider apiKey={apiKey} language="en" region="CA" onLoad={() => setLoaded(true)} onError={() => setFailed(true)}>
        {!loaded && <p role="status" className="driver-map-message">Loading map…</p>}
        <GoogleMap defaultCenter={initialShipperCenter(undefined, props.timeZone)} defaultZoom={12} maxZoom={18}
          disableDefaultUI clickableIcons={false} gestureHandling="greedy" keyboardShortcuts aria-label="Today's order map">
          <StopMap {...props} />
        </GoogleMap>
      </APIProvider>}
  </section>;
}
