import React from 'react';
import { Plus, Minus, Trash2, Navigation, Truck, Package, MapPin, AlertTriangle, Building2, Clock, Layers } from 'lucide-react';
import { OrderPriceAdjustment, PricingOrderInput, PricingPackageInput, PricingSnapshot, PricingStopInput } from '../../types/pricing';
import { PricingContext } from '../../lib/pricingEngine';
import { createStop } from '../../lib/orderPricing';
import {
  fromDisplayDimension,
  fromDisplayDistance,
  fromDisplayWeight,
  toDisplayDimension,
  toDisplayDistance,
  toDisplayWeight
} from '../../lib/units';
import { Select } from '../ui/Select';

/**
 * Order-facts editor shared by the Price Simulator and Order creation. It only
 * edits a `PricingOrderInput`; the caller runs `calculatePricing` and passes the
 * snapshot back for the live readouts.
 */
interface OrderPricingFormProps {
  value: PricingOrderInput;
  onChange: (next: PricingOrderInput) => void;
  ctx: PricingContext;
  snapshot: PricingSnapshot;
  /** Show address fields on stops (Order form). */
  showStopAddresses?: boolean;
  /** Show imported price / card override / manual adjustments. */
  showOverrides?: boolean;
  /** Start section numbering here (Order form prefixes its own sections). */
  startIndex?: number;
}

const fieldClass =
  'w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400';
const labelClass = 'block text-[11px] font-medium text-slate-600 mb-1';
const sectionClass = 'bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs';
const sectionTitle = 'text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5';
const smallBtn = 'text-[11px] font-medium px-2 py-1 rounded border border-slate-200 hover:bg-slate-100';

