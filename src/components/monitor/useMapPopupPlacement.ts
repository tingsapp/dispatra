import { useLayoutEffect, useRef, useState } from 'react';

interface Point { x: number; y: number }
interface Placement extends Point { width: number; height: number }

const MARGIN = 12;
const GAP = 30;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/** Place a map detail card next to its marker within the map canvas. */
export function useMapPopupPlacement(position?: Point) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  useLayoutEffect(() => {
    const card = ref.current;
    const canvas = card?.offsetParent;
    if (!(canvas instanceof HTMLElement) || !card) return;

    const update = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const cardWidth = card.offsetWidth;
      const cardHeight = card.offsetHeight;
      const anchorX = position?.x ?? width / 2;
      const anchorY = position?.y ?? height / 2;
      const below = anchorY + GAP;
      const above = anchorY - cardHeight - GAP;
      const fitsBelow = below + cardHeight <= height - MARGIN;
      const fitsAbove = above >= MARGIN;
      const side = !fitsBelow && !fitsAbove;
      const right = anchorX + GAP;
      const leftSide = anchorX - cardWidth - GAP;
      const left = side && right + cardWidth <= width - MARGIN ? right
        : side && leftSide >= MARGIN ? leftSide
        : clamp(anchorX - cardWidth / 2, MARGIN, Math.max(MARGIN, width - cardWidth - MARGIN));
      const top = fitsBelow ? below
        : fitsAbove ? above
        : side && (right + cardWidth <= width - MARGIN || leftSide >= MARGIN)
          ? clamp(anchorY - cardHeight / 2, MARGIN, Math.max(MARGIN, height - cardHeight - MARGIN))
          : clamp(below, MARGIN, Math.max(MARGIN, height - cardHeight - MARGIN));
      const next = { x: Math.round(left), y: Math.round(top), width, height };
      setPlacement(current => current && current.x === next.x && current.y === next.y && current.width === next.width && current.height === next.height ? current : next);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(canvas);
    observer.observe(card);
    return () => observer.disconnect();
  }, [position?.x, position?.y]);

  return { ref, placement };
}
