import {
CheckCircle2,
Gauge,
Layers,
Plus,
Truck,
Wrench,
X
} from 'lucide-react';
import { useEffect,useMemo,useState } from 'react';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import { VehicleEditor } from '../components/entities/VehicleEditor';
import { VehicleTable } from '../components/entities/VehicleTable';
import { PageHeader } from '../components/layout/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Select';
import { loadSimplePricingConfig } from '../lib/simplePricingStorage';
import { VehicleAsset,loadVehicles,saveVehicles } from '../lib/vehicleStorage';
import { Driver } from '../types';

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
  const vehicleTypes = useMemo(() => loadSimplePricingConfig().vehicles, []);
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
      <PageHeader title="Vehicles" description="Vehicle availability, cargo capacity, dimensions and equipment." onBackToMonitor={onBackToMonitor} actions={<>
          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Vehicle</span>
          </button>
      </>} />

      {/* BODY CONTENT */}
      <div className="page-content flex-1 overflow-y-auto py-6 space-y-6">
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
            <VehicleTable vehicles={filteredVehicles} drivers={drivers} vehicleTypes={vehicleTypes} onDetails={setActiveVehicleDrawer} />
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
