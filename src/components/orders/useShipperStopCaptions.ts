import { useEffect } from 'react';

/** Prioritize the selected order; crowded background stops retain their clickable circles. */
export function layoutShipperStopCaptions(canvas: HTMLElement) {
  const markers = [...canvas.querySelectorAll<HTMLElement>('.shipper-stop-marker')]
    .sort((a, b) => Number(b.getAttribute('aria-current') === 'true') - Number(a.getAttribute('aria-current') === 'true'));
  const occupied: DOMRect[] = [];
  for (const marker of markers) {
    const caption = marker.querySelector<HTMLElement>('.shipper-stop-caption');
    if (!caption) continue;
    const bounds = caption.getBoundingClientRect();
    const selected = marker.getAttribute('aria-current') === 'true';
    const overlaps = occupied.some(rect => bounds.left < rect.right + 6 && bounds.right > rect.left - 6
      && bounds.top < rect.bottom + 6 && bounds.bottom > rect.top - 6);
    marker.dataset.captionHidden = String(!selected && overlaps);
    if (selected || !overlaps) occupied.push(bounds);
  }
}

export function useShipperStopCaptions(map: google.maps.Map | null, revision: string) {
  useEffect(() => {
    if (!map) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => layoutShipperStopCaptions(map.getDiv()));
    };
    const moving = map.addListener('bounds_changed', schedule);
    const settled = map.addListener('idle', schedule);
    schedule();
    return () => { cancelAnimationFrame(frame); moving.remove(); settled.remove(); };
  }, [map, revision]);
}
