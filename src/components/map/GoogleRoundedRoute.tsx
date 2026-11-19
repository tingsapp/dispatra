import { useMap } from '@vis.gl/react-google-maps';
import { useEffect, useRef } from 'react';
import { APP_ACCENT } from '../../lib/appearance';
import { roundedRoutePath } from './roundedRoutePath';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ROUTE_COLOR = '#171717';

type RouteProps = {
  id: string; points: number[][]; selected: boolean; radius?: number;
  /** Vehicle-to-pickup approach: the same black at reduced opacity, so it reads gray beside the order path. */
  approach?: boolean;
  /** Set while a linked line (the same route's approach or order path) is hovered. */
  highlighted?: boolean;
  onHoverChange?: (hovered: boolean) => void;
};

/** A Google-projected SVG route with explicit rounded caps, joins and turns; hovering highlights it in the accent blue. */
export function GoogleRoundedRoute({ id, points, selected, radius = 10, approach = false, highlighted = false, onHoverChange }: RouteProps) {
  const map = useMap();
  const current = useRef({ id, points, selected, radius, approach, highlighted, onHoverChange });
  current.current = { id, points, selected, radius, approach, highlighted, onHoverChange };
  const overlay = useRef<google.maps.OverlayView | null>(null);
  const paintRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!map) return;
    const svg = document.createElementNS(SVG_NS, 'svg'), path = document.createElementNS(SVG_NS, 'path');
    // The visible line stays in the non-interactive layer; a wider transparent twin below the markers detects hover.
    const hitSvg = document.createElementNS(SVG_NS, 'svg'), hit = document.createElementNS(SVG_NS, 'path');
    for (const layer of [svg, hitSvg]) { layer.style.position = 'absolute'; layer.style.pointerEvents = 'none'; layer.setAttribute('aria-hidden', 'true'); }
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', ROUTE_COLOR);
    path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
    hit.setAttribute('fill', 'none'); hit.setAttribute('stroke', 'transparent'); hit.setAttribute('stroke-width', '12');
    hit.setAttribute('stroke-linecap', 'round'); hit.setAttribute('stroke-linejoin', 'round'); hit.style.pointerEvents = 'stroke';
    const paint = () => {
      const { selected, approach, highlighted } = current.current, blue = !!svg.dataset.hovered || highlighted;
      path.setAttribute('stroke', blue ? APP_ACCENT : ROUTE_COLOR);
      path.setAttribute('stroke-opacity', blue || (selected && !approach) ? '1' : approach ? '0.4' : '0.6');
      if (blue) svg.parentNode?.appendChild(svg);
    };
    paintRef.current = paint;
    hit.addEventListener('pointerenter', () => { svg.dataset.hovered = 'true'; paint(); current.current.onHoverChange?.(true); });
    hit.addEventListener('pointerleave', () => { delete svg.dataset.hovered; paint(); current.current.onHoverChange?.(false); });
    svg.appendChild(path); hitSvg.appendChild(hit);
    class RouteOverlay extends google.maps.OverlayView {
      onAdd() {
        const panes = this.getPanes();
        panes?.overlayLayer.appendChild(svg);
        panes?.overlayMouseTarget.insertBefore(hitSvg, panes.overlayMouseTarget.firstChild);
      }
      draw() {
        const projection = this.getProjection(), center = map!.getCenter();
        if (!projection || !center) return;
        const origin = projection.fromLatLngToDivPixel(center);
        if (!origin) return;
        const width = map!.getDiv().clientWidth + 32, height = map!.getDiv().clientHeight + 32;
        const left = origin.x - width / 2, top = origin.y - height / 2;
        for (const layer of [svg, hitSvg]) {
          layer.style.left = `${left}px`; layer.style.top = `${top}px`;
          layer.setAttribute('width', String(width)); layer.setAttribute('height', String(height));
          layer.setAttribute('viewBox', `${left} ${top} ${width} ${height}`);
        }
        svg.dataset.shipperRoute = current.current.id;
        path.setAttribute('stroke-width', '2.5');
        paint();
        const pixels = current.current.points.flatMap(([lat, lng]) => {
          const pixel = projection.fromLatLngToDivPixel(new google.maps.LatLng({ lat, lng }));
          return pixel ? [pixel] : [];
        });
        const d = roundedRoutePath(pixels, current.current.radius);
        path.setAttribute('d', d); hit.setAttribute('d', d);
      }
      onRemove() { svg.remove(); hitSvg.remove(); }
    }
    const instance = new RouteOverlay(); overlay.current = instance; instance.setMap(map);
    return () => { instance.setMap(null); overlay.current = null; };
  }, [map]);
  useEffect(() => { overlay.current?.draw(); }, [id, points, selected, radius, approach]);
  useEffect(() => { paintRef.current(); }, [highlighted]);
  return null;
}
