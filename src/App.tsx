import { PanelLeft,RefreshCw,Sparkles } from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { companySlugForCurrentPath } from './lib/pageRoutes';
import { allOperations, operations } from './operations/api';
import { changeAssignment } from './operations/assignment';
import { driverToUi } from './operations/adapters';
import { api } from './portal/api';
import { companySettingsKey } from './portal/WorkspaceAccount';
import { orderToUi } from './operations/orderAdapters';
import { MonitorActions } from './components/MonitorActions';
import { DetailModalDialog } from './components/DetailModalDialog';
import { MonitorOrderDetails } from './components/orders/MonitorOrderDetails';
import { DriverPopover } from './components/DriverPopover';
import { JobDetailPopover } from './components/JobDetailPopover';
import { MapControls } from './components/MapControls';
import { ConfirmDialogHost, confirmDialog } from './components/ui/ConfirmDialog';
import { Sidebar } from './components/Sidebar';
import { TopMetrics } from './components/TopMetrics';
import { GoogleMonitorMap, type MapController, VANCOUVER_CENTER_LNG_LAT } from './components/GoogleMonitorMap';
import {
INITIAL_DRIVERS,
INITIAL_JOBS,
INITIAL_NEEDS_ATTENTION
} from './data/mockData';
import { bindDriverVehicle,loadDrivers,saveDrivers } from './lib/driverStorage';
import { freezeCompletedOrder } from './lib/driverPayout';
import { loadPricingContext,loadSavedOrders,pricingAttentionItems,saveOrders } from './lib/orderPricing';
import { validateAssignment } from './lib/organizationWorkflows';
import { usePageNavigation } from './lib/usePageNavigation';
import { CustomersPage } from './pages/CustomersPage';
import { DriversPage } from './pages/DriversPage';
import { HelpSupportPage } from './pages/HelpSupportPage';
import { JobsPage } from './pages/JobsPage';
import { ProfilePage } from './pages/ProfilePage';
import { RateCardsPage } from './pages/RateCardsPage';
import { ReportsPage } from './pages/ReportsPage';
import { VehiclesPage } from './pages/VehiclesPage';
import { Driver,Job,MapLayerConfig,ModalDialogState,NeedsAttentionItem } from './types';

/** API attention kinds as dispatcher-facing labels. */
const attentionLabel = (kind: string) => ({ LATE_START: 'Late start', AT_RISK: 'At risk', PRICING: 'Pricing review', OPEN_ISSUE: 'Open issue' } as Record<string, string>)[kind] ?? kind.charAt(0) + kind.slice(1).toLowerCase().replace(/_/g, ' ');

