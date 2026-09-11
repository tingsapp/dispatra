import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Plus,
  Download,
  Search,
  Filter,
  MapPin,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Truck,
  ExternalLink,
  ChevronRight,
  X,
  Phone,
  Package,
  Layers,
  Calendar,
  MoreVertical,
  Check,
  RefreshCw
} from 'lucide-react';
import { Job, Driver } from '../types';
import { PricingOrderInput } from '../types/pricing';
import { Select } from '../components/ui/Select';
import { SearchInput } from '../components/ui/SearchInput';
import { OrderPricingForm } from '../components/pricing/OrderPricingForm';
import { PriceBreakdown } from '../components/pricing/PriceBreakdown';
import { calculatePricing } from '../lib/pricingEngine';
import {
  createDefaultOrderInput,
  describePrice,
  finalizeOrderPrice,
  loadPricingContext,
  priceOrder
} from '../lib/orderPricing';
import { formatDistance, formatWeight } from '../lib/units';

interface JobsPageProps {
  jobs: Job[];
  drivers: Driver[];
  onBackToMonitor: () => void;
  onSelectJob: (jobNumber: string) => void;
  onUpdateJob: (updatedJob: Job) => void;
  onCreateJob: (newJob: Job) => void;
  onNotification: (message: string) => void;
}

