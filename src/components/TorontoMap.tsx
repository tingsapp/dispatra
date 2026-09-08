import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Map, { Marker, Source, Layer, MapRef } from 'react-map-gl/maplibre';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Configure MapLibre Web Worker for Vite bundling to prevent blank gray canvas
import maplibreglWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

if (typeof window !== 'undefined' && maplibregl.setWorkerUrl) {
  maplibregl.setWorkerUrl(maplibreglWorkerUrl);
}

import { Driver, Job, MapLayerConfig } from '../types';
import {
  BLUE_ROUTE_WAYPOINTS,
  GREEN_ROUTE_WAYPOINTS,
  ORANGE_ROUTE_WAYPOINTS,
  TRAFFIC_CORRIDORS,
  INITIAL_DRIVERS,
  INITIAL_JOBS
} from '../data/mockData';

// Vancouver Center Coordinates
export const VANCOUVER_CENTER_LAT_LNG: [number, number] = [49.2827, -123.1207];
export const VANCOUVER_CENTER_LNG_LAT: [number, number] = [-123.1207, 49.2827];
export const TORONTO_CENTER_LNG_LAT: [number, number] = VANCOUVER_CENTER_LNG_LAT;

// OpenFreeMap's public street map uses OpenStreetMap data with no API key.
// Keep MapLibre so the existing route layers, markers and map controls are unchanged.
export const OPENFREEMAP_STREET_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export const SATELLITE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
    }
  },
  layers: [
    {
      id: 'esri-satellite-layer',
      type: 'raster',
      source: 'esri-satellite',
      minzoom: 0,
      maxzoom: 22
    }
  ]
};

export interface MarkerScreenPositions {
  d14?: { x: number; y: number } | null;
  job461?: { x: number; y: number } | null;
  driver?: { x: number; y: number } | null;
  job?: { x: number; y: number } | null;
}

export interface MapController {
  flyTo: (options: {
    center: [number, number];
    zoom?: number;
    duration?: number;
    pitch?: number;
    bearing?: number;
    essential?: boolean;
  }) => void;
  zoomIn: (options?: any) => void;
  zoomOut: (options?: any) => void;
  easeTo?: (options: any) => void;
  panTo?: (coords: [number, number]) => void;
  resize: () => void;
  project?: (coords: [number, number]) => { x: number; y: number };
}

// Helper to interpolate position along polyline
const getInterpolatedPosition = (
  waypoints: [number, number][],
  progress: number
): { latLng: [number, number]; heading: number; distanceRemainingKm: number } => {
  let totalLength = 0;
  const segmentLengths: number[] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const dist = Math.hypot((p2[1] - p1[1]) * 75, (p2[0] - p1[0]) * 111);
    segmentLengths.push(dist);
    totalLength += dist;
  }

  const targetDistance = progress * totalLength;
  let accumulated = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    if (accumulated + segmentLengths[i] >= targetDistance || i === segmentLengths.length - 1) {
      const segProgress = segmentLengths[i] === 0 ? 0 : (targetDistance - accumulated) / segmentLengths[i];
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];

      const lat = p1[0] + (p2[0] - p1[0]) * segProgress;
      const lng = p1[1] + (p2[1] - p1[1]) * segProgress;

      const dLng = (p2[1] - p1[1]) * Math.cos((lat * Math.PI) / 180);
      const dLat = p2[0] - p1[0];
      let heading = (Math.atan2(dLng, dLat) * 180) / Math.PI;
      if (heading < 0) heading += 360;

      const remainingKm = Math.max(0.2, Math.round((1 - progress) * totalLength * 10) / 10);

      return {
        latLng: [lat, lng],
        heading: Math.round(heading),
        distanceRemainingKm: remainingKm
      };
    }
    accumulated += segmentLengths[i];
  }

  return {
    latLng: [waypoints[0][0], waypoints[0][1]],
    heading: 0,
    distanceRemainingKm: 0
  };
};

interface D14AnimatedMarkerProps {
  mapRef: React.RefObject<MapRef | null>;
  onSelectDriver: (driverId: string) => void;
  currentD14CoordsRef: React.MutableRefObject<{ lng: number; lat: number }>;
  onDriverTelemetryRef: React.MutableRefObject<((driverId: string, telemetry: { eta: string; distance: string; speed?: number }) => void) | undefined>;
  updateScreenPositions: () => void;
}

