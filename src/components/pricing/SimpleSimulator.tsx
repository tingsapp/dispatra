import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Check,
  Plus,
  Minus,
  RotateCcw,
  Navigation,
  Truck,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Weight,
  Package
} from 'lucide-react';
import { DeliveryService, VehicleType, AccessorialItem } from '../../types/simplePricing';

interface SimpleSimulatorProps {
  services: DeliveryService[];
  vehicles: VehicleType[];
  accessorials: AccessorialItem[];
}

export const SimpleSimulator: React.FC<SimpleSimulatorProps> = ({
  services,
  vehicles,
  accessorials
}) => {
  // Filter only active items for calculation
  const activeServices = useMemo(() => services.filter(s => s.active), [services]);
  const activeVehicles = useMemo(() => vehicles.filter(v => v.active), [vehicles]);
  const activeAccessorials = useMemo(() => accessorials.filter(a => a.active), [accessorials]);

  // Selected state
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() => {
    return activeServices[0]?.id || '';
  });

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() => {
    return activeVehicles[0]?.id || '';
  });

  const [distanceKm, setDistanceKm] = useState<number>(15);

  // Optional Cargo Fit Inputs for Dispatch Testing
  const [testWeightKg, setTestWeightKg] = useState<number | ''>('');
  const [testPallets, setTestPallets] = useState<number | ''>('');

  // Map of accessorial selections: { [id]: { checked: boolean, quantity: number } }
  const [selectedAccessorials, setSelectedAccessorials] = useState<Record<string, { checked: boolean; quantity: number }>>(() => {
    const initial: Record<string, { checked: boolean; quantity: number }> = {};
    activeAccessorials.forEach(acc => {
      initial[acc.id] = {
        checked: acc.id === 'acc_stairs',
        quantity: acc.pricingType === 'per_unit' ? 2 : 1
      };
    });
    return initial;
  });

  // Current selected objects
  const currentService = useMemo(() => {
    return activeServices.find(s => s.id === selectedServiceId) || activeServices[0];
  }, [activeServices, selectedServiceId]);

  const currentVehicle = useMemo(() => {
    return activeVehicles.find(v => v.id === selectedVehicleId) || activeVehicles[0];
  }, [activeVehicles, selectedVehicleId]);

  // Capacity validation
  const capacityCheck = useMemo(() => {
    if (!currentVehicle) return null;
    const weightVal = Number(testWeightKg) || 0;
    const palletVal = Number(testPallets) || 0;

    if (weightVal === 0 && palletVal === 0) return null;

    const weightExceeded = weightVal > currentVehicle.payloadCapacityKg;
    const palletExceeded = palletVal > currentVehicle.palletCapacity;

    return {
      fits: !weightExceeded && !palletExceeded,
      weightExceeded,
      palletExceeded
    };
  }, [currentVehicle, testWeightKg, testPallets]);

  // Toggle accessorial
  const toggleAccessorial = (id: string) => {
    setSelectedAccessorials(prev => {
      const current = prev[id] || { checked: false, quantity: 1 };
      return {
        ...prev,
        [id]: {
          ...current,
          checked: !current.checked,
          quantity: current.quantity || 1
        }
      };
    });
  };

  // Change quantity for per-unit accessorial
  const updateQuantity = (id: string, delta: number) => {
    setSelectedAccessorials(prev => {
      const current = prev[id] || { checked: true, quantity: 1 };
      const newQty = Math.max(1, (current.quantity || 1) + delta);
      return {
        ...prev,
        [id]: {
          checked: true,
          quantity: newQty
        }
      };
    });
  };

  // Reset simulator
  const handleReset = () => {
    if (activeServices.length > 0) setSelectedServiceId(activeServices[0].id);
    if (activeVehicles.length > 0) setSelectedVehicleId(activeVehicles[0].id);
    setDistanceKm(15);
    setTestWeightKg('');
    setTestPallets('');
    const resetAcc: Record<string, { checked: boolean; quantity: number }> = {};
    activeAccessorials.forEach(acc => {
      resetAcc[acc.id] = { checked: false, quantity: 1 };
    });
    setSelectedAccessorials(resetAcc);
  };

  // Calculation Breakdown
  const calculation = useMemo(() => {
    if (!currentService) {
      return {
        serviceBaseFee: 0,
        vehicleSurcharge: 0,
        includedKm: 0,
        billableKm: 0,
        kmCharge: 0,
        accessorialItems: [],
        accessorialTotal: 0,
        grandTotal: 0
      };
    }

    const serviceBaseFee = currentService.basePrice;
    const vehicleSurcharge = currentVehicle ? currentVehicle.baseSurcharge : 0;
    const includedKm = currentService.includedKm;
    const billableKm = Math.max(0, distanceKm - includedKm);
    const kmCharge = billableKm * currentService.perKmPrice;

    const accessorialItems: {
      id: string;
      name: string;
      pricingType: string;
      unitPrice: number;
      quantity: number;
      unitLabel: string;
      subtotal: number;
    }[] = [];

    let accessorialTotal = 0;

    activeAccessorials.forEach(acc => {
      const selection = selectedAccessorials[acc.id];
      if (selection && selection.checked) {
        const qty = acc.pricingType === 'per_unit' ? selection.quantity : 1;
        const subtotal = acc.price * qty;
        accessorialTotal += subtotal;
        accessorialItems.push({
          id: acc.id,
          name: acc.name,
          pricingType: acc.pricingType,
          unitPrice: acc.price,
          quantity: qty,
          unitLabel: acc.unitLabel,
          subtotal
        });
      }
    });

    const grandTotal = serviceBaseFee + vehicleSurcharge + kmCharge + accessorialTotal;

    return {
      serviceBaseFee,
      vehicleSurcharge,
      includedKm,
      billableKm,
      kmCharge,
      accessorialItems,
      accessorialTotal,
      grandTotal
    };
  }, [currentService, currentVehicle, distanceKm, activeAccessorials, selectedAccessorials]);

  if (activeServices.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <p className="text-sm text-slate-500">
          No active services found. Please activate or add at least one service in the Services tab.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT COLUMN: SIMPLE INPUTS */}
      <div className="lg:col-span-7 space-y-5">
        {/* 1. SELECT VEHICLE TYPE */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-slate-700" />
              <span>1. Choose Vehicle Type</span>
            </h4>
            <span className="text-[11px] text-slate-400">Payload weight & pallet capacity</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {activeVehicles.map(vehicle => {
              const isSelected = vehicle.id === (currentVehicle?.id || '');
              return (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => setSelectedVehicleId(vehicle.id)}
                  className={`p-3 text-left rounded-lg border transition-all relative ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{vehicle.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                  </div>

                  <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                    <span className={`px-1.5 py-0.5 rounded font-medium ${
                      isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
                    }`}>
                      Max: {vehicle.payloadCapacityKg} kg ({vehicle.palletCapacity} skids)
                    </span>
                    {vehicle.cargoBedFeet && (
                      <span className={isSelected ? 'text-slate-300' : 'text-slate-500'}>
                        {vehicle.cargoBedFeet}ft bed
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-200/40">
                    <span className={isSelected ? 'text-slate-300' : 'text-slate-500'}>
                      Vehicle Surcharge:
                    </span>
                    <span className="font-semibold">
                      {vehicle.baseSurcharge > 0 ? `+$${vehicle.baseSurcharge.toFixed(2)}` : '$0.00 (Standard)'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Cargo Fit Check (Optional) */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-[11px] text-slate-500 font-medium">
              Optional Cargo Check:
            </span>
            <div className="flex items-center gap-2">
              <div className="relative w-28">
                <input
                  type="number"
                  placeholder="Cargo kg"
                  value={testWeightKg}
                  onChange={(e) => setTestWeightKg(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                <span className="absolute right-1.5 top-1 text-[10px] text-slate-400">kg</span>
              </div>

              <div className="relative w-28">
                <input
                  type="number"
                  placeholder="Pallets"
                  value={testPallets}
                  onChange={(e) => setTestPallets(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className="w-full text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                <span className="absolute right-1.5 top-1 text-[10px] text-slate-400">skids</span>
              </div>
            </div>
          </div>

          {/* Capacity Feedback */}
          {capacityCheck && (
            <div className={`mt-2 p-2 rounded-lg text-xs flex items-center gap-2 ${
              capacityCheck.fits
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              {capacityCheck.fits ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    Cargo fits safely within <strong>{currentVehicle?.name}</strong> limits (max {currentVehicle?.payloadCapacityKg} kg / {currentVehicle?.palletCapacity} skids).
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    Cargo exceeds vehicle limits! Consider upgrading to a larger truck class.
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* 2. SELECT SERVICE */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              2. Choose Delivery Service
            </h4>
            <span className="text-[11px] text-slate-400">Speed & base delivery fee</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {activeServices.map(service => {
              const isSelected = service.id === (currentService?.id || '');
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => setSelectedServiceId(service.id)}
                  className={`p-3 text-left rounded-lg border transition-all relative ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{service.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                  </div>

                  {service.estimatedTime && (
                    <span
                      className={`inline-block text-[11px] px-1.5 py-0.5 rounded mt-1 ${
                        isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {service.estimatedTime}
                    </span>
                  )}

                  <div className="mt-2.5 flex items-baseline gap-2 text-xs">
                    <span className="font-semibold">
                      ${service.basePrice.toFixed(2)}
                    </span>
                    <span className={isSelected ? 'text-slate-300' : 'text-slate-500'}>
                      ({service.includedKm} km incl.)
                    </span>
                    <span className={isSelected ? 'text-slate-300' : 'text-slate-500'}>
                      +${service.perKmPrice.toFixed(2)}/km
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. DISTANCE (KM) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              3. Trip Distance
            </h4>
            <span className="text-[11px] text-slate-400">
              {currentService?.includedKm || 0} km included in base
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Navigation className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="number"
                min="0"
                step="1"
                value={distanceKm}
                onChange={(e) => setDistanceKm(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full text-base font-medium pl-9 pr-12 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <span className="absolute right-3.5 top-2.5 text-xs font-medium text-slate-400">km</span>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[5, 15, 30, 50].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDistanceKm(preset)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    distanceKm === preset
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {preset} km
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4. ACCESSORIAL CHARGES */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              4. Extra Accessorials
            </h4>
            <span className="text-[11px] text-slate-400">Check add-ons that apply</span>
          </div>

          {activeAccessorials.length === 0 ? (
            <p className="text-xs text-slate-500">No active accessorials configured.</p>
          ) : (
            <div className="space-y-2">
              {activeAccessorials.map(acc => {
                const state = selectedAccessorials[acc.id] || { checked: false, quantity: 1 };
                const isPerUnit = acc.pricingType === 'per_unit';

                return (
                  <div
                    key={acc.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                      state.checked
                        ? 'border-slate-800 bg-slate-50/90'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <label className="flex items-start gap-3 cursor-pointer select-none flex-1">
                      <input
                        type="checkbox"
                        checked={state.checked}
                        onChange={() => toggleAccessorial(acc.id)}
                        className="w-4 h-4 mt-0.5 rounded text-slate-900 focus:ring-slate-900 border-slate-300 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900">{acc.name}</span>
                          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            ${acc.price.toFixed(2)} {acc.unitLabel}
                          </span>
                        </div>
                        {acc.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm">
                            {acc.description}
                          </p>
                        )}
                      </div>
                    </label>

                    {/* Quantity counter for per-unit items */}
                    {isPerUnit && (
                      <div className="flex items-center gap-1.5 ml-3">
                        <button
                          type="button"
                          onClick={() => updateQuantity(acc.id, -1)}
                          className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-slate-800 w-6 text-center">
                          {state.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(acc.id, 1)}
                          className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors"
                        >
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
      </div>

      {/* RIGHT COLUMN: INSTANT QUOTE BREAKDOWN */}
      <div className="lg:col-span-5 sticky top-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header with big total */}
          <div className="p-6 bg-slate-900 text-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium tracking-wide uppercase text-slate-300">
                Calculated Total Quote
              </span>
              <button
                type="button"
                onClick={handleReset}
                title="Reset to defaults"
                className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-white">
                ${calculation.grandTotal.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400 font-medium">CAD</span>
            </div>

            <div className="mt-2 text-xs text-slate-300 flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-white">{currentVehicle?.name}</span>
              <span>•</span>
              <span className="font-medium text-white">{currentService?.name}</span>
              <span>•</span>
              <span>{distanceKm} km</span>
            </div>
          </div>

          {/* Itemized breakdown */}
          <div className="p-6 space-y-4">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
              Price Breakdown
            </h5>

            <div className="space-y-2.5 text-xs">
              {/* Service Base Fee */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-slate-800">Service Base Fee</span>
                  <p className="text-[11px] text-slate-500">
                    {currentService?.name} (includes {calculation.includedKm} km)
                  </p>
                </div>
                <span className="font-semibold text-slate-900">
                  ${calculation.serviceBaseFee.toFixed(2)}
                </span>
              </div>

              {/* Vehicle Type Upgrade */}
              {calculation.vehicleSurcharge > 0 && (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-800">Vehicle Upgrade</span>
                    <p className="text-[11px] text-slate-500">
                      {currentVehicle?.name} (capacity: {currentVehicle?.payloadCapacityKg} kg / {currentVehicle?.palletCapacity} skids)
                    </p>
                  </div>
                  <span className="font-semibold text-slate-900">
                    +${calculation.vehicleSurcharge.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Distance Charge */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-slate-800">Distance Charge</span>
                  <p className="text-[11px] text-slate-500">
                    {calculation.billableKm > 0 ? (
                      <>{calculation.billableKm} km @ ${currentService?.perKmPrice.toFixed(2)}/km</>
                    ) : (
                      'Within included distance allowance'
                    )}
                  </p>
                </div>
                <span className="font-semibold text-slate-900">
                  ${calculation.kmCharge.toFixed(2)}
                </span>
              </div>

              {/* Accessorials */}
              {calculation.accessorialItems.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Accessorial Add-ons:
                  </span>
                  {calculation.accessorialItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between pl-2">
                      <div className="text-slate-700">
                        <span>{item.name}</span>
                        {item.pricingType === 'per_unit' && (
                          <span className="text-slate-500 text-[11px] ml-1">
                            ({item.quantity} × ${item.unitPrice.toFixed(2)})
                          </span>
                        )}
                      </div>
                      <span className="font-medium text-slate-900">
                        +${item.subtotal.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total summary bar */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">Total Quote</span>
              <span className="text-base font-bold text-slate-900">
                ${calculation.grandTotal.toFixed(2)} CAD
              </span>
            </div>

            {/* Vehicle Specs Summary Badge */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-[11px] space-y-1">
              <div className="font-medium text-slate-700 flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-slate-500" />
                <span>Selected Vehicle Specs:</span>
              </div>
              <p className="text-slate-500">
                <strong>Payload:</strong> {currentVehicle?.payloadCapacityKg} kg (~{(Number(currentVehicle?.payloadCapacityKg || 0)/1000).toFixed(1)} Tonnes) • <strong>Pallets:</strong> {currentVehicle?.palletCapacity} skids
                {currentVehicle?.hasLiftgate ? ' • Liftgate Equipped' : ''}
                {currentVehicle?.requiresCommercialLicense ? ' • CDL Required' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
