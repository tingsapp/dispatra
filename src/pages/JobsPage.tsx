import { DriverAvatar } from '../components/DriverAvatar';
import { ListSummary } from '../components/layout/ListSummary';
import { DriverAssignmentMenu } from '../components/entities/DriverAssignmentMenu';
import { OrderDateFilter, type OrderDateSelection } from '../components/orders/OrderDateFilter';
import { formatDateValue } from '../lib/dateValues';
import { Button } from '../components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../components/ui/Dialog';
import {
CircleCheck,
UserRoundSearch,
AlertTriangle,
ChevronRight,
Clock,
MapPin,
Package,
Phone,
Plus,
FileText,
Building2,
Tag
} from 'lucide-react';
import React,{ useMemo,useState } from 'react';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import { PageHeader } from '../components/layout/PageHeader';
import { OrderPricingForm } from '../components/pricing/OrderPricingForm';
import { PriceBreakdown } from '../components/pricing/PriceBreakdown';
import { QuotationMenu } from '../components/pricing/QuotationMenu';
import { buildQuotation } from '../lib/quotation';
import { invoiceOrder, invoiceState } from '../lib/invoicing';
import { SearchInput } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Select';
import { applyDriverVehicle,normalizeOrderInput,snapshotCustomer } from '../domain/orderAdapters';
import { loadVehicles } from '../lib/vehicleStorage';
import { lifecycleLabel,orderAttention,orderEditable,orderLifecycle,validateOrderFacts } from '../domain/validation';
import { ORDER_LIFECYCLES, ORDER_LIFECYCLE_LABELS } from '../domain/operations';
import {
createDefaultOrderInput,
describePrice,
loadPricingContext,
priceOrder
} from '../lib/orderPricing';
import { validateAssignment,validateBooking } from '../lib/organizationWorkflows';
import { formatDimension,formatWeight } from '../lib/units';
import { Driver,Job } from '../types';
import { PricingOrderInput, PricingStopInput } from '../types/pricing';
import { defaultRateCard, PricingContext } from '../lib/pricingEngine';

const priorityLabel = (p: Job['priority'] | undefined) => ({ NORMAL: 'Normal', HIGH: 'High', URGENT: 'Urgent' } as Record<string, string>)[p ?? 'NORMAL'] ?? 'Normal';
const trimUnit = (s: string) => s.replace(/\s\S+$/, '');
const formatWhen = (iso: string | undefined, timeZone: string) => iso ? new Date(iso).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone }) : '';
const dossierStops = (job: Job): PricingStopInput[] => job.pricingInput?.stops ?? [
  { id: 'pu', type: 'PICKUP', label: job.pickupAddress, zoneId: null, residential: false, waitMinutes: 0 },
  { id: 'do', type: 'DROPOFF', label: job.dropoffAddress, zoneId: null, residential: false, waitMinutes: 0 }
];
const dossierAccessorials = (job: Job, ctx: PricingContext) => (job.pricingInput?.accessorials ?? []).flatMap(a => { const item = ctx.catalogue.accessorials.find(c => c.id === a.accessorialId); return item ? [item] : []; });
/** Read-only field styled like the form's label + value pairs. */
function Detail({ label, value, hint, className = '' }: { label: string; value?: string | null; hint?: string | null; className?: string }) {
  return <div className={className}><dt className="text-xs text-slate-500">{label}</dt><dd className="text-sm text-slate-900 break-words">{value?.trim() ? value : '—'}{hint && <span className="block text-xs text-slate-500">{hint}</span>}</dd></div>;
}

interface JobsPageProps {
  jobs: Job[];
  drivers: Driver[];
  onSelectJob: (jobNumber: string) => void;
  onUpdateJob: (updatedJob: Job) => void;
  onCreateJob: (newJob: Job) => void;
  onNotification: (message: string) => void;
}

