import React from 'react';
import { Zone, ZoneRate } from '../../types/pricing';
import { DeliveryService } from '../../types/simplePricing';

interface Props { rates: ZoneRate[]; zones: Zone[]; services: DeliveryService[]; onChange: (rates: ZoneRate[]) => void }
const field = 'w-full border border-slate-200 rounded-lg p-2 text-xs bg-white';
export const ZoneMatrixEditor = ({ rates, zones, services, onChange }: Props) => {
  const patch = (id: string, changes: Partial<ZoneRate>) => onChange(rates.map(r => r.id === id ? { ...r, ...changes } : r));
  return <div className="space-y-2">
    <p className="text-xs text-slate-500">One price per origin, destination and service. Blank service applies to all services; an exact service entry takes precedence. Amounts use the organization tax-inclusive/exclusive setting.</p>
    {rates.map(r => <div key={r.id} className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      <select aria-label="Origin zone" className={field} value={r.originZoneId} onChange={e => patch(r.id, { originZoneId: e.target.value })}><option value="">Choose origin</option>{zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
      <select aria-label="Destination zone" className={field} value={r.destinationZoneId} onChange={e => patch(r.id, { destinationZoneId: e.target.value })}><option value="">Choose destination</option>{zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
      <select aria-label="Zone rate service" className={field} value={r.serviceId ?? ''} onChange={e => patch(r.id, { serviceId: e.target.value || null })}><option value="">All services</option>{services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <input aria-label="Zone price" type="number" min="0" step="0.01" className={field} value={r.amount} onChange={e => patch(r.id, { amount: Math.max(0, Number(e.target.value)) })} />
      <button type="button" className="text-xs text-rose-700" onClick={() => onChange(rates.filter(x => x.id !== r.id))}>Remove entry</button>
    </div>)}
    <button type="button" className="text-xs font-medium border rounded-lg px-3 py-2" onClick={() => onChange([...rates, { id: crypto.randomUUID(), originZoneId: zones[0]?.id ?? '', destinationZoneId: zones[1]?.id ?? zones[0]?.id ?? '', serviceId: null, amount: 0 }])}>Add zone price</button>
  </div>;
};
