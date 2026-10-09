import { useCallback, useEffect, useRef } from 'react';
import type { MapPoint } from './shipperMapLocation';
import { shipperMapPadding, shipperMapSpan, shipperMarkerInsets } from './shipperMapViewport';

function extent(points: MapPoint[]) {
  let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity;
  for (const point of points) {
    south = Math.min(south, point.lat); north = Math.max(north, point.lat);
    west = Math.min(west, point.lng); east = Math.max(east, point.lng);
  }
  return points.length ? [south, north, west, east].join(':') : '';
}

/** Automatic views follow route/layout bounds; only camera gestures switch to manual mode. */
export function useShipperMapCamera(map: google.maps.Map | null, points: MapPoint[], home: MapPoint, ready: boolean) {
  const current = useRef({ points, home, ready });
  current.current = { points, home, ready };
  const initialized = useRef(false);
  const mode = useRef<'orders' | 'home' | 'manual'>('orders');
  const idle = useRef<google.maps.MapsEventListener | null>(null);
  const fittedExtent = useRef('');
  const layoutChanged = useRef(true);
  const ordersExtent = extent(points.length ? points : [home]);
  const homeExtent = extent([home]);
  useEffect(() => {
    initialized.current = false;
    mode.current = 'orders';
    fittedExtent.current = '';
    layoutChanged.current = true;
  }, [map]);
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
    fittedExtent.current = extent(positions);
    layoutChanged.current = false;
    const span = shipperMapSpan(positions);
    // Keep home/single-point views useful; real routes may fit up to street level.
    map.setOptions({ maxZoom: target === 'home' ? 13 : !span.width && !span.height ? 17 : 19 });
    map.fitBounds(bounds, shipperMapPadding(view, card, shipperMarkerInsets(map.getDiv()), span));
    idle.current = google.maps.event.addListenerOnce(map, 'idle', () => { map.setOptions({ maxZoom: 19 }); idle.current = null; });
  }, [map]);

  const markManual = useCallback(() => {
    mode.current = 'manual'; initialized.current = true;
    idle.current?.remove(); idle.current = null; map?.setOptions({ maxZoom: 19 });
  }, [map]);

  useEffect(() => {
    if (!map || !ready || mode.current === 'manual') return;
    const target = mode.current;
    if (initialized.current && !layoutChanged.current && fittedExtent.current === (target === 'orders' ? ordersExtent : homeExtent)) return;
    const tick = requestAnimationFrame(() => frame(target));
    return () => cancelAnimationFrame(tick);
  }, [map, ready, ordersExtent, homeExtent, frame]);

  useEffect(() => {
    if (!map) return;
    let tick = 0;
    const changed = () => {
      layoutChanged.current = true;
      cancelAnimationFrame(tick);
      tick = requestAnimationFrame(() => { if (current.current.ready && mode.current !== 'manual') frame(mode.current); });
    };
    const observe = new ResizeObserver(changed);
    observe.observe(map.getDiv());
    const card = map.getDiv().closest('main')?.querySelector('.shipper-tracking-card');
    if (card) observe.observe(card);
    const canvas = map.getDiv();
    const captions = new Set<Element>();
    const watchCaptions = () => {
      const visible = new Set(canvas.querySelectorAll('.shipper-stop-caption'));
      for (const caption of captions) if (!visible.has(caption)) { observe.unobserve(caption); captions.delete(caption); }
      for (const caption of visible) if (!captions.has(caption)) { observe.observe(caption); captions.add(caption); }
    };
    watchCaptions();
    const labels = new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element
        && (node.matches('.shipper-stop-caption') || node.querySelector('.shipper-stop-caption'))))) {
        watchCaptions(); changed();
      }
    });
    labels.observe(canvas, { childList: true, subtree: true });
    const drag = map.addListener('dragstart', markManual);
    // Marker selection, focus and Escape do not move the camera. Map controls
    // explicitly mark zoom actions; native gestures apply only to the canvas.
    const onCanvas = (event: Event) => !(event.target instanceof Element
      && event.target.closest('button, a, input, [role="button"]'));
    const wheel = (event: WheelEvent) => { if (onCanvas(event) && event.deltaY) markManual(); };
    const keyboard = (event: KeyboardEvent) => {
      if (onCanvas(event) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '+', '-', '=', '_'].includes(event.key)) markManual();
    };
    const doubleClick = (event: MouseEvent) => { if (onCanvas(event)) markManual(); };
    const pinch = (event: TouchEvent) => { if (onCanvas(event) && event.touches.length > 1) markManual(); };
    canvas.addEventListener('wheel', wheel, true);
    canvas.addEventListener('keydown', keyboard, true);
    canvas.addEventListener('dblclick', doubleClick, true);
    canvas.addEventListener('touchstart', pinch, true);
    return () => {
      observe.disconnect(); labels.disconnect(); cancelAnimationFrame(tick); idle.current?.remove();
      drag.remove();
      canvas.removeEventListener('wheel', wheel, true);
      canvas.removeEventListener('keydown', keyboard, true);
      canvas.removeEventListener('dblclick', doubleClick, true);
      canvas.removeEventListener('touchstart', pinch, true);
    };
  }, [map, frame, markManual]);
  return { markManual, fitOrders: () => frame('orders'), focusHome: () => frame('home') };
}
