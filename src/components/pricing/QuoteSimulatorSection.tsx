import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Play,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Plus,
  Trash2,
  Building2,
  Package,
  Layers,
  FileText,
  Truck,
  ArrowRight,
  Info
} from 'lucide-react';
import {
  OrganizationPricingSettings,
  QuoteCalculationRequest,
  SimulatorStop,
  SimulatorItem,
  QuoteCalculationResult
} from '../../types/pricing';
import { calculateDeliveryQuote } from '../../lib/pricingEngine';
import { VERIFICATION_SCENARIOS, VerificationScenario } from '../../lib/pricingScenarios';

interface QuoteSimulatorProps {
  settings: OrganizationPricingSettings;
  onNotification: (msg: string) => void;
}

export const QuoteSimulatorSection: React.FC<QuoteSimulatorProps> = ({
  settings,
  onNotification
}) => {
  // Simulator State initialized with Scenario 1
  const [request, setRequest] = useState<QuoteCalculationRequest>(
    VERIFICATION_SCENARIOS[0].request
  );
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(
    VERIFICATION_SCENARIOS[0].id
  );

  // Run calculation reactively whenever request or settings change
  const quoteResult: QuoteCalculationResult = useMemo(() => {
    return calculateDeliveryQuote(request, settings);
  }, [request, settings]);

  const handleSelectScenario = (scenarioId: string) => {
    setSelectedScenarioId(scenarioId);
    const scen = VERIFICATION_SCENARIOS.find((s) => s.id === scenarioId);
    if (scen) {
      setRequest(JSON.parse(JSON.stringify(scen.request)));
      onNotification(`Loaded verification scenario: "${scen.name}"`);
    }
  };

  const handleAddStop = () => {
    const newStop: SimulatorStop = {
      id: `stop_${Date.now()}`,
      stopType: 'dropoff',
      address: `Waypoint Stop #${request.stops.length + 1}, Vancouver`,
      stairFlights: 0,
      elevatorAvailable: true,
      itemFitsElevator: true,
      carryDistanceMeters: 10,
      hasLoadingDock: false
    };
    setRequest((prev) => ({
      ...prev,
      stops: [...prev.stops, newStop]
    }));
  };

  const handleRemoveStop = (stopId: string) => {
    if (request.stops.length <= 2) {
      onNotification('Delivery journey must have at least 1 pickup and 1 drop-off stop.');
      return;
    }
    setRequest((prev) => ({
      ...prev,
      stops: prev.stops.filter((s) => s.id !== stopId)
    }));
  };

  const updateStop = (stopId: string, field: keyof SimulatorStop, value: any) => {
    setRequest((prev) => ({
      ...prev,
      stops: prev.stops.map((s) => (s.id === stopId ? { ...s, [field]: value } : s))
    }));
  };

  const handleAddItem = () => {
    const newItem: SimulatorItem = {
      id: `item_${Date.now()}`,
      description: 'Standard Freight Carton',
      quantity: 1,
      weightKg: 20,
      lengthCm: 50,
      widthCm: 40,
      heightCm: 30,
      isFragile: false,
      isPallet: false,
      isNonStackable: false
    };
    setRequest((prev) => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const handleRemoveItem = (itemId: string) => {
    if (request.items.length <= 1) {
      onNotification('Shipment must contain at least one item.');
      return;
    }
    setRequest((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.id !== itemId)
    }));
  };

  const updateItem = (itemId: string, field: keyof SimulatorItem, value: any) => {
    setRequest((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === itemId ? { ...i, [field]: value } : i))
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Controls / Verification Scenario Selector */}
      <div className="p-4 rounded-xl bg-slate-900 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold">Live Quoting & Route Fare Simulator</h2>
            <span className="px-2 py-0.5 text-[10px] uppercase font-mono font-medium rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
              Interactive Preview Engine
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Simulate quotes across customer accounts, multi-stop trips, accessorial stair walk-ups, and elevator limits. Changes here do not publish to live settings.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs text-slate-400 font-medium">Verify Scenario:</label>
          <select
            value={selectedScenarioId}
            onChange={(e) => handleSelectScenario(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 text-white border border-slate-700 rounded-lg shadow-xs focus:ring-1 focus:ring-blue-400 max-w-xs"
          >
            {VERIFICATION_SCENARIOS.map((scen) => (
              <option key={scen.id} value={scen.id}>
                {scen.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Scenario explanation callout */}
      {(() => {
        const currentScen = VERIFICATION_SCENARIOS.find((s) => s.id === selectedScenarioId);
        if (!currentScen) return null;
        return (
          <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200/80 flex items-start gap-3 text-xs">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-blue-950 block">
                {currentScen.name}: <span className="font-normal text-blue-800">{currentScen.description}</span>
              </span>
              <p className="text-[11px] text-blue-700 mt-0.5">
                <strong>Expected Behavior:</strong> {currentScen.expectedBehavior}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Main Simulator Grid: Inputs (Left) and Itemized Quote Receipt (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: PARAMETERS & STOPS & ITEMS (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Card 1: Core Dispatch Parameters */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>1. Booking & Transport Parameters</span>
              <span className="text-[11px] font-normal text-slate-400">
                Mode: {request.pricingMode === 'dedicated_trip' ? 'Dedicated Multi-Stop Trip' : 'Individual Delivery'}
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Customer Account</label>
                <select
                  value={request.customerId || ''}
                  onChange={(e) => setRequest((prev) => ({ ...prev, customerId: e.target.value || undefined }))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900"
                >
                  <option value="">(No Customer - Organization Default)</option>
                  {settings.customerAgreements.map((c) => (
                    <option key={c.customerId} value={c.customerId}>
                      {c.customerName} ({c.discountPercentage}% off)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Service Speed</label>
                <select
                  value={request.serviceSpeedId}
                  onChange={(e) => setRequest((prev) => ({ ...prev, serviceSpeedId: e.target.value as any }))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900"
                >
                  {settings.serviceSpeeds.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Handling Level</label>
                <select
                  value={request.handlingLevelId}
                  onChange={(e) => setRequest((prev) => ({ ...prev, handlingLevelId: e.target.value as any }))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900"
                >
                  {settings.handlingLevels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Distance (km)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  value={request.distanceKm}
                  onChange={(e) => setRequest((prev) => ({ ...prev, distanceKm: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold border border-slate-200 rounded-lg text-right"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Duration (min)</label>
                <input
                  type="number"
                  step="5"
                  min="5"
                  value={request.durationMinutes}
                  onChange={(e) => setRequest((prev) => ({ ...prev, durationMinutes: parseInt(e.target.value) || 0 }))}
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold border border-slate-200 rounded-lg text-right"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Vehicle Class</label>
                <select
                  value={request.selectedVehicleId}
                  onChange={(e) => setRequest((prev) => ({ ...prev, selectedVehicleId: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {settings.vehicleTypes.map((v) => (
                    <option key={v.vehicleId} value={v.vehicleId}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Crew Size</label>
                <select
                  value={request.crewType}
                  onChange={(e) => setRequest((prev) => ({ ...prev, crewType: e.target.value as any }))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value="driver_only">Driver Only</option>
                  <option value="two_person">Two-Person Crew</option>
                </select>
              </div>
            </div>

            {/* Quick Surcharges & Manual Price Lock */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={request.requiresTailLift}
                  onChange={(e) => setRequest((prev) => ({ ...prev, requiresTailLift: e.target.checked }))}
                  className="rounded text-blue-600"
                />
                <span className="text-slate-700">Tail Lift</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={request.isNarrowWindow}
                  onChange={(e) => setRequest((prev) => ({ ...prev, isNarrowWindow: e.target.checked }))}
                  className="rounded text-blue-600"
                />
                <span className="text-slate-700">Narrow Window (≤1h)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={request.isAfterHours}
                  onChange={(e) => setRequest((prev) => ({ ...prev, isAfterHours: e.target.checked }))}
                  className="rounded text-blue-600"
                />
                <span className="text-slate-700">After Hours (20:00-06:00)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={request.isWeekend}
                  onChange={(e) => setRequest((prev) => ({ ...prev, isWeekend: e.target.checked }))}
                  className="rounded text-blue-600"
                />
                <span className="text-slate-700">Weekend</span>
              </label>

              {/* Locked Manual Price Override Input */}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" /> Locked Manual Price:
                </span>
                <input
                  type="number"
                  placeholder="None"
                  value={request.manualLockedPrice !== undefined ? request.manualLockedPrice : ''}
                  onChange={(e) =>
                    setRequest((prev) => ({
                      ...prev,
                      manualLockedPrice: e.target.value ? parseFloat(e.target.value) : undefined
                    }))
                  }
                  className="w-20 px-2 py-1 text-xs font-mono font-semibold text-right border border-slate-200 rounded bg-white text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Multi-Stop Access Points (Pickups & Drop-offs) */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                2. Stops & Site Access Handling ({request.stops.length})
              </h3>
              <button
                type="button"
                onClick={handleAddStop}
                className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Stop
              </button>
            </div>

            <div className="space-y-3">
              {request.stops.map((stop, idx) => (
                <div
                  key={stop.id}
                  className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded ${
                          stop.stopType === 'pickup'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {stop.stopType} #{idx + 1}
                      </span>
                      <input
                        type="text"
                        value={stop.address}
                        onChange={(e) => updateStop(stop.id, 'address', e.target.value)}
                        className="w-64 px-2 py-0.5 text-xs font-medium border border-slate-200 rounded bg-white"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveStop(stop.id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                      title="Remove stop"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Stair Flights</label>
                      <input
                        type="number"
                        min="0"
                        value={stop.stairFlights}
                        onChange={(e) => updateStop(stop.id, 'stairFlights', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-xs font-mono font-semibold border border-slate-200 rounded bg-white text-right"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Elevator Available?</label>
                      <select
                        value={stop.elevatorAvailable ? 'yes' : 'no'}
                        onChange={(e) => updateStop(stop.id, 'elevatorAvailable', e.target.value === 'yes')}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Cargo Fits Elevator?</label>
                      <select
                        value={stop.itemFitsElevator ? 'yes' : 'no'}
                        onChange={(e) => updateStop(stop.id, 'itemFitsElevator', e.target.value === 'yes')}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                      >
                        <option value="yes">Fits Cab</option>
                        <option value="no">Too Large (Stairs Required)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Loading Dock?</label>
                      <select
                        value={stop.hasLoadingDock ? 'yes' : 'no'}
                        onChange={(e) => updateStop(stop.id, 'hasLoadingDock', e.target.value === 'yes')}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                      >
                        <option value="yes">Freight Dock Available</option>
                        <option value="no">Street / Ground</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Cargo Manifest & Items */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                3. Cargo Manifest & Weight/Dimensions ({request.items.length})
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Cargo Item
              </button>
            </div>

            <div className="space-y-3">
              {request.items.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      className="w-64 px-2 py-0.5 text-xs font-semibold border border-slate-200 rounded bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Quantity</span>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1 text-xs font-mono font-semibold border border-slate-200 rounded bg-white text-right"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block">Weight (kg/ea)</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0.1"
                        value={item.weightKg}
                        onChange={(e) => updateItem(item.id, 'weightKg', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-xs font-mono font-semibold border border-slate-200 rounded bg-white text-right"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block">Length (cm)</span>
                      <input
                        type="number"
                        value={item.lengthCm}
                        onChange={(e) => updateItem(item.id, 'lengthCm', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-xs font-mono border border-slate-200 rounded bg-white text-right"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block">Width (cm)</span>
                      <input
                        type="number"
                        value={item.widthCm}
                        onChange={(e) => updateItem(item.id, 'widthCm', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-xs font-mono border border-slate-200 rounded bg-white text-right"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block">Height (cm)</span>
                      <input
                        type="number"
                        value={item.heightCm}
                        onChange={(e) => updateItem(item.id, 'heightCm', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-xs font-mono border border-slate-200 rounded bg-white text-right"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.isFragile}
                        onChange={(e) => updateItem(item.id, 'isFragile', e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span className="text-slate-600 text-[11px]">Fragile</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.isPallet}
                        onChange={(e) => updateItem(item.id, 'isPallet', e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span className="text-slate-600 text-[11px]">Palletized</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.isNonStackable}
                        onChange={(e) => updateItem(item.id, 'isNonStackable', e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span className="text-slate-600 text-[11px]">Non-Stackable</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ITEMIZED QUOTE RECEIPT & CALCULATION AUDIT (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Main Price Receipt Card */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-md space-y-4 sticky top-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Itemized Quotation Breakdown
                </span>
                <h3 className="text-sm font-semibold text-slate-900">
                  {quoteResult.rateCardUsed.name}
                </h3>
              </div>
              <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                v{quoteResult.rateCardUsed.version}
              </span>
            </div>

            {/* Warning Banner if Manual Review Required */}
            {quoteResult.isManualReviewRequired && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Cannot Quote Automated: Manual Review Required</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-amber-800 text-[11px] leading-relaxed">
                  {quoteResult.manualReviewReasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Locked Manual Price Callout */}
            {quoteResult.isLockedManualPrice && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Locked manual agreement preserved; formula calculations bypassed.</span>
              </div>
            )}

            {/* Itemized Line Items List */}
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
              {quoteResult.lineItems.map((item, idx) => (
                <div key={idx} className="py-2 flex items-start justify-between gap-2 text-xs">
                  <div>
                    <div className="font-medium text-slate-800">{item.name}</div>
                    <div className="text-[11px] text-slate-400 leading-tight">{item.description}</div>
                  </div>
                  <span
                    className={`font-mono font-semibold shrink-0 ${
                      item.amount < 0 ? 'text-emerald-600' : 'text-slate-900'
                    }`}
                  >
                    {item.amount < 0 ? '-' : ''}${Math.abs(item.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Subtotal, Tax and Grand Total */}
            <div className="pt-3 border-t-2 border-slate-100 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Net Subtotal</span>
                <span className="font-mono font-semibold">${quoteResult.subtotal.toFixed(2)}</span>
              </div>

              {quoteResult.appliedDiscounts > 0 && (
                <div className="flex items-center justify-between text-emerald-600">
                  <span>Applied Contract Discounts</span>
                  <span className="font-mono font-semibold">-${quoteResult.appliedDiscounts.toFixed(2)}</span>
                </div>
              )}

              {quoteResult.minimumChargeAdjustment > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>Minimum Floor Adjustment</span>
                  <span className="font-mono font-semibold">+${quoteResult.minimumChargeAdjustment.toFixed(2)}</span>
                </div>
              )}

              {quoteResult.fuelSurchargeAmount > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>Fuel Index Surcharge</span>
                  <span className="font-mono font-semibold">+${quoteResult.fuelSurchargeAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-slate-600">
                <span>BC GST (5%)</span>
                <span className="font-mono font-semibold">${quoteResult.taxAmount.toFixed(2)}</span>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-baseline justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900">Total Customer Charge</span>
                  <span className="text-[11px] text-slate-400 block font-normal">All handling & fuel included</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold font-mono text-slate-900">
                    ${quoteResult.total.toFixed(2)}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 ml-1">
                    {quoteResult.currency}
                  </span>
                </div>
              </div>
            </div>

            {/* Calculation Audit Log */}
            <div className="pt-3 border-t border-slate-100">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                Deterministic Calculation Audit
              </span>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1 text-[11px] font-mono text-slate-600 max-h-40 overflow-y-auto">
                {quoteResult.calculationOrderBreakdown.map((step, idx) => (
                  <div key={idx} className="leading-snug">
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
