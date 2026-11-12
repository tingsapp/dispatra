import { Package } from 'lucide-react';

interface StopMarkerCircleProps {
  kind: 'PICKUP' | 'DROPOFF';
  cx?: number;
  cy?: number;
  number?: number;
}

/** Shared stop glyph for the illustrative homepage and operational maps. Pickups show a package; drop-offs keep their sequence number. */
export function StopMarkerCircle({ kind, cx = 12, cy = 12, number }: StopMarkerCircleProps) {
  if (kind === 'PICKUP') return <><circle cx={cx} cy={cy} r="9" fill="#171717" stroke="white" strokeWidth="2" />
    <Package x={cx - 5} y={cy - 5} width="10" height="10" color="white" strokeWidth={2.5} aria-hidden="true" /></>;
  return <><circle cx={cx} cy={cy} r="8" fill="#171717" stroke="white" strokeWidth="3" />
    {number != null && <text x={cx} y={cy} dy=".35em" textAnchor="middle" fill="white" fontSize={number > 9 ? 7 : 9} fontWeight="700">{number}</text>}</>;
}
