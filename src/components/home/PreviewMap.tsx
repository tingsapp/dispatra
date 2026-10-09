import { Truck } from 'lucide-react';

// The illustrative route and its road share the same geometry.
const route = 'M225 385V277Q225 265 237 265H293Q305 265 305 253V217Q305 205 317 205H453Q465 205 465 193V93';
const streets = [65, 145, 225, 305, 385, 465, 545, 625];
const avenues = [65, 135, 205, 265, 325, 385];

/** Code-native sample map, independent of real locations or routing providers. */
export function PreviewMap() {
  return <svg viewBox="0 0 700 500" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true">
    <rect width="700" height="500" fill="#f0f2ef" />
    <path d="M-20 431C95 397 177 446 262 431S414 419 500 442 635 424 720 445V520H-20Z" fill="#d8e7ef" />
    <path d="M580-20H720V190C660 183 610 97 580-20Z" fill="#d8e7ef" />
    <g fill="#e6e9e2">
      {streets.slice(0, -1).flatMap((x, column) => avenues.slice(0, -1).map((y, row) => <g key={`${column}-${row}`}>
        <rect x={x + 12} y={y + 12} width="24" height={row === 0 ? 38 : 26} rx="2" />
        <rect x={x + 43} y={y + 12} width="24" height={row === 0 ? 38 : 26} rx="2" />
      </g>))}
    </g>
    <path d="M391 76h62v48h-62zM76 277h57v37H76zM317 337h56v36h-56z" fill="#dae6d6" />
    <g fill="none" stroke="#dfe2db" strokeWidth="9">
      {streets.map(x => <path key={x} d={`M${x} -20V435`} />)}
      {avenues.map(y => <path key={y} d={`M-20 ${y}H720`} />)}
    </g>
    <g fill="none" stroke="white" strokeWidth="7">
      {streets.map(x => <path key={x} d={`M${x} -20V435`} />)}
      {avenues.map(y => <path key={y} d={`M-20 ${y}H720`} />)}
    </g>
    <path d="M-20 205H720M-20 265H720M225-20V435M465-20V435" fill="none" stroke="#d8dcd3" strokeWidth="17" />
    <path d="M-20 205H720M-20 265H720M225-20V435M465-20V435" fill="none" stroke="white" strokeWidth="14" />
    <path data-preview-road="route" d={route} fill="none" stroke="white" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
    <g fill="#92988f" fontFamily="Inter, sans-serif" fontSize="9" letterSpacing="1">
      <text x="290" y="107">VANCOUVER</text><text x="70" y="364">DELIVERY DISTRICT</text><text x="380" y="476">RIVERFRONT</text>
    </g>
    <path d={route} fill="none" stroke="#3b82f6" strokeOpacity="0.12" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
    <path data-preview-route="true" d={route} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="225" cy="385" r="8" fill="white" stroke="#171717" strokeWidth="3" />
    <circle cx="465" cy="93" r="8" fill="#171717" stroke="white" strokeWidth="3" />
    <g data-preview-driver="true" transform="translate(465 150)">
      <rect x="-18" y="-18" width="36" height="36" rx="10" fill="#2563eb" stroke="white" strokeWidth="2" />
      <Truck x="-8" y="-8" width="16" height="16" color="white" />
    </g>
  </svg>;
}