export default function App({ onSignOut }: { onSignOut?: () => void } = {}) {
  const slug = companySlugForCurrentPath();
  const queryClient = useQueryClient();
  const driverQuery = useQuery({ queryKey: ['operations', slug, 'drivers'], queryFn: () => allOperations.drivers(slug!), enabled: !!slug });
  const vehicleQuery = useQuery({ queryKey: ['operations', slug, 'vehicles'], queryFn: () => allOperations.vehicles(slug!), enabled: !!slug });
  const shipperQuery = useQuery({ queryKey: ['operations', slug, 'shippers'], queryFn: () => allOperations.shippers(slug!), enabled: !!slug });
  const catalogQuery = useQuery({ queryKey: ['operations', slug, 'catalog'], queryFn: () => allOperations.catalog(slug!), enabled: !!slug });
  const rateQuery = useQuery({ queryKey: ['operations', slug, 'rates'], queryFn: () => allOperations.rates(slug!), enabled: !!slug });
  const orderQuery = useQuery({ queryKey: ['operations', slug, 'orders'], queryFn: () => allOperations.orders(slug!), enabled: !!slug });
  const routeQuery = useQuery({ queryKey: ['operations', slug, 'routes'], queryFn: () => allOperations.routes(slug!), enabled: !!slug });
  const monitorQuery = useQuery({ queryKey: ['operations', slug, 'monitor'], queryFn: () => operations.monitor(slug!), enabled: !!slug, refetchInterval: 30000 });
  const settingsQuery = useQuery({ queryKey: companySettingsKey(slug!), queryFn: () => api.companySettings(slug!), enabled: !!slug });
  const [activeTab, setActiveTab] = usePageNavigation();
  const [mapEverOpened, setMapEverOpened] = useState(() => activeTab === 'monitor');
  useEffect(() => { if (activeTab === 'monitor') setMapEverOpened(true); }, [activeTab]);
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia('(max-width: 639px)').matches);
  useEffect(() => {
    if (activeTab === 'monitor') return;
    const mobile = window.matchMedia('(max-width: 639px)');
    const fitSettings = () => { if (mobile.matches) setSidebarOpen(false); };
    fitSettings();
    mobile.addEventListener('change', fitSettings);
    return () => mobile.removeEventListener('change', fitSettings);
  }, [activeTab]);
  const [localDrivers, setDrivers] = useState<Driver[]>(() => slug ? [] : loadDrivers(INITIAL_DRIVERS));
  const drivers = slug ? (driverQuery.data ?? []).map(row => {
    const current = routeQuery.data?.find(route => route.driver_id === row.id && ['PLANNED', 'IN_PROGRESS'].includes(route.status));
    const driver = driverToUi(row, vehicleQuery.data?.find(vehicle => vehicle.id === row.vehicle_id), monitorQuery.data?.drivers.find(item => item.id === row.id));
    return { ...driver, status: driver.dutyStatus === 'ON_DUTY' && current?.status === 'IN_PROGRESS' ? 'on_route' as const : driver.status,
      statusLabel: driver.dutyStatus === 'ON_DUTY' && current?.status === 'IN_PROGRESS' ? 'On route' : driver.statusLabel,
      currentJob: orderQuery.data?.find(order => order.route_id === current?.id)?.number,
      nextStop: current?.stops.find(stop => stop.status !== 'COMPLETED')?.stop.address.text ?? 'Not set', routeId: current?.id,
      lastUpdate: row.last_seen_at ? new Date(row.last_seen_at).toLocaleString() : 'Not set' };
  }) : localDrivers;
  useEffect(() => { if (!slug) try { saveDrivers(localDrivers); } catch { showToast('Driver changes could not be saved in this browser.'); } }, [localDrivers, slug]);
  // Every order carries a PricingSnapshot from the shared engine, including the static mocks.
  const [localJobs, setJobs] = useState<Job[]>(() => slug ? [] : loadSavedOrders(INITIAL_JOBS));
  const jobs = slug ? (orderQuery.data ?? []).map(row => orderToUi(row, shipperQuery.data ?? [], catalogQuery.data ?? [], rateQuery.data ?? [], routeQuery.data?.find(route => route.id === row.route_id))) : localJobs;
  useEffect(() => { if (!slug) try { saveOrders(localJobs); } catch { showToast('Order changes could not be saved in this browser. Keep this session open and free storage before reloading.'); } }, [localJobs, slug]);
  const [operationalAttentionItems, setNeedsAttentionItems] = useState<NeedsAttentionItem[]>(INITIAL_NEEDS_ATTENTION);
  // Orders that could not be priced (no card, conflict, zone no-match, missing distance) join the list.
  const needsAttentionItems = slug ? (monitorQuery.data?.needs_attention ?? []).map(item => {
    const order = orderQuery.data?.find(row => row.id === item.order_id);
    return { id: item.id ?? `${item.order_id}-${item.kind}`, jobNumber: order?.number ?? '', statusType: 'at_risk' as const, statusLabel: attentionLabel(item.kind), subtitle: item.description,
      pickupAddress: order?.facts.stops.find(stop => stop.kind === 'PICKUP')?.address.text ?? '', badgeColor: item.kind === 'AT_RISK' ? 'red' as const : 'amber' as const };
  }) : [...pricingAttentionItems(jobs), ...operationalAttentionItems];

  // Active Jobs & Driver counts
  const [localActiveJobsCount, setActiveJobsCount] = useState<number>(47);
  const activeJobsCount = slug ? (monitorQuery.data?.orders.length ?? 0) : localActiveJobsCount;
  const [localAvailableDriversCount, setAvailableDriversCount] = useState<number>(5);
  const availableDriversCount = slug ? drivers.filter(driver => driver.status === 'available').length : localAvailableDriversCount;
  const [localDispatchMode, setDispatchMode] = useState<'AUTO' | 'MANUAL'>('MANUAL');
  const dispatchMode = slug ? settingsQuery.data?.data.dispatch_mode ?? 'MANUAL' : localDispatchMode;

  // Full closable modal dialog state
  const [modalDialog, setModalDialog] = useState<ModalDialogState>({ isOpen: false, type: null });

  // Menu & Popover Visibility States (Default: false - clean map on initialize, menus only appear on click)
  const [showActiveJobsMenu, setShowActiveJobsMenu] = useState<boolean>(false);
  const [showAvailableDriversMenu, setShowAvailableDriversMenu] = useState<boolean>(false);
  const [showNeedsAttentionPopover, setShowNeedsAttentionPopover] = useState<boolean>(false);
  const [showSearchPopover, setShowSearchPopover] = useState<boolean>(false);
  const [showNotificationPopover, setShowNotificationPopover] = useState<boolean>(false);
  const [showAccountPopover, setShowAccountPopover] = useState<boolean>(false);
  const [showDriverPopover, setShowDriverPopover] = useState<boolean>(false);
  const [showDriverActions, setShowDriverActions] = useState<boolean>(false);
  const [showJobDetail, setShowJobDetail] = useState<boolean>(false);
  const [showAssignDriver, setShowAssignDriver] = useState<boolean>(false);
  const [showAiRecommendation, setShowAiRecommendation] = useState<boolean>(false);
  const [showMapSettings, setShowMapSettings] = useState<boolean>(false);

  // Selected Entities
  const [selectedDriverId, setSelectedDriverId] = useState<string>('D14');
  const [selectedJobId, setSelectedJobId] = useState<string>('#461');

  // Interactive Map Controller ref for smooth animations and zooms
  const mapRef = useRef<MapController | null>(null);

  useEffect(() => {
    if (activeTab !== 'monitor' || !mapEverOpened) return;
    const frame = requestAnimationFrame(() => mapRef.current?.resize());
    return () => cancelAnimationFrame(frame);
  }, [activeTab, mapEverOpened]);

  // Dynamic screen positions for popovers
  const [markerPositions, setMarkerPositions] = useState<{
    d14?: { x: number; y: number } | null;
    job461?: { x: number; y: number } | null;
    driver?: { x: number; y: number } | null;
    job?: { x: number; y: number } | null;
  }>({
    d14: null,
    job461: null,
    driver: null,
    job: null
  });

  const handleMarkerPositionsUpdate = useCallback(
    (positions: {
      d14?: { x: number; y: number } | null;
      job461?: { x: number; y: number } | null;
      driver?: { x: number; y: number } | null;
      job?: { x: number; y: number } | null;
    }) => {
      setMarkerPositions(positions);
    },
    []
  );

  // Map Controls State
  const [layerConfig, setLayerConfig] = useState<MapLayerConfig>({
    mode: 'map',
    traffic: false,
    labels: true
  });

  // Notification Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Callback to update driver telemetry from map simulation without re-rendering the whole map
  const handleDriverTelemetryUpdate = useCallback((driverId: string, telemetry: { eta: string; distance: string }) => {
    if (slug) return;
    setDrivers((prev) => {
      const existing = prev.find((d) => d.id === driverId);
      if (existing && existing.eta === telemetry.eta && existing.distance === telemetry.distance) {
        return prev;
      }
      return prev.map((d) => (d.id === driverId ? { ...d, eta: telemetry.eta, distance: telemetry.distance } : d));
    });
  }, [slug]);

  // Selecting driver: Opens primary popover, ensures child menu is CLOSED on-demand
  const handleSelectDriver = useCallback((id: string, markerPosition?: [number, number]) => {
    setSelectedDriverId(id);
    setShowDriverPopover(true);
    setShowDriverActions(false); // Child only displayed on-demand
    setShowJobDetail(false);

    const found = drivers.find((d) => d.id === id);
    if (found && mapRef.current && Number.isFinite(found.lng) && Number.isFinite(found.lat)) {
      const [lng, lat] = markerPosition ?? [found.lng, found.lat];
      if (!markerPosition) mapRef.current.flyTo({ center: [lng, lat], zoom: 13.5, duration: 800, essential: true });
      const pt = mapRef.current.project([lng, lat]);
      if (pt && (pt.x !== 0 || pt.y !== 0)) setMarkerPositions((curr) => ({ ...curr, driver: pt, d14: id === 'D14' ? pt : curr.d14 }));
    }
    showToast(`Selected Driver ${id}`);
  }, [drivers]);

  // Selecting job: Opens primary popover, ensures child and grandchild are CLOSED on-demand
  const handleSelectJob = useCallback((jobNumber: string, markerPosition?: [number, number]) => {
    setSelectedJobId(jobNumber);
    setShowJobDetail(true);
    setShowAssignDriver(false); // Child only displayed on-demand
    setShowAiRecommendation(false); // Grandchild only displayed on-demand
    setShowDriverPopover(false);

    const found = jobs.find((j) => j.jobNumber === jobNumber);
    if (found && mapRef.current && Number.isFinite(found.lng) && Number.isFinite(found.lat)) {
      const [lng, lat] = markerPosition ?? [found.lng, found.lat];
      if (!markerPosition) mapRef.current.flyTo({ center: [lng, lat], zoom: 13.5, duration: 800, essential: true });
      const pt = mapRef.current.project([lng, lat]);
      if (pt && (pt.x !== 0 || pt.y !== 0)) setMarkerPositions((curr) => ({ ...curr, job: pt, job461: jobNumber === '#461' ? pt : curr.job461 }));
    }
    showToast(`Selected Job ${jobNumber}`);
  }, [jobs]);

  useEffect(() => {
    if (activeTab !== 'monitor' || (!showDriverPopover && !showJobDetail)) return;
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const overlay = target.closest<HTMLElement>('[data-map-detail-overlay]');
      if (overlay) {
        if (overlay.dataset.mapDetailOverlay === 'job') {
          if (!target.closest('[data-map-detail-toggle="assignment"]')) setShowAssignDriver(false);
          if (!target.closest('[data-map-detail-toggle="recommendation"]')) setShowAiRecommendation(false);
        } else if (overlay.dataset.mapDetailOverlay === 'assignment' && !target.closest('[data-map-detail-toggle="recommendation"]')) {
          setShowAiRecommendation(false);
        }
        return;
      }
      if (target.closest('[data-slot="popover-content"][aria-label="Driver actions"]')) return;
      setShowDriverPopover(false);
      setShowDriverActions(false);
      setShowJobDetail(false);
      setShowAssignDriver(false);
      setShowAiRecommendation(false);
    };
    document.addEventListener('pointerdown', dismissOutside, true);
    return () => document.removeEventListener('pointerdown', dismissOutside, true);
  }, [activeTab, showDriverPopover, showJobDetail]);

  const handleMapBackgroundClick = useCallback(() => {
    setShowDriverPopover(false);
    setShowDriverActions(false);
    setShowJobDetail(false);
    setShowAssignDriver(false);
    setShowAiRecommendation(false);
    setShowMapSettings(false);
  }, []);

  // Cascading close: closing parent driver popover closes all its children
  const handleCloseDriverPopover = useCallback(() => {
    setShowDriverPopover(false);
    setShowDriverActions(false);
  }, []);

  // Cascading close: closing parent job detail popover closes all its children and grandchildren
  const handleCloseJobDetailPopover = useCallback(() => {
    setShowJobDetail(false);
    setShowAssignDriver(false);
    setShowAiRecommendation(false);
  }, []);

  // Modal dialog triggers
  // Monitor opens the same order details dialog as the Orders list; Edit continues on the Orders page.
  const [dossierJob, setDossierJob] = useState<Job | null>(null);
  const [editJobId, setEditJobId] = useState<string | null>(null);
  const [openDriverId, setOpenDriverId] = useState<string | null>(null);
  const handleOpenJobDossier = (job?: Job) => {
    const target = job || activeJob;
    if (target) setDossierJob(target);
  };

  const handleOpenDriverProfile = (driver?: Driver) => {
    setModalDialog({
      isOpen: true,
      type: 'driver_detail',
      data: driver || activeDriver
    });
  };

  const handleOpenAllJobs = () => {
    setModalDialog({
      isOpen: true,
      type: 'all_jobs'
    });
  };

  const handleOpenAllDrivers = () => {
    setModalDialog({
      isOpen: true,
      type: 'all_drivers'
    });
  };

  const handleOpenAllExceptions = () => {
    setModalDialog({
      isOpen: true,
      type: 'all_exceptions'
    });
  };

  // Navigating from a list page to the Monitor map with the entity selected.
  // The map is unmounted while a list page is open, so the selection is queued
  // and applied once the remounted map can project coordinates again.
  const [pendingLocate, setPendingLocate] = useState<{ type: 'job' | 'driver'; id: string } | null>(null);

  const handleLocateJobOnMap = useCallback((jobNumber: string) => {
    setActiveTab('monitor');
    setPendingLocate({ type: 'job', id: jobNumber });
  }, []);

  const handleLocateDriverOnMap = useCallback((driverId: string) => {
    setActiveTab('monitor');
    setPendingLocate({ type: 'driver', id: driverId });
  }, []);

  useEffect(() => {
    if (activeTab !== 'monitor' || !pendingLocate) return;

    let attempts = 0;
    const apply = () => {
      const pt = mapRef.current?.project?.(VANCOUVER_CENTER_LNG_LAT);
      const mapReady = !!pt && (pt.x !== 0 || pt.y !== 0);
      if (!mapReady) {
        attempts += 1;
        if (attempts >= 80) {
          showToast('Map is unavailable. Check the Google Maps configuration and try again.');
          setPendingLocate(null);
          return true;
        }
        return false;
      }
      if (pendingLocate.type === 'job') {
        handleSelectJob(pendingLocate.id);
      } else {
        handleSelectDriver(pendingLocate.id);
      }
      setPendingLocate(null);
      return true;
    };

    if (apply()) return;
    const timer = window.setInterval(() => {
      if (apply()) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [activeTab, pendingLocate, handleSelectJob, handleSelectDriver]);

  // Job & Driver mutations coming from the Jobs / Drivers pages
  const handleMonitorAssignDriver = async (job: Job, driverId: string) => {
    if (!slug) return;
    const record = orderQuery.data?.find(order => order.id === job.id);
    const driver = drivers.find(item => item.id === driverId);
    if (!record || !driver) return;
    const route = routeQuery.data?.find(item => item.id === record.route_id);
    try {
      if (route) {
        const affected = orderQuery.data?.filter(order => order.route_id === route.id).length ?? 1;
        if (!(await confirmDialog({ title: 'Change driver?', message: affected > 1 ? `This planned route has ${affected} orders. Releasing it will leave the other orders unassigned.` : 'The planned route will be released before the assignment changes.', confirmLabel: 'Change driver' }))) return;
      }
      await changeAssignment(slug, record, driverId, driver.currentVehicleId ?? null, route);
      setShowAssignDriver(false); setShowJobDetail(false);
      showToast(`Assigned ${job.jobNumber} to ${driver.name}.`);
    } catch (error) { showToast(error instanceof Error ? error.message : 'Could not assign driver.'); }
    finally { await Promise.all([queryClient.invalidateQueries({ queryKey: ['operations', slug, 'orders'] }), queryClient.invalidateQueries({ queryKey: ['operations', slug, 'routes'] }), queryClient.invalidateQueries({ queryKey: ['operations', slug, 'monitor'] })]); }
  };

  const handleUpdateJob = useCallback((updatedJob: Job) => {
    setJobs((prev) => prev.map((j) => (j.id === updatedJob.id ? freezeCompletedOrder(j, updatedJob, drivers) : j)));
  }, [drivers]);

  const handleCreateJob = useCallback((newJob: Job) => {
    setJobs((prev) => [freezeCompletedOrder(undefined, newJob, drivers), ...prev]);
    setActiveJobsCount((prev) => prev + 1);
  }, [drivers]);

  const handleUpdateDriver = useCallback((updatedDriver: Driver) => {
    bindDriverVehicle(updatedDriver);
    setDrivers((prev) => prev.map((d) => (d.id === updatedDriver.id ? updatedDriver : d)));
  }, []);

  const handleDeleteDriver = useCallback((driver: Driver) => {
    bindDriverVehicle({ ...driver, currentVehicleId: null });
    setDrivers((prev) => prev.filter((d) => d.id !== driver.id));
  }, []);

  const handleCreateDriver = useCallback((newDriver: Driver) => {
    bindDriverVehicle(newDriver);
    setDrivers((prev) => [newDriver, ...prev]);
    if (newDriver.status === 'available') {
      setAvailableDriversCount((prev) => prev + 1);
    }
  }, []);

  const handleOpenProfile = () => {
    setShowAccountPopover(false);
    setModalDialog({ isOpen: false, type: null });
    setActiveTab('profile');
  };

  const handleOpenHelp = () => {
    setShowAccountPopover(false);
    setModalDialog({ isOpen: false, type: null });
    setActiveTab('help');
  };

  const handleCloseModal = () => {
    setModalDialog({ isOpen: false, type: null });
  };

  const handleApproveRecommendation = () => {
    if (slug) { showToast('Automated recommendations are not enabled for this company.'); return; }
    const target = jobs.find(j => j.jobNumber === '#461');
    const driver = drivers.find(d => d.id === 'D09');
    if (!target || !driver) return;
    const errors = validateAssignment(target, driver, jobs, loadPricingContext());
    if (errors.length) { showToast(errors.join(' ')); return; }
    // Reassign Job #461 to Maria Garcia (D09)
    setJobs((prev) =>
      prev.map((j) =>
        j.jobNumber === '#461'
          ? {
            ...j,
            status: 'on_time',
            statusLabel: 'On Time',
            riskText: 'ETA: On schedule (Maria D09)',
            assignedDriverId: 'D09'
          }
          : j
      )
    );

    // Update drivers availability
    setAvailableDriversCount((prev) => Math.max(prev - 1, 0));

    // Remove #461 from Needs Attention
    setNeedsAttentionItems((prev) => prev.filter((item) => item.jobNumber !== '#461'));

    showToast('AI Recommendation Approved: Job #461 reassigned to Maria Garcia (D09). ETA improved by 14m.');
  };

  const handleKeepCurrent = () => {
    showToast('Maintained current assignment with Driver D14');
  };

  const handleResetSpecView = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: VANCOUVER_CENTER_LNG_LAT,
        zoom: 12,
        pitch: 0,
        bearing: 0,
        duration: 1200,
        essential: true
      });
    }
    showToast('Map centered to Vancouver');
  };

  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.zoomIn({ duration: 300 });
  };

  const handleZoomOut = () => {
    if (mapRef.current) mapRef.current.zoomOut({ duration: 300 });
  };

  const activeDriver = drivers.find((d) => d.id === selectedDriverId) || drivers[0];
  const activeJob = jobs.find((j) => j.jobNumber === selectedJobId) || jobs[0];

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-app-canvas font-sans text-app-text antialiased">
      <ConfirmDialogHost />
      {sidebarOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/20 sm:hidden" onClick={() => setSidebarOpen(false)} />}
      {slug && (orderQuery.error || driverQuery.error || monitorQuery.error) && <div role="alert" className="absolute top-3 left-1/2 z-50 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs text-rose-700">Could not load workspace data. <button type="button" className="underline" onClick={() => queryClient.invalidateQueries({ queryKey: ['operations', slug] })}>Retry</button></div>}
      {/* LEFT NAVIGATION SIDEBAR */}
      <Sidebar
        activeTab={activeTab}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        setActiveTab={setActiveTab}
        showAccountPopover={showAccountPopover}
        setShowAccountPopover={setShowAccountPopover}
        onActionNotification={showToast}
        onLogout={onSignOut}
        onOpenPricing={() => { setModalDialog({ isOpen: false, type: null }); setActiveTab('rate-cards'); }}
        dispatchMode={dispatchMode}
        onDispatchModeChange={(mode) => {
          if (slug) { showToast('Manual dispatch is active.'); return; }
          setDispatchMode(mode);
          showToast(`Dispatch mode set to ${mode === 'AUTO' ? 'Auto' : 'Manual'}`);
        }}
        onOpenProfile={handleOpenProfile}
        onOpenHelp={handleOpenHelp}
      />

      {/* MAIN VIEWPORT / MAP STAGE OR DEDICATED SETTINGS / PROFILE / HELP PAGE */}
      <main
        className={`relative min-w-0 flex-1 h-full overflow-hidden ${!sidebarOpen ? 'menu-hidden' : ''}`}
      >
        {/* Mobile drawer trigger. Desktop expansion lives in the persistent icon rail. */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          aria-hidden={sidebarOpen}
          tabIndex={sidebarOpen ? -1 : 0}
          title="Open menu"
          className={`absolute z-40 flex sm:hidden items-center justify-center text-slate-700 transition-all duration-300 ease-in-out ${activeTab === 'monitor'
              ? 'top-5 left-3 w-10 h-10 rounded-xl bg-white border border-slate-200/90 shadow-md shadow-slate-900/5 hover:bg-slate-50'
              : 'top-4 left-3 w-9 h-9 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-app-hover'
            } ${sidebarOpen ? 'opacity-0 -translate-x-4 pointer-events-none' : 'opacity-100 translate-x-0'}`}
        >
          <PanelLeft className="w-4.5 h-4.5" strokeWidth={1.5} />
        </button>

        {activeTab !== 'monitor' && (activeTab === 'rate-cards' ? (
          <RateCardsPage
            onNotification={showToast}
          />
        ) : activeTab === 'profile' ? (
          <ProfilePage
            onNotification={showToast}
          />
        ) : activeTab === 'help' ? (
          <HelpSupportPage
            onNotification={showToast}
          />
        ) : activeTab === 'customers' ? (
          <CustomersPage
            jobs={jobs}
            onBackToMonitor={() => setActiveTab('monitor')}
            onNotification={showToast}
            onSelectJob={handleLocateJobOnMap}
          />
        ) : activeTab === 'jobs' ? (
          <JobsPage
            jobs={jobs}
            drivers={drivers}
            onSelectJob={handleLocateJobOnMap}
            onUpdateJob={handleUpdateJob}
            onCreateJob={handleCreateJob}
            onNotification={showToast}
            editJobId={editJobId}
            onEditHandled={() => setEditJobId(null)}
          />
        ) : activeTab === 'drivers' ? (
          <DriversPage
            drivers={drivers}
            jobs={jobs}
            onSelectDriver={handleLocateDriverOnMap}
            onUpdateDriver={handleUpdateDriver}
            onCreateDriver={handleCreateDriver}
            onDeleteDriver={handleDeleteDriver}
            onNotification={showToast}
            openDriverId={openDriverId}
            onOpenHandled={() => setOpenDriverId(null)}
          />
        ) : activeTab === 'vehicles' ? (
          <VehiclesPage
            drivers={drivers}
            onSelectDriver={handleLocateDriverOnMap}
            onNotification={showToast}
          />
        ) : activeTab === 'reports' ? (
          <ReportsPage
            onNotification={showToast}
          />
        ) : null)}

        {mapEverOpened && <div className={`absolute inset-0 z-0 ${activeTab === 'monitor' ? '' : 'hidden'}`} aria-label="Monitor map">
            {/* GOOGLE INTERACTIVE MAP CANVAS */}
            <GoogleMonitorMap
              demo={!slug}
              mapRef={mapRef}
              mapInstanceRef={mapRef}
              drivers={drivers}
              jobs={jobs}
              routes={slug ? routeQuery.data ?? [] : undefined}
              selectedDriverId={selectedDriverId}
              selectedJobId={selectedJobId}
              layerConfig={layerConfig}
              onSelectDriver={handleSelectDriver}
              onSelectJob={handleSelectJob}
              onMapClick={handleMapBackgroundClick}
              onPositionsUpdate={handleMarkerPositionsUpdate}
              onUpdatePositions={handleMarkerPositionsUpdate}
              onDriverTelemetry={handleDriverTelemetryUpdate}
              onDriverTelemetryUpdate={handleDriverTelemetryUpdate}
              active={activeTab === 'monitor'}
            />

            {activeTab === 'monitor' && <>
            {/* TOP METRICS (Active Jobs, Available Drivers, Needs Attention) */}
            <TopMetrics
              offsetForMenu={!sidebarOpen}
              drivers={drivers}
              jobs={jobs}
              activeJobsCount={activeJobsCount}
              availableDriversCount={availableDriversCount}
              needsAttentionCount={needsAttentionItems.length}
              needsAttentionItems={needsAttentionItems}
              showActiveJobsMenu={showActiveJobsMenu}
              setShowActiveJobsMenu={setShowActiveJobsMenu}
              showAvailableDriversMenu={showAvailableDriversMenu}
              setShowAvailableDriversMenu={setShowAvailableDriversMenu}
              showNeedsAttentionPopover={showNeedsAttentionPopover}
              setShowNeedsAttentionPopover={setShowNeedsAttentionPopover}
              onSelectJob={(num) => {
                handleSelectJob(num);
                setShowActiveJobsMenu(false);
                setShowNeedsAttentionPopover(false);
              }}
              onSelectDriver={(id) => {
                handleSelectDriver(id);
                setShowAvailableDriversMenu(false);
              }}
              onActionNotification={showToast}
              onOpenAllJobs={handleOpenAllJobs}
              onOpenAllDrivers={handleOpenAllDrivers}
              onOpenAllExceptions={handleOpenAllExceptions}
            />

            {/* MONITOR SEARCH AND NOTIFICATIONS */}
            <MonitorActions
              showSearchPopover={showSearchPopover}
              setShowSearchPopover={setShowSearchPopover}
              showNotificationPopover={showNotificationPopover}
              setShowNotificationPopover={setShowNotificationPopover}
              onSelectJob={(jobNum) => {
                handleSelectJob(jobNum);
                setShowSearchPopover(false);
              }}
              onSelectDriver={(driverId) => {
                handleSelectDriver(driverId);
                setShowSearchPopover(false);
              }}
              onActionNotification={showToast}
              drivers={drivers}
              jobs={jobs}
            />

            {/* DRIVER MARKER FLOW (D14 + Driver Actions Child) */}
            <AnimatePresence>
              {showDriverPopover && (
                <DriverPopover
                  driver={activeDriver}
                  live={!!slug}
                  onClose={handleCloseDriverPopover}
                  showActions={showDriverActions}
                  setShowActions={setShowDriverActions}
                  onActionNotification={showToast}
                  onOpenFullProfile={() => handleOpenDriverProfile(activeDriver)}
                  position={markerPositions.driver ?? markerPositions.d14 ?? undefined}
                />
              )}
            </AnimatePresence>

            {/* JOB MARKER FLOW (Job #461 + Assign Driver + AI Recommendation Terminal Child) */}
            <AnimatePresence>
              {showJobDetail && (
                <JobDetailPopover
                  job={activeJob}
                  live={!!slug}
                  drivers={drivers}
                  stopStatuses={Object.fromEntries((routeQuery.data?.find(route => route.id === activeJob.routeId)?.stops ?? []).map(visit => [visit.stop_id, visit.status]))}
                  onAssignDriver={driverId => handleMonitorAssignDriver(activeJob, driverId)}
                  onClose={handleCloseJobDetailPopover}
                  showAssignDriver={showAssignDriver}
                  setShowAssignDriver={setShowAssignDriver}
                  showAiRecommendation={showAiRecommendation}
                  setShowAiRecommendation={setShowAiRecommendation}
                  onApproveRecommendation={handleApproveRecommendation}
                  onKeepCurrent={handleKeepCurrent}
                  onActionNotification={showToast}
                  onOpenFullDetails={() => handleOpenJobDossier(activeJob)}
                  onOpenAllDrivers={handleOpenAllDrivers}
                  position={markerPositions.job ?? markerPositions.job461 ?? undefined}
                  timeZone={settingsQuery.data?.data.time_zone}
                />
              )}
            </AnimatePresence>

            {/* MAP CONTROLS & SETTINGS (BOTTOM-RIGHT) */}
            <MapControls
              layerConfig={layerConfig}
              setLayerConfig={setLayerConfig}
              showSettingsPopover={showMapSettings}
              setShowSettingsPopover={setShowMapSettings}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onActionNotification={showToast}
            />

            {/* RE-CENTER MAP QUICK ACTION BUTTON */}
            <button
              onClick={handleResetSpecView}
              className="app-action app-secondary absolute bottom-6 left-6 z-30 h-10 px-3.5 bg-white rounded-xl shadow-md shadow-slate-900/10 border border-slate-200/90 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2 transition-all active:scale-95"
              title="Reset map camera to Vancouver overview"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
              <span>Vancouver Overview</span>
            </button>
            </>}
          </div>}

        {/* NOTIFICATION TOAST */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-auto bg-slate-900/95 text-white px-4 py-2.5 rounded-xl shadow-xl shadow-slate-900/20 text-xs font-medium flex items-center gap-2.5"
            >
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {dossierJob && <MonitorOrderDetails job={dossierJob} jobs={jobs} drivers={drivers} onClose={() => setDossierJob(null)}
        onEdit={job => { setDossierJob(null); setEditJobId(job.id); setActiveTab('jobs'); }} onUpdateJob={handleUpdateJob} onNotification={showToast} />}

      {/* FULL CLOSABLE DETAIL MODAL DIALOG (Z-[100] PORTAL OVERLAY) */}
      <DetailModalDialog
        state={modalDialog}
        onClose={handleCloseModal}
        drivers={drivers}
        jobs={jobs}
        needsAttentionItems={needsAttentionItems}
        timeZone={slug ? settingsQuery.data?.data.time_zone : undefined}
        onEditDriver={driver => { handleCloseModal(); setOpenDriverId(driver.id); setActiveTab('drivers'); }}
        onSelectJob={(jobNum) => {
          handleCloseModal();
          handleSelectJob(jobNum);
        }}
        onSelectDriver={(driverId) => {
          handleCloseModal();
          handleSelectDriver(driverId);
        }}
        onActionNotification={showToast}
        onApproveRecommendation={handleApproveRecommendation}
      />
    </div>
  );
}
