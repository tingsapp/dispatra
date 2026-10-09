import { useMap } from '@vis.gl/react-google-maps';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface GoogleOverlayMarkerProps {
  position: google.maps.LatLngLiteral;
  label: string;
  children: ReactNode;
  onSelect?: () => void;
  id?: string;
  title?: string;
  className?: string;
  current?: boolean;
  zIndex?: number;
}

/** React content in the Google map's mouse target pane, centered on its location. */
export function GoogleOverlayMarker({ position, label, children, onSelect, id, title, className = '', current, zIndex }: GoogleOverlayMarkerProps) {
  const map = useMap();
  const element = useRef<HTMLDivElement | null>(null);
  if (!element.current) {
    element.current = document.createElement('div');
    element.current.style.position = 'absolute';
    element.current.style.transform = 'translate(-50%, -50%)';
  }
  const overlay = useRef<google.maps.OverlayView | null>(null);
  const positionRef = useRef(position);
  positionRef.current = position;

  useEffect(() => {
    if (!map || !element.current) return;
    const node = element.current;
    class MarkerOverlay extends google.maps.OverlayView {
      onAdd() { this.getPanes()?.overlayMouseTarget.appendChild(node); }
      draw() {
        // React can update the marker before Google has attached its projection.
        // Google calls draw again once the overlay is ready.
        const projection = this.getProjection();
        if (!projection) return;
        const pixel = projection.fromLatLngToDivPixel(new google.maps.LatLng(positionRef.current));
        if (!pixel) return;
        node.style.left = `${pixel.x}px`;
        node.style.top = `${pixel.y}px`;
      }
      onRemove() { node.remove(); }
    }
    const instance = new MarkerOverlay();
    overlay.current = instance;
    instance.setMap(map);
    return () => { instance.setMap(null); overlay.current = null; };
  }, [map]);

  useEffect(() => { overlay.current?.draw(); }, [position.lat, position.lng]);
  useEffect(() => { if (element.current) element.current.style.zIndex = zIndex === undefined ? '' : String(zIndex); }, [zIndex]);

  return createPortal(<div id={id} role={onSelect ? 'button' : 'img'} tabIndex={onSelect ? 0 : undefined}
    aria-label={label} aria-current={current || undefined} title={title} className={`cursor-pointer select-none ${className}`}
    onClick={event => { event.stopPropagation(); onSelect?.(); }}
    onKeyDown={event => {
      if (!onSelect || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault(); event.stopPropagation(); onSelect();
    }}>
    {children}
  </div>, element.current);
}
