import React, { useMemo, useState } from 'react';
import {
  Plus,
  Minus,
  Trash2,
  RotateCcw,
  Navigation,
  Truck,
  Package,
  MapPin,
  AlertTriangle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Building2,
  Clock,
  Layers
} from 'lucide-react';
import { DeliveryService, VehicleType, AccessorialItem } from '../../types/simplePricing';
import {
  OrderPriceAdjustment,
  PricingOrderInput,
  PricingPackageInput,
  PricingStopInput
} from '../../types/pricing';
import { loadBillingConfig } from '../../lib/billingStorage';
import { loadPricingConfig } from '../../lib/pricingStorage';
import { loadCustomers } from '../../lib/customerStorage';
import { calculatePricing } from '../../lib/pricingEngine';
import {
  fromDisplayDimension,
  fromDisplayDistance,
  fromDisplayWeight,
  toDisplayDimension,
  toDisplayDistance,
  toDisplayWeight
} from '../../lib/units';
import { Select } from '../ui/Select';

interface SimpleSimulatorProps {
  services: DeliveryService[];
  vehicles: VehicleType[];
  accessorials: AccessorialItem[];
}

const fieldClass =
  'w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400';
const labelClass = 'block text-[11px] font-medium text-slate-600 mb-1';
const sectionClass = 'bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs';
const sectionTitle = 'text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5';

const newStop = (type: PricingStopInput['type']): PricingStopInput => ({
  id: `stop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  type,
  zoneId: null,
  residential: false,
  waitMinutes: 0
});

const newPackage = (): PricingPackageInput => ({
  id: `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  quantity: 1,
  weightKg: 10,
  lengthCm: 40,
  widthCm: 30,
  heightCm: 30,
  declaredValue: 0
});