/** Next order number: one past the highest existing #number. */
const nextJobNumber = (jobs: Job[]) => `#${jobs.reduce((max, job) => Math.max(max, Number(job.jobNumber.replace(/\D/g, '')) || 0), 1000) + 1}`;
export function JobsPage({
  jobs,
  drivers,
  onSelectJob,
  onUpdateJob,
  onCreateJob,
  onNotification
}: JobsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on_time' | 'at_risk'>('all');
  const [lifecycleFilter, setLifecycleFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<OrderDateSelection>({ kind: 'all' });
  const [createMode, setCreateMode] = useState<'order' | 'quote'>('order');
  const today = formatDateValue(new Date());
  
  // Selected job for detail drawer
  const [activeJobDossier, setActiveJobDossier] = useState<Job | null>(null);
  
  // Create Job Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newScheduledTime, setNewScheduledTime] = useState('01:00 PM – 03:00 PM');
  const [newDriverId, setNewDriverId] = useState<string>('unassigned');
  const [newInstructions, setNewInstructions] = useState('');
  const [orderFields, setOrderFields] = useState<Partial<Job>>({});
  const [editingOrder, setEditingOrder] = useState<Job | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  // Pricing context is read fresh each time the modal opens so settings edits apply.
  const [pricingCtx, setPricingCtx] = useState(() => loadPricingContext());
  const [newOrderInput, setNewOrderInput] = useState<PricingOrderInput>(() => createDefaultOrderInput(pricingCtx));
  const newOrderSnapshot = useMemo(() => priceOrder(newOrderInput, pricingCtx), [newOrderInput, pricingCtx]);
  const selectedCustomer = pricingCtx.customers.find((c) => c.id === newOrderInput.customerId);

  const openCreateModal = (mode: 'order' | 'quote') => {
    const ctx = loadPricingContext();
    setCreateMode(mode); setEditingOrder(null); setOrderFields({}); setFormErrors([]);
    setPricingCtx(ctx);
    const initial = createDefaultOrderInput(ctx);
    setNewOrderInput(applyDriverVehicle({ ...initial, customerId: null, rateCardOverrideId: mode === 'quote' ? defaultRateCard(ctx.pricing.rateCards)?.id ?? null : null, stops: initial.stops.map(stop => ({ ...stop, zoneId: null })) }, undefined, []));
    setNewInstructions('');
    setNewDriverId('unassigned');
    setShowCreateModal(true);
  };

  const openEditOrder = (job: Job) => {
    if (!orderEditable(job) || !job.pricingInput) return;
    setCreateMode('order'); setPricingCtx(loadPricingContext()); setEditingOrder(job); setOrderFields({ ...job }); setFormErrors([]);
    setNewOrderInput(normalizeOrderInput({ ...structuredClone(job.pricingInput), taxCalculation: 'COMPANY' }));
    setNewInstructions(job.handlingInstructions ?? '');
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
        statusFilter === 'all' || (statusFilter === 'at_risk' ? job.status === 'at_risk' || job.status === 'late_start' : job.status === statusFilter);

      const matchesType =
        typeFilter === 'all' || job.serviceId === typeFilter;
      // Legacy demo orders have time-only schedules; treat those as today's orders.
      const scheduledDate = job.pricingInput?.scheduledAt?.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
        ?? job.scheduledTime.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
        ?? today;
      const matchesDate = dateFilter.kind === 'all' || (dateFilter.kind === 'day'
        ? scheduledDate === dateFilter.date
        : scheduledDate >= dateFilter.from && scheduledDate <= dateFilter.to);

      return matchesSearch && matchesStatus && matchesType && matchesDate && (lifecycleFilter === 'all' || (lifecycleFilter === 'attention' ? orderAttention(job).length > 0 : orderLifecycle(job) === lifecycleFilter));
    });
  }, [jobs, searchQuery, statusFilter, typeFilter, lifecycleFilter, dateFilter, today]);

  // Metrics
  const totalCount = jobs.length;
  const onTimeCount = jobs.filter((j) => j.status === 'on_time').length;
  const atRiskCount = jobs.filter((j) => j.status === 'at_risk' || j.status === 'late_start').length;
  const noDriverCount = jobs.filter(j => !j.assignedDriverId && j.status !== 'completed').length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;

  const handleReassignDriver = (job: Job, driverId: string) => {
    if (!orderEditable(job)) { onNotification('This order is locked for operational or billing changes.'); return; }
    const driver = drivers.find((d) => d.id === driverId);
    if (driver) { const errors = validateAssignment(job, driver, jobs, loadPricingContext()); if (errors.length) { onNotification(errors.join(' ')); return; } }
    const updated: Job = {
      ...job,
      assignedDriverId: driverId === 'unassigned' ? undefined : driverId,
      driverName: driver ? driver.name : undefined,
      lifecycleStatus: driverId === 'unassigned' ? 'NEW' : 'ASSIGNED',
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
    const customerName = selectedCustomer?.name ?? '';
    const pickups = newOrderInput.stops.filter((st) => st.type === 'PICKUP');
    const drops = newOrderInput.stops.filter((st) => st.type === 'DROPOFF');
    if (!selectedCustomer) {
      onNotification('Choose a shipper. Walk-ins are added under Shippers first.');
      return;
    }
    if (!pickups.length || !drops.length || newOrderInput.stops.some((st) => !st.label?.trim())) {
      onNotification('Every stop needs an address, with at least one pickup and one drop-off');
      return;
    }

    // Order numbers are assigned in the background; the API will own the sequence later.
    const normalizedNumber = editingOrder?.jobNumber ?? nextJobNumber(jobs);
    const factsErrors = validateOrderFacts(newOrderInput);
    if (selectedCustomer && ['Inactive','On Hold'].includes(selectedCustomer.status)) factsErrors.push('Choose an active shipper.');
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
    const mapStop = drops[drops.length - 1];

    const newJob: Job = {
      ...editingOrder,
      ...orderFields,
      priority: editingOrder?.priority ?? 'NORMAL',
      id: editingOrder?.id ?? crypto.randomUUID(),
      lifecycleStatus: assignedDriver ? 'ASSIGNED' : 'NEW',
      version: (editingOrder?.version ?? 0) + 1,
      createdAt: editingOrder?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customerSnapshot: editingOrder && editingOrder.customerId === newOrderInput.customerId ? editingOrder.customerSnapshot : snapshotCustomer(selectedCustomer)!,
      billingCustomerSnapshot: editingOrder && editingOrder.billingCustomerId === orderFields.billingCustomerId ? editingOrder.billingCustomerSnapshot : snapshotCustomer(pricingCtx.customers.find(c => c.id === orderFields.billingCustomerId)),
      jobNumber: normalizedNumber,
      status: assignedDriver ? 'on_time' : 'no_driver',
      statusLabel: assignedDriver ? 'On Time' : 'No Driver',
      riskText: assignedDriver ? `Assigned to ${assignedDriver.name}` : 'Needs dispatch',
      customerName: editingOrder && editingOrder.customerId === newOrderInput.customerId ? editingOrder.customerName : customerName,
      customerPhone: editingOrder && editingOrder.customerId === newOrderInput.customerId ? editingOrder.customerPhone : selectedCustomer.phone,
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
      lat: mapStop?.latitude ?? editingOrder?.lat ?? 49.2827,
      lng: mapStop?.longitude ?? editingOrder?.lng ?? -123.1207,
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

  const handleInvoice = (job: Job) => {
    try {
      const updated = invoiceOrder(job, loadPricingContext());
      onUpdateJob(updated);
      if (activeJobDossier?.id === job.id) setActiveJobDossier(updated);
      onNotification(`${job.jobNumber} invoiced — $${updated.pricing!.total.toFixed(2)} ${updated.pricing!.currency} to ${updated.invoicePreview?.billingEmail || 'the shipper'}`);
    } catch (error) { onNotification(error instanceof Error ? error.message : 'The order could not be invoiced.'); }
  };
  useEntityDialog(!!activeJobDossier || showCreateModal, () => { setActiveJobDossier(null); setShowCreateModal(false); });

  return (
    <div className="app-page app-list-page h-full w-full flex flex-col overflow-hidden font-sans">
      {/* HEADER BAR */}
      <PageHeader title="Orders" description="Order details, shipper pricing, time windows and assignments." actions={<>
          <Button type="button" variant="outline" onClick={() => openCreateModal('quote')} className="app-action app-secondary"><Plus className="w-3.5 h-3.5" />New Quote</Button>
          <Button
            type="button"
            onClick={() => openCreateModal('order')}
            className="app-action app-primary flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Order</span>
          </Button>
      </>} />

      {/* BODY CONTENT */}
      <div className="page-content flex-1 overflow-y-auto py-6 space-y-6">
        <ListSummary label="Orders summary" items={[
          { label: 'Total', value: totalCount, icon: Package },
          { label: 'On schedule', value: onTimeCount, icon: Clock },
          { label: 'At risk / late', value: atRiskCount, icon: AlertTriangle },
          { label: 'Unassigned', value: noDriverCount, icon: UserRoundSearch },
          { label: 'Completed', value: completedCount, icon: CircleCheck },
        ]} />

        {/* SEARCH & FILTERS BAR */}
        <div className="app-list-toolbar">
          <SearchInput className="app-list-search"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search orders, references, recipients or addresses..."
          />

          <div className="app-list-filters">
            {/* Status Filter Buttons */}
            <div className="app-list-status">
              <button
                onClick={() => setStatusFilter('all')}
                aria-pressed={statusFilter === 'all'}
                className="app-tab inline-flex items-center gap-2 whitespace-nowrap"
              >
                All ({jobs.length})
              </button>
              <button
                onClick={() => setStatusFilter('on_time')}
                aria-pressed={statusFilter === 'on_time'}
                className="app-tab inline-flex items-center gap-2 whitespace-nowrap"
              >
                On Schedule
              </button>
              <button
                onClick={() => setStatusFilter('at_risk')}
                aria-pressed={statusFilter === 'at_risk'}
                className="app-tab inline-flex items-center gap-2 whitespace-nowrap"
              >
                At Risk
              </button>
            </div>

            <OrderDateFilter value={dateFilter} onValueChange={setDateFilter} today={today} />
            <Select aria-label="Filter by order status" value={lifecycleFilter} onValueChange={setLifecycleFilter} options={[{ value: 'all', label: 'All order statuses' }, ...ORDER_LIFECYCLES.map(value => ({ value, label: ORDER_LIFECYCLE_LABELS[value] })), { value: 'attention', label: 'Needs attention' }]} />
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
        <div className="app-table-shell bg-white overflow-hidden">
          {filteredJobs.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="app-section-title text-slate-800">No orders match your filter</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Try adjusting your search criteria or switch status filter tabs.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setTypeFilter('all'); setLifecycleFilter('all'); setDateFilter({ kind: 'all' });
                }}
                className="mt-4 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table aria-label="Orders" className="app-table w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4">Order / Status</th>
                  <th className="py-3 px-4">Shipper</th>
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
                  const readyToInvoice = invoiceState(job) === 'READY';

                  return (
                    <tr
                      key={job.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setActiveJobDossier(job)}
                    >
                      {/* Job Number & Status Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{job.jobNumber}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{lifecycleLabel(job)}</span>
                          {orderAttention(job).map(a => <span key={a.flag} className="text-xs text-amber-700" title={a.detail}>{a.label}</span>)}
                          {readyToInvoice && <span className="text-xs text-amber-700" title="Completed order ready for invoicing">Invoice</span>}
                        </div>
                        {job.riskText && (
                          <div className="text-xs text-slate-500 mt-0.5 font-normal">
                            {job.riskText}
                          </div>
                        )}
                      </td>

                      {/* Shipper */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{job.customerName}</div>
                        <div className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">
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
                        <div className="text-xs text-slate-400 mt-0.5">
                          {job.pricingInput?.stops.length ?? job.stopsCount} stops on manifest
                        </div>
                      </td>

                      {/* Assigned Driver */}
                      <td className="py-3.5 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {assignedDriver ? (
                          <div className="flex items-center gap-2">
                            <DriverAvatar name={assignedDriver.name} avatar={assignedDriver.avatar} alt={assignedDriver.name} className="w-6 h-6 rounded-full object-cover border border-slate-200" />
                            <div>
                              <div className="font-medium text-slate-800 flex items-center gap-1">
                                {assignedDriver.name}
                                <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1 py-0.2 rounded">
                                  {assignedDriver.id}
                                </span>
                              </div>
                              <div className="text-xs text-slate-400">
                                {assignedDriver.vehicle.split(' ')[0]} • {assignedDriver.eta}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <DriverAssignmentMenu drivers={drivers} open={reassigningJobId === job.id}
                            onOpenChange={open => setReassigningJobId(open ? job.id : null)}
                            onSelect={driverId => handleReassignDriver(job, driverId)} />
                        )}
                      </td>

                      {/* Service & Price */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-medium text-slate-800">{job.serviceLevel || job.jobType}</span>
                        {(() => {
                          const price = describePrice(job);
                          return (
                            <div
                              className={`text-xs mt-0.5 font-medium ${
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
                          {readyToInvoice && <Button type="button" size="xs" variant="outline" onClick={() => handleInvoice(job)}><FileText /> Invoice</Button>}
                          <button
                            onClick={() => onSelectJob(job.jobNumber)}
                            title="Locate on Monitor"
                            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
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

      {/* JOB DOSSIER DIALOG */}
      {activeJobDossier && (
        <Dialog size="md" onClose={() => setActiveJobDossier(null)}>
          <DialogHeader onClose={() => setActiveJobDossier(null)} title={<>
            <span>{activeJobDossier.jobNumber}</span>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">{activeJobDossier.serviceLevel || activeJobDossier.jobType}</span>
            {activeJobDossier.pricing?.status === 'PRICED' && <span className="text-sm font-normal text-slate-600">${activeJobDossier.pricing.total.toFixed(2)} {activeJobDossier.pricing.currency}</span>}
          </>} />
          {/* One bordered section per New Order form section; inner groups are borderless grey */}
          <DialogBody className="space-y-5">
              <section className="rounded-xl border border-slate-200 p-5">
                <h4 className="app-section-title flex items-center gap-1.5 mb-3"><Building2 className="w-3.5 h-3.5 text-slate-700" /><span>Shipper & Service</span></h4>
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3">
                  <Detail label="Shipper" value={activeJobDossier.customerName} hint={activeJobDossier.customerPhone} />
                  <Detail label="Service" value={activeJobDossier.serviceLevel || activeJobDossier.jobType} />
                  <Detail label="Priority" value={priorityLabel(activeJobDossier.priority)} />
                </dl>
              </section>

              <section className="rounded-xl border border-slate-200 p-5">
                <h4 className="app-section-title flex items-center gap-1.5 mb-3"><MapPin className="w-3.5 h-3.5 text-slate-700" /><span>Stops</span></h4>
                <div className="space-y-3">
                  {dossierStops(activeJobDossier).map((stop, i) => <div key={stop.id} className="rounded-lg bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${stop.type === 'PICKUP' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{i + 1} · {stop.type === 'PICKUP' ? 'Pickup' : 'Drop-off'}</span>
                      {stop.residential && <span className="text-xs text-slate-500">Residential</span>}
                    </div>
                    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3">
                      <Detail label={stop.type === 'PICKUP' ? 'Pickup address' : 'Delivery address'} value={stop.label} className={stop.zoneId ? 'sm:col-span-2' : 'sm:col-span-3'} />
                      {stop.zoneId && <Detail label="Zone" value={pricingCtx.pricing.zones.find(z => z.id === stop.zoneId)?.name ?? '—'} />}
                      <Detail label="Contact name" value={stop.contactName} />
                      <Detail label="Phone" value={stop.contactPhone} />
                      <Detail label={stop.type === 'PICKUP' ? 'Ready at' : 'Deliver by'} value={formatWhen(stop.type === 'PICKUP' ? stop.windowStart : stop.windowEnd, pricingCtx.billing.general.timeZone)} />
                    </dl>
                  </div>)}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 p-5">
                <h4 className="app-section-title flex items-center gap-1.5 mb-3"><Package className="w-3.5 h-3.5 text-slate-700" /><span>Packages</span></h4>
                {activeJobDossier.pricingInput?.packages.length ? <div className="rounded-lg bg-slate-50 p-4 overflow-x-auto"><table aria-label="Order packages" className="app-table app-table-plain w-full">
                  <thead><tr><th scope="col" className="text-left">Qty</th><th scope="col" className="text-left">Weight ({pricingCtx.billing.general.weightUnit})</th><th scope="col" className="text-left">L × W × H ({pricingCtx.billing.general.dimensionUnit})</th><th scope="col" className="text-left">Fragile</th><th scope="col" className="text-left">DG</th></tr></thead>
                  <tbody>{activeJobDossier.pricingInput.packages.map(p => <tr key={p.id}><td>{p.quantity}</td><td>{trimUnit(formatWeight(p.weightKg, pricingCtx.billing.general))}</td><td>{[p.lengthCm, p.widthCm, p.heightCm].map(cm => trimUnit(formatDimension(cm, pricingCtx.billing.general))).join(' × ')}</td><td>{p.fragile ? 'Yes' : '—'}</td><td>{p.handlingTags?.includes('DANGEROUS_GOODS') ? 'Yes' : '—'}</td></tr>)}</tbody>
                </table></div> : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{activeJobDossier.cargoWeight ? `Cargo ${activeJobDossier.cargoWeight}` : 'No package details recorded.'}</p>}
              </section>

              <section className="rounded-xl border border-slate-200 p-5">
                <h4 className="app-section-title flex items-center gap-1.5 mb-3"><Tag className="w-3.5 h-3.5 text-slate-700" /><span>Accessorials</span></h4>
                {dossierAccessorials(activeJobDossier, pricingCtx).length ? <dl className="rounded-lg bg-slate-50 p-4 space-y-2">{dossierAccessorials(activeJobDossier, pricingCtx).map(a => <div key={a.id} className="flex items-center justify-between gap-3 text-sm"><dt className="text-slate-800">{a.name}</dt><dd className="text-slate-500 tabular-nums">${a.rate.toFixed(2)}</dd></div>)}</dl> : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No extra charges added.</p>}
              </section>

              <section className="rounded-xl border border-slate-200 p-5 space-y-3">
                <h4 className="app-section-title">Dispatch</h4>
                <div>
                  <label className="app-label">Assigned driver</label>
                  <Select
                    aria-label="Reassign driver"
                    className="w-full"
                    value={activeJobDossier.assignedDriverId || 'unassigned'}
                    onValueChange={(v) => handleReassignDriver(activeJobDossier, v)}
                    options={[
                      { value: 'unassigned', label: '— Unassigned (Needs Dispatch) —' },
                      ...drivers.map((d) => ({ value: d.id, label: `${d.name} (${d.id}) · ${d.statusLabel} (${d.vehicle.split(' ')[0]})` }))
                    ]}
                  />
                </div>
                <dl><Detail label="Handling instructions" value={activeJobDossier.handlingInstructions} /></dl>
              </section>

              <section className="rounded-xl border border-slate-200 p-5">
                <h4 className="app-section-title mb-3">Price</h4>
                {activeJobDossier.pricing
                  ? <PriceBreakdown snapshot={activeJobDossier.pricing} variant="inline" showCalculationSection={false} title={activeJobDossier.pricing.stage === 'FINAL' ? 'Final price' : 'Quoted estimate'} />
                  : <p className="text-sm text-slate-500">This order predates the pricing model and has no snapshot.</p>}
              </section>
          </DialogBody>
          <DialogFooter>
            {orderEditable(activeJobDossier) && <Button variant="outline" onClick={() => openEditOrder(activeJobDossier)}>Edit order</Button>}
            <Button onClick={() => { onSelectJob(activeJobDossier.jobNumber); setActiveJobDossier(null); }}><MapPin /> Locate on Monitor</Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* CREATE NEW ORDER MODAL */}
      {showCreateModal && (
        <Dialog size="xl" onClose={() => setShowCreateModal(false)}>
          <DialogHeader onClose={() => setShowCreateModal(false)} title={editingOrder ? 'Edit Order' : createMode === 'quote' ? 'New Quote' : 'New Order'} description={createMode === 'quote' ? 'Enter shipment details to prepare a quotation without creating an order.' : 'Enter the order details on the left to see its live price estimate on the right.'} />
            <form onSubmit={createMode === 'quote' ? event => event.preventDefault() : handleCreateSubmit} className="app-dialog-body bg-slate-50 pt-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-7 space-y-5 text-xs">
                  {!!formErrors.length && <p role="alert" className="text-xs text-rose-700">{formErrors.join(" ")}</p>}

                  <OrderPricingForm
                    showVehicleSelection={!!editingOrder}
                    customerMode={createMode === 'quote' ? 'rateCard' : 'shipper'}
                    value={newOrderInput}
                    onChange={v => { if (v.customerId !== newOrderInput.customerId) { const c = pricingCtx.customers.find(c => c.id === v.customerId); setOrderFields({ ...orderFields, notificationPreferences: c?.communicationPreferences }); setNewInstructions(c?.instructions ?? ''); } setNewOrderInput(v); }}
                    ctx={pricingCtx}
                    snapshot={newOrderSnapshot}
                    showStopAddresses
                    startIndex={1}
                  />

                  {/* Dispatch applies only when creating or editing an order. */}
                  {createMode === 'order' && <div className="app-panel space-y-3">
                    <h4 className="app-section-title text-slate-500">Dispatch</h4>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Assign Driver (Optional)</label>
                      <Select
                        aria-label="Assign driver"
                        className="w-full"
                        value={newDriverId}
                        onValueChange={driverId => {
                          setNewDriverId(driverId);
                          if (!editingOrder) setNewOrderInput(input => applyDriverVehicle(input, drivers.find(driver => driver.id === driverId), loadVehicles()));
                        }}
                        options={[
                          { value: 'unassigned', label: '— Leave Unassigned (Staged for Dispatch) —' },
                          ...drivers.map((d) => ({ value: d.id, label: `${d.name} (${d.id}) · ${d.statusLabel}` }))
                        ]}
                      />
                      <p className="text-xs text-slate-500 mt-1">{editingOrder ? 'Driver choice never changes the shipper price.' : 'Uses the vehicle attached to the selected driver.'}</p>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Handling Instructions</label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Liftgate required, call receiver 10m before arrival."
                        value={newInstructions}
                        onChange={(e) => setNewInstructions(e.target.value)}
                        className="app-input w-full"
                      />
                    </div>
                  </div>}
                </div>

                <div className="lg:col-span-5 lg:sticky lg:top-0">
                  <PriceBreakdown
                    snapshot={newOrderSnapshot}
                    title={createMode === 'quote' ? 'Live quote' : 'Live estimate'}
                  />
                </div>
              </div>
            </form>

            <DialogFooter note={createMode === 'quote' ? 'Sending a quote does not create an order.' : newOrderSnapshot.status === 'PRICED' ? 'The estimate is frozen on the order as a Pricing Snapshot.' : 'The order can be created, but it will land in Needs Attention until it can be priced.'}>
              {createMode === 'quote'
                ? newOrderSnapshot.status === 'PRICED' && !!newOrderInput.rateCardOverrideId
                  ? <QuotationMenu buildQuotation={() => buildQuotation(newOrderInput, newOrderSnapshot, pricingCtx)} onNotification={onNotification} triggerLabel="Send Quote" prominent allowRecipientEntry />
                  : <Button type="button" disabled>Send Quote</Button>
                : <Button type="button" onClick={(e) => handleCreateSubmit(e as unknown as React.FormEvent)}>{editingOrder ? 'Save Order' : 'Create Order'}</Button>}
            </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
