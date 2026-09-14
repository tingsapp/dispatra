import { useEntityDialog } from '../components/entities/useEntityDialog';
import { VehicleEditor } from '../components/entities/VehicleEditor';
import { loadSimplePricingConfig } from '../lib/simplePricingStorage';
import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  Truck,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Fuel,
  BatteryCharging,
  ShieldAlert,
  Snowflake,
  ExternalLink,
  ChevronRight,
  X,
  Layers,
  Calendar,
  Gauge,
  User,
  MapPin,
  Check,
  RotateCcw
} from 'lucide-react';
import { VehicleAsset, loadVehicles, saveVehicles } from '../lib/vehicleStorage';
import { Driver } from '../types';
import { Select } from '../components/ui/Select';
import { SearchInput } from '../components/ui/SearchInput';

interface VehiclesPageProps {
  drivers: Driver[];
  onBackToMonitor: () => void;
  onNotification: (message: string) => void;
  onSelectDriver?: (driverId: string) => void;
}

export function VehiclesPage({
  drivers,
  onBackToMonitor,
  onNotification,
  onSelectDriver
}: VehiclesPageProps) {
  const [vehicles, setVehicles] = useState<VehicleAsset[]>(loadVehicles);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Slide-over drawer
  const [activeVehicleDrawer, setActiveVehicleDrawer] = useState<VehicleAsset | null>(null);

  // Register Vehicle Modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  useEffect(() => {
    try { saveVehicles(vehicles); } catch { onNotification('Vehicle changes could not be saved in this browser.'); }
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        v.unitNumber.toLowerCase().includes(q) ||
        v.plateNumber.toLowerCase().includes(q) ||
        v.makeModel.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        (v.currentDriverName && v.currentDriverName.toLowerCase().includes(q)) || [...(v.equipment ?? []), ...(v.serviceAreaIds ?? [])].join(' ').toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === 'all' || v.vehicleTypeId === categoryFilter;

      const matchesStatus =
        statusFilter === 'all' || v.availability === statusFilter || v.recordStatus === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [vehicles, searchQuery, categoryFilter, statusFilter]);

  // Metrics
  const totalVehicles = vehicles.length;
  const inServiceCount = vehicles.filter((v) => v.status === 'in_service').length;
  const availableCount = vehicles.filter((v) => v.status === 'available').length;
  const maintenanceCount = vehicles.filter(v => v.availability === 'UNAVAILABLE').length;
  const standbyCount = vehicles.filter(v => v.recordStatus === 'INACTIVE').length;

  const handleSaveVehicle = (vehicle: VehicleAsset) => {
    const next = vehicles.some(v => v.id === vehicle.id) ? vehicles.map(v => v.id === vehicle.id ? vehicle : v) : [vehicle, ...vehicles];
    setVehicles(next); setActiveVehicleDrawer(null); setShowRegisterModal(false); onNotification('Vehicle saved');
  };
  useEntityDialog(!!activeVehicleDrawer || showRegisterModal, () => { setActiveVehicleDrawer(null); setShowRegisterModal(false); });

  return (
    <div className="h-full w-full bg-slate-50 flex flex-col overflow-hidden font-sans">
      {/* HEADER BAR */}
      <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button
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
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-tight">
                Vehicles & Fleet Assets
              </h1>
              <p className="text-[11px] text-slate-500 leading-tight">
                Vehicle availability, cargo capacity, dimensions and equipment
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Vehicle</span>
          </button>
        </div>
      </header>

      {/* BODY CONTENT */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* STATS OVERVIEW CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>Total Fleet Assets</span>
              <Truck className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{totalVehicles}</div>
            <div className="mt-1 text-[11px] text-slate-500">Registered commercial units</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>In Service</span>
              <Gauge className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-blue-600">{inServiceCount}</div>
            <div className="mt-1 text-[11px] text-slate-500">Assigned and out on route</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>Available / Staged</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">{availableCount}</div>
            <div className="mt-1 text-[11px] text-slate-500">Ready for immediate dispatch</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>Inactive records</span>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{standbyCount}</div>
            <div className="mt-1 text-[11px] text-slate-500">Inactive fleet records</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>Unavailable</span>
              <Wrench className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600">{maintenanceCount}</div>
            <div className="mt-1 text-[11px] text-slate-500">Temporarily unavailable for dispatch</div>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search vehicles by unit #, plate, model, or driver..."
          />

          <div className="flex items-center gap-2">
            {/* Status Filter */}
            <Select
              aria-label="Filter by operational status"
              value={statusFilter}
              onValueChange={setStatusFilter}
              align="end"
              options={[
                { value: 'all', label: 'All statuses' }, { value: 'AVAILABLE', label: 'Available' }, { value: 'IN_USE', label: 'In use' }, { value: 'UNAVAILABLE', label: 'Unavailable' }, { value: 'INACTIVE', label: 'Inactive' }
              ]}
            />

            {/* Category Filter */}
            <Select
              aria-label="Filter by vehicle category"
              value={categoryFilter}
              onValueChange={setCategoryFilter}
              align="end"
              options={[
                { value: 'all', label: 'All vehicle types' }, ...loadSimplePricingConfig().vehicles.map(v => ({ value: v.id, label: v.name }))
              ]}
            />
          </div>
        </div>

        {/* VEHICLES GRID */}
        <div>
          {filteredVehicles.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200/90 shadow-2xs">
              <Truck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-800">No vehicles match your filter</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Adjust search query or reset status filters.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                }}
                className="mt-4 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVehicles.map((vehicle) => {
                const assignedDriver = drivers.find((d) => d.id === vehicle.currentDriverId);

                return (
                  <div
                    key={vehicle.id}
                    onClick={() => setActiveVehicleDrawer(vehicle)}
                    className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-slate-900 font-mono">
                              {vehicle.unitNumber}
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              {vehicle.plateNumber}
                            </span>
                          </div>
                          <div className="text-xs font-medium text-slate-700 mt-1">
                            {vehicle.makeModel} ({vehicle.year})
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                            vehicle.status === 'in_service'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : vehicle.status === 'available'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : vehicle.status === 'maintenance'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          {vehicle.recordStatus === 'INACTIVE' ? 'Inactive' : vehicle.availability?.replaceAll('_', ' ') || vehicle.statusLabel}
                        </span>
                      </div>

                      {/* Equipment Capabilities & Tonnage */}
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-800 rounded">
                          {loadSimplePricingConfig().vehicles.find(t => t.id === vehicle.vehicleTypeId)?.name || vehicle.category}
                        </span>
                        {vehicle.hasLiftgate && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-50 text-purple-700 rounded flex items-center gap-1">
                            <Layers className="w-3 h-3" /> Liftgate
                          </span>
                        )}
                        {vehicle.hasReefer && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-cyan-50 text-cyan-700 rounded flex items-center gap-1">
                            <Snowflake className="w-3 h-3" /> Reefer {vehicle.reeferTempC !== undefined ? `(${vehicle.reeferTempC}°C)` : ''}
                          </span>
                        )}
                      </div>

                      {/* Capacity & Fuel specs */}
                      <div className="mt-3 p-3 bg-slate-50 rounded-lg space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2 text-slate-600">
                          <div>
                            <span className="text-slate-400 text-[10px] block">Max Payload:</span>
                            <span className="font-semibold text-slate-800">{vehicle.payloadCapacityKg.toLocaleString()} kg</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">Pallet Skids:</span>
                            <span className="font-semibold text-slate-800">{vehicle.palletCapacity} standard skids</span>
                          </div>
                        </div>

                        <div className="text-xs text-slate-600">Cargo: {vehicle.cargoVolumeM3 == null ? 'volume not set' : `${vehicle.cargoVolumeM3} m³`}<br />Dimensions: {[vehicle.cargoLengthCm, vehicle.cargoWidthCm, vehicle.cargoHeightCm].every(v => v != null) ? `${vehicle.cargoLengthCm} × ${vehicle.cargoWidthCm} × ${vehicle.cargoHeightCm} cm` : 'Not set'}<br />Equipment: {vehicle.equipment?.join(', ') || 'None recorded'}</div>
                        {/* Assigned Driver & Location */}
                        <div className="pt-2 border-t border-slate-200 text-[11px]">
                          <div className="text-slate-500">
                            Assigned Driver:{' '}
                            <strong className="text-slate-800">
                              {vehicle.currentDriverName || 'Unassigned / Yard'}
                            </strong>
                          </div>
                          {vehicle.currentLocation && (
                            <div className="text-slate-400 truncate mt-0.5">
                              {vehicle.currentLocation}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs" onClick={(e) => e.stopPropagation()}>
                      <span className="text-slate-400 text-[11px]">
                        {vehicle.serviceAreaIds?.join(', ') || 'Service area not set'}
                      </span>
                      <button
                        onClick={() => setActiveVehicleDrawer(vehicle)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                      >
                        <Wrench className="w-3 h-3" />
                        Edit vehicle
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* VEHICLE DOSSIER SLIDE-OVER DRAWER */}
      {activeVehicleDrawer && (
        <div data-entity-dialog className="fixed inset-0 bg-slate-900/40 z-50 flex justify-end animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-slate-900 font-mono">
                  {activeVehicleDrawer.unitNumber}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-200 text-slate-800 rounded">
                  {activeVehicleDrawer.plateNumber}
                </span>
              </div>
              <button
                onClick={() => setActiveVehicleDrawer(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5"><VehicleEditor vehicle={activeVehicleDrawer} vehicles={vehicles} onCancel={() => setActiveVehicleDrawer(null)} onSave={handleSaveVehicle} /></div>
          </div>
        </div>
      )}

      {/* REGISTER VEHICLE MODAL */}
      {showRegisterModal && (
        <div data-entity-dialog className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Register Vehicle Asset</h3>
                <p className="text-xs text-slate-500">Add a new commercial vehicle to the Metro Vancouver fleet</p>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5"><VehicleEditor vehicles={vehicles} onCancel={() => setShowRegisterModal(false)} onSave={handleSaveVehicle} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
