/** Fictional street illustration shared by the public agent demonstrations. */
export function AgentMap({ variant = 'route' }: { variant?: 'route' | 'chat' }) {
  if (variant === 'chat') return <svg className="agent-basemap" viewBox="0 0 600 405" preserveAspectRatio="xMidYMid slice" aria-label="Illustrative riverside neighborhood map">
    <rect width="600" height="405" fill="#f1f1f1" />
    <path d="M0 0H600V66Q460 118 330 69T0 105Z" fill="#737373" />
    <path d="M355 115Q425 85 505 125L560 210L470 252L380 215Z" fill="#6d6d6d" />
    <g fill="#e4e4e4">{[50,155,260,365,470].flatMap(x => [155,255,350].map(y => <rect key={`${x}-${y}`} x={x} y={y} width="62" height="35" rx="6" transform={`rotate(-12 ${x} ${y})`} />))}</g>
    <g fill="none" stroke="#dadada" strokeWidth="17"><path d="M-20 240L620 105M-20 355L620 220M105 90L180 430M300 80L375 430M490 80L565 430"/></g>
    <g fill="none" stroke="white" strokeWidth="12"><path d="M-20 240L620 105M-20 355L620 220M105 90L180 430M300 80L375 430M490 80L565 430"/></g>
    <g fill="none" stroke="white" strokeWidth="6"><path d="M-20 295L620 160M-20 405L620 270M205 90L280 430M395 80L470 430"/></g>
    <path d="M0 120Q160 65 320 100T600 85" fill="none" stroke="white" strokeWidth="8"/>
    <g fill="#8f8f8f" fontFamily="Inter,Arial,sans-serif" fontSize="10" letterSpacing="1"><text x="370" y="150">RIVERSIDE PARK</text><text x="380" y="365">EAST QUARTER</text></g>
  </svg>;
  return <svg className="agent-basemap" viewBox="0 0 600 405" preserveAspectRatio="none" aria-label="Illustrative neighborhood map">
    <rect width="600" height="405" fill="#646464" />
    <path d="M470 0H600V405H520Q560 310 502 232T470 0" fill="#737373" />
    <g fill="#6d6d6d"><rect x="38" y="42" width="106" height="78" rx="14"/><rect x="320" y="248" width="100" height="110" rx="16"/></g>
    <g fill="#696969">{[175,285,395].flatMap(x => [35,135,235,335].map(y => <rect key={`${x}-${y}`} x={x} y={y} width="60" height="45" rx="5"/>))}</g>
    <g fill="none" stroke="#797979" strokeWidth="16"><path d="M-20 155H490M-20 300H510M110 -20V430M258 -20V430M450 -20V430"/></g>
    <g fill="none" stroke="#8c8c8c" strokeWidth="12"><path d="M-20 155H490M-20 300H510M110 -20V430M258 -20V430M450 -20V430"/></g>
    <g fill="none" stroke="#8c8c8c" strokeWidth="6"><path d="M0 90H460M0 225H490M0 365H520M185 0V405M350 0V405"/></g>
    <g fill="#d0d0d0" fontFamily="Inter,Arial,sans-serif" fontSize="10" letterSpacing="1"><text x="36" y="65">NORTH PARK</text><text x="324" y="390">GARDEN DISTRICT</text></g>
  </svg>;
}
