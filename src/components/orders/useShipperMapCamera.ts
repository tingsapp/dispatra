import { useCallback, useEffect, useRef } from 'react';
import type { MapPoint } from './shipperMapLocation';
import { shipperMapPadding } from './shipperMapViewport';

/** Initial framing and layout changes respect overlays; ordinary data refreshes keep the camera. */
export function useShipperMapCamera(map: google.maps.Map | null, points: MapPoint[], home: MapPoint, ready: boolean) {
  const current = useRef({ points, home, ready });
  current.current = { points, home, ready };
  const initialized = useRef(false);
  const mode = useRef<'orders' | 'home' | 'manual'>('orders');
  const idle = useRef<google.maps.MapsEventListener | null>(null);
  const frame = useCallback((target: 'orders' | 'home') => {
    if (!map) return;
    const view = map.getDiv().getBoundingClientRect();
    if (!view.width || !view.height) return;
    const card = map.getDiv().closest('main')?.querySelector('.shipper-tracking-card')?.getBoundingClientRect();
    const positions = target === 'orders' && current.current.points.length ? current.current.points : [current.current.home];
    const bounds = new google.maps.LatLngBounds();
    positions.forEach(point => bounds.extend(point));
    idle.current?.remove();
    initialized.current = true;
    mode.current = target;
    // Set a temporary limit before fitting so single-point views retain the padded center.
    map.setOptions({ maxZoom: target === 'home' || positions.length === 1 ? 13 : 15 });
    map.fitBounds(bounds, shipperMapPadding(view, card));
    idle.current = google.maps.event.addListenerOnce(map, 'idle', () => { map.setOptions({ maxZoom: 19 }); idle.current = null; });
  }, [map]);

  const markManual = useCallback(() => {
    mode.current = 'manual'; initialized.current = true;
    idle.current?.remove(); idle.current = null; map?.setOptions({ maxZoom: 19 });
  }, [map]);

  useEffect(() => {
    if (!map || !ready || initialized.current) return;
    const tick = requestAnimationFrame(() => { initialized.current = true; frame('orders'); });
    return () => cancelAnimationFrame(tick);
  }, [map, ready, frame]);

  useEffect(() => {
    if (!map) return;
    let tick = 0;
    const observe = new ResizeObserver(() => {
      cancelAnimationFrame(tick);
      tick = requestAnimationFrame(() => { if (initialized.current && mode.current !== 'manual') frame(mode.current); });
    });
    observe.observe(map.getDiv());
    const card = map.getDiv().closest('main')?.querySelector('.shipper-tracking-card');
    if (card) observe.observe(card);
    const manual = markManual;
    const canvas = map.getDiv();
    canvas.addEventListener('pointerdown', manual, true);
    canvas.addEventListener('wheel', manual, true);
    canvas.addEventListener('keydown', manual, true);
    return () => {
      observe.disconnect(); cancelAnimationFrame(tick); idle.current?.remove();
      canvas.removeEventListener('pointerdown', manual, true);
      canvas.removeEventListener('wheel', manual, true);
      canvas.removeEventListener('keydown', manual, true);
    };
  }, [map, frame, markManual]);
  return { markManual, fitOrders: () => frame('orders'), focusHome: () => frame('home') };
}
