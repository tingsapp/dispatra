import { addressChange, resolveStopLocation } from '../../lib/taxAddress';
import { zoneForAddress } from '../../lib/zoneAddress';
import { hasCentralZoneRates } from '../../lib/centralZoneRates';
import { applyCustomerDefaults, removeOrderStop } from '../../domain/orderAdapters';
import React from 'react';
import { Trash2, Package, MapPin, AlertTriangle, Building2, Layers, Route, Tag, ChevronDown } from 'lucide-react';
import { PricingOrderInput, PricingPackageInput, PricingSnapshot, PricingStopInput } from '../../types/pricing';
import { defaultRateCard, PricingContext } from '../../lib/pricingEngine';
import { createStop } from '../../lib/orderPricing';
import { fromDisplayDimension, fromDisplayDistance, fromDisplayWeight, toDisplayDimension, toDisplayDistance, toDisplayWeight, Units } from '../../lib/units';
import { Select } from '../ui/Select';
import { listedVehicleTypes, suggestVehicleType } from '../../lib/vehicleTypes';
import { DateTimePicker } from '../ui/DateTimePicker';
import { AddressAutocomplete } from '../ui/AddressAutocomplete';
import { ContactInput } from '../ui/ContactInput';

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
  /** Show the order's required vehicle type (set at booking; it decides any vehicle surcharge, never the assigned driver). */
  showVehicleSelection?: boolean;
  /** New orders follow the load: the smallest fitting general vehicle type is suggested until someone picks one. */
  suggestVehicle?: boolean;
  /** `self`: the signed-in shipper books for their own account, so no shipper or rate card is chosen. */
  customerMode?: 'shipper' | 'rateCard' | 'self';
  /** Extra fields for the caller's own concerns (e.g. a shipper's driver preference), placed after Service. */
  serviceExtras?: React.ReactNode;
}

const fieldClass = 'app-input';
const labelClass = 'app-label';
const sectionClass = 'app-panel';
const sectionTitle = 'app-section-title flex items-center gap-1.5';
const smallBtn = 'app-action app-action-compact app-secondary';
const checkbox = 'app-checkbox';

