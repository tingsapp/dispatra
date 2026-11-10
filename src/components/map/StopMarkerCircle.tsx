interface StopMarkerCircleProps {
  kind: 'PICKUP' | 'DROPOFF';
  cx?: number;
  cy?: number;
  number?: number;
}

/** Shared stop glyph for the illustrative homepage and operational maps. */
export function StopMarkerCircle({ kind, cx = 12, cy = 12, number }: StopMarkerCircleProps) {
  const pickup = kind === 'PICKUP';
  return <><circle cx={cx} cy={cy} r="8" fill={pickup ? 'white' : '#171717'}
    stroke={pickup ? '#171717' : 'white'} strokeWidth="3" />
    {number != null && <text x={cx} y={cy} dy=".35em" textAnchor="middle" fill={pickup ? '#171717' : 'white'} fontSize={number > 9 ? 7 : 9} fontWeight="700">{number}</text>}</>;
}
