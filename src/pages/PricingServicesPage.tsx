import React, { useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Check,
  RotateCcw,
  Truck,
  Layers,
  Calculator,
  Clock,
  Weight,
  Package,
  ShieldAlert,
  Ruler,
  Tag
} from 'lucide-react';
import { DeliveryService, VehicleType, AccessorialItem, SimplePricingConfig } from '../types/simplePricing';
import {
  loadSimplePricingConfig,
  saveSimplePricingConfig,
  resetSimplePricingConfig
} from '../lib/simplePricingStorage';
import { ServiceModal } from '../components/pricing/ServiceModal';
import { VehicleModal } from '../components/pricing/VehicleModal';
import { AccessorialModal } from '../components/pricing/AccessorialModal';

interface PricingServicesPageProps {
  onBackToMonitor: () => void;
  onOpenSimulator?: () => void;
  onNotification?: (msg: string) => void;
}

type ActiveTab = 'services' | 'vehicles' | 'accessorials';

export const PricingServicesPage: React.FC<PricingServicesPageProps> = ({
  onBackToMonitor,
  onOpenSimulator,
  onNotification
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('services');
  const [config, setConfig] = useState<SimplePricingConfig>(() => loadSimplePricingConfig());

  // Modal States
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<DeliveryService | null>(null);

  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleType | null>(null);

  const [isAccessorialModalOpen, setIsAccessorialModalOpen] = useState(false);
  const [editingAccessorial, setEditingAccessorial] = useState<AccessorialItem | null>(null);

  // Sync to storage on change
  const updateConfig = (newConfig: SimplePricingConfig) => {
    setConfig(newConfig);
    saveSimplePricingConfig(newConfig);
  };

  // SERVICES CRUD
  const handleSaveService = (service: DeliveryService) => {
    const exists = config.services.some(s => s.id === service.id);
    let updatedServices: DeliveryService[];
    if (exists) {
      updatedServices = config.services.map(s => (s.id === service.id ? service : s));
      onNotification?.(`Updated service "${service.name}"`);
    } else {
      updatedServices = [...config.services, service];
      onNotification?.(`Added service "${service.name}"`);
    }
    updateConfig({ ...config, services: updatedServices });
  };

  const handleDeleteService = (id: string) => {
    const target = config.services.find(s => s.id === id);
    if (!target) return;
    if (config.services.length <= 1) {
      onNotification?.('At least one delivery service is required.');
      return;
    }
    const updated = config.services.filter(s => s.id !== id);
    updateConfig({ ...config, services: updated });
    onNotification?.(`Deleted service "${target.name}"`);
  };

  const handleToggleServiceActive = (id: string) => {
    const updated = config.services.map(s =>
      s.id === id ? { ...s, active: !s.active } : s
    );
    updateConfig({ ...config, services: updated });
  };

  // VEHICLES CRUD
  const handleSaveVehicle = (vehicle: VehicleType) => {
    const exists = config.vehicles.some(v => v.id === vehicle.id);
    let updatedVehicles: VehicleType[];
    if (exists) {
      updatedVehicles = config.vehicles.map(v => (v.id === vehicle.id ? vehicle : v));
      onNotification?.(`Updated vehicle "${vehicle.name}"`);
    } else {
      updatedVehicles = [...config.vehicles, vehicle];
      onNotification?.(`Added vehicle "${vehicle.name}"`);
    }
    updateConfig({ ...config, vehicles: updatedVehicles });
  };

  const handleDeleteVehicle = (id: string) => {
    const target = config.vehicles.find(v => v.id === id);
    if (!target) return;
    if (config.vehicles.length <= 1) {
      onNotification?.('At least one vehicle type is required.');
      return;
    }
    const updated = config.vehicles.filter(v => v.id !== id);
    updateConfig({ ...config, vehicles: updated });
    onNotification?.(`Deleted vehicle "${target.name}"`);
  };

  const handleToggleVehicleActive = (id: string) => {
    const updated = config.vehicles.map(v =>
      v.id === id ? { ...v, active: !v.active } : v
    );
    updateConfig({ ...config, vehicles: updated });
  };

  // ACCESSORIALS CRUD
  const handleSaveAccessorial = (accessorial: AccessorialItem) => {
    const exists = config.accessorials.some(a => a.id === accessorial.id);
    let updatedAccessorials: AccessorialItem[];
    if (exists) {
      updatedAccessorials = config.accessorials.map(a => (a.id === accessorial.id ? accessorial : a));
      onNotification?.(`Updated accessorial "${accessorial.name}"`);
    } else {
      updatedAccessorials = [...config.accessorials, accessorial];
      onNotification?.(`Added accessorial "${accessorial.name}"`);
    }
    updateConfig({ ...config, accessorials: updatedAccessorials });
  };

  const handleDeleteAccessorial = (id: string) => {
    const target = config.accessorials.find(a => a.id === id);
    if (!target) return;
    const updated = config.accessorials.filter(a => a.id !== id);
    updateConfig({ ...config, accessorials: updated });
    onNotification?.(`Deleted accessorial "${target.name}"`);
  };

  const handleToggleAccessorialActive = (id: string) => {
    const updated = config.accessorials.map(a =>
      a.id === id ? { ...a, active: !a.active } : a
    );
    updateConfig({ ...config, accessorials: updated });
  };

  // RESET DEFAULTS
  const handleReset = () => {
    const defaults = resetSimplePricingConfig();
    setConfig(defaults);
    onNotification?.('Reset pricing, vehicles, and accessorials to standard defaults');
  };

  return (
    <div className="h-full w-full bg-slate-50 flex flex-col overflow-hidden font-sans">
      {/* HEADER BAR */}
      <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBackToMonitor}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
            title="Return to Monitor Map"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Back to Monitor</span>
          </button>

          <div className="h-4 w-px bg-slate-200" />

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-tight">
                Services & Accessorials
              </h1>
              <p className="text-[11px] text-slate-500 leading-tight">
                Manage delivery services, vehicle fleet capacities, and accessorial surcharges.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onOpenSimulator && (
            <button
              type="button"
              onClick={onOpenSimulator}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
            >
              <Calculator className="w-3.5 h-3.5 text-slate-500" />
              <span>Open Pricing Simulator</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </header>

      {/* SUB-NAVIGATION TABS */}
      <div className="h-12 bg-white border-b border-slate-200/90 px-6 flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('services')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'services'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>1. Services</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'services' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {config.services.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vehicles')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'vehicles'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>2. Vehicles & Capacities</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'vehicles' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {config.vehicles.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('accessorials')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'accessorials'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>3. Accessorials</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'accessorials' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {config.accessorials.length}
            </span>
          </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* TAB 1: SERVICES */}
        {activeTab === 'services' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Delivery Services
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Delivery options available to customers, each with its base fee, included distance, and per-km rate.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingService(null);
                  setIsServiceModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Service</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {config.services.map(service => (
                <div
                  key={service.id}
                  className={`bg-white rounded-xl border p-5 transition-all shadow-2xs ${
                    service.active ? 'border-slate-200' : 'border-slate-200/60 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {service.name}
                        </h3>
                        {!service.active && (
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      {service.estimatedTime && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{service.estimatedTime}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingService(service);
                          setIsServiceModalOpen(true);
                        }}
                        title="Edit Service"
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteService(service.id)}
                        title="Delete Service"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Pricing metrics */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px] block">Base Fee</span>
                      <span className="font-semibold text-slate-800 text-sm">
                        ${service.basePrice.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] block">Included Distance</span>
                      <span className="font-semibold text-slate-800">
                        {service.includedKm} km
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] block">After Allowance</span>
                      <span className="font-semibold text-slate-800">
                        ${service.perKmPrice.toFixed(2)} / km
                      </span>
                    </div>
                  </div>

                  {service.description && (
                    <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
                      {service.description}
                    </p>
                  )}

                  {/* Active toggle */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500">
                      {service.active ? 'Available for bookings' : 'Hidden from booking'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleServiceActive(service.id)}
                      className={`text-[11px] font-medium px-2 py-1 rounded transition-colors ${
                        service.active
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {service.active ? 'Active' : 'Enable'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: VEHICLES & CAPACITIES */}
        {activeTab === 'vehicles' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Vehicle Types & Fleet Capacities
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure payload ratings (1 Tonne, 2 Tonnes, 3 Tonnes, etc.), pallet capacities, bed lengths, and upgrade surcharges.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingVehicle(null);
                  setIsVehicleModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Vehicle Type</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {config.vehicles.map(vehicle => (
                <div
                  key={vehicle.id}
                  className={`bg-white rounded-xl border p-5 transition-all shadow-2xs flex flex-col justify-between ${
                    vehicle.active ? 'border-slate-200' : 'border-slate-200/60 opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900">
                            {vehicle.name}
                          </h3>
                          {!vehicle.active && (
                            <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                          {vehicle.baseSurcharge > 0 ? (
                            <span className="text-slate-900 font-semibold">+${vehicle.baseSurcharge.toFixed(2)} Vehicle Surcharge</span>
                          ) : (
                            <span className="text-slate-500">$0.00 Standard Base</span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVehicle(vehicle);
                            setIsVehicleModalOpen(true);
                          }}
                          title="Edit Vehicle"
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteVehicle(vehicle.id)}
                          title="Delete Vehicle"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Capacity Grid */}
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 text-[11px] block">Max Payload</span>
                        <span className="font-semibold text-slate-800 text-sm">
                          {vehicle.payloadCapacityKg.toLocaleString()} kg
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          ≈ {(vehicle.payloadCapacityKg / 1000).toFixed(1)} Tonnes
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[11px] block">Pallet Limit</span>
                        <span className="font-semibold text-slate-800 text-sm">
                          {vehicle.palletCapacity} skids
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          40″ × 48″
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[11px] block">Cargo Bed</span>
                        <span className="font-semibold text-slate-800 text-sm">
                          {vehicle.cargoBedFeet ? `${vehicle.cargoBedFeet} ft` : 'Standard'}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          Floor length
                        </span>
                      </div>
                    </div>

                    {/* Equipment & Requirements badges */}
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                      {vehicle.hasLiftgate && (
                        <span className="text-[11px] font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200/60">
                          Power Liftgate
                        </span>
                      )}
                      {vehicle.requiresCommercialLicense && (
                        <span className="text-[11px] font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200/60">
                          CDL / Air Brakes
                        </span>
                      )}
                      {!vehicle.hasLiftgate && !vehicle.requiresCommercialLicense && (
                        <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          Standard Commercial Driver
                        </span>
                      )}
                    </div>

                    {vehicle.description && (
                      <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                        {vehicle.description}
                      </p>
                    )}
                  </div>

                  {/* Active toggle */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500">
                      {vehicle.active ? 'Active in fleet' : 'Inactive'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleVehicleActive(vehicle.id)}
                      className={`text-[11px] font-medium px-2 py-1 rounded transition-colors ${
                        vehicle.active
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {vehicle.active ? 'Active' : 'Enable'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: ACCESSORIALS */}
        {activeTab === 'accessorials' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Accessorial Surcharges & Add-ons
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Extra fees applied for stairs, second crew helpers, liftgate equipment, detention, or inside delivery.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingAccessorial(null);
                  setIsAccessorialModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Accessorial</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {config.accessorials.map(acc => (
                <div
                  key={acc.id}
                  className={`bg-white rounded-xl border p-5 transition-all shadow-2xs flex flex-col justify-between ${
                    acc.active ? 'border-slate-200' : 'border-slate-200/60 opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {acc.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-base font-bold text-slate-900">
                            ${acc.price.toFixed(2)}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {acc.unitLabel}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAccessorial(acc);
                            setIsAccessorialModalOpen(true);
                          }}
                          title="Edit Accessorial"
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAccessorial(acc.id)}
                          title="Delete Accessorial"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                      {acc.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500">
                      {acc.pricingType === 'flat' ? 'Fixed fee' : 'Unit-based'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleAccessorialActive(acc.id)}
                      className={`text-[11px] font-medium px-2 py-1 rounded transition-colors ${
                        acc.active
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {acc.active ? 'Active' : 'Enable'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      <ServiceModal
        isOpen={isServiceModalOpen}
        onClose={() => {
          setIsServiceModalOpen(false);
          setEditingService(null);
        }}
        onSave={handleSaveService}
        initialService={editingService}
      />

      <VehicleModal
        isOpen={isVehicleModalOpen}
        onClose={() => {
          setIsVehicleModalOpen(false);
          setEditingVehicle(null);
        }}
        onSave={handleSaveVehicle}
        initialVehicle={editingVehicle}
      />

      <AccessorialModal
        isOpen={isAccessorialModalOpen}
        onClose={() => {
          setIsAccessorialModalOpen(false);
          setEditingAccessorial(null);
        }}
        onSave={handleSaveAccessorial}
        initialAccessorial={editingAccessorial}
      />
    </div>
  );
};
