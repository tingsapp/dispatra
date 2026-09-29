import { DriverAvatar } from '../components/DriverAvatar';
import { ListSummary } from '../components/layout/ListSummary';
import { Button } from '../components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../components/ui/Dialog';
import {
Route,
CircleCheck,
Coffee,
MapPin,
Plus,
Users,
Trash2
} from 'lucide-react';
import { useEffect,useMemo,useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { companySlugForCurrentPath } from '../lib/pageRoutes';
import { allOperations, operations } from '../operations/api';
import { catalogToVehicleType, driverFromUi, driverToUi, vehicleFromUi, vehicleToUi } from '../operations/adapters';
import { DriverEditor } from '../components/entities/DriverEditor';
import { DriverActivity } from '../components/entities/DriverActivity';
import { VehicleEditor } from '../components/entities/VehicleEditor';
import { loadVehicles, saveVehicleProfile, type VehicleAsset, type VehicleProfile } from '../lib/vehicleStorage';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import { confirmDialog } from '../components/ui/ConfirmDialog';
import { PageHeader } from '../components/layout/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { Driver,Job } from '../types';

interface DriversPageProps {
  drivers: Driver[];
  jobs: Job[];
  onSelectDriver: (driverId: string) => void;
  onUpdateDriver: (updatedDriver: Driver) => void;
  onCreateDriver: (newDriver: Driver) => void;
  onDeleteDriver?: (driver: Driver) => void;
  onNotification: (message: string) => void;
  /** Opens this driver's details once loaded (e.g. "Edit driver" from the Monitor). */
  openDriverId?: string | null;
  onOpenHandled?: () => void;
}

export function DriversPage({
  drivers: suppliedDrivers,
  jobs,
  onSelectDriver,
  onUpdateDriver,
  onCreateDriver,
  onDeleteDriver,
  onNotification,
  openDriverId,
  onOpenHandled
}: DriversPageProps) {
  const slug = companySlugForCurrentPath();
  const queryClient = useQueryClient();
  const driverQuery = useQuery({ queryKey: ['operations', slug, 'drivers'], queryFn: () => allOperations.drivers(slug!), enabled: !!slug });
  const vehicleQuery = useQuery({ queryKey: ['operations', slug, 'vehicles'], queryFn: () => allOperations.vehicles(slug!), enabled: !!slug });
  const catalogQuery = useQuery({ queryKey: ['operations', slug, 'catalog'], queryFn: () => allOperations.catalog(slug!), enabled: !!slug });
  const vehicleOptions = slug ? (vehicleQuery.data ?? []).map(row => vehicleToUi(row, catalogQuery.data?.find(type => type.id === row.type_id), driverQuery.data?.find(driver => driver.vehicle_id === row.id))) : undefined;
  const vehicleTypes = slug ? (catalogQuery.data ?? []).filter(type => type.kind === 'VEHICLE_TYPE').map(catalogToVehicleType) : undefined;
  const drivers = slug ? (driverQuery.data ?? []).map(row => driverToUi(row, vehicleQuery.data?.find(v => v.id === row.vehicle_id))) : suppliedDrivers;
  const [initialCredential, setInitialCredential] = useState<{ name: string; email: string; password: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on_route' | 'available' | 'offline'>('all');

  // Selected driver for slide-over drawer
  const [activeDriverDrawer, setActiveDriverDrawer] = useState<Driver | null>(null);
  useEffect(() => {
    if (!openDriverId) return;
    const driver = drivers.find(row => row.id === openDriverId);
    if (!driver) return;
    setActiveDriverDrawer(driver); onOpenHandled?.();
  }, [openDriverId, drivers]);

  // Add Driver Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [driverAddressBlocked, setDriverAddressBlocked] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [createdVehicle, setCreatedVehicle] = useState<VehicleAsset | null>(null);
  const openVehicleModal = () => { setCreatedVehicle(null); setShowVehicleModal(true); };
  const openDriverDetails = (driver: Driver) => { setCreatedVehicle(null); setActiveDriverDrawer(driver); };
  const handleRegisterVehicle = async (vehicle: VehicleAsset, profile: VehicleProfile) => {
    if (slug) {
      try {
        const saved = await operations.createVehicle(slug, vehicleFromUi(vehicle));
        await queryClient.invalidateQueries({ queryKey: ['operations', slug, 'vehicles'] });
        setCreatedVehicle(vehicleToUi(saved, catalogQuery.data?.find(type => type.id === saved.type_id)));
        setShowVehicleModal(false); onNotification('Vehicle registered');
      } catch (error) { onNotification(error instanceof Error ? error.message : 'Could not register vehicle.'); }
      return;
    }
    try { saveVehicleProfile(vehicle, profile, loadVehicles()); }
    catch { onNotification('Vehicle could not be saved in this browser.'); return; }
    setCreatedVehicle(vehicle); setShowVehicleModal(false); onNotification('Vehicle registered');
  };
  const saveDriver = async (form: Driver) => {
    if (slug) {
      try {
        const previous = driverQuery.data?.find(row => row.id === form.id);
        const saved = previous ? await operations.updateDriver(slug, previous, driverFromUi(form, previous, form.addressCoordinates), form.dutyStatus) : await operations.createDriver(slug, driverFromUi(form, undefined, form.addressCoordinates));
        await Promise.all([queryClient.invalidateQueries({ queryKey: ['operations', slug, 'drivers'] }), queryClient.invalidateQueries({ queryKey: ['operations', slug, 'monitor'] })]);
        setActiveDriverDrawer(null); setShowAddModal(false);
        if (saved.initial_password) setInitialCredential({ name: saved.name, email: saved.email, password: saved.initial_password });
        else onNotification('Driver saved');
      } catch (error) { onNotification(error instanceof Error ? error.message : 'Could not save driver.'); }
      return;
    }
    if (drivers.some(d => d.id === form.id)) onUpdateDriver(form); else onCreateDriver(form);
    setActiveDriverDrawer(null); setShowAddModal(false); onNotification('Driver saved');
  };
  // Filtered drivers
  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        driver.name.toLowerCase().includes(q) ||
        driver.id.toLowerCase().includes(q) ||
        (driver.phone && driver.phone.toLowerCase().includes(q)) ||
        driver.vehicle.toLowerCase().includes(q) ||
        driver.nextStop.toLowerCase().includes(q) || driver.address?.toLowerCase().includes(q) || [...(driver.skills ?? []), ...(driver.serviceAreaIds ?? []), driver.driverNumber ?? ''].join(' ').toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'all' || driver.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [drivers, searchQuery, statusFilter]);

  // Metrics
  const totalDrivers = drivers.length;
  const onRouteCount = drivers.filter((d) => d.status === 'on_route').length;
  const availableCount = drivers.filter((d) => d.status === 'available').length;
  const offlineCount = drivers.filter((d) => d.status === 'idle' || d.status === 'offline').length;

  const handleDeleteDriver = async (driver: Driver) => {
    const active = jobs.filter(j => j.assignedDriverId === driver.id && j.status !== 'completed').length;
    if (active) { onNotification(`${driver.name} has ${active} active order${active === 1 ? '' : 's'}. Reassign them before deleting the driver.`); return; }
    if (!(await confirmDialog({ title: `Delete driver "${driver.name}"?`, message: `This removes the driver profile${driver.currentVehicleId ? ' and releases their vehicle' : ''}. Completed orders keep their history. This cannot be undone.`, confirmLabel: 'Delete driver', tone: 'danger' }))) return;
    if (slug) {
      const record = driverQuery.data?.find(row => row.id === driver.id);
      if (!record) return;
      try { await operations.archiveDriver(slug, record); await queryClient.invalidateQueries({ queryKey: ['operations', slug, 'drivers'] }); }
      catch (error) { onNotification(error instanceof Error ? error.message : 'Driver could not be deleted.'); return; }
    } else { try { onDeleteDriver?.(driver); } catch (error) { onNotification(error instanceof Error ? error.message : 'Driver could not be deleted.'); return; } }
    if (activeDriverDrawer?.id === driver.id) setActiveDriverDrawer(null);
    onNotification(`Removed driver "${driver.name}".`);
  };
  useEntityDialog(!!activeDriverDrawer || showAddModal, () => { setActiveDriverDrawer(null); setShowAddModal(false); });
  useEntityDialog(showVehicleModal, () => setShowVehicleModal(false));

  return (
    <div className="app-page app-list-page h-full w-full flex flex-col overflow-hidden font-sans">
      <PageHeader title="Drivers" description="Driver profiles, employment, attached vehicles and service areas." actions={<>
        <Button
          type="button"
          onClick={() => { setCreatedVehicle(null); setShowAddModal(true); }}
          className="app-action app-primary flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Driver</span>
        </Button>
      </>} />

      {/* BODY CONTENT */}
      <div className="page-content flex-1 overflow-y-auto py-6 space-y-6">
        {slug && driverQuery.isPending && <p role="status" className="text-sm text-slate-500">Loading drivers…</p>}
        {slug && driverQuery.error && <p role="alert" className="text-sm text-rose-700">{driverQuery.error.message}</p>}
        <ListSummary label="Drivers summary" items={[
          { label: 'Total', value: totalDrivers, icon: Users },
          { label: 'On route', value: onRouteCount, icon: Route },
          { label: 'Available', value: availableCount, icon: CircleCheck },
          { label: 'Off duty / on break', value: offlineCount, icon: Coffee },
        ]} />

        {/* SEARCH & FILTERS BAR */}
        <div className="app-list-toolbar">
          <SearchInput className="app-list-search"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search drivers by name, ID (D14), or vehicle..."
          />

          <div className="app-list-filters">
            {/* Status Filter Buttons */}
            <div className="app-list-status">
              <button
                onClick={() => setStatusFilter('all')}
                aria-pressed={statusFilter === 'all'}
                className="app-tab inline-flex items-center gap-2 whitespace-nowrap"
              >
                All ({drivers.length})
              </button>
              <button
                onClick={() => setStatusFilter('on_route')}
                aria-pressed={statusFilter === 'on_route'}
                className="app-tab inline-flex items-center gap-2 whitespace-nowrap"
              >
                On Route
              </button>
              <button
                onClick={() => setStatusFilter('available')}
                aria-pressed={statusFilter === 'available'}
                className="app-tab inline-flex items-center gap-2 whitespace-nowrap"
              >
                Available
              </button>
            </div>


          </div>
        </div>

        {/* DRIVERS CONTENT */}
        <div>
          {filteredDrivers.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200/90 shadow-2xs">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="app-section-title text-slate-800">No drivers match your criteria</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Try clearing your search or status filter.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="mt-4 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            /* TABLE VIEW */
            <div className="app-table-shell bg-white overflow-hidden">
              <div className="overflow-x-auto">
              <table aria-label="Drivers" className="app-table w-full min-w-[850px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-medium text-slate-600">
                    <th className="py-3 px-4">Driver</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Assigned Vehicle</th>
                    <th className="py-3 px-4">Next Destination / Job</th>
                    <th className="py-3 px-4">ETA & Distance</th>
                    <th className="py-3 px-4">GPS Freshness</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                  {filteredDrivers.map((driver) => (
                    <tr
                      key={driver.driverNumber ?? driver.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => openDriverDetails(driver)}
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <DriverAvatar name={driver.name} avatar={driver.avatar} alt={driver.name} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                          <div>
                            <div className="font-medium text-slate-900 flex items-center gap-1.5">
                              {driver.name}
                              <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1 py-0.2 rounded">
                                {driver.driverNumber ?? driver.id}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400">{driver.phone}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full border ${
                            driver.status === 'on_route'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : driver.status === 'available' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {driver.statusLabel}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {driver.vehicle}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-800">
                        {driver.nextStop}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-700">
                        <div>{driver.eta}</div>
                        <div className="text-xs text-slate-400">{driver.distance} away</div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 text-xs">
                        {driver.locationCapturedAt || 'No GPS timestamp'}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button type="button" aria-label={`Details for ${driver.name}`} onClick={() => openDriverDetails(driver)} className="mr-2 rounded-md px-2 py-1.5 font-medium text-slate-700 hover:bg-slate-100">Details</button>
                        <button
                          onClick={() => onSelectDriver(driver.id)}
                          title="Locate on Map"
                          className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <MapPin className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => handleDeleteDriver(driver)} title="Delete driver" aria-label={`Delete ${driver.name}`} className="ml-1 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DRIVER PROFILE DIALOG */}
      {activeDriverDrawer && (
        <Dialog size="md" onClose={() => setActiveDriverDrawer(null)}>
          <DialogHeader onClose={() => setActiveDriverDrawer(null)}
            leading={<DriverAvatar name={activeDriverDrawer.name} avatar={activeDriverDrawer.avatar} alt={activeDriverDrawer.name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />}
            title={<>{activeDriverDrawer.name}<span className="text-xs font-mono font-medium bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">{activeDriverDrawer.driverNumber ?? activeDriverDrawer.id}</span></>}
            description={activeDriverDrawer.phone} />
          <DialogBody className="space-y-6">
            <section aria-label="Driver profile">
              <DriverEditor driver={activeDriverDrawer} drivers={drivers} vehicleOptions={vehicleOptions} onRegisterVehicle={openVehicleModal} createdVehicle={createdVehicle} formId="driver-details-form" hideActions onAddressBlockedChange={setDriverAddressBlocked} onCancel={() => setActiveDriverDrawer(null)} onSave={saveDriver} />
            </section>
            <DriverActivity driver={activeDriverDrawer} jobs={jobs} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { onSelectDriver(activeDriverDrawer.id); setActiveDriverDrawer(null); }}><MapPin /> Locate on Monitor</Button>
            <Button type="submit" form="driver-details-form" disabled={driverAddressBlocked}>Save driver</Button>
          </DialogFooter>
        </Dialog>
      )}

      {initialCredential && <Dialog size="md" onClose={() => setInitialCredential(null)}><DialogHeader title="Driver account created" onClose={() => setInitialCredential(null)} /><DialogBody className="space-y-3 text-sm"><p>Give these login details to {initialCredential.name}. The password is shown only once.</p><p><strong>Email:</strong> {initialCredential.email}</p><p><strong>Initial password:</strong> <code>{initialCredential.password}</code></p></DialogBody><DialogFooter><Button type="button" onClick={() => setInitialCredential(null)}>Done</Button></DialogFooter></Dialog>}

      {/* ADD DRIVER MODAL */}
      {showAddModal && (
        <Dialog size="form" onClose={() => setShowAddModal(false)}>
            <DialogHeader onClose={() => setShowAddModal(false)} title="Add Driver" />
          <DialogBody><DriverEditor drivers={drivers} vehicleOptions={vehicleOptions} onRegisterVehicle={openVehicleModal} createdVehicle={createdVehicle} formId="driver-add-form" hideActions onAddressBlockedChange={setDriverAddressBlocked} onCancel={() => setShowAddModal(false)} onSave={saveDriver} /></DialogBody>
          <DialogFooter><Button type="submit" form="driver-add-form" disabled={driverAddressBlocked}>Save driver</Button></DialogFooter>
        </Dialog>
      )}
      {showVehicleModal && (
        <Dialog size="md" zIndex="z-[60]" onClose={() => setShowVehicleModal(false)}>
          <DialogHeader onClose={() => setShowVehicleModal(false)} title="Register Vehicle" />
          <DialogBody><VehicleEditor vehicles={vehicleOptions ?? (slug ? [] : loadVehicles())} vehicleTypes={vehicleTypes} live={!!slug} formId="driver-vehicle-add-form" hideActions onCancel={() => setShowVehicleModal(false)} onSave={handleRegisterVehicle} /></DialogBody>
          <DialogFooter><Button type="submit" form="driver-vehicle-add-form">Save vehicle</Button></DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
