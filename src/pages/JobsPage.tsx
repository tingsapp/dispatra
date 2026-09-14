import { useEntityDialog } from '../components/entities/useEntityDialog';
import { csv } from '../domain/csv';
import { OrderFields, OrderDetails } from '../components/entities/OrderFields';
import { StopDetails } from '../components/entities/StopItemFields';
import { validateOrderFacts, orderEditable, lifecycleLabel, orderLifecycle } from '../domain/validation';
import { normalizeOrderInput, snapshotCustomer } from '../domain/orderAdapters';
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
import { validateBooking, validateAssignment, createInvoicePreview } from '../lib/organizationWorkflows';
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
  const [lifecycleFilter, setLifecycleFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // Selected job for detail drawer
  const [activeJobDossier, setActiveJobDossier] = useState<Job | null>(null);
  
  // Create Job Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newJobNumber, setNewJobNumber] = useState(`#${Math.floor(480 + Math.random() * 40)}`);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newScheduledTime, setNewScheduledTime] = useState('01:00 PM – 03:00 PM');
  const [newDriverId, setNewDriverId] = useState<string>('unassigned');
  const [newInstructions, setNewInstructions] = useState('');
  const [orderFields, setOrderFields] = useState<Partial<Job>>({});
  const [editingOrder, setEditingOrder] = useState<Job | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  // Pricing context is read fresh each time the modal opens so settings edits apply.
  const [pricingCtx, setPricingCtx] = useState(() => loadPricingContext());
  const [newOrderInput, setNewOrderInput] = useState<PricingOrderInput>(() => createDefaultOrderInput(pricingCtx));
  const newOrderSnapshot = useMemo(() => calculatePricing(newOrderInput, pricingCtx), [newOrderInput, pricingCtx]);
  const selectedCustomer = pricingCtx.customers.find((c) => c.id === newOrderInput.customerId);

  const openCreateModal = () => {
    const ctx = loadPricingContext();
    setEditingOrder(null); setOrderFields({}); setFormErrors([]);
    setPricingCtx(ctx);
    setNewOrderInput(createDefaultOrderInput(ctx));
    setNewJobNumber(`#${Math.floor(480 + Math.random() * 40)}`);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewInstructions('');
    setNewDriverId('unassigned');
    setShowCreateModal(true);
  };

  const openEditOrder = (job: Job) => {
    if (!orderEditable(job) || !job.pricingInput) return;
    setPricingCtx(loadPricingContext()); setEditingOrder(job); setOrderFields({ ...job }); setFormErrors([]);
    setNewOrderInput(normalizeOrderInput(structuredClone(job.pricingInput))); setNewJobNumber(job.jobNumber);
    setNewCustomerName(job.customerName); setNewCustomerPhone(job.customerPhone); setNewInstructions(job.handlingInstructions ?? '');
    setNewScheduledTime(job.scheduledTime); setNewDriverId(job.assignedDriverId ?? 'unassigned'); setActiveJobDossier(null); setShowCreateModal(true);
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
        (job.assignedDriverId && job.assignedDriverId.toLowerCase().includes(q)) || [job.referenceNumbers, ...(job.tags ?? []), ...(job.pricingInput?.stops.map(s => [s.label, s.contactName, s.contactPhone].join(' ')) ?? [])].join(' ').toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'at_risk' ? job.status === 'at_risk' || job.status === 'late_start' : statusFilter === 'no_driver' ? !job.assignedDriverId && job.status !== 'completed' : job.status === statusFilter);

      const matchesType =
        typeFilter === 'all' || job.serviceId === typeFilter;

      return matchesSearch && matchesStatus && matchesType && (lifecycleFilter === 'all' || orderLifecycle(job) === lifecycleFilter);
    });
  }, [jobs, searchQuery, statusFilter, typeFilter, lifecycleFilter]);

  // Metrics
  const totalCount = jobs.length;
  const onTimeCount = jobs.filter((j) => j.status === 'on_time').length;
  const atRiskCount = jobs.filter((j) => j.status === 'at_risk' || j.status === 'late_start').length;
  const noDriverCount = jobs.filter(j => !j.assignedDriverId && j.status !== 'completed').length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;

  const handleExportCSV = () => {
    const content = csv([
      ['Order number','Order status','Risk','Customer','Reference / PO','Priority','Stops in order','Scheduled','Driver','Service','Pricing status','Currency','Subtotal','Tax','Total'],
      ...filteredJobs.map(j => [j.jobNumber,lifecycleLabel(j),j.status === 'at_risk' || j.status === 'late_start' ? j.statusLabel : '',j.customerName,j.referenceNumbers,j.priority ?? 'NORMAL',j.pricingInput?.stops.map((s,i) => `${i+1}. ${s.type}: ${s.label} (${s.contactName ?? ''})`).join(' | '),j.scheduledTime,j.assignedDriverId,j.serviceLevel,j.pricing?.status,j.pricing?.currency,j.pricing?.subtotal,j.pricing?.taxTotal,j.pricing?.total])
    ]);
    const encodedUri = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dispatra_orders_manifest_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(encodedUri);
    onNotification(`Exported ${filteredJobs.length} jobs to CSV manifest`);
  };

  const handleReassignDriver = (job: Job, driverId: string) => {
    if (!orderEditable(job)) { onNotification('This order is locked for operational or billing changes.'); return; }
    const driver = drivers.find((d) => d.id === driverId);
    if (driver) { const errors = validateAssignment(job, driver, jobs, loadPricingContext()); if (errors.length) { onNotification(errors.join(' ')); return; } }
    const updated: Job = {
      ...job,
      assignedDriverId: driverId === 'unassigned' ? undefined : driverId,
      driverName: driver ? driver.name : undefined,
      lifecycleStatus: driverId === 'unassigned' ? 'READY_FOR_DISPATCH' : 'ASSIGNED',
      version: (job.version ?? 1) + 1,
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

    const normalizedNumber = newJobNumber.trim().startsWith('#') ? newJobNumber.trim() : `#${newJobNumber.trim()}`;
    const factsErrors = validateOrderFacts(newOrderInput);
    if (!newJobNumber.trim() || jobs.some(j => j.id !== editingOrder?.id && j.jobNumber.toLowerCase() === normalizedNumber.toLowerCase())) factsErrors.push('Enter a unique order number.');
    if (selectedCustomer && ['Inactive','On Hold'].includes(selectedCustomer.status)) factsErrors.push('Choose an active customer.');
    const latest = editingOrder && jobs.find(j => j.id === editingOrder.id);
    if (editingOrder && (!latest || !orderEditable(latest) || (latest.version ?? 1) !== (editingOrder.version ?? 1))) factsErrors.push('Order changed while editing. Close and reopen it before saving.');
    setFormErrors(factsErrors);
    if (factsErrors.length) { onNotification(factsErrors.join(' ')); return; }
    const bookingErrors = validateBooking(newOrderInput, pricingCtx);
    if (bookingErrors.length) { onNotification(bookingErrors.join(' ')); return; }
    const assignedDriver = drivers.find((d) => d.id === newDriverId);
    const service = pricingCtx.catalogue.services.find((sv) => sv.id === newOrderInput.serviceId);
    const snapshot = priceOrder(newOrderInput, pricingCtx);
    if (assignedDriver) { const errors = validateAssignment({ ...orderFields, version: (editingOrder?.version ?? 0) + 1, id: editingOrder?.id ?? 'new', status: 'no_driver', pricing: snapshot, pricingInput: newOrderInput }, assignedDriver, jobs, pricingCtx); if (errors.length) { onNotification(errors.join(' ')); return; } }
    const totalKg = newOrderInput.packages.reduce((n, p) => n + p.quantity * p.weightKg, 0);

    const newJob: Job = {
      ...editingOrder,
      ...orderFields,
      id: editingOrder?.id ?? crypto.randomUUID(),
      lifecycleStatus: assignedDriver ? 'ASSIGNED' : snapshot.status === 'PRICED' ? 'READY_FOR_DISPATCH' : 'SUBMITTED',
      version: (editingOrder?.version ?? 0) + 1,
      createdAt: editingOrder?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customerSnapshot: editingOrder && editingOrder.customerId === newOrderInput.customerId ? editingOrder.customerSnapshot : snapshotCustomer(selectedCustomer) ?? { id: null, name: customerName, phone: newCustomerPhone, email: '', billingEmail: '' },
      billingCustomerSnapshot: editingOrder && editingOrder.billingCustomerId === orderFields.billingCustomerId ? editingOrder.billingCustomerSnapshot : snapshotCustomer(pricingCtx.customers.find(c => c.id === orderFields.billingCustomerId)),
      jobNumber: normalizedNumber,
      status: assignedDriver ? 'on_time' : 'no_driver',
      statusLabel: assignedDriver ? 'On Time' : 'No Driver',
      riskText: assignedDriver ? `Assigned to ${assignedDriver.name}` : 'Needs dispatch',
      customerName: editingOrder && editingOrder.customerId === newOrderInput.customerId ? editingOrder.customerName : customerName,
      customerPhone: editingOrder && editingOrder.customerId === newOrderInput.customerId ? editingOrder.customerPhone : selectedCustomer?.phone ?? newCustomerPhone,
      customerEmail: editingOrder && editingOrder.customerId === newOrderInput.customerId ? editingOrder.customerEmail : selectedCustomer?.email,
      pickupAddress: pickups[0].label!,
      dropoffAddress: drops[drops.length - 1].label!,
      scheduledTime: [newOrderInput.scheduledAt, newOrderInput.scheduledEndAt].filter(Boolean).join(' – ') || 'Unscheduled',
      jobType: service?.name ?? 'Delivery',
      serviceLevel: service?.name,
      assignedDriverId: assignedDriver ? assignedDriver.id : undefined,
      driverName: assignedDriver ? assignedDriver.name : undefined,
      cargoWeight: formatWeight(totalKg, pricingCtx.billing.general),
      palletCount: newOrderInput.packages.reduce((n, p) => n + p.quantity, 0),
      handlingInstructions: newInstructions || undefined,
      stopsCount: newOrderInput.stops.length,
      lat: editingOrder?.lat ?? 49.2827,
      lng: editingOrder?.lng ?? -123.1207,
      customerId: newOrderInput.customerId,
      serviceId: newOrderInput.serviceId,
      vehicleId: newOrderInput.vehicleId,
      pricingInput: newOrderInput,
      pricing: snapshot
    };

    if (editingOrder) onUpdateJob(newJob); else onCreateJob(newJob);
    setShowCreateModal(false);
    onNotification(
      snapshot.status === 'PRICED'
        ? `${editingOrder ? 'Updated' : 'Created'} ${newJob.jobNumber} — quoted $${snapshot.total.toFixed(2)} ${snapshot.currency}`
        : `${editingOrder ? 'Updated' : 'Created'} ${newJob.jobNumber} — pricing needs attention`
    );
  };

  /** Re-run the engine against current settings (estimate stage only). */
  const handleReprice = (job: Job) => {
    if (!job.pricingInput || !orderEditable(job)) return;
    const updated: Job = { ...job, pricing: priceOrder(job.pricingInput), version: (job.version ?? 1) + 1 };
    onUpdateJob(updated);
    setActiveJobDossier(updated);
    onNotification(`${job.jobNumber} re-priced against current Rate Cards`);
  };

  /** Completion pricing: settle on actuals and lock the snapshot. */
  const handleFinalize = (job: Job) => {
    if (!job.pricingInput || job.pricing?.stage === 'FINAL') return;
    const hourly = job.pricing?.method === 'HOURLY';
    const actual = hourly ? window.prompt('Actual billable minutes for the agreed hourly clock (required when settling actuals):', String(job.pricingInput.actualHourlyBillableMinutes ?? '')) : '';
    if (actual === null) return;
    const minutes = actual.trim() === '' ? null : Number(actual);
    if (minutes != null && (!Number.isFinite(minutes) || minutes < 0)) { onNotification('Enter valid nonnegative minutes.'); return; }
    const ctx = loadPricingContext();
    const { input, snapshot } = finalizeOrderPrice(job.pricingInput, minutes, ctx, job.pricing);
    if (snapshot.status !== 'PRICED') { onNotification(snapshot.errors.map(e => e.message).join(' ')); return; }
    const updated: Job = { ...job, pricingInput: input, pricing: snapshot, invoicePreview: job.invoicePreview ?? createInvoicePreview(job.id, snapshot, ctx) };
    onUpdateJob(updated);
    setActiveJobDossier(updated);
    onNotification(`${job.jobNumber} price finalized at $${snapshot.total.toFixed(2)} ${snapshot.currency}`);
  };

  useEntityDialog(!!activeJobDossier || showCreateModal, () => { setActiveJobDossier(null); setShowCreateModal(false); });

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
                Order details, customer pricing, time windows and assignments
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
              <span>Total Orders</span>
              <Package className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{totalCount}</div>
            <div className="mt-1 text-[11px] text-slate-500">All saved orders</div>
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
            placeholder="Search orders, references, recipients or addresses..."
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

            <Select aria-label="Filter by order status" value={lifecycleFilter} onValueChange={setLifecycleFilter} options={[{value:'all',label:'All order statuses'}, ...['DRAFT','SUBMITTED','PRICED','READY_FOR_DISPATCH','ASSIGNED','IN_EXECUTION','COMPLETED','BILLING_FINALIZATION','INVOICED','CANCELLED','FAILED','NEEDS_ATTENTION'].map(value => ({value,label:value.replaceAll('_',' ')}))]} />
            {/* Service Type Filter */}
            <Select
              aria-label="Filter by service level"
              value={typeFilter}
              onValueChange={setTypeFilter}
              align="end"
              options={[
                { value: 'all', label: 'All Service Levels' }, ...pricingCtx.catalogue.services.map(s => ({value:s.id,label:s.name}))
              ]}
            />
          </div>
        </div>

        {/* JOBS TABLE */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          {filteredJobs.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-800">No orders match your filter</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Try adjusting your search criteria or switch status filter tabs.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setTypeFilter('all'); setLifecycleFilter('all');
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
                  <th className="py-3 px-4">Order / Status</th>
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
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{lifecycleLabel(job)}</span>
                          {(job.status === 'at_risk' || job.status === 'late_start') && <span className="text-[11px] text-amber-700">{job.statusLabel}</span>}
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
                          {job.pricingInput?.stops.length ?? job.stopsCount} stops on manifest
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
        <div
          data-entity-dialog
          className="fixed inset-0 bg-slate-900/40 z-50 flex justify-end animate-in fade-in duration-150"
          onClick={(event) => {
            if (event.target === event.currentTarget) setActiveJobDossier(null);
          }}
        >
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

              <OrderDetails order={activeJobDossier} />
              {orderEditable(activeJobDossier) && <button className="px-3 py-2 rounded-lg bg-slate-900 text-white" onClick={() => openEditOrder(activeJobDossier)}>Edit order</button>}
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
                          <div className="font-medium text-slate-800">{stop.label || '—'}</div><StopDetails stop={stop} />
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
                  <span className="text-[11px] text-slate-400">Validates order limits and exclusive service; route feasibility is not yet connected.</span>
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
                {activeJobDossier.pricing?.quoteExpiresAt && activeJobDossier.pricing.stage !== 'FINAL' && <p className="text-xs text-slate-600">Quote expires: {new Date(activeJobDossier.pricing.quoteExpiresAt).toLocaleString()} {Date.now() > Date.parse(activeJobDossier.pricing.quoteExpiresAt) ? '— expired; re-price before accepting' : ''}</p>}
                {activeJobDossier.invoicePreview && <div className="mt-3 p-3 border rounded-lg text-xs space-y-1"><h4 className="font-semibold">Invoice preview — local only, not sent</h4><p>Due: {new Date(activeJobDossier.invoicePreview.dueAt).toLocaleDateString()}</p><p>Billing email: {activeJobDossier.invoicePreview.billingEmail || 'Missing'}</p><p>Tax registration: {activeJobDossier.invoicePreview.taxRegistrationNumber || 'Not configured'}</p><p>Finalized total: {activeJobDossier.invoicePreview.total.toFixed(2)} {activeJobDossier.invoicePreview.currency}</p><p>Uses the finalized charge lines above. Invoice issuance and email sending are not connected.</p></div>}
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
        <div data-entity-dialog className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{editingOrder ? 'Edit Order' : 'New Order'}</h3>
                <p className="text-xs text-slate-500">
                  Enter the order details on the left to see its live price estimate on the right.
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
                  <OrderFields value={orderFields} onChange={v => { setOrderFields(v); setNewOrderInput({ ...newOrderInput, billingCustomerId: v.billingCustomerId }); }} customers={pricingCtx.customers} />
                  {!!formErrors.length && <p role="alert" className="text-xs text-rose-700">{formErrors.join(" ")}</p>}
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
                    onChange={v => { if (v.customerId !== newOrderInput.customerId) { const c = pricingCtx.customers.find(c => c.id === v.customerId); setOrderFields({ ...orderFields, notificationPreferences: c?.communicationPreferences }); setNewInstructions(c?.instructions ?? ''); } setNewOrderInput(v); }}
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
                  {editingOrder ? 'Save Order' : 'Create Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