const newPackage = (): PricingPackageInput => ({
  id: `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  quantity: 1, weightKg: 10, lengthCm: 40, widthCm: 30, heightCm: 30, declaredValue: 0
});

/** Keep a typed decimal intact until blur; display stored package measurements to one decimal. */
function PackageMeasurementInput({ value, units, kind, label, onChange }: {
  value: number;
  units: Units;
  kind: 'weight' | 'dimension';
  label: string;
  onChange: (canonicalValue: number) => void;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const display = kind === 'weight' ? toDisplayWeight : toDisplayDimension;
  const canonical = kind === 'weight' ? fromDisplayWeight : fromDisplayDimension;
  return <input type="number" min={0} step="any" aria-label={label} className="app-input"
    value={draft ?? display(value, units).toFixed(1)}
    onChange={event => {
      setDraft(event.target.value);
      if (event.target.value !== '') onChange(Math.max(0, canonical(Number(event.target.value), units)));
    }}
    onBlur={() => setDraft(null)} />;
}

export const OrderPricingForm: React.FC<OrderPricingFormProps> = ({ value, onChange, ctx, snapshot, showStopAddresses = false, startIndex = 1, showVehicleSelection = true, suggestVehicle = false, customerMode = 'shipper', serviceExtras }) => {
  const { catalogue, pricing, customers, billing } = ctx;
  const units = billing.general;
  const timeZone = billing.general.timeZone ?? 'America/Vancouver';
  const activeServices = catalogue.services.filter((s) => s.active);
  const activeVehicles = listedVehicleTypes(catalogue.vehicles);
  const activeAccessorials = catalogue.accessorials.filter((a) => a.active);
  const customer = customers.find(c => c.id === value.customerId);
  const card = pricing.rateCards.find(c => c.id === value.rateCardOverrideId && c.status === 'ACTIVE')
    ?? pricing.rateCards.find(c => c.id === customer?.rateCardId && c.status === 'ACTIVE')
    ?? defaultRateCard(pricing.rateCards);
  const zonePriced = card?.pricingMethod === 'ZONE';
  const centralPickup = zonePriced && hasCentralZoneRates(card.zoneRates ?? []);
  const pickups = value.stops.filter(s => s.type === 'PICKUP');
  const drops = value.stops.filter(s => s.type === 'DROPOFF');

  const patch = (changes: Partial<PricingOrderInput>) => onChange({ ...value, ...changes });
  /** Stop edits; pickup ready times and delivery deadlines also set the order's schedule. */
  const updateStop = (id: string, changes: Partial<PricingStopInput>) => {
    const stops = value.stops.map((s) => (s.id === id ? { ...s, ...('label' in changes ? { ...addressChange(changes.label ?? ''), zoneId: zoneForAddress(changes.label ?? '', pricing.zones) } : {}), ...changes } : s));
    const readyTimes = stops.filter(s => s.type === 'PICKUP' && s.windowStart).map(s => s.windowStart!).sort();
    const deadlines = stops.filter(s => s.type === 'DROPOFF' && s.windowEnd).map(s => s.windowEnd!).sort();
    patch({ stops, scheduledAt: readyTimes[0] ?? null, scheduledEndAt: deadlines[deadlines.length - 1] ?? null });
  };
  const updatePackage = (id: string, changes: Partial<PricingPackageInput>) => patch({ packages: value.packages.map((p) => (p.id === id ? { ...p, ...changes } : p)) });
  const qtyOf = (id: string) => value.accessorials.find((a) => a.accessorialId === id)?.quantity ?? 0;
  const setQty = (id: string, quantity: number) => patch({ accessorials: [...value.accessorials.filter((a) => a.accessorialId !== id), ...(quantity > 0 ? [{ accessorialId: id, quantity }] : [])] });
  const addStop = (type: PricingStopInput['type']) => patch({ stops: [...value.stops, createStop(type, type === 'DROPOFF' && pickups.length === 1 ? { pickupIds: [pickups[0].id] } : {})] });

  const suggested = suggestVehicleType(catalogue.vehicles, value.packages);
  const lastSuggested = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!suggestVehicle) return;
    if ((value.vehicleId == null || value.vehicleId === lastSuggested.current) && value.vehicleId !== suggested) onChange({ ...value, vehicleId: suggested });
    lastSuggested.current = suggested;
  }, [suggestVehicle, suggested]); // eslint-disable-line react-hooks/exhaustive-deps
  const currentVehicle = activeVehicles.find((v) => v.id === value.vehicleId);
  const totalWeight = value.packages.reduce((n, p) => n + p.quantity * p.weightKg, 0);
  const capacityWarning = currentVehicle && totalWeight > currentVehicle.payloadCapacityKg
    ? `Cargo (${Math.round(toDisplayWeight(totalWeight, units))} ${units.weightUnit}) exceeds ${currentVehicle.name} payload. Choose a larger vehicle type.` : null;
  const selectedAccessorials = activeAccessorials.filter(a => qtyOf(a.id) > 0);

  let n = startIndex;
  const num = () => `${n++}.`;

  return (
    <div className="space-y-5">
      {/* Shipper, service, vehicle */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between mb-3">
          <h4 className={sectionTitle}><Building2 className="w-3.5 h-3.5 text-slate-700" /><span>{num()} {customerMode === 'rateCard' ? 'Rate Card & Service' : customerMode === 'self' ? showVehicleSelection ? 'Service & Vehicle' : 'Service' : showVehicleSelection ? 'Shipper, Service & Vehicle' : 'Shipper & Service'}</span></h4>
        </div>
        <div className={`grid grid-cols-1 ${showVehicleSelection && customerMode !== 'self' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
          {customerMode !== 'self' && <div>
            {customerMode === 'rateCard' ? <>
              <label className={labelClass}>Rate Card</label>
              <Select aria-label="Rate Card" className="w-full" value={value.rateCardOverrideId ?? ''} onValueChange={(v) => patch({ customerId: null, rateCardOverrideId: v || null })}
                options={[{ value: '', label: 'Choose a rate card…' }, ...pricing.rateCards.filter(c => c.status === 'ACTIVE').map(c => c.pricingMethod === 'IMPORTED' ? { value: c.id, label: `${c.name} (external price only)`, disabled: true } : { value: c.id, label: c.name })]} />
            </> : <>
              <label className={labelClass}>Shipper</label>
              <Select aria-label="Shipper" className="w-full" value={value.customerId ?? ''} onValueChange={(v) => {
              const next = applyCustomerDefaults(value, customers.find(c => c.id === v), customer);
              onChange(showStopAddresses ? { ...next, stops: next.stops.map(stop => ({ ...stop, zoneId: zoneForAddress(stop.label ?? '', pricing.zones) })) } : next);
            }}
              options={[{ value: '', label: 'Choose a shipper…' }, ...customers.filter(c => c.status !== 'Inactive' && c.status !== 'On Hold').map((c) => ({ value: c.id, label: c.name }))]} />
            </>}
          </div>}
          <div>
            <label className={labelClass}>Service</label>
            <Select aria-label="Service" className="w-full" value={value.serviceId} onValueChange={(v) => patch({ serviceId: v })} options={activeServices.map((s) => ({ value: s.id, label: s.name }))} />
          </div>
          {showVehicleSelection && <div>
            <label className={labelClass}>Vehicle type</label>
            <Select aria-label="Vehicle type" className="w-full" value={value.vehicleId ?? ''} onValueChange={(v) => patch({ vehicleId: v || null })} options={[...(value.vehicleId ? [] : [{ value: '', label: 'Choose a vehicle type' }]), ...activeVehicles.map((v) => ({ value: v.id, label: v.name })), ...(value.vehicleId && !activeVehicles.some(v => v.id === value.vehicleId) ? [{ value: value.vehicleId, label: catalogue.vehicles.find(v => v.id === value.vehicleId)?.name ?? 'Previous vehicle type' }] : [])]} />
          </div>}
          {serviceExtras}
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
            const unresolved = value.taxCalculation === 'DESTINATION' && !!stop.label?.trim() && (location.conflict || !location.country || (location.country === 'CA' && !location.province));
            const sid = `stop-${stop.id}`;
            return <div key={stop.id} className="rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${stop.type === 'PICKUP' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{i + 1} · {stop.type === 'PICKUP' ? 'Pickup' : 'Drop-off'}</span>
                <button type="button" disabled={value.stops.length <= 2} onClick={() => onChange(removeOrderStop(value, stop.id))} className="ml-auto p-1.5 -mr-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded disabled:opacity-30 shrink-0" title="Remove stop" aria-label={`Remove stop ${i + 1}`}><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {showStopAddresses && <div className="sm:col-span-2">
                  <label htmlFor={`${sid}-address`} className={labelClass}>{stop.type === 'PICKUP' ? 'Pickup address' : 'Delivery address'}</label>
                  <AddressAutocomplete id={`${sid}-address`} value={stop.label ?? ''} includeCoordinates placeholder="Street, city, province, postal code" onChange={(address, selected) => updateStop(stop.id, { label: address, ...(selected ? { latitude: selected.latitude, longitude: selected.longitude, city: selected.city, provinceCode: selected.province, postalCode: selected.postalCode, countryCode: selected.country, normalizedAddress: address } : {}) })} className={`${fieldClass} w-full`} aria-label="Stop address" />
                  {unresolved && <p className="mt-1 text-xs text-amber-700">Include the province and postal code so tax can be calculated for this stop.</p>}
                  {zonePriced && (!centralPickup || stop.type === 'DROPOFF') && !!stop.label?.trim() && <p className={`mt-1 text-xs ${stop.zoneId ? 'text-slate-500' : 'text-amber-700'}`}>{stop.zoneId ? `Pricing zone: ${pricing.zones.find(zone => zone.id === stop.zoneId)?.name ?? 'Matched'}` : 'No pricing zone matches this postal code. Add it under Pricing → Zones.'}</p>}
                </div>}
                {zonePriced && !showStopAddresses && (!centralPickup || stop.type === 'DROPOFF') && <div className="sm:col-span-2">
                  <label className={labelClass}>{centralPickup ? 'Delivery zone' : 'Zone'}</label>
                  <Select aria-label={centralPickup ? 'Delivery zone' : 'Zone'} className="w-full" value={stop.zoneId ?? ''} onValueChange={(v) => updateStop(stop.id, { zoneId: v || null })} options={[{ value: '', label: centralPickup ? 'Delivery zone (required)' : 'Zone (required)' }, ...pricing.zones.map((z) => ({ value: z.id, label: z.name }))]} />
                </div>}
                <div>
                  <label htmlFor={`${sid}-contact`} className={labelClass}>Contact name</label>
                  <input id={`${sid}-contact`} type="text" value={stop.contactName ?? ''} onChange={(e) => updateStop(stop.id, { contactName: e.target.value })} className={`${fieldClass} w-full`} aria-label={`Stop ${i + 1} contact name`} />
                </div>
                <div>
                  <label htmlFor={`${sid}-phone`} className={labelClass}>Phone</label>
                  <ContactInput id={`${sid}-phone`} type="tel" value={stop.contactPhone ?? ''} onChange={(e) => updateStop(stop.id, { contactPhone: e.target.value })} className={`${fieldClass} w-full`} aria-label={`Stop ${i + 1} phone`} />
                </div>
                <div className="sm:col-span-2">
                  <span className={labelClass}>{stop.type === 'PICKUP' ? 'Ready at' : 'Deliver by'}</span>
                  {stop.type === 'PICKUP'
                    ? <DateTimePicker aria-label={`Stop ${i + 1} ready at`} value={stop.windowStart ?? ''} onValueChange={windowStart => updateStop(stop.id, { windowStart: windowStart || undefined })} timeZone={timeZone} />
                    : <DateTimePicker aria-label={`Stop ${i + 1} deliver by`} value={stop.windowEnd ?? ''} onValueChange={windowEnd => updateStop(stop.id, { windowEnd: windowEnd || undefined })} timeZone={timeZone} />}
                </div>
              </div>
              {stop.type === 'DROPOFF' && pickups.length > 1 && <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600"><span>Picked up at:</span>{pickups.map(pickup => <label key={pickup.id} className="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={(stop.pickupIds ?? []).includes(pickup.id)} onChange={e => updateStop(stop.id, { pickupIds: e.target.checked ? [...(stop.pickupIds ?? []), pickup.id] : (stop.pickupIds ?? []).filter(p => p !== pickup.id) })} className={checkbox} />Stop {value.stops.indexOf(pickup) + 1}</label>)}</div>}
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
        <div className="app-package-table-shell rounded-lg border border-slate-200 p-3">
          <table aria-label="Packages" className="app-table app-table-editable app-table-plain app-package-table w-full">
            <thead><tr>
              <th scope="col" className="text-left">Qty</th>
              <th scope="col" className="text-left">Weight ({units.weightUnit})</th>
              <th scope="col" className="text-left">L × W × H ({units.dimensionUnit})</th>
              {pickups.length > 1 && <th scope="col" className="text-left">From</th>}
              {drops.length > 1 && <th scope="col" className="text-left">To</th>}
              <th scope="col" className="text-center">Fragile</th>
              <th scope="col" className="text-center"><abbr title="Dangerous goods">DG</abbr></th>
              <th scope="col"><span className="sr-only">Remove</span></th>
            </tr></thead>
            <tbody>
              {value.packages.map((p, index) => <tr key={p.id}>
                <td className="package-qty"><input type="number" min={1} step={1} value={p.quantity} onChange={(e) => updatePackage(p.id, { quantity: Math.max(1, Math.round(Number(e.target.value) || 1)) })} className={fieldClass} aria-label={`Package ${index + 1} quantity`} /></td>
                <td className="package-weight"><PackageMeasurementInput key={units.weightUnit} value={p.weightKg} units={units} kind="weight" label={`Package ${index + 1} weight`}
                  onChange={weightKg => updatePackage(p.id, { weightKg })} /></td>
                <td className="package-dimensions"><div className="flex items-center gap-1">{(['lengthCm', 'widthCm', 'heightCm'] as const).map((k, d) => <React.Fragment key={`${k}-${units.dimensionUnit}`}>{d > 0 && <span className="text-slate-400">×</span>}<PackageMeasurementInput value={p[k]} units={units} kind="dimension" onChange={dimension => updatePackage(p.id, { [k]: dimension })} label={`Package ${index + 1} ${k === 'lengthCm' ? 'length' : k === 'widthCm' ? 'width' : 'height'}`} /></React.Fragment>)}</div></td>
                {pickups.length > 1 && <td className="package-stop"><Select aria-label={`Package ${index + 1} pickup`} className="package-stop-select" value={p.pickupStopId ?? ''} onValueChange={pickupStopId => updatePackage(p.id, { pickupStopId: pickupStopId || undefined })} options={[{ value: '', label: 'Pickup…' }, ...pickups.map(s => ({ value: s.id, label: `Stop ${value.stops.indexOf(s) + 1}` }))]} /></td>}
                {drops.length > 1 && <td className="package-stop"><Select aria-label={`Package ${index + 1} delivery`} className="package-stop-select" value={p.deliveryStopId ?? ''} onValueChange={deliveryStopId => updatePackage(p.id, { deliveryStopId: deliveryStopId || undefined })} options={[{ value: '', label: 'Delivery…' }, ...drops.map(s => ({ value: s.id, label: `Stop ${value.stops.indexOf(s) + 1}` }))]} /></td>}
                <td className="package-flag text-center"><input type="checkbox" aria-label={`Package ${index + 1} fragile`} checked={!!p.fragile} onChange={(e) => updatePackage(p.id, { fragile: e.target.checked })} className={checkbox} /></td>
                <td className="package-flag text-center"><input type="checkbox" aria-label={`Package ${index + 1} dangerous goods`} checked={(p.handlingTags ?? []).includes('DANGEROUS_GOODS')} onChange={(e) => updatePackage(p.id, { handlingTags: e.target.checked ? [...(p.handlingTags ?? []), 'DANGEROUS_GOODS'] : (p.handlingTags ?? []).filter(tag => tag !== 'DANGEROUS_GOODS') })} className={checkbox} /></td>
                <td className="package-remove text-right"><button type="button" disabled={value.packages.length <= 1} onClick={() => patch({ packages: value.packages.filter((x) => x.id !== p.id) })} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded disabled:opacity-30" title="Remove package" aria-label={`Remove package ${index + 1}`}><Trash2 className="w-4 h-4" /></button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Actual {toDisplayWeight(snapshot.inputs.actualWeightKg, units).toFixed(1)} {units.weightUnit}
          {snapshot.inputs.dimensionalPricingEnabled && <> · dimensional {toDisplayWeight(snapshot.inputs.dimensionalWeightKg, units).toFixed(1)} {units.weightUnit}</>}
          {(snapshot.method === 'ZONE' || snapshot.inputs.dimensionalPricingEnabled) && <> · <span className="font-medium text-slate-700">chargeable {toDisplayWeight(snapshot.inputs.chargeableWeightKg, units).toFixed(1)} {units.weightUnit}</span></>}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {snapshot.method === 'FIXED' || snapshot.method === 'HOURLY' || (snapshot.method === 'BASE_PLUS_DISTANCE' && snapshot.context?.distanceWeightMode === 'NONE')
            ? 'Package weight and dimensions do not change this rate card’s base price.'
            : 'Chargeable weight is the larger of actual and dimensional weight, so the heavier value is used for pricing.'}
        </p>
      </div>

      {/* Accessorials */}
      <details className={`${sectionClass} group/acc`}>
        <summary className="list-none cursor-pointer flex items-center justify-between gap-4 [&::-webkit-details-marker]:hidden rounded-lg">
          <span className="min-w-0">
            <span className={sectionTitle}><Tag className="w-3.5 h-3.5 text-slate-700" /><span>{num()} Accessorials</span></span>
            <span className="block text-xs text-slate-500 mt-1 truncate">{selectedAccessorials.length ? selectedAccessorials.map(a => a.name).join(' · ') : 'No extra charges added.'}</span>
          </span>
          <span className="flex items-center gap-3 shrink-0">
            {selectedAccessorials.length > 0 && <span className="text-sm text-slate-700 tabular-nums">${selectedAccessorials.reduce((sum, a) => sum + a.rate, 0).toFixed(2)}</span>}
            <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open/acc:rotate-180" />
          </span>
        </summary>
        {activeAccessorials.length === 0 ? <p className="mt-4 rounded-lg border border-slate-200 p-4 text-xs text-slate-500">No active accessorials configured.</p> : (
          <div className="mt-4 rounded-lg border border-slate-200 p-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
            {activeAccessorials.map((acc) => {
              const on = qtyOf(acc.id) > 0;
              return (
                <label key={acc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 cursor-pointer select-none min-w-0">
                  <input type="checkbox" checked={on} onChange={() => setQty(acc.id, on ? 0 : 1)} className={checkbox} />
                  <span className="flex-1 min-w-0 truncate text-sm text-slate-800" title={acc.name}>{acc.name}</span>
                  <span className="shrink-0 text-sm text-slate-500 tabular-nums">${acc.rate.toFixed(2)}</span>
                </label>
              );
            })}
          </div>
        )}
      </details>
    </div>
  );
};
