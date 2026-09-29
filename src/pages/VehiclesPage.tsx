import { ListSummary } from '../components/layout/ListSummary';
import { Button } from '../components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../components/ui/Dialog';
import {
Route,
CircleCheck,
CirclePause,
Wrench,
Plus,
Truck
} from 'lucide-react';
import { useMemo,useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { companySlugForCurrentPath } from '../lib/pageRoutes';
import { allOperations, operations } from '../operations/api';
import { catalogToVehicleType, vehicleFromUi, vehicleToUi } from '../operations/adapters';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import { confirmDialog } from '../components/ui/ConfirmDialog';
import { VehicleEditor } from '../components/entities/VehicleEditor';
import { VehicleTable } from '../components/entities/VehicleTable';
import { PageHeader } from '../components/layout/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Select';
import { loadSimplePricingConfig } from '../lib/simplePricingStorage';
import { VehicleAsset,loadVehicles,saveVehicles,saveVehicleProfile,archiveVehicleProfile,type VehicleProfile } from '../lib/vehicleStorage';
import { Driver } from '../types';

interface VehiclesPageProps {
  drivers: Driver[];
  onNotification: (message: string) => void;
  onSelectDriver?: (driverId: string) => void;
}

export function VehiclesPage({
  drivers,
  onNotification,
  onSelectDriver
}: VehiclesPageProps) {
  const slug = companySlugForCurrentPath();
  const queryClient = useQueryClient();
  const fleetQuery = useQuery({ queryKey: ['operations', slug, 'vehicles'], queryFn: () => allOperations.vehicles(slug!), enabled: !!slug });
  const catalogQuery = useQuery({ queryKey: ['operations', slug, 'catalog'], queryFn: () => allOperations.catalog(slug!), enabled: !!slug });
  const driversQuery = useQuery({ queryKey: ['operations', slug, 'drivers'], queryFn: () => allOperations.drivers(slug!), enabled: !!slug });
  const [localVehicles, setVehicles] = useState<VehicleAsset[]>(() => slug ? [] : loadVehicles());
  const vehicles = slug ? (fleetQuery.data ?? []).map(row => vehicleToUi(row, catalogQuery.data?.find(type => type.id === row.type_id), driversQuery.data?.find(driver => driver.vehicle_id === row.id))) : localVehicles;
  const vehicleTypes = slug ? (catalogQuery.data ?? []).filter(type => type.kind === 'VEHICLE_TYPE').map(catalogToVehicleType) : loadSimplePricingConfig().vehicles;
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Slide-over drawer
  const [activeVehicleDrawer, setActiveVehicleDrawer] = useState<VehicleAsset | null>(null);

  // Register Vehicle Modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        v.unitNumber.toLowerCase().includes(q) || (v.vehicleNumber?.toLowerCase().includes(q) ?? false) ||
        v.plateNumber.toLowerCase().includes(q) ||
        v.makeModel.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        vehicleTypes.find(type => type.id === v.vehicleTypeId)?.name.toLowerCase().includes(q) ||
        (v.currentDriverName && v.currentDriverName.toLowerCase().includes(q)) || [...(v.equipment ?? []), ...(v.serviceAreaIds ?? [])].join(' ').toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === 'all' || v.vehicleTypeId === categoryFilter;

      const matchesStatus =
        statusFilter === 'all' || v.availability === statusFilter || v.recordStatus === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [vehicles, vehicleTypes, searchQuery, categoryFilter, statusFilter]);

  // Metrics
  const totalVehicles = vehicles.length;
  const inServiceCount = vehicles.filter((v) => v.status === 'in_service').length;
  const availableCount = vehicles.filter((v) => v.status === 'available').length;
  const maintenanceCount = vehicles.filter(v => v.availability === 'UNAVAILABLE').length;
  const standbyCount = vehicles.filter(v => v.recordStatus === 'INACTIVE').length;

  const handleSaveVehicle = async (vehicle: VehicleAsset, profile: VehicleProfile) => {
    if (slug) {
      try {
        const previous = fleetQuery.data?.find(row => row.id === vehicle.id);
        const input = vehicleFromUi(vehicle, previous);
        if (previous) await operations.updateVehicle(slug, previous, input);
        else await operations.createVehicle(slug, input);
        await queryClient.invalidateQueries({ queryKey: ['operations', slug, 'vehicles'] });
        setActiveVehicleDrawer(null); setShowRegisterModal(false); onNotification('Vehicle saved');
      } catch (error) { onNotification(error instanceof Error ? error.message : 'Could not save vehicle.'); }
      return;
    }

    const next = saveVehicleProfile(vehicle, profile, vehicles);
    setVehicles(next); setActiveVehicleDrawer(null); setShowRegisterModal(false); onNotification('Vehicle saved');
  };
  const handleDeleteVehicle = async (vehicle: VehicleAsset) => {
    const driver = drivers.find(d => d.id === vehicle.currentDriverId) ?? (vehicle.currentDriverName ? { name: vehicle.currentDriverName } : null);
    if (driver) { onNotification(`${vehicle.unitNumber} is attached to ${driver.name}. Release it on the driver profile before deleting.`); return; }
    if (!(await confirmDialog({ title: `Delete vehicle "${vehicle.unitNumber}"?`, message: 'This removes the fleet record. Completed orders keep their history. This cannot be undone.', confirmLabel: 'Delete vehicle', tone: 'danger' }))) return;
    if (slug) {
      const record = fleetQuery.data?.find(row => row.id === vehicle.id);
      if (!record) return;
      try { await operations.archiveVehicle(slug, record); await queryClient.invalidateQueries({ queryKey: ['operations', slug, 'vehicles'] }); setActiveVehicleDrawer(null); onNotification(`Removed vehicle "${vehicle.unitNumber}".`); }
      catch (error) { onNotification(error instanceof Error ? error.message : 'Could not remove vehicle.'); }
      return;
    }
    const next = vehicles.filter(v => v.id !== vehicle.id);
    saveVehicles(next); archiveVehicleProfile(vehicle); setVehicles(next);
    if (activeVehicleDrawer?.id === vehicle.id) setActiveVehicleDrawer(null);
    onNotification(`Removed vehicle "${vehicle.unitNumber}".`);
  };
  useEntityDialog(!!activeVehicleDrawer || showRegisterModal, () => { setActiveVehicleDrawer(null); setShowRegisterModal(false); });

  return (
    <div className="app-page app-list-page h-full w-full flex flex-col overflow-hidden font-sans">
      {/* HEADER BAR */}
      <PageHeader title="Vehicles" description="Manage fleet vehicles, capacity, pricing and availability." actions={<>
          <Button type="button" onClick={() => setShowRegisterModal(true)}><Plus /> Register Vehicle</Button>
      </>} />

      {/* BODY CONTENT */}
      <div className="page-content flex-1 overflow-y-auto py-6 space-y-6">
        {slug && fleetQuery.isPending && <p role="status" className="text-sm text-slate-500">Loading vehicles…</p>}
        {slug && fleetQuery.error && <p role="alert" className="text-sm text-rose-700">{fleetQuery.error.message}</p>}
        <div className="space-y-6">
            <ListSummary label="Vehicles summary" items={[
              { label: 'Total', value: totalVehicles, icon: Truck },
              { label: 'In service', value: inServiceCount, icon: Route },
              { label: 'Available', value: availableCount, icon: CircleCheck },
              { label: 'Inactive', value: standbyCount, icon: CirclePause },
              { label: 'Unavailable', value: maintenanceCount, icon: Wrench },
            ]} />

            {/* SEARCH & FILTERS BAR */}
            <div className="app-list-toolbar">
              <SearchInput className="app-list-search"
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search vehicles by unit #, plate, model, or driver..."
              />

              <div className="app-list-filters">
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
                    { value: 'all', label: 'All vehicle types' }, ...vehicleTypes.map(v => ({ value: v.id, label: v.name }))
                  ]}
                />
              </div>
            </div>

            {/* VEHICLES GRID */}
            <div>
              {filteredVehicles.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-xl border border-slate-200/90 shadow-2xs">
                  <Truck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <h3 className="app-section-title text-slate-800">No vehicles match your filter</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Adjust search query or reset status filters.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryFilter('all');
                      setStatusFilter('all');
                    }}
                    className="mt-4 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <VehicleTable vehicles={filteredVehicles} drivers={drivers} vehicleTypes={vehicleTypes} onDetails={setActiveVehicleDrawer} onDelete={handleDeleteVehicle} />
              )}
            </div>
        </div>
      </div>

      {/* VEHICLE DOSSIER DIALOG */}
      {activeVehicleDrawer && (
        <Dialog size="md" onClose={() => setActiveVehicleDrawer(null)}>
          <DialogHeader onClose={() => setActiveVehicleDrawer(null)}
            title={<><span className="font-mono">{activeVehicleDrawer.vehicleNumber ?? activeVehicleDrawer.unitNumber}</span><span className="text-xs font-medium px-2 py-0.5 bg-slate-200 text-slate-800 rounded">{activeVehicleDrawer.plateNumber}</span></>} />
          <DialogBody><VehicleEditor vehicle={activeVehicleDrawer} vehicles={vehicles} vehicleTypes={vehicleTypes} live={!!slug} formId="vehicle-details-form" hideActions onCancel={() => setActiveVehicleDrawer(null)} onSave={handleSaveVehicle} /></DialogBody>
          <DialogFooter><Button type="submit" form="vehicle-details-form">Save vehicle</Button></DialogFooter>
        </Dialog>
      )}

      {/* REGISTER VEHICLE MODAL */}
      {showRegisterModal && (
        <Dialog size="md" onClose={() => setShowRegisterModal(false)}>
          <DialogHeader onClose={() => setShowRegisterModal(false)} title="Register Vehicle" />
          <DialogBody><VehicleEditor vehicles={vehicles} vehicleTypes={vehicleTypes} live={!!slug} formId="vehicle-add-form" hideActions onCancel={() => setShowRegisterModal(false)} onSave={handleSaveVehicle} /></DialogBody>
          <DialogFooter><Button type="submit" form="vehicle-add-form">Save vehicle</Button></DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