export function JobsPage({
  jobs,
  drivers,
  onBackToMonitor,
  onSelectJob,
  onUpdateJob,
  onCreateJob,
  onNotification
}: JobsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on_time' | 'at_risk' | 'late_start' | 'no_driver' | 'completed'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // Selected job for detail drawer
  const [activeJobDossier, setActiveJobDossier] = useState<Job | null>(null);
  
  // Create Job Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newJobNumber, setNewJobNumber] = useState(`#${Math.floor(480 + Math.random() * 40)}`);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('(604) 555-');
  const [newScheduledTime, setNewScheduledTime] = useState('01:00 PM – 03:00 PM');
  const [newDriverId, setNewDriverId] = useState<string>('unassigned');
  const [newInstructions, setNewInstructions] = useState('');
  // Pricing context is read fresh each time the modal opens so settings edits apply.
  const [pricingCtx, setPricingCtx] = useState(() => loadPricingContext());
  const [newOrderInput, setNewOrderInput] = useState<PricingOrderInput>(() => createDefaultOrderInput(pricingCtx));
  const newOrderSnapshot = useMemo(() => calculatePricing(newOrderInput, pricingCtx), [newOrderInput, pricingCtx]);
  const selectedCustomer = pricingCtx.customers.find((c) => c.id === newOrderInput.customerId);

  const openCreateModal = () => {
    const ctx = loadPricingContext();
    setPricingCtx(ctx);
    setNewOrderInput(createDefaultOrderInput(ctx));
    setNewJobNumber(`#${Math.floor(480 + Math.random() * 40)}`);
    setNewCustomerName('');
    setNewCustomerPhone('(604) 555-');
    setNewInstructions('');
    setNewDriverId('unassigned');
    setShowCreateModal(true);
  };

  // Reassignment popover
  const [reassigningJobId, setReassigningJobId] = useState<string | null>(null);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        job.jobNumber.toLowerCase().includes(q) ||
        job.customerName.toLowerCase().includes(q) ||
        job.pickupAddress.toLowerCase().includes(q) ||
        job.dropoffAddress.toLowerCase().includes(q) ||
        (job.driverName && job.driverName.toLowerCase().includes(q)) ||
        (job.assignedDriverId && job.assignedDriverId.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'all' || job.status === statusFilter;

      const matchesType =
        typeFilter === 'all' || job.jobType.toLowerCase().includes(typeFilter.toLowerCase());

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [jobs, searchQuery, statusFilter, typeFilter]);

  // Metrics
  const totalCount = jobs.length;
  const onTimeCount = jobs.filter((j) => j.status === 'on_time').length;
  const atRiskCount = jobs.filter((j) => j.status === 'at_risk' || j.status === 'late_start').length;
  const noDriverCount = jobs.filter((j) => j.status === 'no_driver' || !j.assignedDriverId).length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;

  const handleExportCSV = () => {
    const headers = ['Job Number', 'Status', 'Customer', 'Phone', 'Pickup', 'Dropoff', 'Scheduled', 'Driver', 'Service', 'Rate Card', 'Pricing', 'Total'];
    const rows = filteredJobs.map((j) => [
      j.jobNumber,
      j.statusLabel,
      `"${j.customerName}"`,
      `"${j.customerPhone}"`,
      `"${j.pickupAddress}"`,
      `"${j.dropoffAddress}"`,
      `"${j.scheduledTime}"`,
      j.assignedDriverId || 'Unassigned',
      `"${j.jobType}"`,
      `"${j.pricing?.rateCard?.name ?? ''}"`,
      j.pricing ? `${j.pricing.status}${j.pricing.stage === 'FINAL' ? ' (final)' : ''}` : 'NOT_PRICED',
      j.pricing?.status === 'PRICED' ? j.pricing.total.toFixed(2) : ''
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dispatra_jobs_manifest_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotification(`Exported ${filteredJobs.length} jobs to CSV manifest`);
  };

  const handleReassignDriver = (job: Job, driverId: string) => {
    const driver = drivers.find((d) => d.id === driverId);
    const updated: Job = {
      ...job,
      assignedDriverId: driverId === 'unassigned' ? undefined : driverId,
      driverName: driver ? driver.name : undefined,
      status: driverId === 'unassigned' ? 'no_driver' : 'on_time',
      statusLabel: driverId === 'unassigned' ? 'No Driver' : 'On Time',
      riskText: driver ? `Assigned to ${driver.name} (${driver.id})` : 'Needs dispatch'
    };
    onUpdateJob(updated);
    if (activeJobDossier && activeJobDossier.id === job.id) {
      setActiveJobDossier(updated);
    }
    setReassigningJobId(null);
    onNotification(`Job ${job.jobNumber} reassigned to ${driver ? `${driver.name} (${driver.id})` : 'Unassigned'}`);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const customerName = selectedCustomer?.name ?? newCustomerName.trim();
    const pickups = newOrderInput.stops.filter((st) => st.type === 'PICKUP');
    const drops = newOrderInput.stops.filter((st) => st.type === 'DROPOFF');
    if (!customerName) {
      onNotification('Choose a customer or enter a shipper name');
      return;
    }
    if (!pickups.length || !drops.length || newOrderInput.stops.some((st) => !st.label?.trim())) {
      onNotification('Every stop needs an address, with at least one pickup and one drop-off');
      return;
    }

    const assignedDriver = drivers.find((d) => d.id === newDriverId);
    const service = pricingCtx.catalogue.services.find((sv) => sv.id === newOrderInput.serviceId);
    const snapshot = priceOrder(newOrderInput, pricingCtx);
    const totalKg = newOrderInput.packages.reduce((n, p) => n + p.quantity * p.weightKg, 0);

    const newJob: Job = {
      id: `job-${Date.now()}`,
      jobNumber: newJobNumber.startsWith('#') ? newJobNumber : `#${newJobNumber}`,
      status: assignedDriver ? 'on_time' : 'no_driver',
      statusLabel: assignedDriver ? 'On Time' : 'No Driver',
      riskText: assignedDriver ? `Assigned to ${assignedDriver.name}` : 'Needs dispatch',
      customerName,
      customerPhone: selectedCustomer?.phone ?? newCustomerPhone,
      customerEmail: selectedCustomer?.email,
      pickupAddress: pickups[0].label!,
      dropoffAddress: drops[drops.length - 1].label!,
      scheduledTime: newScheduledTime,
      jobType: service?.name ?? 'Delivery',
      serviceLevel: service?.name,
      assignedDriverId: assignedDriver ? assignedDriver.id : undefined,
      driverName: assignedDriver ? assignedDriver.name : undefined,
      cargoWeight: formatWeight(totalKg, pricingCtx.billing.general),
      palletCount: newOrderInput.packages.reduce((n, p) => n + p.quantity, 0),
      handlingInstructions: newInstructions || undefined,
      stopsCount: newOrderInput.stops.length,
      lat: 49.2720 + (Math.random() - 0.5) * 0.04,
      lng: -123.1100 + (Math.random() - 0.5) * 0.06,
      customerId: newOrderInput.customerId,
      serviceId: newOrderInput.serviceId,
      vehicleId: newOrderInput.vehicleId,
      pricingInput: newOrderInput,
      pricing: snapshot
    };

    onCreateJob(newJob);
    setShowCreateModal(false);
    onNotification(
      snapshot.status === 'PRICED'
        ? `Created ${newJob.jobNumber} — quoted $${snapshot.total.toFixed(2)} ${snapshot.currency}`
        : `Created ${newJob.jobNumber} — pricing needs attention`
    );
  };

  /** Re-run the engine against current settings (estimate stage only). */
  const handleReprice = (job: Job) => {
    if (!job.pricingInput || job.pricing?.stage === 'FINAL') return;
    const updated: Job = { ...job, pricing: priceOrder(job.pricingInput) };
    onUpdateJob(updated);
    setActiveJobDossier(updated);
    onNotification(`${job.jobNumber} re-priced against current Rate Cards`);
  };

  /** Completion pricing: settle on actuals and lock the snapshot. */
  const handleFinalize = (job: Job) => {
    if (!job.pricingInput || job.pricing?.stage === 'FINAL') return;
    const actual = window.prompt(
      'Actual duration in minutes (leave blank to settle on the estimate):',
      String(job.pricingInput.actualMinutes ?? job.pricingInput.estimatedMinutes ?? '')
    );
    if (actual === null) return;
    const minutes = actual.trim() === '' ? null : Math.max(0, Number(actual) || 0);
    const { input, snapshot } = finalizeOrderPrice(job.pricingInput, minutes);
    const updated: Job = { ...job, pricingInput: input, pricing: snapshot };
    onUpdateJob(updated);
    setActiveJobDossier(updated);
    onNotification(`${job.jobNumber} price finalized at $${snapshot.total.toFixed(2)} ${snapshot.currency}`);
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
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-tight">
                Orders
              </h1>
              <p className="text-[11px] text-slate-500 leading-tight">
                Live delivery manifests, customer pricing, route windows, and driver assignments
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Manifest</span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Order</span>
          </button>
        </div>
      </header>

      {/* BODY CONTENT */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* STATS OVERVIEW CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>Total Today's Jobs</span>
              <Package className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{totalCount}</div>
            <div className="mt-1 text-[11px] text-slate-500">All dispatches scheduled today</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>On Schedule</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">{onTimeCount}</div>
            <div className="mt-1 text-[11px] text-slate-500">Running inside the delivery window</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>At Risk / Late</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-rose-600">{atRiskCount}</div>
            <div className="mt-1 text-[11px] text-slate-500">Needs dispatcher intervention</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>Unassigned</span>
              <AlertCircle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600">{noDriverCount}</div>
            <div className="mt-1 text-[11px] text-slate-500">Awaiting a driver assignment</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              <span>Completed</span>
              <Check className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{completedCount}</div>
            <div className="mt-1 text-[11px] text-slate-500">Delivered and closed out</div>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search job #, customer, address, or driver..."
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
                All ({jobs.length})
              </button>
              <button
                onClick={() => setStatusFilter('on_time')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'on_time'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                On Schedule
              </button>
              <button
                onClick={() => setStatusFilter('at_risk')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'at_risk'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                At Risk
              </button>
              <button
                onClick={() => setStatusFilter('no_driver')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'no_driver'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Unassigned
              </button>
            </div>

            {/* Service Type Filter */}
            <Select
              aria-label="Filter by service level"
              value={typeFilter}
              onValueChange={setTypeFilter}
              align="end"
              options={[
                { value: 'all', label: 'All Service Levels' },
                { value: 'Standard', label: 'Standard Delivery' },
                { value: 'Priority', label: 'Priority Freight' },
                { value: 'Medical', label: 'Medical Supplies' },
                { value: 'Express', label: 'Express Courier' }
              ]}
            />
          </div>
        </div>

        {/* JOBS TABLE */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          {filteredJobs.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-800">No jobs match your filter</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Try adjusting your search criteria or switch status filter tabs.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setTypeFilter('all');
                }}
                className="mt-4 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-600 tracking-wide uppercase">
                  <th className="py-3 px-4">Job / Status</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Route Leg (Pickup → Delivery)</th>
                  <th className="py-3 px-4">Scheduled Window</th>
                  <th className="py-3 px-4">Assigned Driver</th>
                  <th className="py-3 px-4">Service & Price</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                {filteredJobs.map((job) => {
                  const assignedDriver = drivers.find((d) => d.id === job.assignedDriverId);

                  return (
                    <tr
                      key={job.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setActiveJobDossier(job)}
                    >
                      {/* Job Number & Status Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{job.jobNumber}</span>
                          {job.status === 'at_risk' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              At Risk
                            </span>
                          )}
                          {job.status === 'late_start' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              Late Start
                            </span>
                          )}
                          {job.status === 'no_driver' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                              No Driver
                            </span>
                          )}
                          {job.status === 'on_time' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              On Time
                            </span>
                          )}
                        </div>
                        {job.riskText && (
                          <div className="text-[11px] text-slate-500 mt-0.5 font-normal">
                            {job.riskText}
                          </div>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{job.customerName}</div>
                        <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {job.customerPhone}
                        </div>
                      </td>

                      {/* Route Leg Addresses */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-start gap-1.5 text-slate-700">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-none" />
                          <span className="truncate font-medium">{job.pickupAddress}</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-slate-500 mt-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 flex-none" />
                          <span className="truncate">{job.dropoffAddress}</span>
                        </div>
                      </td>

                      {/* Scheduled Window */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-slate-700 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {job.scheduledTime}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {job.stopsCount} stop{job.stopsCount > 1 ? 's' : ''} on manifest
                        </div>
                      </td>

                      {/* Assigned Driver */}
                      <td className="py-3.5 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {assignedDriver ? (
                          <div className="flex items-center gap-2">
                            <img
                              src={assignedDriver.avatar}
                              alt={assignedDriver.name}
                              className="w-6 h-6 rounded-full object-cover border border-slate-200"
                            />
                            <div>
                              <div className="font-medium text-slate-800 flex items-center gap-1">
                                {assignedDriver.name}
                                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1 py-0.2 rounded">
                                  {assignedDriver.id}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {assignedDriver.vehicle.split(' ')[0]} • {assignedDriver.eta}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="relative inline-block">
                            <button
                              onClick={() => setReassigningJobId(reassigningJobId === job.id ? null : job.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer"
                            >
                              <User className="w-3 h-3" />
                              Assign Driver
                            </button>

                            {/* Dropdown for assignment */}
                            {reassigningJobId === job.id && (
                              <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-xl border border-slate-200/90 shadow-lg p-2 z-50">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                                  Select Driver
                                </div>
                                {drivers.map((d) => (
                                  <button
                                    key={d.id}
                                    onClick={() => handleReassignDriver(job, d.id)}
                                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-xs text-slate-800 transition-colors"
                                  >
                                    <img src={d.avatar} alt={d.name} className="w-5 h-5 rounded-full object-cover" />
                                    <div className="flex-1 truncate">
                                      <div className="font-medium truncate">{d.name}</div>
                                      <div className="text-[10px] text-slate-400">{d.id} • {d.statusLabel}</div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Service & Price */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-medium text-slate-800">{job.serviceLevel || job.jobType}</span>
                        {(() => {
                          const price = describePrice(job);
                          return (
                            <div
                              className={`text-[11px] mt-0.5 font-semibold ${
                                price.tone === 'ok' ? 'text-slate-900' : price.tone === 'warn' ? 'text-amber-700' : 'text-slate-400'
                              }`}
                            >
                              {price.tone === 'warn' && <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />}
                              {price.text}
                              {job.pricing?.rateCard && (
                                <span className="text-slate-400 font-normal"> · {job.pricing.rateCard.name}</span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => onSelectJob(job.jobNumber)}
                            title="Locate on Monitor Map"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                          >
                            <MapPin className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setActiveJobDossier(job)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="View Full Dossier"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {/* JOB DOSSIER SLIDE-OVER DRAWER */}
      {activeJobDossier && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex justify-end animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-base font-bold text-slate-900">{activeJobDossier.jobNumber}</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {activeJobDossier.serviceLevel || activeJobDossier.jobType}
                </span>
                {activeJobDossier.pricing?.status === 'PRICED' && (
                  <span className="text-xs font-bold text-slate-900">
                    ${activeJobDossier.pricing.total.toFixed(2)} {activeJobDossier.pricing.currency}
                  </span>
                )}
              </div>
              <button
                onClick={() => setActiveJobDossier(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {/* Status Alert Banner */}
              {activeJobDossier.status === 'at_risk' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-none mt-0.5" />
                  <div>
                    <div className="font-semibold text-rose-900">Delivery Schedule At Risk</div>
                    <div className="text-[11px] text-rose-700 mt-0.5">
                      {activeJobDossier.riskText || 'Projected 22 min delay due to traffic and bridge delays.'}
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Info Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer & Contact</div>
                <div className="text-sm font-bold text-slate-900">{activeJobDossier.customerName}</div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <a href={`tel:${activeJobDossier.customerPhone}`} className="hover:text-blue-600 font-medium">
                    {activeJobDossier.customerPhone}
                  </a>
                </div>
              </div>

              {/* Routing Leg Details */}
              <div className="p-4 bg-white rounded-xl border border-slate-200/90 space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Route & Stops</div>
                
                <div className="space-y-3">
                  {(activeJobDossier.pricingInput?.stops ?? [
                    { id: 'pu', type: 'PICKUP' as const, label: activeJobDossier.pickupAddress, zoneId: null, residential: false, waitMinutes: 0 },
                    { id: 'do', type: 'DROPOFF' as const, label: activeJobDossier.dropoffAddress, zoneId: null, residential: false, waitMinutes: 0 }
                  ]).map((stop, i, all) => (
                    <React.Fragment key={stop.id}>
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-5 h-5 rounded-full font-bold flex items-center justify-center text-[10px] flex-none mt-0.5 ${
                            stop.type === 'PICKUP' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {i + 1}
                        </div>
                        <div className="min-w-0">
                          <div className={`text-[10px] font-semibold ${stop.type === 'PICKUP' ? 'text-emerald-700' : 'text-blue-700'}`}>
                            {stop.type === 'PICKUP' ? 'PICKUP' : 'DROP-OFF'}
                            {stop.zoneId && (
                              <span className="ml-1.5 text-slate-400 font-normal">
                                {pricingCtx.pricing.zones.find((z) => z.id === stop.zoneId)?.name}
                              </span>
                            )}
                            {stop.residential && <span className="ml-1.5 text-slate-400 font-normal">· residential</span>}
                            {stop.waitMinutes > 0 && <span className="ml-1.5 text-slate-400 font-normal">· {stop.waitMinutes} min wait</span>}
                          </div>
                          <div className="font-medium text-slate-800">{stop.label || '—'}</div>
                        </div>
                      </div>
                      {i < all.length - 1 && <div className="ml-2.5 border-l-2 border-dashed border-slate-200 h-3" />}
                    </React.Fragment>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-500">
                  <span>Scheduled Time Window</span>
                  <span className="font-semibold text-slate-800">{activeJobDossier.scheduledTime}</span>
                </div>
              </div>

              {/* Assigned Driver Section */}
              <div className="p-4 bg-white rounded-xl border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Driver Assignment</div>
                  <span className="text-[11px] text-slate-400">Select to reassign</span>
                </div>

                <Select
                  aria-label="Reassign driver"
                  className="w-full"
                  value={activeJobDossier.assignedDriverId || 'unassigned'}
                  onValueChange={(v) => handleReassignDriver(activeJobDossier, v)}
                  options={[
                    { value: 'unassigned', label: '— Unassigned (Needs Dispatch) —' },
                    ...drivers.map((d) => ({
                      value: d.id,
                      label: `${d.name} (${d.id}) · ${d.statusLabel} (${d.vehicle.split(' ')[0]})`
                    }))
                  ]}
                />
              </div>

              {/* Cargo & Handling Specs */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cargo & Handling</div>
                <div className="grid grid-cols-3 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400 text-[10px]">Actual Weight:</span>
                    <div className="font-semibold">
                      {activeJobDossier.pricing ? `${activeJobDossier.pricing.inputs.actualWeightKg} kg` : activeJobDossier.cargoWeight || '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Chargeable Weight:</span>
                    <div className="font-semibold">
                      {activeJobDossier.pricing ? `${activeJobDossier.pricing.inputs.chargeableWeightKg} kg` : '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Pieces:</span>
                    <div className="font-semibold">{activeJobDossier.pricing?.inputs.pieces ?? activeJobDossier.palletCount ?? '—'}</div>
                  </div>
                </div>
                {activeJobDossier.handlingInstructions && (
                  <div className="pt-2 border-t border-slate-200 text-slate-600">
                    <span className="text-slate-400 text-[10px] block">Special Instructions:</span>
                    {activeJobDossier.handlingInstructions}
                  </div>
                )}
              </div>

              {/* Customer Price — frozen Pricing Snapshot */}
              <div className="p-4 bg-white rounded-xl border border-slate-200/90">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer Price</div>
                  {activeJobDossier.pricingInput && activeJobDossier.pricing?.stage !== 'FINAL' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleReprice(activeJobDossier)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                        title="Re-run the engine against current Rate Cards"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Re-price
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFinalize(activeJobDossier)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
                        title="Settle on actuals and lock the price"
                      >
                        <Check className="w-3 h-3" />
                        Finalize
                      </button>
                    </div>
                  )}
                </div>
                {activeJobDossier.pricing ? (
                  <PriceBreakdown
                    snapshot={activeJobDossier.pricing}
                    variant="inline"
                    title={activeJobDossier.pricing.stage === 'FINAL' ? 'Final price' : 'Quoted estimate'}
                  />
                ) : (
                  <p className="text-slate-500">This order predates the pricing model and has no snapshot.</p>
                )}
                {activeJobDossier.pricingInput?.routeKm != null && (
                  <p className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
                    Priced on a {formatDistance(activeJobDossier.pricingInput.routeKm, pricingCtx.billing.general)} standalone route
                    {activeJobDossier.pricingInput.estimatedMinutes != null ? ` · ${activeJobDossier.pricingInput.estimatedMinutes} min` : ''}.
                    Operational route distance and driver assignment do not change it.
                  </p>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-white flex items-center gap-2">
              <button
                onClick={() => {
                  onSelectJob(activeJobDossier.jobNumber);
                  setActiveJobDossier(null);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
              >
                <MapPin className="w-3.5 h-3.5" />
                Locate on Monitor Map
              </button>
              <button
                onClick={() => setActiveJobDossier(null)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW ORDER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900">New Order</h3>
                <p className="text-xs text-slate-500">
                  Order facts on the left; the live estimate on the right comes from the same pricing engine as the simulator.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-5 bg-slate-50">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-7 space-y-5 text-xs">
                  {/* Order identity */}
                  <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Order</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Order Number</label>
                        <input
                          type="text"
                          value={newJobNumber}
                          onChange={(e) => setNewJobNumber(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Scheduled Window</label>
                        <input
                          type="text"
                          value={newScheduledTime}
                          onChange={(e) => setNewScheduledTime(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                        />
                      </div>
                      {!selectedCustomer && (
                        <>
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">Shipper Name (walk-in)</label>
                            <input
                              type="text"
                              placeholder="e.g. Pacific Coast Fresh"
                              value={newCustomerName}
                              onChange={(e) => setNewCustomerName(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                            <input
                              type="tel"
                              value={newCustomerPhone}
                              onChange={(e) => setNewCustomerPhone(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                            />
                          </div>
                        </>
                      )}
                      {selectedCustomer && (
                        <div className="col-span-2 text-[11px] text-slate-500">
                          Contact: <span className="font-medium text-slate-800">{selectedCustomer.contactName}</span> · {selectedCustomer.phone}
                          {selectedCustomer.rateCardId || selectedCustomer.customerGroupId ? ' · contract pricing applies' : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  <OrderPricingForm
                    value={newOrderInput}
                    onChange={setNewOrderInput}
                    ctx={pricingCtx}
                    snapshot={newOrderSnapshot}
                    showStopAddresses
                    showOverrides
                    startIndex={1}
                  />

                  {/* Dispatch */}
                  <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dispatch</h4>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Assign Driver (Optional)</label>
                      <Select
                        aria-label="Assign driver"
                        className="w-full"
                        value={newDriverId}
                        onValueChange={setNewDriverId}
                        options={[
                          { value: 'unassigned', label: '— Leave Unassigned (Staged for Dispatch) —' },
                          ...drivers.map((d) => ({ value: d.id, label: `${d.name} (${d.id}) · ${d.statusLabel}` }))
                        ]}
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Driver choice never changes the customer price.</p>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Handling Instructions</label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Liftgate required, call receiver 10m before arrival."
                        value={newInstructions}
                        onChange={(e) => setNewInstructions(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 lg:sticky lg:top-0">
                  <PriceBreakdown
                    snapshot={newOrderSnapshot}
                    targetMarginPercent={pricingCtx.billing.operatingCost.targetGrossMarginPercent}
                    title="Live estimate"
                  />
                </div>
              </div>
            </form>

            <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500">
                {newOrderSnapshot.status === 'PRICED'
                  ? 'The estimate is frozen on the order as a Pricing Snapshot.'
                  : 'The order can be created, but it will land in Needs Attention until it can be priced.'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => handleCreateSubmit(e as unknown as React.FormEvent)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  Create Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
