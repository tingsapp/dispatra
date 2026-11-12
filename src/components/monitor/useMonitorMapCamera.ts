import { useEffect, useRef } from 'react';
import { MONITOR_CAMERA } from './mapScene';

type MapPoint = [number, number];
const FIT_PADDING = { top: 120, right: 80, bottom: 90, left: 40 };
const FIT_MAX_ZOOM = 15;
const zoomLimits = new WeakMap<google.maps.Map, google.maps.MapsEventListener>();

/** The full-bleed dispatcher map must fit markers beside its floating panels. */
export function monitorFitPadding(canvas?: HTMLElement): google.maps.Padding {
  const workspace = canvas?.closest('.dispatcher-monitor');
  if (!workspace || !canvas) return FIT_PADDING;
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width < 640) return FIT_PADDING;
  const panel = workspace.querySelector('[aria-label="Active orders"]');
  const sidebar = workspace.querySelector('[aria-label="Main navigation"]');
  const occupiedRight = Math.max(panel?.getBoundingClientRect().right ?? 0, sidebar?.getBoundingClientRect().right ?? 0);
  return { ...FIT_PADDING, left: Math.min(Math.round(bounds.width * .55), Math.max(40, occupiedRight - bounds.left + 24)) };
}

/** Shared by automatic framing, Locate and the manual Fit all control. */
export function fitMonitorPoints(map: google.maps.Map, points: MapPoint[]) {
  zoomLimits.get(map)?.remove();
  zoomLimits.delete(map);
  const valid = points.filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
  if (!valid.length) { map.panTo(MONITOR_CAMERA.center); map.setZoom(MONITOR_CAMERA.zoom); return; }
  const bounds = new google.maps.LatLngBounds();
  valid.forEach(([lng, lat]) => bounds.extend({ lat, lng }));
  const canvas = map.getDiv?.();
  if (!canvas?.closest('.dispatcher-monitor') && valid.every(([lng, lat]) => lng === valid[0][0] && lat === valid[0][1])) {
    map.panTo(bounds.getCenter()); map.setZoom(FIT_MAX_ZOOM); return;
  }
  map.fitBounds(bounds, monitorFitPadding(canvas));
  zoomLimits.set(map, google.maps.event.addListenerOnce(map, 'idle', () => {
    zoomLimits.delete(map);
    if ((map.getZoom() ?? 0) > FIT_MAX_ZOOM) map.setZoom(FIT_MAX_ZOOM);
  }));
}

/** Reframe changed visible content, including removals and late road geometry, without moving on identical refreshes. */
export function useMonitorMapCamera(map: google.maps.Map | null, points: MapPoint[], contentIds: string[], active: boolean) {
  // Canonical order ignores API result ordering and object identity. IDs detect changes at shared stops.
  const key = JSON.stringify([contentIds.slice().sort(), [...new Set(points.map(point => point.join(',')))].sort()]);
  const pointsRef = useRef(points);
  pointsRef.current = points;
  useEffect(() => {
    if (!map || !active) return;
    const canvas = map.getDiv();
    let frame: number | null = null;
    let size = '';
    const schedule = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = null;
        const { width, height } = canvas.getBoundingClientRect();
        if (width <= 0 || height <= 0) return;
        fitMonitorPoints(map, pointsRef.current);
      });
    };
    const resized = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const next = `${width},${height}`;
      if (next === size) return;
      size = next;
      schedule();
    };
    resized();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resized);
    observer?.observe(canvas);
    window.addEventListener('resize', resized);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resized);
      if (frame !== null) cancelAnimationFrame(frame);
      zoomLimits.get(map)?.remove();
      zoomLimits.delete(map);
    };
  }, [map, active, key]);
}
