import { useEntityDialog } from '../components/entities/useEntityDialog';
import { DriverEditor } from '../components/entities/DriverEditor';
import { syncDriver, connectivity } from '../lib/driverStorage';
import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Users,
  Plus,
  Search,
  MapPin,
  Phone,
  Truck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Radio,
  ExternalLink,
  ChevronRight,
  X,
  MessageSquare,
  ShieldCheck,
  Fuel,
  Activity,
  List,
  LayoutGrid
} from 'lucide-react';
import { Driver, Job } from '../types';
import { Select } from '../components/ui/Select';
import { SearchInput } from '../components/ui/SearchInput';

interface DriversPageProps {
  drivers: Driver[];
  jobs: Job[];
  onBackToMonitor: () => void;
  onSelectDriver: (driverId: string) => void;
  onUpdateDriver: (updatedDriver: Driver) => void;
  onCreateDriver: (newDriver: Driver) => void;
  onNotification: (message: string) => void;
}

export function DriversPage({
  drivers,
  jobs,
  onBackToMonitor,
  onSelectDriver,
  onUpdateDriver,
  onCreateDriver,
  onNotification
}: DriversPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on_route' | 'available' | 'offline'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Selected driver for slide-over drawer
  const [activeDriverDrawer, setActiveDriverDrawer] = useState<Driver | null>(null);

  // Add Driver Modal
  const [showAddModal, setShowAddModal] = useState(false);
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
        driver.nextStop.toLowerCase().includes(q) || [...(driver.skills ?? []), ...(driver.serviceAreaIds ?? []), driver.driverNumber ?? ''].join(' ').toLowerCase().includes(q);

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

  const handleToggleDuty = (driver: Driver) => {
    const updated = syncDriver({ ...driver, dutyStatus: driver.dutyStatus === 'ON_DUTY' ? 'OFF_DUTY' : 'ON_DUTY' });
    try { onUpdateDriver(updated); } catch (error) { onNotification(error instanceof Error ? error.message : 'Driver could not be saved.'); return; }
    if (activeDriverDrawer && activeDriverDrawer.id === driver.id) {
      setActiveDriverDrawer(updated);
    }
    onNotification(`Updated ${driver.name} status to ${updated.statusLabel}`);
  };

  useEntityDialog(!!activeDriverDrawer || showAddModal, () => { setActiveDriverDrawer(null); setShowAddModal(false); });

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
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-tight">
                Fleet Drivers Directory
              </h1>
              <p className="text-[11px] text-slate-500 leading-tight">
                Driver profiles, skills, service areas, shifts and availability
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Driver</span>
          </button>
        </div>
      </header>

      {/* BODY CONTENT */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* STATS OVERVIEW CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>Total Drivers Roster</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{totalDrivers}</div>
            <div className="mt-1 text-[11px] text-slate-500">Registered fleet operators</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>On Route / En Route</span>
              <Truck className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-blue-600">{onRouteCount}</div>
            <div className="mt-1 text-[11px] text-slate-500">Assigned delivery work</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>Available for Dispatch</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">{availableCount}</div>
            <div className="mt-1 text-[11px] text-slate-500">Ready to accept new assignments</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>Off duty / on break</span>
              <Activity className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{offlineCount}</div>
            <div className="mt-1 text-[11px] text-slate-500">Unavailable for new work</div>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search drivers by name, ID (D14), or vehicle..."
          />

          <div className="flex items-center gap-2">
            {/* Status Filter Buttons */}
            <div className="inline-flex bg-slate-50 p-0.5 border border-slate-200 rounded-lg text-xs font-medium">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({drivers.length})
              </button>
              <button
                onClick={() => setStatusFilter('on_route')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'on_route'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                On Route
              </button>
              <button
                onClick={() => setStatusFilter('available')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'available'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Available
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="inline-flex bg-slate-50 p-0.5 border border-slate-200 rounded-lg text-slate-500">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-700'}`}
                title="Grid Cards View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-700'}`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* DRIVERS CONTENT */}
        <div>
          {filteredDrivers.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200/90 shadow-2xs">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-800">No drivers match your criteria</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Try clearing your search or status filter.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="mt-4 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                Reset Filters
              </button>
            </div>
          ) : viewMode === 'cards' ? (
            /* CARDS GRID VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDrivers.map((driver) => {
                const assignedJob = jobs.find((j) => j.assignedDriverId === driver.id);

                return (
                  <div
                    key={driver.id}
                    onClick={() => setActiveDriverDrawer(driver)}
                    className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      {/* Driver Top Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img
                              src={driver.avatar}
                              alt={driver.name}
                              className="w-11 h-11 rounded-full object-cover border border-slate-200"
                            />
                            <span
                              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                                driver.status === 'on_route'
                                  ? 'bg-blue-500 ring-2 ring-blue-100'
                                  : 'bg-emerald-500 ring-2 ring-emerald-100'
                              }`}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-slate-900 text-sm">{driver.name}</h3>
                              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                {driver.id}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                              <Truck className="w-3 h-3 text-slate-400" />
                              {driver.vehicle}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                            driver.status === 'on_route'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {driver.statusLabel}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 mt-2">{driver.skills?.join(', ') || 'No skills set'} · {driver.serviceAreaIds?.join(', ') || 'No service areas set'}</p>
                      {/* Current Job & Next Destination */}
                      <div className="mt-4 p-3 bg-slate-50 rounded-lg space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-500">
                          <span className="text-[10px] uppercase font-semibold text-slate-400">Current Assignment</span>
                          <span className="text-[11px] font-mono text-slate-700">
                            {assignedJob ? assignedJob.jobNumber : 'No active job'}
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5 text-slate-800 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-none mt-0.5" />
                          <span className="truncate">{driver.nextStop}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-200/60">
                          <span>ETA: <strong className="text-slate-800">{driver.eta}</strong></span>
                          <span>GPS: <strong className="text-slate-600">{driver.locationCapturedAt || 'No GPS timestamp'}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <a href={`tel:${driver.phone}`} className="hover:text-blue-600 font-medium">
                          {driver.phone || '(604) 555-0100'}
                        </a>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onSelectDriver(driver.id)}
                          title="Locate on Monitor Map"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <MapPin className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleDuty(driver)}
                          title="Toggle duty"
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Activity className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* TABLE VIEW */
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-600 tracking-wide uppercase">
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
                      key={driver.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => setActiveDriverDrawer(driver)}
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={driver.avatar}
                            alt={driver.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200"
                          />
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {driver.name}
                              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1 py-0.2 rounded">
                                {driver.id}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">{driver.phone}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                            driver.status === 'on_route'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
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
                        <div className="text-[11px] text-slate-400">{driver.distance} away</div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                        {driver.locationCapturedAt || 'No GPS timestamp'}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectDriver(driver.id)}
                          title="Locate on Map"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <MapPin className="w-4 h-4" />
                        </button>
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

      {/* DRIVER PROFILE DRAWER */}
      {activeDriverDrawer && (
        <div data-entity-dialog className="fixed inset-0 bg-slate-900/40 z-50 flex justify-end animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={activeDriverDrawer.avatar}
                  alt={activeDriverDrawer.name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    {activeDriverDrawer.name}
                    <span className="text-xs font-mono font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                      {activeDriverDrawer.id}
                    </span>
                  </h3>
                  <div className="text-xs text-slate-500">{activeDriverDrawer.phone}</div>
                </div>
              </div>
              <button
                onClick={() => setActiveDriverDrawer(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              <DriverEditor driver={activeDriverDrawer} drivers={drivers} onCancel={() => setActiveDriverDrawer(null)} onSave={d => { onUpdateDriver(d); setActiveDriverDrawer(null); onNotification('Driver saved'); }} />

            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-white flex items-center gap-2">
              <button
                onClick={() => {
                  onSelectDriver(activeDriverDrawer.id);
                  setActiveDriverDrawer(null);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                Locate on Monitor Map
              </button>
              <button
                onClick={() => handleToggleDuty(activeDriverDrawer)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Toggle duty
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD DRIVER MODAL */}
      {showAddModal && (
        <div data-entity-dialog className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add Fleet Driver</h3>
                <p className="text-xs text-slate-500">Register a new driver to the Metro Vancouver dispatch roster</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5"><DriverEditor drivers={drivers} onCancel={() => setShowAddModal(false)} onSave={d => { onCreateDriver(d); setShowAddModal(false); onNotification('Driver created'); }} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
