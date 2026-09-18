import { addressChange, resolveStopLocation } from '../../lib/taxAddress';
import { applyCustomerDefaults, removeOrderStop } from '../../domain/orderAdapters';
import React from 'react';
import { Plus, Minus, Trash2, Package, MapPin, AlertTriangle, Building2, Layers, Route } from 'lucide-react';
import { PricingOrderInput, PricingPackageInput, PricingSnapshot, PricingStopInput } from '../../types/pricing';
import { defaultRateCard, PricingContext } from '../../lib/pricingEngine';
import { createStop } from '../../lib/orderPricing';
import { fromDisplayDimension, fromDisplayDistance, fromDisplayWeight, toDisplayDimension, toDisplayDistance, toDisplayWeight } from '../../lib/units';
import { Select } from '../ui/Select';
import { DateTimePicker } from '../ui/DateTimePicker';
import { SettingsDisclosure } from '../settings/SettingsLayout';

/**
 * Order-facts editor for Order creation. It only edits a `PricingOrderInput`; the caller runs
 * `calculatePricing` and passes the snapshot back for the live readouts.
 */
interface OrderPricingFormProps {
  value: PricingOrderInput;
  onChange: (next: PricingOrderInput) => void;
  ctx: PricingContext;
  snapshot: PricingSnapshot;
  /** Show address fields on stops (Order form). */
  showStopAddresses?: boolean;
  /** Start section numbering here (Order form prefixes its own sections). */
  startIndex?: number;
}

const fieldClass = 'w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400';
const labelClass = 'block text-[11px] font-medium text-slate-600 mb-1';
const sectionClass = 'bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs';
const sectionTitle = 'text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5';
const smallBtn = 'text-[11px] font-medium px-2 py-1 rounded border border-slate-200 hover:bg-slate-100';
const checkbox = 'w-4 h-4 rounded border-slate-300 accent-slate-900 cursor-pointer';

