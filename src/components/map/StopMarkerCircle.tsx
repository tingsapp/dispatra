import { Package } from 'lucide-react';

/** Shared soft shadow that lifts map glyphs off the tiles and route lines. */
export const MAP_MARKER_SHADOW = 'drop-shadow-[0_2px_3px_rgb(0_0_0/0.35)]';

interface StopMarkerCircleProps {
  kind: 'PICKUP' | 'DROPOFF';
  cx?: number;
  cy?: number;
}

/** Shared stop glyph for the illustrative homepage and operational maps. Pickups show a package; drop-offs show a black ring around a filled center dot. */
export function StopMarkerCircle({ kind, cx = 12, cy = 12 }: StopMarkerCircleProps) {
  if (kind === 'PICKUP') return <><circle cx={cx} cy={cy} r="9" fill="#171717" stroke="white" strokeWidth="2" />
    <Package x={cx - 5} y={cy - 5} width="10" height="10" color="white" strokeWidth={2.5} aria-hidden="true" /></>;
  return <><circle cx={cx} cy={cy} r="6" fill="white" stroke="#171717" strokeWidth="2.5" />
    <circle cx={cx} cy={cy} r="2.5" fill="#171717" /></>;
}
