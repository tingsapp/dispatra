import { clockText } from '../lib/dateTimeFormat';
import { DriverAvatar } from '../components/DriverAvatar';
import { ListSummary } from '../components/layout/ListSummary';
import { DriverAssignmentMenu } from '../components/entities/DriverAssignmentMenu';
import { OrderDateFilter, type OrderDateSelection } from '../components/orders/OrderDateFilter';
import { formatDateValue } from '../lib/dateValues';
import { Button } from '../components/ui/button';
import { Dialog, DialogFooter, DialogHeader } from '../components/ui/Dialog';
import {
CircleCheck,
UserRoundSearch,
AlertTriangle,
ChevronRight,
Clock,
MapPin,
Package,
Mail,
Phone,
Plus,
Navigation
} from 'lucide-react';
import React,{ useEffect,useMemo,useRef,useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { companySlugForCurrentPath } from '../lib/pageRoutes';
import { allOperations, operations, type CatalogItem } from '../operations/api';
import { catalogFromUi } from '../operations/pricingAdapters';
import { assignableRoute, assignToDriver } from '../operations/assignment';
import { draftToInput, emailDraftRow, inputToBooking } from '../operations/orderAdapters';
import { OrderDetailsDialog } from '../components/orders/OrderDetailsDialog';
import { EMAIL_DRAFT_STATUSES, IntakeDialog, type EmailDraft } from '../components/orders/EmailIntake';
import { useCompanyPricingContext, useOrderAssignment, useOrderCompletion } from '../components/orders/useOrderDetails';
import { useOrderPreview } from '../components/orders/useOrderPreview';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import { PageHeader } from '../components/layout/PageHeader';
import { OrderPricingForm } from '../components/pricing/OrderPricingForm';
import { AccessorialModal } from '../components/pricing/AccessorialModal';
import { PriceBreakdown } from '../components/pricing/PriceBreakdown';
import { withSurchargeRows } from '../lib/surchargeRows';
import { resolveFuelPercent } from '../lib/billingEngine';
import { QuotationMenu } from '../components/pricing/QuotationMenu';
import { buildQuotation } from '../lib/quotation';
import { SearchInput } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Select';
import { companyRateRows, travelRows } from '../lib/companyTax';
import { normalizeOrderInput,snapshotCustomer } from '../domain/orderAdapters';
import { lifecycleLabel,orderAttention,orderEditable,orderLifecycle,validateOrderFacts } from '../domain/validation';
import { ORDER_LIFECYCLES, ORDER_LIFECYCLE_LABELS } from '../domain/operations';
import {
createBookingInput,
createDefaultOrderInput,
describePrice,
loadPricingContext,
priceOrder
} from '../lib/orderPricing';
import { validateAssignment,validateBooking,validateBookingSchedule } from '../lib/organizationWorkflows';
import { formatWeight } from '../lib/units';
import { Driver,Job } from '../types';
import { PricingOrderInput } from '../types/pricing';
import { defaultRateCard } from '../lib/pricingEngine';
import { loadSimplePricingConfig, saveSimplePricingConfig } from '../lib/simplePricingStorage';
import type { AccessorialItem } from '../types/simplePricing';
import { formatPhone } from '../lib/phone';
import { formatWhen } from '../components/orders/OrderDossierSections';
import { OrderTrackingDialog, trackable } from '../components/orders/OrderTracking';

interface JobsPageProps {
  jobs: Job[];
  drivers: Driver[];
  onSelectJob: (jobNumber: string) => void;
  onUpdateJob: (updatedJob: Job) => void;
  onCreateJob: (newJob: Job) => void;
  onNotification: (message: string) => void;
  /** Opens this order's edit form once data is ready (e.g. "Edit order" from the Monitor). */
  editJobId?: string | null;
  onEditHandled?: () => void;
}

/** Next order number: one past the highest existing #number. */
/** API instants in the company time zone; offset-less wall times as written; legacy prototype clock text in 24-hour form. */
const scheduleText = (value: string | undefined, timeZone: string) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return clockText(value ?? '');
  const wall = /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.exec(value.slice(0, 16));
  return /[zZ]$|[+-]\d\d:\d\d$/.test(value) || !wall ? formatWhen(value, timeZone) : formatWhen(`${wall[0]}Z`, 'UTC');
};
const nextJobNumber = (jobs: Job[]) => `#${jobs.reduce((max, job) => Math.max(max, Number(job.jobNumber.replace(/\D/g, '')) || 0), 1000) + 1}`;
export function JobsPage({
  jobs,
  drivers,
  onSelectJob,
  onUpdateJob,
  onCreateJob,
  onNotification,
  editJobId,
  onEditHandled
}: JobsPageProps) {
  const slug = companySlugForCurrentPath();
  const queryClient = useQueryClient();
  const { ctx: livePricingCtx, settings: settingsQuery, catalog: catalogQuery, rates: rateQuery, shippers: shipperQuery } = useCompanyPricingContext(slug);
  const orderQuery = useQuery({ queryKey: ['operations', slug, 'orders'], queryFn: () => allOperations.orders(slug!), enabled: !!slug });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'at_risk'>('all');
  const [lifecycleFilter, setLifecycleFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<OrderDateSelection>({ kind: 'all' });
  const [createMode, setCreateMode] = useState<'order' | 'quote'>('order');
  const today = formatDateValue(new Date());
  
  // Selected job for detail drawer
  const [activeJobDossier, setActiveJobDossier] = useState<Job | null>(null);
  
  // Create Job Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddAccessorial, setShowAddAccessorial] = useState(false);
  const [newScheduledTime, setNewScheduledTime] = useState('13:00 – 15:00');
  const [newDriverId, setNewDriverId] = useState<string>('unassigned');
  const [newInstructions, setNewInstructions] = useState('');
  const [orderFields, setOrderFields] = useState<Partial<Job>>({});
  const [editingOrder, setEditingOrder] = useState<Job | null>(null);
  const [emailSource, setEmailSource] = useState<{ id: string; version: number } | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  // Pricing context is read fresh each time the modal opens so settings edits apply.
  const [localPricingCtx, setPricingCtx] = useState(() => loadPricingContext());
  const pricingCtx = livePricingCtx ?? localPricingCtx;
  const [newOrderInput, setNewOrderInput] = useState<PricingOrderInput>(() => createDefaultOrderInput(pricingCtx));
  const newOrderSnapshot = useOrderPreview({ slug, input: newOrderInput, ctx: pricingCtx, enabled: showCreateModal, toBooking: input => inputToBooking(input, '', pricingCtx.billing.general.timeZone), rates: rateQuery.data });
  const pendingQuote = useRef<{ key: string; quote: Awaited<ReturnType<typeof operations.createQuote>> } | null>(null);
  const selectedCustomer = pricingCtx.customers.find((c) => c.id === newOrderInput.customerId);
  const closeCreateModal = () => { setShowAddAccessorial(false); setShowCreateModal(false); };
  const addAccessorial = async (item: AccessorialItem) => {
    const existing = pricingCtx.catalogue.accessorials.find(row => row.code === item.code || row.name.toLowerCase() === item.name.toLowerCase());
    if (existing) throw new Error(existing.active ? 'This accessorial already exists. Select it from the list or edit it in Settings.' : 'This accessorial already exists but is inactive. Activate it in Settings.');
    let id = item.id;
    if (slug) {
      const saved = await operations.createCatalog(slug, 'ACCESSORIAL', item.code, catalogFromUi(item));
      id = saved.id;
      queryClient.setQueryData<CatalogItem[]>(['operations', slug, 'catalog'], current => current ? [...current, saved] : [saved]);
      void queryClient.invalidateQueries({ queryKey: ['operations', slug, 'catalog'] });
    } else {
      const config = loadSimplePricingConfig();
      saveSimplePricingConfig({ ...config, accessorials: [...config.accessorials, item] });
      setPricingCtx(loadPricingContext());
    }
    setNewOrderInput(current => ({ ...current, accessorials: [...current.accessorials, { accessorialId: id, quantity: 1 }] }));
    onNotification(`${item.name} added to accessorials and selected for this order.`);
  };

  const openCreateModal = (mode: 'order' | 'quote') => {
    const ctx = slug ? livePricingCtx : loadPricingContext();
    if (!ctx) { onNotification('Pricing data is still loading. Try again in a moment.'); return; }
    setCreateMode(mode); setEditingOrder(null); setEmailSource(null); setOrderFields({}); setFormErrors([]); pendingQuote.current = null;
    setPricingCtx(ctx);
    setNewOrderInput({ ...createBookingInput(ctx), rateCardOverrideId: mode === 'quote' ? defaultRateCard(ctx.pricing.rateCards)?.id ?? null : null });
    setNewInstructions('');
    setNewDriverId('unassigned');
    setShowCreateModal(true);
  };

  const openEditOrder = (job: Job) => {
    if (!orderEditable(job) || !job.pricingInput) return;
    setCreateMode('order'); setPricingCtx(slug && livePricingCtx ? livePricingCtx : loadPricingContext()); setEditingOrder(job); setEmailSource(null); setOrderFields({ ...job }); setFormErrors([]);
    setNewOrderInput(normalizeOrderInput({ ...structuredClone(job.pricingInput), taxCalculation: 'COMPANY' }));
    setNewInstructions(job.handlingInstructions ?? '');
    setNewScheduledTime(job.scheduledTime); setNewDriverId(job.assignedDriverId ?? 'unassigned'); setActiveJobDossier(null); setShowCreateModal(true);
  };

  useEffect(() => {
    if (!editJobId || (slug && !livePricingCtx)) return;
    const job = jobs.find(row => row.id === editJobId);
    if (!job) return;
    openEditOrder(job); onEditHandled?.();
  }, [editJobId, jobs, livePricingCtx]);

  // Order emails the agent could not book yet are listed as Draft orders in this same Orders list; other emails are ignored.
  const emailQuery = useQuery({ queryKey: ['operations', slug, 'email-intakes', 'drafts'], queryFn: () => operations.emailIntakes(slug!, EMAIL_DRAFT_STATUSES), enabled: !!slug });
  const [reviewingEmailId, setReviewingEmailId] = useState<string | null>(null);
  const [trackingJob, setTrackingJob] = useState<Job | null>(null);
  const openEmailDraft = (email: EmailDraft) => {
    if (!livePricingCtx) { onNotification('Pricing data is still loading. Try again in a moment.'); return; }
    setCreateMode('order'); setEditingOrder(null); setOrderFields({}); setFormErrors([]); pendingQuote.current = null; setPricingCtx(livePricingCtx);
    setNewOrderInput(normalizeOrderInput({ ...draftToInput(email.draft), taxCalculation: 'COMPANY' }));
    setNewInstructions(''); setNewDriverId('unassigned'); setEmailSource(email.intake); setShowCreateModal(true);
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
        statusFilter === 'all' || (statusFilter === 'at_risk' ? job.status === 'at_risk' || job.status === 'late_start' : orderLifecycle(job) === 'IN_PROGRESS');

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

  const emailDrafts = useMemo(() => (emailQuery.data ?? []).filter(row => EMAIL_DRAFT_STATUSES.includes(row.status)).map(row => emailDraftRow(row, shipperQuery.data ?? [], catalogQuery.data ?? [])), [emailQuery.data, shipperQuery.data, catalogQuery.data]);
  const visibleDrafts = useMemo(() => {
    if (statusFilter !== 'all' || typeFilter !== 'all' || dateFilter.kind !== 'all' || !['all', 'draft'].includes(lifecycleFilter)) return [];
    const q = searchQuery.toLowerCase().trim();
    return emailDrafts.filter(row => !q || [row.shipper, row.from, row.pickup, row.dropoff, row.reference, row.service].join(' ').toLowerCase().includes(q));
  }, [emailDrafts, statusFilter, typeFilter, dateFilter, lifecycleFilter, searchQuery]);

  // Metrics
  const totalCount = jobs.length;
  const inProgressCount = jobs.filter(j => orderLifecycle(j) === 'IN_PROGRESS').length;
  const atRiskCount = jobs.filter((j) => j.status === 'at_risk' || j.status === 'late_start').length;
  const noDriverCount = jobs.filter(j => orderLifecycle(j) === 'NEW').length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;

  const reassign = useOrderAssignment({ slug, jobs, drivers, onUpdateJob, onNotification });
  const handleReassignDriver = async (job: Job, driverId: string) => {
    const result = await reassign(job, driverId);
    if (!result) return;
    setReassigningJobId(null);
    if (!result.updated) setActiveJobDossier(null);
    else if (activeJobDossier?.id === job.id) setActiveJobDossier(result.updated);
  };
  const complete = useOrderCompletion({ slug, onUpdateJob, onNotification });
  const handleCompleteOrder = async (job: Job) => {
    const result = await complete(job);
    if (!result) return;
    if (!result.updated) setActiveJobDossier(null);
    else if (activeJobDossier?.id === job.id) setActiveJobDossier(result.updated);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) {
      const scheduleErrors = validateBookingSchedule(newOrderInput, pricingCtx.billing.general.timeZone);
      if (scheduleErrors.length) { setFormErrors(scheduleErrors); onNotification(scheduleErrors.join(' ')); return; }
    }
    if (slug) {
      try {
        const driver = newDriverId === 'unassigned' ? undefined : drivers.find(row => row.id === newDriverId);
        if (newDriverId !== 'unassigned') {
          if (!driver?.currentVehicleId) throw new Error('The selected driver needs an attached vehicle before assignment.');
          assignableRoute(await allOperations.routes(slug), driver.id, driver.currentVehicleId);
          if (driver.dutyStatus !== 'ON_DUTY' || driver.status === 'offline')
            throw new Error('The selected driver and vehicle must be available before assignment.');
        }
        const booking = inputToBooking(newOrderInput, newInstructions, pricingCtx.billing.general.timeZone);
        const previous = editingOrder ? orderQuery.data?.find(row => row.id === editingOrder.id) : undefined;
        const saved = previous ? await operations.updateOrder(slug, previous, booking)
          : emailSource ? await operations.createOrderFromEmail(slug, emailSource, booking) : await operations.createOrder(slug, booking);
        if (emailSource) { setEmailSource(null); void queryClient.invalidateQueries({ queryKey: ['operations', slug, 'email-intakes'] }); }
        closeCreateModal();
        try {
          if (newDriverId !== 'unassigned' && saved.status === 'NEW') {
            await assignToDriver(slug, saved, driver!.id, driver!.currentVehicleId!);
          }
          onNotification(`${previous ? 'Updated' : 'Created'} ${saved.number}.`);
        } catch (assignmentError) {
          onNotification(`${saved.number} saved without an assignment. ${assignmentError instanceof Error ? assignmentError.message : 'Assignment failed.'}`);
        } finally {
          await Promise.all([queryClient.invalidateQueries({ queryKey: ['operations', slug, 'orders'] }), queryClient.invalidateQueries({ queryKey: ['operations', slug, 'routes'] }), queryClient.invalidateQueries({ queryKey: ['operations', slug, 'monitor'] })]);
        }
      } catch (error) { const message = error instanceof Error ? error.message : 'Could not save order.'; setFormErrors([message]); onNotification(message); }
      return;
    }
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
    closeCreateModal();
    onNotification(
      snapshot.status === 'PRICED'
        ? `${editingOrder ? 'Updated' : 'Created'} ${newJob.jobNumber} — quoted $${snapshot.total.toFixed(2)} ${snapshot.currency}`
        : `${editingOrder ? 'Updated' : 'Created'} ${newJob.jobNumber} — pricing needs attention`
    );
  };

  const sendLiveQuote = async (recipient: string) => {
    if (!slug) return;
    const scheduleErrors = validateBookingSchedule(newOrderInput, pricingCtx.billing.general.timeZone);
    if (scheduleErrors.length) throw new Error(scheduleErrors.join(' '));
    const booking = inputToBooking(newOrderInput, '', pricingCtx.billing.general.timeZone);
    const key = JSON.stringify(booking);
    const quote = pendingQuote.current?.key === key ? pendingQuote.current.quote : await operations.createQuote(slug, booking);
    pendingQuote.current = { key, quote };
    await operations.sendQuote(slug, quote, recipient);
    pendingQuote.current = null;
    await queryClient.invalidateQueries({ queryKey: ['operations', slug, 'quotes'] });
    closeCreateModal(); onNotification(`Quote queued for ${recipient}.`);
  };
  useEntityDialog(!!activeJobDossier || showCreateModal, () => { setActiveJobDossier(null); closeCreateModal(); });

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
        {slug && (orderQuery.isPending || !livePricingCtx) && <p role="status" className="text-sm text-slate-500">Loading orders and pricing…</p>}
        {slug && (orderQuery.error || settingsQuery.error || catalogQuery.error || rateQuery.error || shipperQuery.error) && <p role="alert" className="text-sm text-rose-700">Could not load order data. Retry from the workspace.</p>}
        <ListSummary label="Orders summary" items={[
          { label: 'Total', value: totalCount, icon: Package },
          { label: 'In progress', value: inProgressCount, icon: Clock },
          { label: 'At risk', value: atRiskCount, icon: AlertTriangle },
          { label: 'New', value: noDriverCount, icon: UserRoundSearch },
          { label: 'Completed', value: completedCount, icon: CircleCheck },
          ...(slug ? [{ label: 'Drafts', value: emailDrafts.length, icon: Mail }] : []),
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
                onClick={() => setStatusFilter('in_progress')}
                aria-pressed={statusFilter === 'in_progress'}
                className="app-tab inline-flex items-center gap-2 whitespace-nowrap"
              >
                In Progress
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
            <Select aria-label="Filter by order status" value={lifecycleFilter} onValueChange={setLifecycleFilter} options={[{ value: 'all', label: 'All order statuses' }, ...ORDER_LIFECYCLES.map(value => ({ value, label: ORDER_LIFECYCLE_LABELS[value] })), { value: 'attention', label: 'Needs attention' }, ...(slug ? [{ value: 'draft', label: 'Draft' }] : [])]} />
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
          {filteredJobs.length === 0 && visibleDrafts.length === 0 ? (
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
                  <th className="py-3 px-4">Pickup → Delivery</th>
                  <th className="py-3 px-4">Scheduled Window</th>
                  <th className="py-3 px-4">Assigned Driver</th>
                  <th className="py-3 px-4">Service & Price</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                {visibleDrafts.map(draft => (
                  <tr key={draft.id} className="hover:bg-slate-50/80 transition-colors cursor-pointer" onClick={() => setReviewingEmailId(draft.id)}>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-400">—</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">Draft</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" /> From email</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{draft.shipper}</div>
                      <div className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">{draft.phone ? <><Phone className="w-3 h-3 text-slate-400" />{formatPhone(draft.phone)}</> : draft.shipper ? null : draft.from}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex items-start gap-1.5 text-slate-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-none" />
                        <span className="truncate font-medium">{draft.pickup}</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-slate-500 mt-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 flex-none" />
                        <span className="truncate">{draft.dropoff}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-slate-700 font-medium"><Clock className="w-3.5 h-3.5 text-slate-400" />{scheduleText(draft.scheduledAt, pricingCtx.billing.general.timeZone)}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{draft.stops} stops on manifest</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap" />
                    <td className="py-3.5 px-4 whitespace-nowrap"><span className="font-medium text-slate-800">{draft.service}</span></td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button type="button" onClick={e => { e.stopPropagation(); setReviewingEmailId(draft.id); }} title="Review draft"
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
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
                          <span className="font-medium text-slate-900">{job.jobNumber}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{lifecycleLabel(job)}</span>
                          {orderAttention(job).map(a => <span key={a.flag} className="text-xs text-amber-700" title={a.detail}>{a.label}</span>)}
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
                          {formatPhone(job.customerPhone)}
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
                          {scheduleText(job.pricingInput?.scheduledAt ?? job.scheduledTime, pricingCtx.billing.general.timeZone)}
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
                                  {assignedDriver.driverNumber ?? assignedDriver.id}
                                </span>
                              </div>
                              <div className="text-xs text-slate-400">
                                {assignedDriver.vehicle.split(' ')[0]} • {assignedDriver.eta}
                              </div>
                            </div>
                          </div>
                        ) : job.lifecycleStatus === 'NEW' ? (
                          <DriverAssignmentMenu drivers={drivers} requestedId={job.pricingInput?.preferredDriverId} open={reassigningJobId === job.id}
                            onOpenChange={open => setReassigningJobId(open ? job.id : null)}
                            onSelect={driverId => handleReassignDriver(job, driverId)} />
                        ) : (
                          <span className="text-slate-500">{job.routeId ? 'Assigned driver unavailable' : '—'}</span>
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
                          {slug && trackable(job.lifecycleStatus) && <button type="button" onClick={() => setTrackingJob(job)} title="Track order" aria-label={`Track ${job.jobNumber}`}
                            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"><Navigation className="w-4 h-4" /></button>}
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

      {/* ORDER DETAILS DIALOG */}
      {activeJobDossier && <OrderDetailsDialog job={activeJobDossier} ctx={pricingCtx} drivers={drivers} onClose={() => setActiveJobDossier(null)}
        onReassign={handleReassignDriver} onEdit={openEditOrder} onComplete={handleCompleteOrder} onLocate={job => { onSelectJob(job.jobNumber); setActiveJobDossier(null); }} />}

      {reviewingEmailId && slug && <IntakeDialog slug={slug} id={reviewingEmailId} onClose={() => setReviewingEmailId(null)} onNotification={onNotification}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ['operations', slug, 'email-intakes'] })}
        onCompleteDraft={email => { setReviewingEmailId(null); openEmailDraft(email); }} onShowOrder={number => { setReviewingEmailId(null); onSelectJob(number); }} />}
      {trackingJob && slug && <OrderTrackingDialog slug={slug} orderId={trackingJob.id} orderNumber={trackingJob.jobNumber} timeZone={pricingCtx.billing.general.timeZone}
        version={jobs.find(job => job.id === trackingJob.id)?.version} onClose={() => setTrackingJob(null)}
        onOpenMap={() => { onSelectJob(trackingJob.jobNumber); setTrackingJob(null); }} />}

      {/* CREATE NEW ORDER MODAL */}
      {showCreateModal && (
        <Dialog size="xl" onClose={closeCreateModal}>
          <DialogHeader onClose={closeCreateModal} title={editingOrder ? 'Edit Order' : createMode === 'quote' ? 'New Quote' : emailSource ? 'New Order from Email' : 'New Order'} description={createMode === 'quote' ? 'Enter shipment details to prepare a quotation without creating an order.' : 'Enter the order details on the left to see its live price estimate on the right.'} />
            <form onSubmit={createMode === 'quote' ? event => event.preventDefault() : handleCreateSubmit} className="app-dialog-body bg-slate-50 pt-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-7 space-y-5 text-xs">
                  {!!formErrors.length && <p role="alert" className="text-xs text-rose-700">{formErrors.join(" ")}</p>}

                  <OrderPricingForm
                    showVehicleSelection suggestVehicle={!editingOrder}
                    customerMode={createMode === 'quote' ? 'rateCard' : 'shipper'}
                    value={newOrderInput}
                    onChange={v => { if (v.customerId !== newOrderInput.customerId) { const c = pricingCtx.customers.find(c => c.id === v.customerId); setOrderFields({ ...orderFields, notificationPreferences: c?.communicationPreferences }); setNewInstructions(c?.instructions ?? ''); } setNewOrderInput(v); }}
                    ctx={pricingCtx}
                    snapshot={newOrderSnapshot}
                    showStopAddresses
                    futureOnly={!editingOrder}
                    onAddAccessorial={() => setShowAddAccessorial(true)}
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
                          // The required vehicle comes from the load; a driver's truck is only checked against it.
                          setNewDriverId(driverId);
                        }}
                        options={[
                          { value: 'unassigned', label: '— Leave Unassigned (Staged for Dispatch) —' },
                          ...drivers.map((d) => ({ value: d.id, label: `${d.name} (${d.driverNumber ?? d.id}) · ${d.statusLabel}` }))
                        ]}
                      />
                      <p className="text-xs text-slate-500 mt-1">{editingOrder ? 'Driver choice never changes the shipper price.' : 'Uses the vehicle attached to the selected driver.'}</p>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Instructions</label>
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
                    snapshot={withSurchargeRows(newOrderSnapshot, pricingCtx.pricing.rateCards.find(card => card.id === newOrderSnapshot.rateCard?.id), resolveFuelPercent(pricingCtx.billing), pricingCtx.catalogue.vehicles.find(vehicle => vehicle.id === newOrderInput.vehicleId)?.name)}
                    title={createMode === 'quote' ? 'Live quote' : 'Live estimate'}
                    showPricingDetail={false}
                    rateRows={[...companyRateRows(pricingCtx.billing), ...(newOrderSnapshot.status === 'PRICED' ? travelRows(newOrderSnapshot, pricingCtx.billing.general) : [])]}
                  />
                </div>
              </div>
            </form>

            <DialogFooter note={createMode === 'quote' ? 'Sending a quote does not create an order.' : newOrderSnapshot.status === 'PRICED' ? 'The estimate is frozen on the order as a Pricing Snapshot.' : 'The order can be created, but it will land in Needs Attention until it can be priced.'}>
              {createMode === 'quote'
                ? newOrderSnapshot.status === 'PRICED' && !!newOrderInput.rateCardOverrideId
                  ? <QuotationMenu buildQuotation={() => buildQuotation(newOrderInput, newOrderSnapshot, pricingCtx)} sendEmail={slug ? sendLiveQuote : undefined} onNotification={onNotification} triggerLabel="Send Quote" prominent allowRecipientEntry />
                  : <Button type="button" disabled>Send Quote</Button>
                : <Button type="button" onClick={(e) => handleCreateSubmit(e as unknown as React.FormEvent)}>{editingOrder ? 'Save Order' : 'Create Order'}</Button>}
            </DialogFooter>
        </Dialog>
      )}
      {showCreateModal && showAddAccessorial && <AccessorialModal isOpen initialAccessorial={null} onClose={() => setShowAddAccessorial(false)} onSave={addAccessorial} />}
    </div>
  );
}