const fmt = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toFixed(2)}`;

export const SimpleSimulator: React.FC<SimpleSimulatorProps> = ({ services, vehicles, accessorials }) => {
  const activeServices = useMemo(() => services.filter((s) => s.active), [services]);
  const activeVehicles = useMemo(() => vehicles.filter((v) => v.active), [vehicles]);
  const activeAccessorials = useMemo(() => accessorials.filter((a) => a.active), [accessorials]);

  // Org-wide settings, rate cards, and customers — the same stores Order creation will use.
  const [billing] = useState(() => loadBillingConfig());
  const [pricing] = useState(() => loadPricingConfig());
  const [customers] = useState(() => loadCustomers());
  const units = billing.general;

  // ---- order facts ----------------------------------------------------------
  const [customerId, setCustomerId] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>(activeServices[0]?.id ?? '');
  const [vehicleId, setVehicleId] = useState<string>(activeVehicles[0]?.id ?? '');
  const [stops, setStops] = useState<PricingStopInput[]>(() => [
    { ...newStop('PICKUP'), zoneId: pricing.zones[0]?.id ?? null },
    { ...newStop('DROPOFF'), zoneId: pricing.zones[1]?.id ?? null }
  ]);
  const [routeKm, setRouteKm] = useState<number | null>(15);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(40);
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [stage, setStage] = useState<'ESTIMATE' | 'FINAL'>('ESTIMATE');
  const [actualMinutes, setActualMinutes] = useState<number>(0);
  const [packages, setPackages] = useState<PricingPackageInput[]>(() => [newPackage()]);
  const [accessorialQty, setAccessorialQty] = useState<Record<string, number>>({});
  const [importedPrice, setImportedPrice] = useState<string>('');
  const [rateCardOverrideId, setRateCardOverrideId] = useState<string>('');
  const [adjustments, setAdjustments] = useState<OrderPriceAdjustment[]>([]);
  const [showCalculation, setShowCalculation] = useState(false);

  const handleReset = () => {
    setCustomerId('');
    setServiceId(activeServices[0]?.id ?? '');
    setVehicleId(activeVehicles[0]?.id ?? '');
    setStops([
      { ...newStop('PICKUP'), zoneId: pricing.zones[0]?.id ?? null },
      { ...newStop('DROPOFF'), zoneId: pricing.zones[1]?.id ?? null }
    ]);
    setRouteKm(15);
    setEstimatedMinutes(40);
    setScheduledAt('');
    setStage('ESTIMATE');
    setActualMinutes(0);
    setPackages([newPackage()]);
    setAccessorialQty({});
    setImportedPrice('');
    setRateCardOverrideId('');
    setAdjustments([]);
  };

  const order: PricingOrderInput = useMemo(
    () => ({
      customerId: customerId || null,
      serviceId,
      vehicleId: vehicleId || null,
      stops,
      routeKm,
      estimatedMinutes,
      actualMinutes: stage === 'FINAL' ? actualMinutes : null,
      packages,
      accessorials: Object.entries(accessorialQty as Record<string, number>)
        .filter(([, q]) => (q as number) > 0)
        .map(([accessorialId, quantity]) => ({ accessorialId, quantity })),
      scheduledAt: scheduledAt || null,
      source: importedPrice !== '' ? 'IMPORT' : 'DISPATCHER',
      importedPrice: importedPrice === '' ? null : Number(importedPrice) || 0,
      externalSource: importedPrice !== '' ? 'External TMS' : null,
      externalReference: null,
      adjustments,
      rateCardOverrideId: rateCardOverrideId || null,
      stage
    }),
    [customerId, serviceId, vehicleId, stops, routeKm, estimatedMinutes, stage, actualMinutes, packages, accessorialQty, scheduledAt, importedPrice, adjustments, rateCardOverrideId]
  );

  const snapshot = useMemo(
    () => calculatePricing(order, { billing, catalogue: { services, vehicles, accessorials }, pricing, customers }),
    [order, billing, services, vehicles, accessorials, pricing, customers]
  );

  const currentVehicle = activeVehicles.find((v) => v.id === vehicleId);
  const totalWeight = packages.reduce((n, p) => n + p.quantity * p.weightKg, 0);
  const capacityWarning =
    currentVehicle && totalWeight > currentVehicle.payloadCapacityKg
      ? `Cargo (${Math.round(toDisplayWeight(totalWeight, units))} ${units.weightUnit}) exceeds ${currentVehicle.name} payload.`
      : null;

  const updateStop = (id: string, changes: Partial<PricingStopInput>) =>
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  const updatePackage = (id: string, changes: Partial<PricingPackageInput>) =>
    setPackages((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes } : p)));

  const statusStyle =
    snapshot.status === 'PRICED'
      ? 'bg-emerald-500/15 text-emerald-300'
      : snapshot.status === 'NEEDS_ATTENTION'
      ? 'bg-amber-500/15 text-amber-300'
      : 'bg-rose-500/15 text-rose-300';

  if (activeServices.length === 0) {
    return (
      <div className={`${sectionClass} p-8 text-center`}>
        <p className="text-sm text-slate-500">No active services. Activate or add one under Services & Accessorials.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* ============================ INPUTS ============================ */}
      <div className="lg:col-span-7 space-y-5">
        {/* 1. Customer, service, vehicle */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-3">
            <h4 className={sectionTitle}>
              <Building2 className="w-3.5 h-3.5 text-slate-700" />
              <span>1. Customer, Service & Vehicle</span>
            </h4>
            <span className="text-[11px] text-slate-400">Decides which Rate Card applies</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Customer</label>
              <Select
                aria-label="Customer"
                className="w-full"
                value={customerId}
                onValueChange={setCustomerId}
                options={[{ value: '', label: 'Walk-in — organization pricing' }, ...customers.map((c) => ({ value: c.id, label: c.name }))]}
              />
            </div>
            <div>
              <label className={labelClass}>Service</label>
              <Select
                aria-label="Service"
                className="w-full"
                value={serviceId}
                onValueChange={setServiceId}
                options={activeServices.map((s) => ({ value: s.id, label: `${s.name} (×${s.defaultMultiplier.toFixed(2)})` }))}
              />
            </div>
            <div>
              <label className={labelClass}>Vehicle</label>
              <Select
                aria-label="Vehicle"
                className="w-full"
                value={vehicleId}
                onValueChange={setVehicleId}
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

        {/* 2. Stops */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-3">
            <h4 className={sectionTitle}>
              <MapPin className="w-3.5 h-3.5 text-slate-700" />
              <span>2. Stops</span>
            </h4>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setStops((p) => [...p, newStop('PICKUP')])} className="text-[11px] font-medium px-2 py-1 rounded border border-slate-200 hover:bg-slate-100">
                + Pickup
              </button>
              <button type="button" onClick={() => setStops((p) => [...p, newStop('DROPOFF')])} className="text-[11px] font-medium px-2 py-1 rounded border border-slate-200 hover:bg-slate-100">
                + Drop-off
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {stops.map((stop, i) => (
              <div key={stop.id} className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-2 items-center p-2 rounded-lg border border-slate-200 bg-slate-50/60">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    stop.type === 'PICKUP' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
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
                  disabled={stops.length <= 2}
                  onClick={() => setStops((p) => p.filter((s) => s.id !== stop.id))}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded disabled:opacity-30"
                  title="Remove stop"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Stops beyond the included count are charged. Waiting past the free allowance bills in increments. Residential stops can auto-add accessorials.
          </p>
        </div>

        {/* 3. Route & schedule */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-3">
            <h4 className={sectionTitle}>
              <Navigation className="w-3.5 h-3.5 text-slate-700" />
              <span>3. Route & Schedule</span>
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
                  value={routeKm === null ? '' : Number(toDisplayDistance(routeKm, units).toFixed(1))}
                  placeholder="unknown"
                  onChange={(e) => setRouteKm(e.target.value === '' ? null : Math.max(0, fromDisplayDistance(Number(e.target.value) || 0, units)))}
                  className={`${fieldClass} pr-9`}
                />
                <span className="absolute right-3 top-2.5 text-[10px] text-slate-400">{units.distanceUnit}</span>
              </div>
            </div>
            <div>
              <label className={labelClass}>Estimated duration</label>
              <div className="relative">
                <input type="number" min={0} step={5} value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(Math.max(0, Number(e.target.value) || 0))} className={`${fieldClass} pr-9`} />
                <span className="absolute right-3 top-2.5 text-[10px] text-slate-400">min</span>
              </div>
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Service window starts</label>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={fieldClass} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px] font-medium">
              {(['ESTIMATE', 'FINAL'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStage(s)}
                  className={`px-3 py-1.5 ${stage === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {s === 'ESTIMATE' ? 'Estimate at booking' : 'Final at completion'}
                </button>
              ))}
            </div>
            {stage === 'FINAL' && (
              <div className="relative w-40">
                <input type="number" min={0} step={5} value={actualMinutes} onChange={(e) => setActualMinutes(Math.max(0, Number(e.target.value) || 0))} className={`${fieldClass} pr-20`} />
                <span className="absolute right-3 top-2.5 text-[10px] text-slate-400">actual min</span>
              </div>
            )}
            <span className="text-[11px] text-slate-500">
              {stage === 'FINAL' ? 'Hourly and time charges settle on actual duration.' : 'Hourly and time charges use the estimate.'}
            </span>
          </div>
        </div>

        {/* 4. Packages */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-3">
            <h4 className={sectionTitle}>
              <Package className="w-3.5 h-3.5 text-slate-700" />
              <span>4. Packages</span>
            </h4>
            <button type="button" onClick={() => setPackages((p) => [...p, newPackage()])} className="text-[11px] font-medium px-2 py-1 rounded border border-slate-200 hover:bg-slate-100">
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
            {packages.map((p) => (
              <div key={p.id} className="grid grid-cols-[56px_1fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                <input type="number" min={1} step={1} value={p.quantity} onChange={(e) => updatePackage(p.id, { quantity: Math.max(1, Math.round(Number(e.target.value) || 1)) })} className={fieldClass} aria-label="Quantity" />
                <input type="number" min={0} step={0.5} value={Number(toDisplayWeight(p.weightKg, units).toFixed(1))} onChange={(e) => updatePackage(p.id, { weightKg: fromDisplayWeight(Math.max(0, Number(e.target.value) || 0), units) })} className={fieldClass} aria-label="Weight per piece" />
                {(['lengthCm', 'widthCm', 'heightCm'] as const).map((k) => (
                  <input key={k} type="number" min={0} step={1} value={Number(toDisplayDimension(p[k], units).toFixed(1))} onChange={(e) => updatePackage(p.id, { [k]: fromDisplayDimension(Math.max(0, Number(e.target.value) || 0), units) })} className={fieldClass} aria-label={k} />
                ))}
                <input type="number" min={0} step={50} value={p.declaredValue} onChange={(e) => updatePackage(p.id, { declaredValue: Math.max(0, Number(e.target.value) || 0) })} className={fieldClass} aria-label="Declared value" />
                <button type="button" disabled={packages.length <= 1} onClick={() => setPackages((prev) => prev.filter((x) => x.id !== p.id))} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded disabled:opacity-30" title="Remove package">
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

        {/* 5. Accessorials */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-3">
            <h4 className={sectionTitle}>
              <Layers className="w-3.5 h-3.5 text-slate-700" />
              <span>5. Accessorials</span>
            </h4>
            <span className="text-[11px] text-slate-400">Waiting comes from stops; auto rules add themselves</span>
          </div>
          {activeAccessorials.length === 0 ? (
            <p className="text-xs text-slate-500">No active accessorials configured.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeAccessorials
                .filter((a) => a.calculationType !== 'PER_MINUTE')
                .map((acc) => {
                  const qty = accessorialQty[acc.id] ?? 0;
                  const on = qty > 0;
                  const quantityBased = acc.calculationType === 'PER_UNIT' || acc.calculationType === 'PER_HOUR' || acc.appliesAt === 'PER_STOP';
                  const pct = acc.calculationType.startsWith('PERCENT');
                  return (
                    <div key={acc.id} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border transition-all ${on ? 'border-slate-800 bg-slate-50/90' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <label className="flex items-start gap-2.5 cursor-pointer select-none flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setAccessorialQty((p) => ({ ...p, [acc.id]: on ? 0 : 1 }))}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 accent-slate-900 cursor-pointer"
                        />
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
                          <button type="button" onClick={() => setAccessorialQty((p) => ({ ...p, [acc.id]: Math.max(1, qty - 1) }))} className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold text-slate-800 w-6 text-center">{qty}</span>
                          <button type="button" onClick={() => setAccessorialQty((p) => ({ ...p, [acc.id]: qty + 1 }))} className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">
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

        {/* 6. Overrides & adjustments */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-3">
            <h4 className={sectionTitle}>
              <Truck className="w-3.5 h-3.5 text-slate-700" />
              <span>6. Overrides & Adjustments</span>
            </h4>
            <span className="text-[11px] text-slate-400">Order-level only — never changes a Rate Card</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Imported price (external system)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400">$</span>
                <input type="number" min={0} step={0.5} value={importedPrice} placeholder="none" onChange={(e) => setImportedPrice(e.target.value)} className={`${fieldClass} pl-6`} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Rate Card override (authorized)</label>
              <Select
                aria-label="Rate card override"
                className="w-full"
                value={rateCardOverrideId}
                onValueChange={setRateCardOverrideId}
                options={[{ value: '', label: 'Resolve automatically' }, ...pricing.rateCards.filter((c) => c.status !== 'ARCHIVED').map((c) => ({ value: c.id, label: c.name }))]}
              />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-slate-600">Manual adjustments</span>
              <button
                type="button"
                onClick={() => setAdjustments((p) => [...p, { id: `adj_${Date.now()}`, amount: -10, reason: 'Service recovery', taxable: true }])}
                className="text-[11px] font-medium px-2 py-1 rounded border border-slate-200 hover:bg-slate-100"
              >
                + Adjustment
              </button>
            </div>
            {adjustments.length === 0 ? (
              <p className="text-[11px] text-slate-400">None. Negative = one-off discount, positive = extra approved work.</p>
            ) : (
              <div className="space-y-2">
                {adjustments.map((adj) => (
                  <div key={adj.id} className="grid grid-cols-[120px_1fr_auto_auto] gap-2 items-center">
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-slate-400">$</span>
                      <input type="number" step={0.5} value={adj.amount} onChange={(e) => setAdjustments((p) => p.map((a) => (a.id === adj.id ? { ...a, amount: Number(e.target.value) || 0 } : a)))} className={`${fieldClass} pl-6`} aria-label="Adjustment amount" />
                    </div>
                    <input type="text" value={adj.reason} onChange={(e) => setAdjustments((p) => p.map((a) => (a.id === adj.id ? { ...a, reason: e.target.value } : a)))} className={fieldClass} placeholder="Reason (required on real orders)" aria-label="Reason" />
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer whitespace-nowrap">
                      <input type="checkbox" checked={adj.taxable} onChange={(e) => setAdjustments((p) => p.map((a) => (a.id === adj.id ? { ...a, taxable: e.target.checked } : a)))} className="w-3.5 h-3.5 rounded border-slate-300 accent-slate-900" />
                      Taxable
                    </label>
                    <button type="button" onClick={() => setAdjustments((p) => p.filter((a) => a.id !== adj.id))} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded" title="Remove">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================ RESULT ============================ */}
      <div className="lg:col-span-5 sticky top-6">
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-6 bg-slate-900 text-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium tracking-wide uppercase text-slate-300">
                {stage === 'FINAL' ? 'Final price' : 'Quote estimate'}
              </span>
              <button type="button" onClick={handleReset} className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition-colors">
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight">{snapshot.status === 'PRICED' ? `$${snapshot.total.toFixed(2)}` : '—'}</span>
              <span className="text-xs text-slate-400 font-medium">{snapshot.currency}</span>
              <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded ${statusStyle}`}>
                {snapshot.status.replace('_', ' ')}
              </span>
            </div>

            <div className="mt-3 text-[11px] text-slate-300 space-y-0.5">
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Rate Card</span>
                <span className="font-medium text-white text-right truncate">
                  {snapshot.rateCard ? `${snapshot.rateCard.name} · v${snapshot.rateCard.version}` : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Resolved via</span>
                <span className="font-medium text-white">{snapshot.rateCard ? snapshot.rateCard.source.replace(/_/g, ' ').toLowerCase() : '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Method</span>
                <span className="font-medium text-white">{snapshot.method ? snapshot.method.replace(/_/g, ' ').toLowerCase() : '—'}</span>
              </div>
            </div>

            {snapshot.errors.length > 0 && (
              <div className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-[11px] space-y-1">
                {snapshot.errors.map((e) => (
                  <div key={e.code} className="flex items-start gap-1.5 text-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    <span>{e.message}</span>
                  </div>
                ))}
              </div>
            )}
            {snapshot.warnings.map((w) => (
              <div key={w} className="mt-2 text-[11px] text-amber-200/90">{w}</div>
            ))}
          </div>

          <div className="p-6 space-y-4">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">Charge Lines</h5>

            {snapshot.lines.length === 0 ? (
              <p className="text-xs text-slate-500">Nothing priced yet.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {snapshot.lines.map((l) => (
                  <div key={l.key} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className={`font-medium ${l.amount < 0 ? 'text-emerald-700' : 'text-slate-800'}`}>{l.label}</span>
                      {l.detail && <p className="text-[11px] text-slate-500 truncate">{l.detail}</p>}
                    </div>
                    <span className={`font-semibold whitespace-nowrap ${l.amount < 0 ? 'text-emerald-700' : 'text-slate-900'}`}>{fmt(l.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-700">Subtotal</span>
                  <span className="font-semibold text-slate-900">${snapshot.subtotal.toFixed(2)}</span>
                </div>
                {snapshot.taxExempt ? (
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Tax exempt customer</span>
                    <span>$0.00</span>
                  </div>
                ) : (
                  snapshot.taxLines.map((l) => (
                    <div key={l.key} className="flex items-center justify-between text-slate-700">
                      <span>
                        {l.label} <span className="text-slate-500 text-[11px]">{l.detail}</span>
                      </span>
                      <span className="font-medium text-slate-900">${l.amount.toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">Total</span>
              <span className="text-base font-bold text-slate-900">
                ${snapshot.total.toFixed(2)} {snapshot.currency}
              </span>
            </div>

            {/* View calculation */}
            <button
              type="button"
              onClick={() => setShowCalculation((v) => !v)}
              className="w-full flex items-center justify-between text-[11px] font-medium text-slate-600 hover:text-slate-900 py-1"
            >
              <span>View calculation</span>
              {showCalculation ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showCalculation && (
              <div className="space-y-3 text-[11px]">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="font-medium text-slate-700 mb-1.5">Rate Card resolution</div>
                  {snapshot.candidates.length === 0 ? (
                    <p className="text-slate-500">No cards considered.</p>
                  ) : (
                    <ul className="space-y-1">
                      {snapshot.candidates.map((c) => (
                        <li key={`${c.source}_${c.id}`} className="flex items-center justify-between gap-2">
                          <span className={c.eligible ? 'text-slate-800' : 'text-slate-400 line-through'}>
                            {c.name} <span className="text-slate-400 no-underline">· {c.source.replace(/_/g, ' ').toLowerCase()}</span>
                          </span>
                          <span className={`shrink-0 ${c.id === snapshot.rateCard?.id ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                            {c.id === snapshot.rateCard?.id ? 'selected' : c.reason}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600">
                  <span>Billable distance</span><span className="text-right font-mono">{snapshot.inputs.billableKm} km</span>
                  <span>Minutes priced</span><span className="text-right font-mono">{snapshot.inputs.estimatedMinutes ?? '—'}</span>
                  <span>Chargeable weight</span><span className="text-right font-mono">{snapshot.inputs.chargeableWeightKg} kg</span>
                  <span>Pieces / stops</span><span className="text-right font-mono">{snapshot.inputs.pieces} / {snapshot.inputs.stopCount}</span>
                  <span>Service multiplier</span><span className="text-right font-mono">×{snapshot.inputs.serviceMultiplier.toFixed(2)}</span>
                  <span>Fuel</span><span className="text-right font-mono">{snapshot.inputs.fuelPercent}% of ${snapshot.inputs.fuelBase.toFixed(2)}</span>
                  <span>Wait allowance</span><span className="text-right font-mono">{snapshot.inputs.waitFreeMinutes} free / {snapshot.inputs.waitIncrementMinutes} min blocks</span>
                  <span>Tax profile</span><span className="text-right font-mono">{snapshot.taxExempt ? 'exempt' : snapshot.taxProfile?.name ?? '—'}</span>
                  <span>Engine</span><span className="text-right font-mono">{snapshot.engineVersion}</span>
                </div>
              </div>
            )}

            {/* Internal margin */}
            {snapshot.cost && snapshot.status === 'PRICED' && (
              <div className={`p-3 rounded-lg border text-[11px] space-y-1.5 ${snapshot.cost.meetsTargetMargin ? 'bg-emerald-50/70 border-emerald-200' : 'bg-rose-50/70 border-rose-200'}`}>
                <div className="flex items-center justify-between font-medium text-slate-700">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                    Internal margin (not shown to customer)
                  </span>
                  <span className={`font-bold ${snapshot.cost.meetsTargetMargin ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {snapshot.cost.grossMarginPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Estimated fulfilment cost</span>
                  <span className="font-mono">${snapshot.cost.estimatedCost.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Gross profit</span>
                  <span className="font-mono">${snapshot.cost.grossProfit.toFixed(2)}</span>
                </div>
                {!snapshot.cost.meetsTargetMargin && (
                  <p className="text-rose-700 font-medium pt-1">Below the {billing.operatingCost.targetGrossMarginPercent}% target margin.</p>
                )}
                <p className="text-slate-400 pt-1">Deadhead and driver choice affect this cost, never the customer price.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