const newPackage = (): PricingPackageInput => ({
  id: `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  quantity: 1,
  weightKg: 10,
  lengthCm: 40,
  widthCm: 30,
  heightCm: 30,
  declaredValue: 0
});

export const OrderPricingForm: React.FC<OrderPricingFormProps> = ({
  value,
  onChange,
  ctx,
  snapshot,
  showStopAddresses = false,
  showOverrides = true,
  startIndex = 1
}) => {
  const { catalogue, pricing, customers, billing } = ctx;
  const units = billing.general;
  const activeServices = catalogue.services.filter((s) => s.active);
  const activeVehicles = catalogue.vehicles.filter((v) => v.active);
  const activeAccessorials = catalogue.accessorials.filter((a) => a.active && a.calculationType !== 'PER_MINUTE');

  const patch = (changes: Partial<PricingOrderInput>) => onChange({ ...value, ...changes });
  const updateStop = (id: string, changes: Partial<PricingStopInput>) =>
    patch({ stops: value.stops.map((s) => (s.id === id ? { ...s, ...changes } : s)) });
  const updatePackage = (id: string, changes: Partial<PricingPackageInput>) =>
    patch({ packages: value.packages.map((p) => (p.id === id ? { ...p, ...changes } : p)) });
  const qtyOf = (id: string) => value.accessorials.find((a) => a.accessorialId === id)?.quantity ?? 0;
  const setQty = (id: string, quantity: number) =>
    patch({
      accessorials: [
        ...value.accessorials.filter((a) => a.accessorialId !== id),
        ...(quantity > 0 ? [{ accessorialId: id, quantity }] : [])
      ]
    });

  const currentVehicle = activeVehicles.find((v) => v.id === value.vehicleId);
  const totalWeight = value.packages.reduce((n, p) => n + p.quantity * p.weightKg, 0);
  const capacityWarning =
    currentVehicle && totalWeight > currentVehicle.payloadCapacityKg
      ? `Cargo (${Math.round(toDisplayWeight(totalWeight, units))} ${units.weightUnit}) exceeds ${currentVehicle.name} payload.`
      : null;

  let n = startIndex;
  const num = () => `${n++}.`;

  return (
    <div className="space-y-5">
      {/* Customer, service, vehicle */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between mb-3">
          <h4 className={sectionTitle}>
            <Building2 className="w-3.5 h-3.5 text-slate-700" />
            <span>{num()} Customer, Service & Vehicle</span>
          </h4>
          <span className="text-[11px] text-slate-400">Decides which Rate Card applies</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Customer</label>
            <Select
              aria-label="Customer"
              className="w-full"
              value={value.customerId ?? ''}
              onValueChange={(v) => patch({ customerId: v || null })}
              options={[{ value: '', label: 'Walk-in — organization pricing' }, ...customers.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
          <div>
            <label className={labelClass}>Service</label>
            <Select
              aria-label="Service"
              className="w-full"
              value={value.serviceId}
              onValueChange={(v) => patch({ serviceId: v })}
              options={activeServices.map((s) => ({ value: s.id, label: `${s.name} (×${s.defaultMultiplier.toFixed(2)})` }))}
            />
          </div>
          <div>
            <label className={labelClass}>Vehicle</label>
            <Select
              aria-label="Vehicle"
              className="w-full"
              value={value.vehicleId ?? ''}
              onValueChange={(v) => patch({ vehicleId: v || null })}
              options={activeVehicles.map((v) => ({
                value: v.id,
                label: `${v.name}${v.baseSurcharge > 0 ? ` (+$${v.baseSurcharge.toFixed(0)})` : ''}`
              }))}
            />
          </div>
        </div>
        {capacityWarning && (
          <div className="mt-3 p-2 rounded-lg text-xs flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{capacityWarning} Consider a larger class — capacity does not change the price.</span>
          </div>
        )}
      </div>

      {/* Stops */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between mb-3">
          <h4 className={sectionTitle}>
            <MapPin className="w-3.5 h-3.5 text-slate-700" />
            <span>{num()} Stops</span>
          </h4>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => patch({ stops: [...value.stops, createStop('PICKUP')] })} className={smallBtn}>
              + Pickup
            </button>
            <button type="button" onClick={() => patch({ stops: [...value.stops, createStop('DROPOFF')] })} className={smallBtn}>
              + Drop-off
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {value.stops.map((stop, i) => (
            <div key={stop.id} className="p-2 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2">
              <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-2 items-center">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${stop.type === 'PICKUP' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {i + 1} · {stop.type === 'PICKUP' ? 'PU' : 'DO'}
                </span>
                <Select
                  aria-label="Zone"
                  className="w-full"
                  value={stop.zoneId ?? ''}
                  onValueChange={(v) => updateStop(stop.id, { zoneId: v || null })}
                  options={[{ value: '', label: 'No zone' }, ...pricing.zones.map((z) => ({ value: z.id, label: z.name }))]}
                />
                <div className="relative">
                  <Clock className="w-3 h-3 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={stop.waitMinutes}
                    onChange={(e) => updateStop(stop.id, { waitMinutes: Math.max(0, Number(e.target.value) || 0) })}
                    className={`${fieldClass} pl-7 pr-10`}
                    aria-label="Wait minutes"
                  />
                  <span className="absolute right-2.5 top-2.5 text-[10px] text-slate-400">wait</span>
                </div>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={stop.residential}
                    onChange={(e) => updateStop(stop.id, { residential: e.target.checked })}
                    className="w-3.5 h-3.5 rounded border-slate-300 accent-slate-900"
                  />
                  Residential
                </label>
                <button
                  type="button"
                  disabled={value.stops.length <= 2}
                  onClick={() => patch({ stops: value.stops.filter((s) => s.id !== stop.id) })}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded disabled:opacity-30"
                  title="Remove stop"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {showStopAddresses && (
                <input
                  type="text"
                  value={stop.label ?? ''}
                  placeholder={stop.type === 'PICKUP' ? 'Pickup address' : 'Delivery address'}
                  onChange={(e) => updateStop(stop.id, { label: e.target.value })}
                  className={fieldClass}
                  aria-label="Stop address"
                />
              )}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          Stops beyond the included count are charged. Waiting past the free allowance bills in increments. Residential stops can auto-add accessorials.
        </p>
      </div>

      {/* Route & schedule */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between mb-3">
          <h4 className={sectionTitle}>
            <Navigation className="w-3.5 h-3.5 text-slate-700" />
            <span>{num()} Route & Schedule</span>
          </h4>
          <span className="text-[11px] text-slate-400">Standalone route for these stops — never the driver's approach</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className={labelClass}>Priced distance</label>
            <div className="relative">
              <input
                type="number"
                min={0}
                step={0.5}
                value={value.routeKm === null ? '' : Number(toDisplayDistance(value.routeKm, units).toFixed(1))}
                placeholder="unknown"
                onChange={(e) => patch({ routeKm: e.target.value === '' ? null : Math.max(0, fromDisplayDistance(Number(e.target.value) || 0, units)) })}
                className={`${fieldClass} pr-9`}
              />
              <span className="absolute right-3 top-2.5 text-[10px] text-slate-400">{units.distanceUnit}</span>
            </div>
          </div>
          <div>
            <label className={labelClass}>Estimated duration</label>
            <div className="relative">
              <input
                type="number"
                min={0}
                step={5}
                value={value.estimatedMinutes ?? ''}
                onChange={(e) => patch({ estimatedMinutes: e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0) })}
                className={`${fieldClass} pr-9`}
              />
              <span className="absolute right-3 top-2.5 text-[10px] text-slate-400">min</span>
            </div>
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Service window starts</label>
            <input
              type="datetime-local"
              value={value.scheduledAt ?? ''}
              onChange={(e) => patch({ scheduledAt: e.target.value || null })}
              className={fieldClass}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px] font-medium">
            {(['ESTIMATE', 'FINAL'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => patch({ stage: s, actualMinutes: s === 'FINAL' ? value.actualMinutes ?? value.estimatedMinutes : null })}
                className={`px-3 py-1.5 ${value.stage === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {s === 'ESTIMATE' ? 'Estimate at booking' : 'Final at completion'}
              </button>
            ))}
          </div>
          {value.stage === 'FINAL' && (
            <div className="relative w-40">
              <input
                type="number"
                min={0}
                step={5}
                value={value.actualMinutes ?? ''}
                onChange={(e) => patch({ actualMinutes: Math.max(0, Number(e.target.value) || 0) })}
                className={`${fieldClass} pr-20`}
              />
              <span className="absolute right-3 top-2.5 text-[10px] text-slate-400">actual min</span>
            </div>
          )}
          <span className="text-[11px] text-slate-500">
            {value.stage === 'FINAL' ? 'Hourly and time charges settle on actual duration.' : 'Hourly and time charges use the estimate.'}
          </span>
        </div>
      </div>

      {/* Packages */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between mb-3">
          <h4 className={sectionTitle}>
            <Package className="w-3.5 h-3.5 text-slate-700" />
            <span>{num()} Packages</span>
          </h4>
          <button type="button" onClick={() => patch({ packages: [...value.packages, newPackage()] })} className={smallBtn}>
            + Package
          </button>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-[56px_1fr_1fr_1fr_1fr_1fr_auto] gap-2 text-[10px] font-medium text-slate-500 px-1">
            <span>Qty</span>
            <span>Weight ({units.weightUnit})</span>
            <span>L ({units.dimensionUnit})</span>
            <span>W</span>
            <span>H</span>
            <span>Declared $</span>
            <span />
          </div>
          {value.packages.map((p) => (
            <div key={p.id} className="grid grid-cols-[56px_1fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center">
              <input type="number" min={1} step={1} value={p.quantity} onChange={(e) => updatePackage(p.id, { quantity: Math.max(1, Math.round(Number(e.target.value) || 1)) })} className={fieldClass} aria-label="Quantity" />
              <input type="number" min={0} step={0.5} value={Number(toDisplayWeight(p.weightKg, units).toFixed(1))} onChange={(e) => updatePackage(p.id, { weightKg: fromDisplayWeight(Math.max(0, Number(e.target.value) || 0), units) })} className={fieldClass} aria-label="Weight per piece" />
              {(['lengthCm', 'widthCm', 'heightCm'] as const).map((k) => (
                <input key={k} type="number" min={0} step={1} value={Number(toDisplayDimension(p[k], units).toFixed(1))} onChange={(e) => updatePackage(p.id, { [k]: fromDisplayDimension(Math.max(0, Number(e.target.value) || 0), units) })} className={fieldClass} aria-label={k} />
              ))}
              <input type="number" min={0} step={50} value={p.declaredValue} onChange={(e) => updatePackage(p.id, { declaredValue: Math.max(0, Number(e.target.value) || 0) })} className={fieldClass} aria-label="Declared value" />
              <button
                type="button"
                disabled={value.packages.length <= 1}
                onClick={() => patch({ packages: value.packages.filter((x) => x.id !== p.id) })}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded disabled:opacity-30"
                title="Remove package"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-[11px]">
          <div className="p-2 rounded bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block">Actual weight</span>
            <span className="font-semibold text-slate-800">{toDisplayWeight(snapshot.inputs.actualWeightKg, units).toFixed(1)} {units.weightUnit}</span>
          </div>
          <div className="p-2 rounded bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block">Dimensional ÷ {snapshot.inputs.dimensionalDivisor}</span>
            <span className="font-semibold text-slate-800">
              {snapshot.inputs.dimensionalPricingEnabled ? `${toDisplayWeight(snapshot.inputs.dimensionalWeightKg, units).toFixed(1)} ${units.weightUnit}` : 'off'}
            </span>
          </div>
          <div className="p-2 rounded bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block">Chargeable weight</span>
            <span className="font-semibold text-slate-900">{toDisplayWeight(snapshot.inputs.chargeableWeightKg, units).toFixed(1)} {units.weightUnit}</span>
          </div>
        </div>
      </div>

      {/* Accessorials */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between mb-3">
          <h4 className={sectionTitle}>
            <Layers className="w-3.5 h-3.5 text-slate-700" />
            <span>{num()} Accessorials</span>
          </h4>
          <span className="text-[11px] text-slate-400">Waiting comes from stops; auto rules add themselves</span>
        </div>
        {activeAccessorials.length === 0 ? (
          <p className="text-xs text-slate-500">No active accessorials configured.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeAccessorials.map((acc) => {
              const qty = qtyOf(acc.id);
              const on = qty > 0;
              const quantityBased = acc.calculationType === 'PER_UNIT' || acc.calculationType === 'PER_HOUR' || acc.appliesAt === 'PER_STOP';
              const pct = acc.calculationType.startsWith('PERCENT');
              return (
                <div key={acc.id} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border transition-all ${on ? 'border-slate-800 bg-slate-50/90' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <label className="flex items-start gap-2.5 cursor-pointer select-none flex-1 min-w-0">
                    <input type="checkbox" checked={on} onChange={() => setQty(acc.id, on ? 0 : 1)} className="mt-0.5 w-4 h-4 rounded border-slate-300 accent-slate-900 cursor-pointer" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">{acc.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {pct ? `${acc.rate}%` : `$${acc.rate.toFixed(2)}`} {acc.unitLabel}
                        {acc.autoRule !== 'NONE' && <span className="ml-1 text-blue-600">· auto</span>}
                      </div>
                    </div>
                  </label>
                  {on && quantityBased && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => setQty(acc.id, Math.max(1, qty - 1))} className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-slate-800 w-6 text-center">{qty}</span>
                      <button type="button" onClick={() => setQty(acc.id, qty + 1)} className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Overrides & adjustments */}
      {showOverrides && (
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-3">
            <h4 className={sectionTitle}>
              <Truck className="w-3.5 h-3.5 text-slate-700" />
              <span>{num()} Overrides & Adjustments</span>
            </h4>
            <span className="text-[11px] text-slate-400">Order-level only — never changes a Rate Card</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Imported price (external system)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400">$</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={value.importedPrice ?? ''}
                  placeholder="none"
                  onChange={(e) =>
                    patch(
                      e.target.value === ''
                        ? { importedPrice: null, source: 'DISPATCHER', externalSource: null }
                        : { importedPrice: Math.max(0, Number(e.target.value) || 0), source: 'IMPORT', externalSource: value.externalSource ?? 'External TMS' }
                    )
                  }
                  className={`${fieldClass} pl-6`}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Rate Card override (authorized)</label>
              <Select
                aria-label="Rate card override"
                className="w-full"
                value={value.rateCardOverrideId ?? ''}
                onValueChange={(v) => patch({ rateCardOverrideId: v || null })}
                options={[{ value: '', label: 'Resolve automatically' }, ...pricing.rateCards.filter((c) => c.status !== 'ARCHIVED').map((c) => ({ value: c.id, label: c.name }))]}
              />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-slate-600">Manual adjustments</span>
              <button
                type="button"
                onClick={() => patch({ adjustments: [...value.adjustments, { id: `adj_${Date.now()}`, amount: -10, reason: 'Service recovery', taxable: true }] })}
                className={smallBtn}
              >
                + Adjustment
              </button>
            </div>
            {value.adjustments.length === 0 ? (
              <p className="text-[11px] text-slate-400">None. Negative = one-off discount, positive = extra approved work.</p>
            ) : (
              <div className="space-y-2">
                {value.adjustments.map((adj: OrderPriceAdjustment) => {
                  const update = (changes: Partial<OrderPriceAdjustment>) =>
                    patch({ adjustments: value.adjustments.map((a) => (a.id === adj.id ? { ...a, ...changes } : a)) });
                  return (
                    <div key={adj.id} className="grid grid-cols-[120px_1fr_auto_auto] gap-2 items-center">
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400">$</span>
                        <input type="number" step={0.5} value={adj.amount} onChange={(e) => update({ amount: Number(e.target.value) || 0 })} className={`${fieldClass} pl-6`} aria-label="Adjustment amount" />
                      </div>
                      <input type="text" value={adj.reason} onChange={(e) => update({ reason: e.target.value })} className={fieldClass} placeholder="Reason (required)" aria-label="Reason" />
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer whitespace-nowrap">
                        <input type="checkbox" checked={adj.taxable} onChange={(e) => update({ taxable: e.target.checked })} className="w-3.5 h-3.5 rounded border-slate-300 accent-slate-900" />
                        Taxable
                      </label>
                      <button type="button" onClick={() => patch({ adjustments: value.adjustments.filter((a) => a.id !== adj.id) })} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded" title="Remove">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
