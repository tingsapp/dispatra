import { useMap } from '@vis.gl/react-google-maps';
import { useEffect, useRef } from 'react';
import { roundedRoutePath } from './roundedRoutePath';

/** A Google-projected SVG route with explicit rounded caps, joins and turns. */
export function GoogleRoundedRoute({ id, points, selected }: { id: string; points: number[][]; selected: boolean }) {
  const map = useMap();
  const current = useRef({ id, points, selected });
  current.current = { id, points, selected };
  const overlay = useRef<google.maps.OverlayView | null>(null);
  useEffect(() => {
    if (!map) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.style.position = 'absolute'; svg.style.pointerEvents = 'none';
    svg.setAttribute('aria-hidden', 'true');
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#171717');
    path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    class RouteOverlay extends google.maps.OverlayView {
      onAdd() { this.getPanes()?.overlayLayer.appendChild(svg); }
      draw() {
        const projection = this.getProjection(), center = map!.getCenter();
        if (!projection || !center) return;
        const origin = projection.fromLatLngToDivPixel(center);
        if (!origin) return;
        const width = map!.getDiv().clientWidth + 32, height = map!.getDiv().clientHeight + 32;
        const left = origin.x - width / 2, top = origin.y - height / 2;
        svg.style.left = `${left}px`; svg.style.top = `${top}px`;
        svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height));
        svg.setAttribute('viewBox', `${left} ${top} ${width} ${height}`);
        svg.dataset.shipperRoute = current.current.id;
        path.setAttribute('stroke-width', current.current.selected ? '6' : '4');
        path.setAttribute('stroke-opacity', current.current.selected ? '1' : '0.6');
        const pixels = current.current.points.flatMap(([lat, lng]) => {
          const pixel = projection.fromLatLngToDivPixel(new google.maps.LatLng({ lat, lng }));
          return pixel ? [pixel] : [];
        });
        path.setAttribute('d', roundedRoutePath(pixels));
      }
      onRemove() { svg.remove(); }
    }
    const instance = new RouteOverlay(); overlay.current = instance; instance.setMap(map);
    return () => { instance.setMap(null); overlay.current = null; };
  }, [map]);
  useEffect(() => { overlay.current?.draw(); }, [id, points, selected]);
  return null;
}
