import { Zone, ZoneRate } from '../../types/pricing';

interface Props { rates: ZoneRate[]; zones: Zone[]; onChange: (rates: ZoneRate[]) => void }
const cell = 'w-full min-w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white text-right focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400';

/** Pickup zones down, delivery zones across, one price per cell. Blank = no price for that pair. */
export const ZoneMatrixEditor = ({ rates, zones, onChange }: Props) => {
  const find = (origin: string, destination: string) => rates.find(r => r.originZoneId === origin && r.destinationZoneId === destination);
  const setPrice = (origin: string, destination: string, raw: string) => {
    const others = rates.filter(r => !(r.originZoneId === origin && r.destinationZoneId === destination));
    if (raw === '') return onChange(others);
    const amount = Math.max(0, Number(raw) || 0);
    onChange([...others, { id: find(origin, destination)?.id ?? `zr_${origin}_${destination}`, originZoneId: origin, destinationZoneId: destination, serviceId: null, amount }]);
  };
  if (zones.length === 0) return <p className="text-xs text-slate-500">Add zones first, then enter a price for each pickup → delivery pair.</p>;
  return <div className="space-y-2">
    <p className="text-xs text-slate-500">Pickup zone down, delivery zone across. Prices are before tax; service multipliers, Accessorials and fuel apply on top. Blank means no price for that pair.</p>
    <div className="overflow-x-auto">
      <table aria-label="Zone prices" className="w-full text-xs border-separate border-spacing-1">
        <thead>
          <tr><th scope="col" className="text-left font-medium text-slate-500 pr-2 whitespace-nowrap">Pickup ↓ · Delivery →</th>{zones.map(z => <th key={z.id} scope="col" className="font-medium text-slate-700 px-1 text-center whitespace-nowrap">{z.name}</th>)}</tr>
        </thead>
        <tbody>
          {zones.map(origin => <tr key={origin.id}>
            <th scope="row" className="text-left font-medium text-slate-700 pr-2 whitespace-nowrap">{origin.name}</th>
            {zones.map(destination => {
              const rate = find(origin.id, destination.id);
              return <td key={destination.id}>
                <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">$</span>
                  <input aria-label={`${origin.name} to ${destination.name} price`} type="number" min={0} step={0.5} className={`${cell} pl-5`} value={rate ? rate.amount : ''} placeholder="—" onChange={e => setPrice(origin.id, destination.id, e.target.value)} />
                </div>
              </td>;
            })}
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>;
};
