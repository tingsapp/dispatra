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
  const [newName, setNewName] = useState('');
  const [newId, setNewId] = useState(`D${Math.floor(20 + Math.random() * 30)}`);
  const [newPhone, setNewPhone] = useState('(604) 555-');
  const [newVehicle, setNewVehicle] = useState('V14 (BC DISP 901)');
  const [newLicenseClass, setNewLicenseClass] = useState('Class 5 Commercial Courier');
  const [newStatus, setNewStatus] = useState<'available' | 'on_route'>('available');

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
        driver.nextStop.toLowerCase().includes(q);

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
    const nextStatus = driver.status === 'available' ? 'on_route' : 'available';
    const nextLabel = nextStatus === 'available' ? 'Available' : 'On route';
    const updated: Driver = {
      ...driver,
      status: nextStatus,
      statusLabel: nextLabel,
      lastUpdate: 'Just now'
    };
    onUpdateDriver(updated);
    if (activeDriverDrawer && activeDriverDrawer.id === driver.id) {
      setActiveDriverDrawer(updated);
    }
    onNotification(`Updated ${driver.name} status to ${nextLabel}`);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) {
      onNotification('Please enter driver name');
      return;
    }

    const newDriver: Driver = {
      id: newId,
      name: newName,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      status: newStatus,
      statusLabel: newStatus === 'available' ? 'Available' : 'On route',
      vehicle: newVehicle,
      nextStop: 'Staging Hub, Vancouver',
      eta: newStatus === 'available' ? 'Available now' : '15 min',
      distance: '3.0 km',
      lastUpdate: 'Just now (Live)',
      phone: newPhone,
      lat: 49.2700 + (Math.random() - 0.5) * 0.03,
      lng: -123.1150 + (Math.random() - 0.5) * 0.04
    };

    onCreateDriver(newDriver);
    setShowAddModal(false);
    setNewName('');
    setNewId(`D${Math.floor(20 + Math.random() * 30)}`);
    onNotification(`Added new driver ${newDriver.name} (${newDriver.id})`);
  };

  return (
    <div className="relative flex flex-col h-full w-full bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* TOP BAR */}
      <header className="flex-none bg-white border-b border-slate-200 px-6 py-4 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToMonitor}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Monitor
            </button>
            <div className="h-4 w-px bg-slate-300" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Fleet Drivers Directory
              </h1>
              <p className="text-xs text-slate-500">
                Active driver roster, vehicle assignments, real-time GPS telemetry, and duty status
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onNotification('Broadcast alert sent to all active fleet drivers')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5 text-blue-600" />
              Fleet Broadcast
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Driver
            </button>
          </div>
        </div>
      </header>

      {/* METRIC CARDS BANNER */}
      <div className="flex-none bg-white/70 border-b border-slate-200 px-6 py-3">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div className="text-xs font-medium text-slate-500">Total Drivers Roster</div>
            <div className="text-xl font-bold text-slate-900 mt-1">{totalDrivers}</div>
          </div>
          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div className="text-xs font-medium text-blue-600 flex items-center gap-1">
              <Truck className="w-3.5 h-3.5" /> On Route / En Route
            </div>
            <div className="text-xl font-bold text-blue-600 mt-1">{onRouteCount}</div>
          </div>
          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div className="text-xs font-medium text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Available for Dispatch
            </div>
            <div className="text-xl font-bold text-emerald-600 mt-1">{availableCount}</div>
          </div>
          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div className="text-xs font-medium text-slate-500">Fleet On-Time Rate</div>
            <div className="text-xl font-bold text-slate-900 mt-1">98.2%</div>
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="flex-none px-6 py-3 bg-slate-100 border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search driver name, ID (D14), vehicle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            {/* Status Filter Buttons */}
            <div className="inline-flex bg-white p-0.5 border border-slate-300 rounded-lg text-xs font-medium">
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
            <div className="inline-flex bg-white p-0.5 border border-slate-300 rounded-lg text-slate-500">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-slate-100 text-slate-900' : 'hover:text-slate-700'}`}
                title="Grid Cards View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-slate-100 text-slate-900' : 'hover:text-slate-700'}`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DRIVERS CONTENT */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-7xl mx-auto">
          {filteredDrivers.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-xl">
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
                    className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
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
                          <span>GPS: <strong className="text-slate-600">{driver.lastUpdate}</strong></span>
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
                          title="Toggle Available / On Route status"
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
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-medium">
                    <th className="py-3 px-4">Driver</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Assigned Vehicle</th>
                    <th className="py-3 px-4">Next Destination / Job</th>
                    <th className="py-3 px-4">ETA & Distance</th>
                    <th className="py-3 px-4">GPS Freshness</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
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
                        {driver.lastUpdate}
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
          )}
        </div>
      </div>

      {/* DRIVER PROFILE DRAWER */}
      {activeDriverDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div
            className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
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
              {/* Telemetry Status Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live Telemetry</div>
                <div className="grid grid-cols-2 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 text-[10px]">Status:</span>
                    <div className="font-semibold text-slate-900">{activeDriverDrawer.statusLabel}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">GPS Freshness:</span>
                    <div className="font-semibold text-emerald-600">{activeDriverDrawer.lastUpdate}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Next ETA:</span>
                    <div className="font-semibold text-slate-900">{activeDriverDrawer.eta}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Distance to Stop:</span>
                    <div className="font-semibold text-slate-900">{activeDriverDrawer.distance}</div>
                  </div>
                </div>
              </div>

              {/* Vehicle Assignment */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Fleet Asset</div>
                <div className="text-sm font-bold text-slate-900">{activeDriverDrawer.vehicle}</div>
                <div className="text-slate-500 text-[11px]">
                  Commercial Class 5 Cargo specification with GPS gateway & mobile telematics.
                </div>
              </div>

              {/* Shift Performance */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Today's Shift Performance</div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <div className="text-lg font-bold text-slate-900">6</div>
                    <div className="text-[10px] text-slate-500">Completed Drops</div>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <div className="text-lg font-bold text-emerald-600">100%</div>
                    <div className="text-[10px] text-slate-500">On-Time Rate</div>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <div className="text-lg font-bold text-slate-900">5.2h</div>
                    <div className="text-[10px] text-slate-500">On Duty Time</div>
                  </div>
                </div>
              </div>
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
                Toggle Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD DRIVER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
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

            <form onSubmit={handleAddSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Driver Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Jordan Lee"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Callsign / ID</label>
                  <input
                    type="text"
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Direct Phone</label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">License Class</label>
                  <input
                    type="text"
                    value={newLicenseClass}
                    onChange={(e) => setNewLicenseClass(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Vehicle</label>
                <select
                  value={newVehicle}
                  onChange={(e) => setNewVehicle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="V14 (BC DISP 901)">V14 (BC DISP 901) - 1T Mercedes Sprinter</option>
                  <option value="V12 (BC L2 ABC 123)">V12 (BC L2 ABC 123) - 2T Ford Cutaway</option>
                  <option value="V08 (BC TRK 882)">V08 (BC TRK 882) - 3T Freightliner Reefer</option>
                  <option value="V04 (BC FLT 319)">V04 (BC FLT 319) - 5T Hino Box Truck</option>
                  <option value="V19 (BC VAN 442)">V19 (BC VAN 442) - 1T Electric E-Transit</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Status</label>
                <div className="flex items-center gap-3 mt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={newStatus === 'available'}
                      onChange={() => setNewStatus('available')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Available (Staged)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={newStatus === 'on_route'}
                      onChange={() => setNewStatus('on_route')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>On Route</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  Register Driver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
