import { APIProvider, Map, Polyline, useMap } from '@vis.gl/react-google-maps';
import { Clock3, Package, Plane, Truck, UserX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BLUE_ROUTE_WAYPOINTS, GREEN_ROUTE_WAYPOINTS, ORANGE_ROUTE_WAYPOINTS, INITIAL_DRIVERS, INITIAL_JOBS } from '../data/mockData';
import type { Driver, Job, MapLayerConfig } from '../types';
import { GoogleOverlayMarker } from './monitor/GoogleOverlayMarker';
import { MONITOR_CAMERA } from './monitor/mapScene';
export { VANCOUVER_CENTER_LNG_LAT } from './monitor/mapScene';

interface MarkerScreenPositions {
  d14?: { x: number; y: number } | null;
  job461?: { x: number; y: number } | null;
  driver?: { x: number; y: number } | null;
  job?: { x: number; y: number } | null;
}

export interface MapController {
  flyTo: (options: { center: [number, number]; zoom?: number; duration?: number; pitch?: number; bearing?: number; essential?: boolean }) => void;
  zoomIn: (options?: { duration?: number }) => void;
  zoomOut: (options?: { duration?: number }) => void;
  resize: () => void;
  project: (coords: [number, number]) => { x: number; y: number };
}

interface GoogleMonitorMapProps {
  active?: boolean;
  drivers?: Driver[];
  jobs?: Job[];
  selectedDriverId?: string | null;
  selectedJobId?: string | null;
  onSelectDriver: (id: string, markerPosition?: [number, number]) => void;
  onSelectJob: (id: string, markerPosition?: [number, number]) => void;
  onMapClick?: () => void;
  layerConfig: MapLayerConfig;
  onPositionsUpdate?: (positions: MarkerScreenPositions) => void;
  onUpdatePositions?: (positions: MarkerScreenPositions) => void;
  onDriverTelemetry?: (driverId: string, telemetry: { eta: string; distance: string; speed?: number }) => void;
  onDriverTelemetryUpdate?: (driverId: string, telemetry: { eta: string; distance: string; speed?: number }) => void;
  mapInstanceRef?: React.MutableRefObject<MapController | null>;
  mapRef?: React.MutableRefObject<MapController | null>;
}

const path = (waypoints: [number, number][]): google.maps.LatLngLiteral[] =>
  waypoints.map(([lat, lng]) => ({ lat, lng }));
const BLUE_PATH = path(BLUE_ROUTE_WAYPOINTS);
const GREEN_PATH = path(GREEN_ROUTE_WAYPOINTS);
const ORANGE_PATH = path(ORANGE_ROUTE_WAYPOINTS);

function routePosition(progress: number) {
  const waypoints = BLUE_ROUTE_WAYPOINTS;
  const segmentLengths = waypoints.slice(1).map((point, index) =>
    Math.hypot((point[1] - waypoints[index][1]) * 75, (point[0] - waypoints[index][0]) * 111));
  const total = segmentLengths.reduce((sum, length) => sum + length, 0);
  const distance = progress * total;
  let passed = 0;
  for (let index = 0; index < segmentLengths.length; index++) {
    const length = segmentLengths[index];
    if (passed + length >= distance || index === segmentLengths.length - 1) {
      const fraction = length ? (distance - passed) / length : 0;
      const [lat, lng] = waypoints[index];
      const [nextLat, nextLng] = waypoints[index + 1];
      const point = { lat: lat + (nextLat - lat) * fraction, lng: lng + (nextLng - lng) * fraction };
      const heading = Math.atan2((nextLng - lng) * Math.cos(point.lat * Math.PI / 180), nextLat - lat) * 180 / Math.PI;
      return { ...point, heading: (heading + 360) % 360, distanceRemainingKm: Math.max(0.2, Math.round((1 - progress) * total * 10) / 10) };
    }
    passed += length;
  }
  return { lat: waypoints[0][0], lng: waypoints[0][1], heading: 0, distanceRemainingKm: 0 };
}

