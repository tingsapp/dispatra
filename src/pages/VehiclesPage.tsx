import { ListSummary } from '../components/layout/ListSummary';
import { Button } from '../components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../components/ui/Dialog';
import { Tabs } from '../components/ui/Tabs';
import {
Route,
CircleCheck,
CirclePause,
Wrench,
Plus,
Truck
} from 'lucide-react';
import { useEffect,useMemo,useState } from 'react';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import { confirmDialog } from '../components/ui/ConfirmDialog';
import { VehicleEditor } from '../components/entities/VehicleEditor';
import { VehicleTable } from '../components/entities/VehicleTable';
import { CatalogueSection } from '../components/settings/CatalogueSection';
import { PageHeader } from '../components/layout/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Select';
import { loadSimplePricingConfig } from '../lib/simplePricingStorage';
import { VehicleAsset,loadVehicles,saveVehicles } from '../lib/vehicleStorage';
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
  const [typesRevision, setTypesRevision] = useState(0);
  const vehicleTypes = useMemo(() => loadSimplePricingConfig().vehicles, [typesRevision]);
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

  const handleSaveVehicle = (vehicle: VehicleAsset) => {
    const next = vehicles.some(v => v.id === vehicle.id) ? vehicles.map(v => v.id === vehicle.id ? vehicle : v) : [vehicle, ...vehicles];
    setVehicles(next); setActiveVehicleDrawer(null); setShowRegisterModal(false); onNotification('Vehicle saved');
  };
  const handleDeleteVehicle = async (vehicle: VehicleAsset) => {
    const driver = drivers.find(d => d.id === vehicle.currentDriverId) ?? (vehicle.currentDriverName ? { name: vehicle.currentDriverName } : null);
    if (driver) { onNotification(`${vehicle.unitNumber} is attached to ${driver.name}. Release it on the driver profile before deleting.`); return; }
    if (!(await confirmDialog({ title: `Delete vehicle "${vehicle.unitNumber}"?`, message: 'This removes the fleet record. Completed orders keep their history. This cannot be undone.', confirmLabel: 'Delete vehicle', tone: 'danger' }))) return;
    setVehicles(vehicles.filter(v => v.id !== vehicle.id));
    if (activeVehicleDrawer?.id === vehicle.id) setActiveVehicleDrawer(null);
    onNotification(`Removed vehicle "${vehicle.unitNumber}".`);
  };
  useEntityDialog(!!activeVehicleDrawer || showRegisterModal, () => { setActiveVehicleDrawer(null); setShowRegisterModal(false); });

  return (
    <div className="app-page app-list-page h-full w-full flex flex-col overflow-hidden font-sans">
      {/* HEADER BAR */}
      <PageHeader title="Vehicles" description="Manage your fleet, vehicle types, capacity and availability." actions={<>
          <Button type="button" onClick={() => setShowRegisterModal(true)}><Plus /> Register Vehicle</Button>
      </>} />

      {/* BODY CONTENT */}
      <div className="page-content flex-1 overflow-y-auto py-6 space-y-6">
        <Tabs label="Vehicle sections" items={[
          { id: 'fleet', label: 'Vehicles', content: <div className="space-y-6">
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
          </div> },
          { id: 'types', label: 'Vehicle Types', content: <CatalogueSection section="vehicles" onNotification={onNotification} onChanged={() => setTypesRevision(value => value + 1)} /> }
        ]} />
      </div>

      {/* VEHICLE DOSSIER DIALOG */}
      {activeVehicleDrawer && (
        <Dialog size="md" onClose={() => setActiveVehicleDrawer(null)}>
          <DialogHeader onClose={() => setActiveVehicleDrawer(null)}
            title={<><span className="font-mono">{activeVehicleDrawer.unitNumber}</span><span className="text-xs font-medium px-2 py-0.5 bg-slate-200 text-slate-800 rounded">{activeVehicleDrawer.plateNumber}</span></>} />
          <DialogBody><VehicleEditor vehicle={activeVehicleDrawer} vehicles={vehicles} formId="vehicle-details-form" hideActions onCancel={() => setActiveVehicleDrawer(null)} onSave={handleSaveVehicle} /></DialogBody>
          <DialogFooter><Button type="submit" form="vehicle-details-form">Save vehicle</Button></DialogFooter>
        </Dialog>
      )}

      {/* REGISTER VEHICLE MODAL */}
      {showRegisterModal && (
        <Dialog size="form" onClose={() => setShowRegisterModal(false)}>
          <DialogHeader onClose={() => setShowRegisterModal(false)} title="Register Vehicle" />
          <DialogBody><VehicleEditor vehicles={vehicles} formId="vehicle-add-form" hideActions onCancel={() => setShowRegisterModal(false)} onSave={handleSaveVehicle} /></DialogBody>
          <DialogFooter><Button type="submit" form="vehicle-add-form">Save vehicle</Button></DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