const D14AnimatedMarker: React.FC<D14AnimatedMarkerProps> = React.memo(({
  mapRef,
  onSelectDriver,
  currentD14CoordsRef,
  onDriverTelemetryRef,
  updateScreenPositions
}) => {
  const [d14Coords, setD14Coords] = useState<{
    lng: number;
    lat: number;
    heading: number;
  }>({
    lng: BLUE_ROUTE_WAYPOINTS[9][1],
    lat: BLUE_ROUTE_WAYPOINTS[9][0],
    heading: 180
  });

  const simulationProgressRef = useRef<number>(0.65);
  const lastTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    let animationFrameId: number;
    let lastTelemetryTime = 0;
    let lastPosUpdateTime = 0;

    const animateVehicle = (time: number) => {
      const rawDelta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;
      const delta = Math.min(Math.max(rawDelta, 0), 0.1);

      const step = (delta * 0.012) % 1;
      let nextProgress = simulationProgressRef.current + step;
      if (nextProgress > 0.98) {
        nextProgress = 0.02;
      }
      simulationProgressRef.current = nextProgress;

      const { latLng, heading, distanceRemainingKm } = getInterpolatedPosition(
        BLUE_ROUTE_WAYPOINTS,
        nextProgress
      );

      currentD14CoordsRef.current = { lng: latLng[1], lat: latLng[0] };

      // Update marker coordinates smoothly (150ms)
      if (time - lastPosUpdateTime > 150) {
        lastPosUpdateTime = time;
        setD14Coords({
          lng: latLng[1],
          lat: latLng[0],
          heading
        });
      }

      // Throttle telemetry update to parent UI (every 3s)
      if (time - lastTelemetryTime > 3000) {
        lastTelemetryTime = time;
        const simulatedSpeed = Math.round(48 + Math.sin(time / 1000) * 8);
        const etaMinutes = Math.max(1, Math.round(distanceRemainingKm * 1.8));

        if (onDriverTelemetryRef.current) {
          onDriverTelemetryRef.current('D14', {
            eta: `${etaMinutes} min (${distanceRemainingKm} km)`,
            distance: `${distanceRemainingKm} km`,
            speed: simulatedSpeed
          });
        }
      }

      animationFrameId = requestAnimationFrame(animateVehicle);
    };

    lastTimeRef.current = performance.now();
    animationFrameId = requestAnimationFrame(animateVehicle);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [currentD14CoordsRef, onDriverTelemetryRef]);

  return (
    <Marker
      longitude={d14Coords.lng}
      latitude={d14Coords.lat}
      anchor="center"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onSelectDriver('D14');
        updateScreenPositions();
      }}
    >
      <div
        id="d14-marker-container"
        className="relative group flex items-center justify-center cursor-pointer select-none"
        style={{ width: '46px', height: '46px' }}
      >
        <div className="absolute inset-0 rounded-full bg-blue-500/25 animate-radar-ping pointer-events-none" />
        <div className="absolute inset-1.5 rounded-full bg-blue-400/20 animate-radar-ping-fast pointer-events-none" />
        <div className="relative w-9 h-9 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/40 ring-2 ring-white flex items-center justify-center transform group-hover:scale-110 transition-transform">
          <svg
            id="d14-vehicle-arrow"
            className="w-5 h-5 transition-transform duration-200"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ transform: `rotate(${d14Coords.heading - 90}deg)` }}
          >
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
          </svg>
        </div>
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm whitespace-nowrap pointer-events-none">
          D14 • Arles
        </div>
      </div>
    </Marker>
  );
});

export interface TorontoMapProps {
  drivers?: Driver[];
  jobs?: Job[];
  selectedDriverId?: string | null;
  selectedJobId?: string | null;
  onSelectDriver: (id: string) => void;
  onSelectJob: (id: string) => void;
  onMapClick?: () => void;
  layerConfig: MapLayerConfig;
  onPositionsUpdate?: (positions: MarkerScreenPositions) => void;
  onUpdatePositions?: (positions: MarkerScreenPositions) => void;
  onDriverTelemetry?: (driverId: string, telemetry: { eta: string; distance: string; speed?: number }) => void;
  onDriverTelemetryUpdate?: (driverId: string, telemetry: { eta: string; distance: string; speed?: number }) => void;
  mapInstanceRef?: React.MutableRefObject<any>;
  mapRef?: React.MutableRefObject<any>;
}

