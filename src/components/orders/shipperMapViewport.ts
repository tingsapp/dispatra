import type { MapPoint } from './shipperMapLocation';
type Rect = Pick<DOMRectReadOnly, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;
type Insets = google.maps.Padding;

/** Actual visible labels, rather than a large margin reserved for every stop. */
export function shipperMarkerInsets(canvas: HTMLElement): Insets {
  const insets = { top: 12, right: 12, bottom: 12, left: 12 };
  for (const caption of canvas.querySelectorAll('.shipper-stop-caption')) {
    const marker = caption.closest('.shipper-stop-marker')?.getBoundingClientRect();
    if (!marker) continue;
    const label = caption.getBoundingClientRect();
    const x = marker.left + marker.width / 2, y = marker.top + marker.height / 2;
    insets.left = Math.max(insets.left, x - label.left);
    insets.right = Math.max(insets.right, label.right - x);
    insets.top = Math.max(insets.top, y - label.top);
    insets.bottom = Math.max(insets.bottom, label.bottom - y);
  }
  if (canvas.querySelector('[role="img"]')) {
    for (const edge of ['top', 'right', 'bottom', 'left'] as const) insets[edge] = Math.max(insets[edge], 18);
  }
  return insets;
}

/** Mercator dimensions let each route's shape determine its best available space. */
export function shipperMapSpan(points: MapPoint[]) {
  let west = Infinity, east = -Infinity, north = Infinity, south = -Infinity;
  for (const point of points) {
    const x = point.lng / 360;
    const sin = Math.sin(Math.max(-85, Math.min(85, point.lat)) * Math.PI / 180);
    const y = Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
    west = Math.min(west, x); east = Math.max(east, x);
    north = Math.min(north, y); south = Math.max(south, y);
  }
  return { width: points.length ? east - west : 0, height: points.length ? south - north : 0 };
}

/** Choose the closest uncovered fit; 12px also allows for Google pixel rounding. */
export function shipperMapPadding(view: Rect, card?: Rect, insets: Insets = { top: 12, right: 12, bottom: 12, left: 12 }, span?: { width: number; height: number }): Insets {
  const base = { top: 76 + insets.top, right: 12 + insets.right, bottom: 44 + insets.bottom, left: 12 + insets.left };
  if (!card) return base;
  const beside = { ...base, left: Math.max(base.left, card.right - view.left + 12 + insets.left) };
  const below = { ...base, top: Math.max(base.top, card.bottom - view.top + 12 + insets.top) };
  const score = (padding: Insets) => {
    const width = Math.max(0, view.width - padding.left - padding.right);
    const height = Math.max(0, view.height - padding.top - padding.bottom);
    return span && (span.width || span.height)
      ? Math.min(width / Math.max(span.width, 1e-12), height / Math.max(span.height, 1e-12))
      : width * height;
  };
  return score(beside) > score(below) ? beside : below;
}