function GoogleTraffic({ enabled }: { enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !enabled) return;
    const layer = new google.maps.TrafficLayer({ map });
    return () => layer.setMap(null);
  }, [map, enabled]);
  return null;
}

function MonitorMapContent(props: GoogleMonitorMapProps) {
  const map = useMap();
  const projection = useRef<google.maps.MapCanvasProjection | null>(null);
  const frame = useRef<number | null>(null);
  const progress = useRef(0.65);
  const initialPosition = useRef(routePosition(0.65));
  const [movingDriver, setMovingDriver] = useState(initialPosition.current);
  const movingDriverRef = useRef(initialPosition.current);
  const propsRef = useRef(props);
  propsRef.current = props;

  const project = useCallback((coords: [number, number]) => {
    const pixel = projection.current?.fromLatLngToContainerPixel(new google.maps.LatLng(coords[1], coords[0]));
    return pixel ? { x: pixel.x, y: pixel.y } : { x: 0, y: 0 };
  }, []);

  const updatePositions = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (!projection.current) return;
      const current = propsRef.current;
      const jobs = current.jobs?.length ? current.jobs : INITIAL_JOBS;
      const drivers = current.drivers?.length ? current.drivers : INITIAL_DRIVERS;
      const d14 = project([movingDriverRef.current.lng, movingDriverRef.current.lat]);
      const job461 = jobs.find(job => job.jobNumber === '#461') ?? INITIAL_JOBS[0];
      const selectedDriver = drivers.find(driver => driver.id === current.selectedDriverId);
      const selectedJob = jobs.find(job => job.jobNumber === current.selectedJobId);
      const positions: MarkerScreenPositions = {
        d14,
        job461: project([job461.lng, job461.lat]),
        driver: selectedDriver ? project([selectedDriver.id === 'D14' ? movingDriverRef.current.lng : selectedDriver.lng, selectedDriver.id === 'D14' ? movingDriverRef.current.lat : selectedDriver.lat]) : d14,
        job: selectedJob ? project([selectedJob.lng, selectedJob.lat]) : project([job461.lng, job461.lat])
      };
      (current.onPositionsUpdate ?? current.onUpdatePositions)?.(positions);
    });
  }, [project]);

  useEffect(() => {
    if (!map) return;
    class ProjectionOverlay extends google.maps.OverlayView {
      onAdd() {}
      draw() { projection.current = this.getProjection(); updatePositions(); }
      onRemove() { projection.current = null; }
    }
    const overlay = new ProjectionOverlay();
    overlay.setMap(map);
    const listener = map.addListener('bounds_changed', updatePositions);
    const idleListener = map.addListener('idle', updatePositions);
    const controller: MapController = {
      flyTo: ({ center, zoom, pitch, bearing }) => {
        map.panTo({ lat: center[1], lng: center[0] });
        if (zoom !== undefined) map.setZoom(zoom);
        if (pitch !== undefined) map.setTilt(pitch);
        if (bearing !== undefined) map.setHeading(bearing);
      },
      zoomIn: () => map.setZoom((map.getZoom() ?? MONITOR_CAMERA.zoom) + 1),
      zoomOut: () => map.setZoom((map.getZoom() ?? MONITOR_CAMERA.zoom) - 1),
      resize: () => google.maps.event.trigger(map, 'resize'),
      project
    };
    if (props.mapRef) props.mapRef.current = controller;
    if (props.mapInstanceRef) props.mapInstanceRef.current = controller;
    updatePositions();
    return () => {
      listener.remove();
      idleListener.remove();
      overlay.setMap(null);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (props.mapRef?.current === controller) props.mapRef.current = null;
      if (props.mapInstanceRef?.current === controller) props.mapInstanceRef.current = null;
    };
  }, [map, project, updatePositions, props.mapRef, props.mapInstanceRef]);

  useEffect(() => { updatePositions(); }, [props.selectedDriverId, props.selectedJobId, props.jobs, props.drivers, updatePositions]);

  useEffect(() => {
    if (props.active === false) return;
    let animationFrame = 0;
    let lastTime = performance.now();
    let lastPosition = 0;
    let lastTelemetry = 0;
    const tick = (time: number) => {
      const delta = Math.min(Math.max((time - lastTime) / 1000, 0), 0.1);
      lastTime = time;
      progress.current += delta * 0.012;
      if (progress.current > 0.98) progress.current = 0.02;
      const next = routePosition(progress.current);
      movingDriverRef.current = next;
      if (time - lastPosition > 150) {
        lastPosition = time;
        setMovingDriver(next);
        updatePositions();
      }
      if (time - lastTelemetry > 3000) {
        lastTelemetry = time;
        const distance = next.distanceRemainingKm;
        (propsRef.current.onDriverTelemetry ?? propsRef.current.onDriverTelemetryUpdate)?.('D14', {
          eta: `${Math.max(1, Math.round(distance * 1.8))} min (${distance} km)`,
          distance: `${distance} km`,
          speed: Math.round(48 + Math.sin(time / 1000) * 8)
        });
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [updatePositions, props.active]);

  const visibleJobs = (props.jobs?.length ? props.jobs : INITIAL_JOBS).filter(job => {
    if (job.status === 'completed') return false;
    if (INITIAL_JOBS.some(seed => seed.id === job.id)) return true;
    const drops = job.pricingInput?.stops.filter(stop => stop.type === 'DROPOFF') ?? [];
    const destination = drops[drops.length - 1];
    return destination?.latitude != null && destination.longitude != null;
  });

  return <>
    <GoogleTraffic enabled={props.active !== false && props.layerConfig.traffic} />
    <Polyline path={BLUE_PATH} strokeColor="#1d4ed8" strokeOpacity={0.8} strokeWeight={7} clickable={false} />
    <Polyline path={BLUE_PATH} strokeColor="#60a5fa" strokeWeight={4} clickable={false} />
    <Polyline path={GREEN_PATH} strokeColor="#047857" strokeOpacity={0.7} strokeWeight={5} clickable={false} />
    <Polyline path={GREEN_PATH} strokeColor="#34d399" strokeWeight={3} clickable={false} />
    <Polyline path={ORANGE_PATH} strokeColor="#c2410c" strokeOpacity={0.7} strokeWeight={5} clickable={false} />
    <Polyline path={ORANGE_PATH} strokeColor="#fb923c" strokeWeight={3} clickable={false} />

    <GoogleOverlayMarker position={{ lat: 49.196, lng: -123.184 }} label="Vancouver Airport cargo">
      <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-md border border-blue-200 text-blue-700 font-semibold text-xs whitespace-nowrap">
        <Plane className="w-3.5 h-3.5" /> Vancouver Airport (YVR Cargo)
      </div>
    </GoogleOverlayMarker>
    {visibleJobs.map(job => {
      const risk = job.status === 'at_risk';
      const late = job.status === 'late_start';
      const unassigned = job.status === 'no_driver';
      const color = risk ? 'bg-rose-600' : late ? 'bg-amber-500' : unassigned ? 'bg-slate-700' : 'bg-blue-600';
      const label = risk ? 'At Risk' : late ? 'Late Start' : unassigned ? 'No Driver' : job.statusLabel;
      const Icon = risk ? Package : late ? Clock3 : unassigned ? UserX : Package;
      return <GoogleOverlayMarker key={job.id} position={{ lat: job.lat, lng: job.lng }}
        label={`Order ${job.jobNumber}, ${label}`} onSelect={() => props.onSelectJob(job.jobNumber, [job.lng, job.lat])}>
        <div className="relative flex items-center justify-center w-9 h-9 group">
          {risk && <div className="absolute inset-0 rounded-full bg-rose-500/30 animate-radar-ping-fast pointer-events-none" />}
          <div className={`relative w-8 h-8 rounded-full ${color} text-white ring-2 ring-white shadow-lg grid place-items-center group-hover:scale-110 transition-transform`}><Icon className="w-4 h-4" /></div>
          <div className={`absolute -top-6 left-1/2 -translate-x-1/2 ${color} text-white text-xs font-bold px-2 py-0.5 rounded-md shadow-sm whitespace-nowrap pointer-events-none`}>{job.jobNumber} • {label}</div>
        </div>
      </GoogleOverlayMarker>;
    })}
    <GoogleOverlayMarker id="d14-marker-container" position={{ lat: movingDriver.lat, lng: movingDriver.lng }} label="Driver D14, Arles" onSelect={() => props.onSelectDriver('D14', [movingDriverRef.current.lng, movingDriverRef.current.lat])}>
      <div className="relative group flex items-center justify-center w-[46px] h-[46px]">
        <div className="absolute inset-0 rounded-full bg-blue-500/25 animate-radar-ping pointer-events-none" />
        <div className="absolute inset-1.5 rounded-full bg-blue-400/20 animate-radar-ping-fast pointer-events-none" />
        <div className="relative w-9 h-9 rounded-full bg-blue-600 text-white shadow-lg ring-2 ring-white grid place-items-center group-hover:scale-110 transition-transform"><Truck className="w-5 h-5" style={{ transform: `rotate(${movingDriver.heading - 90}deg)` }} /></div>
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-xs font-bold px-2 py-0.5 rounded-md shadow-sm whitespace-nowrap pointer-events-none">D14 • Arles</div>
      </div>
    </GoogleOverlayMarker>
    {(props.drivers?.length ? props.drivers : INITIAL_DRIVERS).filter(driver => driver.id !== 'D14').map(driver => {
      const available = driver.status === 'available';
      const label = driver.id === 'D28' ? 'Driver D28, Marcus' : driver.id === 'D09' ? 'Driver D09, available' : `Driver ${driver.id}, ${driver.name}`;
      return <GoogleOverlayMarker key={driver.id} position={{ lat: driver.lat, lng: driver.lng }} label={label}
        onSelect={() => props.onSelectDriver(driver.id, [driver.lng, driver.lat])}>
        <div className="flex items-center gap-2 bg-white rounded-full px-2.5 py-1 shadow-lg border border-slate-200/90 hover:border-emerald-300 transition-all whitespace-nowrap">
          <div className={`w-6 h-6 rounded-full ${available ? 'bg-emerald-500' : driver.status === 'offline' ? 'bg-slate-400' : 'bg-blue-600'} text-white grid place-items-center shrink-0`}><Truck className="w-3.5 h-3.5" /></div>
          <div className="pr-1 leading-none"><div className="text-xs font-bold text-slate-800">{driver.id} • {driver.name.split(' ')[0]}</div><div className="text-xs text-slate-500 font-medium">{driver.statusLabel}</div></div>
        </div>
      </GoogleOverlayMarker>;
    })}
  </>;
}

const NO_LABELS: google.maps.MapTypeStyle[] = [{ elementType: 'labels', stylers: [{ visibility: 'off' }] }];

export function GoogleMonitorMap(props: GoogleMonitorMapProps) {
  const [error, setError] = useState(false);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey || error) return <div className="absolute inset-0 grid place-items-center bg-slate-100 px-6 text-center text-sm text-slate-600" role="status">
    {error ? 'Google Maps could not load. Check the browser key, Maps JavaScript API, billing, and allowed website.' : 'Set VITE_GOOGLE_MAPS_API_KEY in client/.env.local to show the Google map.'}
  </div>;
  const { mode, labels } = props.layerConfig;
  return <div className="absolute inset-0 bg-slate-100" data-map-provider="google">
    <APIProvider apiKey={apiKey} language="en" region="CA" onError={() => setError(true)}>
      <Map defaultCenter={MONITOR_CAMERA.center} defaultZoom={MONITOR_CAMERA.zoom}
        mapTypeId={mode === 'map' ? 'roadmap' : labels ? 'hybrid' : 'satellite'}
        styles={mode === 'map' && !labels ? NO_LABELS : undefined}
        disableDefaultUI clickableIcons={false} gestureHandling="greedy"
        onClick={() => props.onMapClick?.()}>
        <MonitorMapContent {...props} />
      </Map>
    </APIProvider>
  </div>;
}
