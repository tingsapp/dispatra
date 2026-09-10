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
  const [newUnitNumber, setNewUnitNumber] = useState(`V${Math.floor(20 + Math.random() * 20)}`);
  const [newPlateNumber, setNewPlateNumber] = useState('BC FLT ');
  const [newVin, setNewVin] = useState('1FTBR1Y' + Math.random().toString(36).substring(2, 8).toUpperCase());
  const [newCategory, setNewCategory] = useState<VehicleAsset['category']>('1 Tonne Van');
  const [newMakeModel, setNewMakeModel] = useState('Ford Transit 350 High Roof');
  const [newYear, setNewYear] = useState(2024);
  const [newPayload, setNewPayload] = useState(1400);
  const [newPallets, setNewPallets] = useState(2);
  const [newHasLiftgate, setNewHasLiftgate] = useState(false);
  const [newHasReefer, setNewHasReefer] = useState(false);
  const [newFuelType, setNewFuelType] = useState<VehicleAsset['fuelType']>('Diesel');

  useEffect(() => {
    saveVehicles(vehicles);
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
        (v.currentDriverName && v.currentDriverName.toLowerCase().includes(q));

      const matchesCategory =
        categoryFilter === 'all' || v.category === categoryFilter;

      const matchesStatus =
        statusFilter === 'all' || v.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [vehicles, searchQuery, categoryFilter, statusFilter]);

  // Metrics
  const totalVehicles = vehicles.length;
  const inServiceCount = vehicles.filter((v) => v.status === 'in_service').length;
  const availableCount = vehicles.filter((v) => v.status === 'available').length;
  const maintenanceCount = vehicles.filter((v) => v.status === 'maintenance').length;
  const standbyCount = vehicles.filter((v) => v.status === 'standby').length;

  const handleToggleMaintenance = (vehicle: VehicleAsset) => {
    const nextStatus = vehicle.status === 'maintenance' ? 'available' : 'maintenance';
    const nextLabel = nextStatus === 'maintenance' ? 'In Maintenance / Shop' : 'Available / Staged';
    const updated = vehicles.map((v) =>
      v.id === vehicle.id ? { ...v, status: nextStatus as any, statusLabel: nextLabel } : v
    );
    setVehicles(updated);
    if (activeVehicleDrawer && activeVehicleDrawer.id === vehicle.id) {
      setActiveVehicleDrawer({ ...activeVehicleDrawer, status: nextStatus as any, statusLabel: nextLabel });
    }
    onNotification(`Updated vehicle ${vehicle.unitNumber} status to ${nextLabel}`);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitNumber || !newPlateNumber) {
      onNotification('Please enter unit number and plate number');
      return;
    }

    const newVehicle: VehicleAsset = {
      id: `veh-${Date.now()}`,
      unitNumber: newUnitNumber,
      plateNumber: newPlateNumber,
      vin: newVin,
      category: newCategory,
      makeModel: newMakeModel,
      year: Number(newYear),
      status: 'available',
      statusLabel: 'Available / Staged',
      fuelBatteryPercent: 100,
      fuelType: newFuelType,
      odometerKm: 12500,
      payloadCapacityKg: Number(newPayload),
      palletCapacity: Number(newPallets),
      hasLiftgate: newHasLiftgate,
      hasReefer: newHasReefer,
      lastInspectionDate: new Date().toISOString().slice(0, 10),
      nextServiceKm: 25000,
      notes: 'Newly registered commercial asset added to Vancouver fleet roster.'
    };

    setVehicles([newVehicle, ...vehicles]);
    setShowRegisterModal(false);
    setNewUnitNumber(`V${Math.floor(20 + Math.random() * 20)}`);
    setNewPlateNumber('BC FLT ');
    onNotification(`Registered new vehicle asset ${newVehicle.unitNumber} (${newVehicle.plateNumber})`);
  };

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
                Commercial vehicle inventory, tonnage classifications, liftgate & reefer equipment, and service inspections
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNotification('Fleet mechanical inspection report generated')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
            <span>Inspection Log</span>
          </button>
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
              <span>Standby Reserve</span>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{standbyCount}</div>
            <div className="mt-1 text-[11px] text-slate-500">Held back as spare capacity</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>Maintenance / Shop</span>
              <Wrench className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600">{maintenanceCount}</div>
            <div className="mt-1 text-[11px] text-slate-500">Out of service for repairs</div>
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
                { value: 'all', label: 'All Operational Statuses' },
                { value: 'in_service', label: 'In Service / En Route' },
                { value: 'available', label: 'Available / Staged' },
                { value: 'standby', label: 'Standby' },
                { value: 'maintenance', label: 'In Maintenance' }
              ]}
            />

            {/* Category Filter */}
            <Select
              aria-label="Filter by vehicle category"
              value={categoryFilter}
              onValueChange={setCategoryFilter}
              align="end"
              options={[
                { value: 'all', label: 'All Vehicle Categories' },
                { value: '1 Tonne Van', label: '1 Tonne Van' },
                { value: '2 Tonne Cube', label: '2 Tonne Cube' },
                { value: '3 Tonne Box', label: '3 Tonne Box' },
                { value: '5 Tonne Freight', label: '5 Tonne Freight' },
                { value: 'Refrigerated Reefer', label: 'Refrigerated Reefer' },
                { value: 'Flatbed', label: 'Flatbed' }
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
                          {vehicle.status === 'in_service'
                            ? 'In Service'
                            : vehicle.status === 'available'
                            ? 'Available'
                            : vehicle.status === 'maintenance'
                            ? 'In Shop'
                            : 'Standby'}
                        </span>
                      </div>

                      {/* Equipment Capabilities & Tonnage */}
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-800 rounded">
                          {vehicle.category}
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

                        {/* Fuel / Battery Bar */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-slate-500 flex items-center gap-1">
                              {vehicle.fuelType === 'Electric' ? (
                                <BatteryCharging className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Fuel className="w-3 h-3 text-slate-500" />
                              )}
                              {vehicle.fuelType}
                            </span>
                            <span className="font-bold text-slate-800">{vehicle.fuelBatteryPercent}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                vehicle.fuelBatteryPercent > 50
                                  ? 'bg-emerald-500'
                                  : vehicle.fuelBatteryPercent > 25
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${vehicle.fuelBatteryPercent}%` }}
                            />
                          </div>
                        </div>

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
                        Odometer: <strong>{vehicle.odometerKm.toLocaleString()} km</strong>
                      </span>
                      <button
                        onClick={() => handleToggleMaintenance(vehicle)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                      >
                        <Wrench className="w-3 h-3" />
                        {vehicle.status === 'maintenance' ? 'Exit Shop' : 'Service'}
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
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex justify-end animate-in fade-in duration-150">
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

            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {/* Asset Overview */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Specifications</div>
                <div className="text-sm font-bold text-slate-900">{activeVehicleDrawer.makeModel}</div>
                <div className="grid grid-cols-2 gap-2 text-slate-700 pt-1">
                  <div>
                    <span className="text-slate-400 text-[10px]">Model Year:</span>
                    <div className="font-semibold">{activeVehicleDrawer.year}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">VIN:</span>
                    <div className="font-mono text-[11px] font-semibold">{activeVehicleDrawer.vin}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Category Class:</span>
                    <div className="font-semibold">{activeVehicleDrawer.category}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Fuel Engine:</span>
                    <div className="font-semibold">{activeVehicleDrawer.fuelType}</div>
                  </div>
                </div>
              </div>

              {/* Cargo & Equipment Specs */}
              <div className="p-4 bg-white rounded-xl border border-slate-200/90 space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cargo & Capacity Ratings</div>
                <div className="grid grid-cols-2 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 text-[10px]">Payload Limit:</span>
                    <div className="text-sm font-bold text-slate-900">{activeVehicleDrawer.payloadCapacityKg.toLocaleString()} kg</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Pallet Deck Capacity:</span>
                    <div className="text-sm font-bold text-slate-900">{activeVehicleDrawer.palletCapacity} standard skids</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Hydraulic Liftgate:</span>
                    <div className="font-semibold">{activeVehicleDrawer.hasLiftgate ? 'Equipped (1000kg tuckunder)' : 'None'}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Temperature Control:</span>
                    <div className="font-semibold">
                      {activeVehicleDrawer.hasReefer
                        ? `Reefer Unit (${activeVehicleDrawer.reeferTempC !== undefined ? `${activeVehicleDrawer.reeferTempC}°C` : 'Multi-zone'})`
                        : 'Ambient / Dry Freight'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Service & Compliance */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Service & Compliance</div>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400 text-[10px]">Odometer:</span>
                    <div className="font-semibold">{activeVehicleDrawer.odometerKm.toLocaleString()} km</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Next Service Due:</span>
                    <div className="font-semibold">{activeVehicleDrawer.nextServiceKm.toLocaleString()} km</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Last CVIP Inspection:</span>
                    <div className="font-semibold">{activeVehicleDrawer.lastInspectionDate}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Current Driver:</span>
                    <div className="font-semibold">{activeVehicleDrawer.currentDriverName || 'None'}</div>
                  </div>
                </div>
                {activeVehicleDrawer.notes && (
                  <div className="pt-2 border-t border-slate-200 text-slate-600 text-[11px]">
                    <span className="text-slate-400 text-[10px] block">Fleet Notes:</span>
                    {activeVehicleDrawer.notes}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-white flex items-center gap-2">
              <button
                onClick={() => handleToggleMaintenance(activeVehicleDrawer)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                {activeVehicleDrawer.status === 'maintenance' ? 'Complete Maintenance & Release' : 'Send to Maintenance Shop'}
              </button>
              <button
                onClick={() => setActiveVehicleDrawer(null)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REGISTER VEHICLE MODAL */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
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

            <form onSubmit={handleRegisterSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit Number</label>
                  <input
                    type="text"
                    value={newUnitNumber}
                    onChange={(e) => setNewUnitNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">License Plate</label>
                  <input
                    type="text"
                    value={newPlateNumber}
                    onChange={(e) => setNewPlateNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 uppercase focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vehicle Category</label>
                  <Select
                    aria-label="Vehicle category"
                    className="w-full"
                    value={newCategory}
                    onValueChange={(v) => setNewCategory(v as any)}
                    options={[
                      { value: '1 Tonne Van', label: '1 Tonne Van (Sprinter/Transit)' },
                      { value: '2 Tonne Cube', label: '2 Tonne Cube Cutaway' },
                      { value: '3 Tonne Box', label: '3 Tonne Box Truck' },
                      { value: '5 Tonne Freight', label: '5 Tonne Freight Box' },
                      { value: 'Refrigerated Reefer', label: 'Refrigerated Reefer' },
                      { value: 'Flatbed', label: 'Flatbed' }
                    ]}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fuel Type</label>
                  <Select
                    aria-label="Fuel type"
                    className="w-full"
                    value={newFuelType}
                    onValueChange={(v) => setNewFuelType(v as any)}
                    options={[
                      { value: 'Diesel', label: 'Diesel' },
                      { value: 'Gasoline', label: 'Gasoline' },
                      { value: 'Electric', label: 'Electric (EV)' },
                      { value: 'Hybrid', label: 'Hybrid' }
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Make & Model</label>
                <input
                  type="text"
                  value={newMakeModel}
                  onChange={(e) => setNewMakeModel(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payload Capacity (kg)</label>
                  <input
                    type="number"
                    value={newPayload}
                    onChange={(e) => setNewPayload(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pallet Deck Capacity</label>
                  <input
                    type="number"
                    value={newPallets}
                    onChange={(e) => setNewPallets(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={newHasLiftgate}
                    onChange={(e) => setNewHasLiftgate(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 accent-slate-900 focus:ring-2 focus:ring-slate-900/20 cursor-pointer"
                  />
                  <span>Equipped with Liftgate</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={newHasReefer}
                    onChange={(e) => setNewHasReefer(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 accent-slate-900 focus:ring-2 focus:ring-slate-900/20 cursor-pointer"
                  />
                  <span>Reefer Temp Controlled</span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  Register Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