const newPackage = (): PricingPackageInput => ({
  id: `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  quantity: 1, weightKg: 10, lengthCm: 40, widthCm: 30, heightCm: 30, declaredValue: 0
});

export const OrderPricingForm: React.FC<OrderPricingFormProps> = ({ value, onChange, ctx, snapshot, showStopAddresses = false, startIndex = 1 }) => {
  const { catalogue, pricing, customers, billing } = ctx;
  const units = billing.general;
  const timeZone = billing.general.timeZone ?? 'America/Vancouver';
  const activeServices = catalogue.services.filter((s) => s.active);
  const activeVehicles = catalogue.vehicles.filter((v) => v.active);
  const activeAccessorials = catalogue.accessorials.filter((a) => a.active && a.autoRule !== 'WAITING_RECORDED');
  const customer = customers.find(c => c.id === value.customerId);
  // The customer's card (or the Default) decides whether stops need zones.
  const card = pricing.rateCards.find(c => c.id === customer?.rateCardId && c.status === 'ACTIVE') ?? defaultRateCard(pricing.rateCards);
  const zonePriced = card?.pricingMethod === 'ZONE';
  const pickups = value.stops.filter(s => s.type === 'PICKUP');
  const drops = value.stops.filter(s => s.type === 'DROPOFF');

  const patch = (changes: Partial<PricingOrderInput>) => onChange({ ...value, ...changes });
  /** Stop edits; pickup ready times and delivery deadlines also set the order's schedule. */
  const updateStop = (id: string, changes: Partial<PricingStopInput>) => {
    const stops = value.stops.map((s) => (s.id === id ? { ...s, ...('label' in changes ? addressChange(changes.label ?? '') : {}), ...changes } : s));
    const readyTimes = stops.filter(s => s.type === 'PICKUP' && s.windowStart).map(s => s.windowStart!).sort();
    const deadlines = stops.filter(s => s.type === 'DROPOFF' && s.windowEnd).map(s => s.windowEnd!).sort();
    patch({ stops, scheduledAt: readyTimes[0] ?? null, scheduledEndAt: deadlines[deadlines.length - 1] ?? null });
  };
  const updatePackage = (id: string, changes: Partial<PricingPackageInput>) => patch({ packages: value.packages.map((p) => (p.id === id ? { ...p, ...changes } : p)) });
  const qtyOf = (id: string) => value.accessorials.find((a) => a.accessorialId === id)?.quantity ?? 0;
  const setQty = (id: string, quantity: number) => patch({ accessorials: [...value.accessorials.filter((a) => a.accessorialId !== id), ...(quantity > 0 ? [{ accessorialId: id, quantity }] : [])] });
  const addStop = (type: PricingStopInput['type']) => patch({ stops: [...value.stops, createStop(type, type === 'DROPOFF' && pickups.length === 1 ? { pickupIds: [pickups[0].id] } : {})] });

  const currentVehicle = activeVehicles.find((v) => v.id === value.vehicleId);
  const totalWeight = value.packages.reduce((n, p) => n + p.quantity * p.weightKg, 0);
  const capacityWarning = currentVehicle && totalWeight > currentVehicle.payloadCapacityKg
    ? `Cargo (${Math.round(toDisplayWeight(totalWeight, units))} ${units.weightUnit}) exceeds ${currentVehicle.name} payload. Capacity does not change the price.` : null;
  const selectedAccessorials = activeAccessorials.filter(a => qtyOf(a.id) > 0);

  let n = startIndex;
  const num = () => `${n++}.`;

  return (
    <div className="space-y-5">
      {/* Customer, service, vehicle */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between mb-3">
          <h4 className={sectionTitle}><Building2 className="w-3.5 h-3.5 text-slate-700" /><span>{num()} Customer, Service & Vehicle</span></h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Customer</label>
            <Select aria-label="Customer" className="w-full" value={value.customerId ?? ''} onValueChange={(v) => onChange(applyCustomerDefaults(value, customers.find(c => c.id === v)))}
              options={[{ value: '', label: 'Choose a customer…' }, ...customers.filter(c => c.status !== 'Inactive' && c.status !== 'On Hold').map((c) => ({ value: c.id, label: c.name }))]} />
          </div>
          <div>
            <label className={labelClass}>Service</label>
            <Select aria-label="Service" className="w-full" value={value.serviceId} onValueChange={(v) => patch({ serviceId: v })} options={activeServices.map((s) => ({ value: s.id, label: s.name }))} />
          </div>
          <div>
            <label className={labelClass}>Vehicle</label>
            <Select aria-label="Vehicle" className="w-full" value={value.vehicleId ?? ''} onValueChange={(v) => patch({ vehicleId: v || null })} options={activeVehicles.map((v) => ({ value: v.id, label: v.name }))} />
          </div>
        </div>
        {capacityWarning && <p className="mt-3 p-2 rounded-lg text-xs flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200"><AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />{capacityWarning}</p>}
      </div>

      {/* Stops */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between mb-3">
          <h4 className={sectionTitle}><MapPin className="w-3.5 h-3.5 text-slate-700" /><span>{num()} Stops</span></h4>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => addStop('PICKUP')} className={smallBtn}>+ Pickup</button>
            <button type="button" onClick={() => addStop('DROPOFF')} className={smallBtn}>+ Drop-off</button>
          </div>
        </div>
        <div className="space-y-3">
          {value.stops.map((stop, i) => {
            const location = resolveStopLocation(stop);
            const unresolved = !!stop.label?.trim() && (location.conflict || !location.country || (location.country === 'CA' && !location.province));
            return <div key={stop.id} className="rounded-lg border border-slate-200 p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${stop.type === 'PICKUP' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{i + 1} · {stop.type === 'PICKUP' ? 'Pickup' : 'Drop-off'}</span>
                {showStopAddresses && <input type="text" value={stop.label ?? ''} placeholder={stop.type === 'PICKUP' ? 'Pickup address' : 'Delivery address'} onChange={(e) => updateStop(stop.id, { label: e.target.value })} className={fieldClass} aria-label="Stop address" />}
                {zonePriced && <Select aria-label="Zone" className="w-44 shrink-0" value={stop.zoneId ?? ''} onValueChange={(v) => updateStop(stop.id, { zoneId: v || null })} options={[{ value: '', label: 'Zone (required)' }, ...pricing.zones.map((z) => ({ value: z.id, label: z.name }))]} />}
                <button type="button" disabled={value.stops.length <= 2} onClick={() => onChange(removeOrderStop(value, stop.id))} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded disabled:opacity-30 shrink-0" title="Remove stop" aria-label={`Remove stop ${i + 1}`}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              {unresolved && <p className="text-[11px] text-amber-700">Include the province and postal code so tax can be calculated for this stop.</p>}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-start">
                  <input type="text" value={stop.contactName ?? ''} placeholder="Contact name" onChange={(e) => updateStop(stop.id, { contactName: e.target.value })} className={fieldClass} aria-label={`Stop ${i + 1} contact name`} />
                  <input type="tel" value={stop.contactPhone ?? ''} placeholder="Phone" onChange={(e) => updateStop(stop.id, { contactPhone: e.target.value })} className={fieldClass} aria-label={`Stop ${i + 1} phone`} />
                </div>
                <div className="min-w-0">{stop.type === 'PICKUP'
                  ? <DateTimePicker aria-label={`Stop ${i + 1} ready at`} value={stop.windowStart ?? ''} onValueChange={windowStart => updateStop(stop.id, { windowStart: windowStart || undefined })} timeZone={timeZone} />
                  : <DateTimePicker aria-label={`Stop ${i + 1} deliver by`} value={stop.windowEnd ?? ''} onValueChange={windowEnd => updateStop(stop.id, { windowEnd: windowEnd || undefined })} timeZone={timeZone} />}</div>
                {stop.type === 'DROPOFF' && pickups.length > 1 && <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600"><span>Picked up at:</span>{pickups.map(pickup => <label key={pickup.id} className="inline-flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={(stop.pickupIds ?? []).includes(pickup.id)} onChange={e => updateStop(stop.id, { pickupIds: e.target.checked ? [...(stop.pickupIds ?? []), pickup.id] : (stop.pickupIds ?? []).filter(p => p !== pickup.id) })} className={checkbox} />{value.stops.indexOf(pickup) + 1}</label>)}</div>}
                <div className="flex justify-end">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600"><input type="checkbox" checked={stop.residential} onChange={(e) => updateStop(stop.id, { residential: e.target.checked })} className={checkbox} />Residential</label>
                </div>
              </div>
            </div>;
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <Route className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium text-slate-700">Route</span>
          <span>{value.routeKm == null ? 'Distance and duration are calculated from the stop addresses once routing is connected.' : `${toDisplayDistance(value.routeKm, units).toFixed(1)} ${units.distanceUnit}${value.estimatedMinutes != null ? ` · ${value.estimatedMinutes} min` : ''}`}</span>
        </div>
      </div>

      {/* Packages */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between mb-3">
          <h4 className={sectionTitle}><Package className="w-3.5 h-3.5 text-slate-700" /><span>{num()} Packages</span></h4>
          <button type="button" onClick={() => patch({ packages: [...value.packages, { ...newPackage(), pickupStopId: pickups.length === 1 ? pickups[0].id : undefined, deliveryStopId: drops.length === 1 ? drops[0].id : undefined }] })} className={smallBtn}>+ Package</button>
        </div>
        <div className="overflow-x-auto">
          <table aria-label="Packages" className="w-full text-xs">
            <thead><tr className="text-[11px] text-slate-500">
              <th scope="col" className="text-left font-medium pb-1.5 pr-2">Qty</th>
              <th scope="col" className="text-left font-medium pb-1.5 px-2">Weight ({units.weightUnit})</th>
              <th scope="col" className="text-left font-medium pb-1.5 px-2">L × W × H ({units.dimensionUnit})</th>
              {pickups.length > 1 && <th scope="col" className="text-left font-medium pb-1.5 px-2">From</th>}
              {drops.length > 1 && <th scope="col" className="text-left font-medium pb-1.5 px-2">To</th>}
              <th scope="col" className="text-left font-medium pb-1.5 px-2">Fragile</th>
              <th scope="col" className="pb-1.5"><span className="sr-only">Remove</span></th>
            </tr></thead>
            <tbody>
              {value.packages.map((p, index) => <tr key={p.id} className="border-t border-slate-100">
                <td className="py-1.5 pr-2 w-16"><input type="number" min={1} step={1} value={p.quantity} onChange={(e) => updatePackage(p.id, { quantity: Math.max(1, Math.round(Number(e.target.value) || 1)) })} className={fieldClass} aria-label={`Package ${index + 1} quantity`} /></td>
                <td className="py-1.5 px-2 w-24"><input type="number" min={0} step={0.5} value={Number(toDisplayWeight(p.weightKg, units).toFixed(1))} onChange={(e) => updatePackage(p.id, { weightKg: fromDisplayWeight(Math.max(0, Number(e.target.value) || 0), units) })} className={fieldClass} aria-label={`Package ${index + 1} weight`} /></td>
                <td className="py-1.5 px-2"><div className="flex items-center gap-1">{(['lengthCm', 'widthCm', 'heightCm'] as const).map((k, d) => <React.Fragment key={k}>{d > 0 && <span className="text-slate-400">×</span>}<input type="number" min={0} step={1} value={Number(toDisplayDimension(p[k], units).toFixed(1))} onChange={(e) => updatePackage(p.id, { [k]: fromDisplayDimension(Math.max(0, Number(e.target.value) || 0), units) })} className={`${fieldClass} w-16`} aria-label={`Package ${index + 1} ${k === 'lengthCm' ? 'length' : k === 'widthCm' ? 'width' : 'height'}`} /></React.Fragment>)}</div></td>
                {pickups.length > 1 && <td className="py-1.5 px-2"><Select aria-label={`Package ${index + 1} pickup`} className="w-28" value={p.pickupStopId ?? ''} onValueChange={pickupStopId => updatePackage(p.id, { pickupStopId: pickupStopId || undefined })} options={[{ value: '', label: 'Pickup…' }, ...pickups.map(s => ({ value: s.id, label: `Stop ${value.stops.indexOf(s) + 1}` }))]} /></td>}
                {drops.length > 1 && <td className="py-1.5 px-2"><Select aria-label={`Package ${index + 1} delivery`} className="w-28" value={p.deliveryStopId ?? ''} onValueChange={deliveryStopId => updatePackage(p.id, { deliveryStopId: deliveryStopId || undefined })} options={[{ value: '', label: 'Delivery…' }, ...drops.map(s => ({ value: s.id, label: `Stop ${value.stops.indexOf(s) + 1}` }))]} /></td>}
                <td className="py-1.5 px-2 text-center"><input type="checkbox" checked={!!p.fragile} onChange={(e) => updatePackage(p.id, { fragile: e.target.checked })} className={checkbox} aria-label={`Package ${index + 1} fragile`} /></td>
                <td className="py-1.5 pl-2 text-right"><button type="button" disabled={value.packages.length <= 1} onClick={() => patch({ packages: value.packages.filter((x) => x.id !== p.id) })} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded disabled:opacity-30" title="Remove package" aria-label={`Remove package ${index + 1}`}><Trash2 className="w-3.5 h-3.5" /></button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Actual {toDisplayWeight(snapshot.inputs.actualWeightKg, units).toFixed(1)} {units.weightUnit}
          {snapshot.inputs.dimensionalPricingEnabled && <> · dimensional {toDisplayWeight(snapshot.inputs.dimensionalWeightKg, units).toFixed(1)} {units.weightUnit}</>}
          {' · '}<span className="font-medium text-slate-700">chargeable {toDisplayWeight(snapshot.inputs.chargeableWeightKg, units).toFixed(1)} {units.weightUnit}</span>
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Chargeable weight is the larger of actual and dimensional weight, so the heavier value is used for pricing.
        </p>
      </div>

      {/* Accessorials */}
      <SettingsDisclosure title={`${num()} Accessorials`} description={selectedAccessorials.length ? selectedAccessorials.map(a => `${a.name}${qtyOf(a.id) > 1 ? ` ×${qtyOf(a.id)}` : ''}`).join(' · ') : 'None added. Waiting is charged from the minutes recorded at stops.'}>
        {activeAccessorials.length === 0 ? <p className="text-xs text-slate-500">No active accessorials configured.</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeAccessorials.map((acc) => {
              const qty = qtyOf(acc.id);
              const on = qty > 0;
              const quantityBased = acc.calculationType === 'PER_UNIT' || acc.calculationType === 'PER_MINUTE' || acc.calculationType === 'PER_HOUR' || acc.appliesAt === 'PER_STOP';
              const pct = acc.calculationType.startsWith('PERCENT');
              return (
                <div key={acc.id} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border transition-all ${on ? 'border-slate-800 bg-slate-50/90' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
                  <label className="flex items-start gap-2.5 cursor-pointer select-none flex-1 min-w-0">
                    <input type="checkbox" checked={on} onChange={() => setQty(acc.id, on ? 0 : 1)} className={`mt-0.5 ${checkbox}`} />
                    <span className="min-w-0"><span className="block text-xs font-medium text-slate-800 truncate">{acc.name}</span><span className="block text-[11px] text-slate-500">{pct ? `${acc.rate}%` : `$${acc.rate.toFixed(2)}`} {acc.unitLabel}{acc.autoRule !== 'NONE' && <span className="ml-1 text-blue-600">· auto</span>}</span></span>
                  </label>
                  {on && quantityBased && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" aria-label={`Decrease ${acc.name} quantity`} onClick={() => setQty(acc.id, Math.max(1, qty - 1))} className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 hover:bg-slate-100"><Minus className="w-3 h-3" /></button>
                      {acc.calculationType === 'PER_MINUTE' ? <><input type="number" min={0} step={1} aria-label={`${acc.name} minutes`} value={qty} onChange={(e) => setQty(acc.id, Math.max(0, Number(e.target.value) || 0))} className="w-16 text-xs px-2 py-1 border border-slate-200 rounded" /><span className="text-[11px] text-slate-500">min</span></> : <span className="text-xs font-bold text-slate-800 w-6 text-center">{qty}</span>}
                      <button type="button" aria-label={`Increase ${acc.name} quantity`} onClick={() => setQty(acc.id, qty + 1)} className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 hover:bg-slate-100"><Plus className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SettingsDisclosure>
    </div>
  );
};