export const TorontoMap: React.FC<TorontoMapProps> = ({
  drivers = INITIAL_DRIVERS,
  jobs = INITIAL_JOBS,
  selectedDriverId,
  selectedJobId,
  onSelectDriver,
  onSelectJob,
  onMapClick,
  layerConfig,
  onPositionsUpdate,
  onUpdatePositions,
  onDriverTelemetry,
  onDriverTelemetryUpdate,
  mapInstanceRef,
  mapRef: propMapRef
}) => {
  const mapRef = useRef<MapRef | null>(null);

  const currentD14CoordsRef = useRef<{ lng: number; lat: number }>({
    lng: BLUE_ROUTE_WAYPOINTS[9][1],
    lat: BLUE_ROUTE_WAYPOINTS[9][0]
  });

  // Keep stable refs for callbacks and current selections
  const onSelectDriverRef = useRef(onSelectDriver);
  onSelectDriverRef.current = onSelectDriver;

  const onSelectJobRef = useRef(onSelectJob);
  onSelectJobRef.current = onSelectJob;

  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  const onPositionsUpdateRef = useRef(onPositionsUpdate || onUpdatePositions);
  onPositionsUpdateRef.current = onPositionsUpdate || onUpdatePositions;

  const onDriverTelemetryRef = useRef(onDriverTelemetry || onDriverTelemetryUpdate);
  onDriverTelemetryRef.current = onDriverTelemetry || onDriverTelemetryUpdate;

  const jobsRef = useRef(jobs);
  jobsRef.current = jobs && jobs.length > 0 ? jobs : INITIAL_JOBS;

  const driversRef = useRef(drivers);
  driversRef.current = drivers && drivers.length > 0 ? drivers : INITIAL_DRIVERS;

  const selectedDriverIdRef = useRef(selectedDriverId);
  selectedDriverIdRef.current = selectedDriverId;

  const selectedJobIdRef = useRef(selectedJobId);
  selectedJobIdRef.current = selectedJobId;

  // Keep map gestures available after a marker opens an anchored popover.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    map.dragPan.enable();
    map.scrollZoom.enable();
    map.boxZoom.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();
  }, [selectedDriverId, selectedJobId]);

  // Convert Route Waypoints [lat, lng] to GeoJSON LineStrings [lng, lat]
  const blueRouteGeoJson = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: BLUE_ROUTE_WAYPOINTS.map(([lat, lng]) => [lng, lat])
      }
    }),
    []
  );

  const greenRouteGeoJson = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: GREEN_ROUTE_WAYPOINTS.map(([lat, lng]) => [lng, lat])
      }
    }),
    []
  );

  const orangeRouteGeoJson = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: ORANGE_ROUTE_WAYPOINTS.map(([lat, lng]) => [lng, lat])
      }
    }),
    []
  );

  const trafficGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: TRAFFIC_CORRIDORS.map((c) => ({
        type: 'Feature' as const,
        properties: {
          color: c.status === 'congested' ? '#ef4444' : c.status === 'moderate' ? '#f59e0b' : '#10b981',
          name: c.name
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: c.coords.map(([lat, lng]) => [lng, lat])
        }
      }))
    }),
    []
  );

  // Sync screen coordinates for popover positioning with RAF debouncing & delta threshold
  const isPosUpdateScheduledRef = useRef(false);
  const lastEmittedPositionsRef = useRef<{
    d14: { x: number; y: number } | null;
    job461: { x: number; y: number } | null;
  }>({ d14: null, job461: null });

  const updateScreenPositions = useCallback(() => {
    if (isPosUpdateScheduledRef.current) return;
    isPosUpdateScheduledRef.current = true;

    requestAnimationFrame(() => {
      isPosUpdateScheduledRef.current = false;
      const map = mapRef.current?.getMap();
      if (!map) return;

      let d14Point: { x: number; y: number } | null = null;
      let job461Point: { x: number; y: number } | null = null;
      let driverPoint: { x: number; y: number } | null = null;
      let jobPoint: { x: number; y: number } | null = null;

      try {
        if (currentD14CoordsRef.current) {
          const pt = map.project([currentD14CoordsRef.current.lng, currentD14CoordsRef.current.lat]);
          d14Point = { x: Math.round(pt.x), y: Math.round(pt.y) };
        }
        const jobList = jobsRef.current || INITIAL_JOBS;
        const job461 = jobList.find((j) => j.jobNumber === '#461') || INITIAL_JOBS[0];
        if (job461) {
          const pt = map.project([job461.lng, job461.lat]);
          job461Point = { x: Math.round(pt.x), y: Math.round(pt.y) };
        }

        const currentDriverId = selectedDriverIdRef.current;
        if (currentDriverId) {
          if (currentDriverId === 'D14' && currentD14CoordsRef.current) {
            driverPoint = d14Point;
          } else {
            const driverList = driversRef.current || INITIAL_DRIVERS;
            const d = driverList.find((dr) => dr.id === currentDriverId);
            if (d) {
              const pt = map.project([d.lng, d.lat]);
              driverPoint = { x: Math.round(pt.x), y: Math.round(pt.y) };
            }
          }
        }

        const currentJobId = selectedJobIdRef.current;
        if (currentJobId) {
          const j = jobList.find((jb) => jb.jobNumber === currentJobId);
          if (j) {
            const pt = map.project([j.lng, j.lat]);
            jobPoint = { x: Math.round(pt.x), y: Math.round(pt.y) };
          }
        }
      } catch {
        // Ignored during resize or unmount
      }

      const last = lastEmittedPositionsRef.current;
      const d14Moved = !last.d14 || !d14Point || Math.hypot(last.d14.x - d14Point.x, last.d14.y - d14Point.y) > 1;
      const jobMoved = !last.job461 || !job461Point || Math.hypot(last.job461.x - job461Point.x, last.job461.y - job461Point.y) > 1;

      if (d14Moved || jobMoved || driverPoint || jobPoint) {
        lastEmittedPositionsRef.current = { d14: d14Point, job461: job461Point };
        if (onPositionsUpdateRef.current) {
          onPositionsUpdateRef.current({
            d14: d14Point,
            job461: job461Point,
            driver: driverPoint || d14Point,
            job: jobPoint || job461Point
          });
        }
      }
    });
  }, []);

  // Expose controller to parent refs
  const exposeMapController = useCallback(() => {
    const controller: MapController = {
      flyTo: ({ center, zoom, duration = 1000, pitch, bearing }) => {
        try {
          const map = mapRef.current?.getMap();
          if (!map) return;
          const lat = Math.abs(center[0]) > 90 ? center[1] : center[0];
          const lng = Math.abs(center[0]) > 90 ? center[0] : center[1];
          const flyToOptions: maplibregl.FlyToOptions = {
            center: [lng, lat],
            zoom: zoom ?? 13.5,
            duration: typeof duration === 'number' && duration < 10 ? duration * 1000 : duration
          };
          if (pitch !== undefined) flyToOptions.pitch = pitch;
          if (bearing !== undefined) flyToOptions.bearing = bearing;
          map.flyTo(flyToOptions);
        } catch (err) {
          console.warn('Map flyTo safe catch:', err);
        }
      },
      zoomIn: () => {
        try {
          mapRef.current?.zoomIn();
        } catch {}
      },
      zoomOut: () => {
        try {
          mapRef.current?.zoomOut();
        } catch {}
      },
      easeTo: (options: any) => {
        try {
          const map = mapRef.current?.getMap();
          if (!map) return;
          if (options?.center) {
            const lat = Math.abs(options.center[0]) > 90 ? options.center[1] : options.center[0];
            const lng = Math.abs(options.center[0]) > 90 ? options.center[0] : options.center[1];
            map.easeTo({ ...options, center: [lng, lat] });
          } else {
            map.easeTo(options);
          }
        } catch {}
      },
      panTo: (coords: [number, number]) => {
        try {
          const map = mapRef.current?.getMap();
          if (!map) return;
          const lat = Math.abs(coords[0]) > 90 ? coords[1] : coords[0];
          const lng = Math.abs(coords[0]) > 90 ? coords[0] : coords[1];
          map.panTo([lng, lat]);
        } catch {}
      },
      resize: () => {
        try {
          mapRef.current?.resize();
        } catch {}
      },
      project: (coords: [number, number]) => {
        try {
          const map = mapRef.current?.getMap();
          if (!map) return { x: 0, y: 0 };
          const lat = Math.abs(coords[0]) > 90 ? coords[1] : coords[0];
          const lng = Math.abs(coords[0]) > 90 ? coords[0] : coords[1];
          const pt = map.project([lng, lat]);
          return { x: pt.x, y: pt.y };
        } catch {
          return { x: 0, y: 0 };
        }
      }
    };

    if (mapInstanceRef) mapInstanceRef.current = controller;
    if (propMapRef) propMapRef.current = controller;
  }, [mapInstanceRef, propMapRef]);

  // Handle map initial load with WebGL context recovery
  const handleMapLoad = useCallback(() => {
    try {
      const map = mapRef.current?.getMap();
      if (map) {
        map.resize();
        const canvas = map.getCanvas();
        canvas?.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          console.warn('MapLibre WebGL context lost handled; preventing freeze.');
        });
        canvas?.addEventListener('webglcontextrestored', () => {
          console.info('MapLibre WebGL context restored; resizing.');
          map.resize();
        });
        map.on('error', (e) => {
          console.warn('MapLibre runtime event caught:', e.error?.message || e);
        });
      }
    } catch (e) {
      console.warn('Map load safe init error:', e);
    }

    exposeMapController();
    updateScreenPositions();
    // Schedule follow-up resize to ensure WebGL canvas matches final DOM layout
    setTimeout(() => {
      try {
        mapRef.current?.getMap()?.resize();
        updateScreenPositions();
      } catch {}
    }, 150);
  }, [exposeMapController, updateScreenPositions]);

  const handleMapClick = useCallback(() => {
    if (onMapClickRef.current) {
      onMapClickRef.current();
    }
  }, []);

  const activeMapStyle = layerConfig.mode === 'satellite' ? SATELLITE_STYLE : OPENFREEMAP_STREET_STYLE;

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden select-none bg-slate-100">
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <Map
          ref={mapRef}
          mapLib={maplibregl}
          workerUrl={maplibreglWorkerUrl}
          initialViewState={{
            longitude: VANCOUVER_CENTER_LNG_LAT[0],
            latitude: VANCOUVER_CENTER_LNG_LAT[1],
            zoom: 11,
            pitch: 0,
            bearing: 0
          }}
          dragPan={true}
          scrollZoom={true}
          boxZoom={true}
          dragRotate={true}
          doubleClickZoom={true}
          touchZoomRotate={true}
          touchPitch={true}
          cursor="grab"
          mapStyle={activeMapStyle}
          style={{ width: '100%', height: '100%' }}
          attributionControl={true}
          onResize={updateScreenPositions}
          onMoveEnd={updateScreenPositions}
          onZoomEnd={updateScreenPositions}
          onLoad={handleMapLoad}
          onClick={handleMapClick}
        >
        {/* 1. DISPATCH POLYLINES */}
        {/* Blue Route */}
        <Source id="blue-route-source" type="geojson" data={blueRouteGeoJson}>
          <Layer
            id="blue-route-casing"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{
              'line-color': '#1d4ed8',
              'line-width': 7,
              'line-opacity': 0.8
            }}
          />
          <Layer
            id="blue-route-core"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{
              'line-color': '#60a5fa',
              'line-width': 4,
              'line-dasharray': [2, 3]
            }}
          />
        </Source>

        {/* Green Route */}
        <Source id="green-route-source" type="geojson" data={greenRouteGeoJson}>
          <Layer
            id="green-route-casing"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{
              'line-color': '#047857',
              'line-width': 5,
              'line-opacity': 0.7
            }}
          />
          <Layer
            id="green-route-core"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{
              'line-color': '#34d399',
              'line-width': 3
            }}
          />
        </Source>

        {/* Orange Route */}
        <Source id="orange-route-source" type="geojson" data={orangeRouteGeoJson}>
          <Layer
            id="orange-route-casing"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{
              'line-color': '#c2410c',
              'line-width': 5,
              'line-opacity': 0.7
            }}
          />
          <Layer
            id="orange-route-core"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{
              'line-color': '#fb923c',
              'line-width': 3
            }}
          />
        </Source>

        {/* Traffic Corridors */}
        {layerConfig.traffic && (
          <Source id="traffic-source" type="geojson" data={trafficGeoJson}>
            <Layer
              id="traffic-layer"
              type="line"
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{
                'line-color': ['get', 'color'],
                'line-width': 5,
                'line-opacity': 0.85
              }}
            />
          </Source>
        )}

        {/* 2. AIRPORT YVR CARGO LANDMARK */}
        <Marker longitude={-123.184} latitude={49.196} anchor="center">
          <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-md border border-blue-200 text-blue-700 font-semibold text-[11px] whitespace-nowrap hover:scale-105 transition-transform cursor-pointer select-none">
            <svg className="w-3.5 h-3.5 text-blue-600 fill-blue-600" viewBox="0 0 24 24">
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
            </svg>
            <span>Vancouver Airport (YVR Cargo)</span>
          </div>
        </Marker>

        {/* 3. DISPATCH JOB MARKERS */}
        {/* Job #461 (Kitsilano Stop • At Risk) */}
        <Marker
          longitude={-123.153}
          latitude={49.268}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            onSelectJob('#461');
            updateScreenPositions();
          }}
        >
          <div className="relative group flex items-center justify-center cursor-pointer select-none" style={{ width: '48px', height: '48px' }}>
            <div className="absolute inset-0 rounded-full bg-rose-500/30 animate-radar-ping-fast pointer-events-none" />
            <div className="absolute inset-2 rounded-full bg-rose-400/20 animate-radar-ping pointer-events-none" />
            <div className="relative w-9 h-9 rounded-full bg-rose-600 text-white ring-2 ring-white shadow-lg shadow-rose-600/40 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm whitespace-nowrap pointer-events-none">
              #461 • At Risk (22m late)
            </div>
          </div>
        </Marker>

        {/* Job #452 (Mount Pleasant Stop • Late Start) */}
        <Marker
          longitude={-123.098}
          latitude={49.27}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            onSelectJob('#452');
            updateScreenPositions();
          }}
        >
          <div className="relative group flex items-center justify-center cursor-pointer select-none" style={{ width: '40px', height: '40px' }}>
            <div className="w-8 h-8 rounded-full bg-amber-500 text-white ring-2 ring-white shadow-md shadow-amber-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap pointer-events-none">
              #452 • Late Start
            </div>
          </div>
        </Marker>

        {/* Job #439 (Downtown Stop • No Driver) */}
        <Marker
          longitude={-123.1215}
          latitude={49.2855}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            onSelectJob('#439');
            updateScreenPositions();
          }}
        >
          <div className="relative group flex items-center justify-center cursor-pointer select-none" style={{ width: '38px', height: '38px' }}>
            <div className="w-7 h-7 rounded-full bg-slate-700 text-white ring-2 ring-white shadow-md flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="18" y1="8" x2="23" y2="13" />
                <line x1="23" y1="8" x2="18" y2="13" />
              </svg>
            </div>
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap pointer-events-none">
              #439 • No Driver
            </div>
          </div>
        </Marker>

        {/* 4. FLEET DRIVER MARKERS */}
        {/* Driver D14 (Arles Morgan - Active Animated Vehicle) */}
        <D14AnimatedMarker
          mapRef={mapRef}
          onSelectDriver={onSelectDriver}
          currentD14CoordsRef={currentD14CoordsRef}
          onDriverTelemetryRef={onDriverTelemetryRef}
          updateScreenPositions={updateScreenPositions}
        />

        {/* Driver D28 (Marcus Vance) */}
        <Marker
          longitude={-123.069}
          latitude={49.272}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            onSelectDriver('D28');
            updateScreenPositions();
          }}
        >
          <div className="flex items-center gap-2 bg-white rounded-full px-2.5 py-1 shadow-lg shadow-slate-900/10 border border-slate-200/90 hover:border-emerald-300 transition-all hover:scale-105 cursor-pointer select-none">
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM19 17H5v-4.66l.12-.34h13.77l.11.34V17z" />
              </svg>
            </div>
            <div className="pr-1 leading-none">
              <div className="text-[11px] font-bold text-slate-800">D28 • Marcus</div>
              <div className="text-[9px] text-emerald-600 font-medium">Available • 5-ton</div>
            </div>
          </div>
        </Marker>

        {/* Driver D09 (Elena Rostova / Maria Garcia) */}
        <Marker
          longitude={-123.115}
          latitude={49.2705}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            onSelectDriver('D09');
            updateScreenPositions();
          }}
        >
          <div className="flex items-center gap-1.5 bg-white/95 rounded-full px-2.5 py-1 shadow-md border border-slate-200/90 hover:scale-105 transition-transform cursor-pointer select-none">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-[11px] font-bold text-slate-800">D09</span>
            <span className="text-[10px] text-emerald-600 font-semibold">Available</span>
          </div>
        </Marker>
      </Map>
      </div>
    </div>
  );
};
