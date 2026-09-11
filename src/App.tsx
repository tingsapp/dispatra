import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from './components/Sidebar';
import { TopMetrics } from './components/TopMetrics';
import { DateControl } from './components/DateControl';
import { TorontoMap, VANCOUVER_CENTER_LNG_LAT, MapController } from './components/TorontoMap';
import { DriverPopover } from './components/DriverPopover';
import { JobDetailPopover } from './components/JobDetailPopover';
import { MapControls } from './components/MapControls';
import { DetailModalDialog } from './components/DetailModalDialog';
import { PricingServicesPage } from './pages/PricingServicesPage';
import { PricingSimulatorPage } from './pages/PricingSimulatorPage';
import { ProfilePage } from './pages/ProfilePage';
import { HelpSupportPage } from './pages/HelpSupportPage';
import { CustomersPage } from './pages/CustomersPage';
import { JobsPage } from './pages/JobsPage';
import { DriversPage } from './pages/DriversPage';
import { VehiclesPage } from './pages/VehiclesPage';
import { ReportsPage } from './pages/ReportsPage';
import { BillingSettingsPage } from './pages/BillingSettingsPage';
import { RateCardsPage } from './pages/RateCardsPage';
import {
  INITIAL_DRIVERS,
  INITIAL_JOBS,
  INITIAL_NEEDS_ATTENTION
} from './data/mockData';
import { Driver, Job, NeedsAttentionItem, MapLayerConfig, ModalDialogState } from './types';
import { Sparkles, RefreshCw, Menu } from 'lucide-react';
import { enrichJobsWithPricing, pricingAttentionItems } from './lib/orderPricing';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('monitor');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [drivers, setDrivers] = useState<Driver[]>(INITIAL_DRIVERS);
  // Every order carries a PricingSnapshot from the shared engine, including the static mocks.
  const [jobs, setJobs] = useState<Job[]>(() => enrichJobsWithPricing(INITIAL_JOBS));
  const [operationalAttentionItems, setNeedsAttentionItems] = useState<NeedsAttentionItem[]>(INITIAL_NEEDS_ATTENTION);
  // Orders that could not be priced (no card, conflict, zone no-match, missing distance) join the list.
  const needsAttentionItems = useMemo(
    () => [...pricingAttentionItems(jobs), ...operationalAttentionItems],
    [jobs, operationalAttentionItems]
  );

  // Active Jobs & Driver counts
  const [activeJobsCount, setActiveJobsCount] = useState<number>(47);
  const [availableDriversCount, setAvailableDriversCount] = useState<number>(5);
  const [dispatchMode, setDispatchMode] = useState<'AUTO' | 'MANUAL'>('MANUAL');

  // Full closable modal dialog state
  const [modalDialog, setModalDialog] = useState<ModalDialogState>({ isOpen: false, type: null });

  // Menu & Popover Visibility States (Default: false - clean map on initialize, menus only appear on click)
  const [showActiveJobsMenu, setShowActiveJobsMenu] = useState<boolean>(false);
  const [showAvailableDriversMenu, setShowAvailableDriversMenu] = useState<boolean>(false);
  const [showNeedsAttentionPopover, setShowNeedsAttentionPopover] = useState<boolean>(false);
  const [showCalendarPopover, setShowCalendarPopover] = useState<boolean>(false);
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
    traffic: true,
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
    setDrivers((prev) => {
      const existing = prev.find((d) => d.id === driverId);
      if (existing && existing.eta === telemetry.eta && existing.distance === telemetry.distance) {
        return prev;
      }
      return prev.map((d) => (d.id === driverId ? { ...d, eta: telemetry.eta, distance: telemetry.distance } : d));
    });
  }, []);

  // Selecting driver: Opens primary popover, ensures child menu is CLOSED on-demand
  const handleSelectDriver = useCallback((id: string) => {
    setSelectedDriverId(id);
    setShowDriverPopover(true);
    setShowDriverActions(false); // Child only displayed on-demand
    setShowJobDetail(false);

    setDrivers((prev) => {
      const found = prev.find((d) => d.id === id);
      if (found && mapRef.current) {
        mapRef.current.flyTo({
          center: [found.lng, found.lat],
          zoom: 13.5,
          duration: 800,
          essential: true
        });
        const pt = mapRef.current.project([found.lng, found.lat]);
        if (pt && (pt.x !== 0 || pt.y !== 0)) {
          setMarkerPositions((curr) => ({
            ...curr,
            driver: pt,
            d14: id === 'D14' ? pt : curr.d14
          }));
        }
      }
      return prev;
    });
    showToast(`Selected Driver ${id}`);
  }, []);

  // Selecting job: Opens primary popover, ensures child and grandchild are CLOSED on-demand
  const handleSelectJob = useCallback((jobNumber: string) => {
    setSelectedJobId(jobNumber);
    setShowJobDetail(true);
    setShowAssignDriver(false); // Child only displayed on-demand
    setShowAiRecommendation(false); // Grandchild only displayed on-demand
    setShowDriverPopover(false);

    setJobs((prev) => {
      const found = prev.find((j) => j.jobNumber === jobNumber);
      if (found && mapRef.current) {
        mapRef.current.flyTo({
          center: [found.lng, found.lat],
          zoom: 13.5,
          duration: 800,
          essential: true
        });
        const pt = mapRef.current.project([found.lng, found.lat]);
        if (pt && (pt.x !== 0 || pt.y !== 0)) {
          setMarkerPositions((curr) => ({
            ...curr,
            job: pt,
            job461: jobNumber === '#461' ? pt : curr.job461
          }));
        }
      }
      return prev;
    });
    showToast(`Selected Job ${jobNumber}`);
  }, []);

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
  const handleOpenJobDossier = (job?: Job) => {
    setModalDialog({
      isOpen: true,
      type: 'job_detail',
      data: job || activeJob
    });
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
      if (!mapReady && attempts < 40) {
        attempts += 1;
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
    }, 100);
    return () => window.clearInterval(timer);
  }, [activeTab, pendingLocate, handleSelectJob, handleSelectDriver]);

  // Job & Driver mutations coming from the Jobs / Drivers pages
  const handleUpdateJob = useCallback((updatedJob: Job) => {
    setJobs((prev) => prev.map((j) => (j.id === updatedJob.id ? updatedJob : j)));
  }, []);

  const handleCreateJob = useCallback((newJob: Job) => {
    setJobs((prev) => [newJob, ...prev]);
    setActiveJobsCount((prev) => prev + 1);
  }, []);

  const handleUpdateDriver = useCallback((updatedDriver: Driver) => {
    setDrivers((prev) => prev.map((d) => (d.id === updatedDriver.id ? updatedDriver : d)));
  }, []);

  const handleCreateDriver = useCallback((newDriver: Driver) => {
    setDrivers((prev) => [newDriver, ...prev]);
    if (newDriver.status === 'available') {
      setAvailableDriversCount((prev) => prev + 1);
    }
  }, []);

  const handleOpenPricingServices = () => {
    setShowAccountPopover(false);
    setModalDialog({ isOpen: false, type: null });
    setActiveTab('services-accessorials');
  };

  const handleOpenBillingSettings = () => {
    setShowAccountPopover(false);
    setModalDialog({ isOpen: false, type: null });
    setActiveTab('billing-settings');
  };

  const handleOpenPricingSimulator = () => {
    setShowAccountPopover(false);
    setModalDialog({ isOpen: false, type: null });
    setActiveTab('pricing-simulator');
  };

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
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* LEFT NAVIGATION SIDEBAR */}
      <Sidebar
        activeTab={activeTab}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        setActiveTab={setActiveTab}
        showAccountPopover={showAccountPopover}
        setShowAccountPopover={setShowAccountPopover}
        onActionNotification={showToast}
        onOpenPricingServices={handleOpenPricingServices}
        onOpenPricingSimulator={handleOpenPricingSimulator}
        onOpenBillingSettings={handleOpenBillingSettings}
        dispatchMode={dispatchMode}
        onDispatchModeChange={(mode) => {
          setDispatchMode(mode);
          showToast(`Dispatch mode set to ${mode === 'AUTO' ? 'Auto' : 'Manual'}`);
        }}
        onOpenProfile={handleOpenProfile}
        onOpenHelp={handleOpenHelp}
      />

      {/* MAIN VIEWPORT / MAP STAGE OR DEDICATED SETTINGS / SIMULATOR / PROFILE / HELP PAGE */}
      <main
        className={`relative flex-1 h-full w-full overflow-hidden ${!sidebarOpen ? 'menu-hidden' : ''}`}
      >
        {/* Menu button — visible whenever the sidebar is hidden. Floats over the map; sits in the page header elsewhere. */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          title="Open menu"
          className={`absolute z-40 flex items-center justify-center text-slate-700 transition-all duration-300 ease-in-out ${
            activeTab === 'monitor'
              ? 'top-5 left-3 w-10 h-10 rounded-xl bg-white border border-slate-200/90 shadow-md shadow-slate-900/5 hover:bg-slate-50'
              : 'top-3.5 left-4 w-9 h-9 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          } ${sidebarOpen ? 'opacity-0 -translate-x-4 pointer-events-none' : 'opacity-100 translate-x-0'}`}
        >
          <Menu className="w-4.5 h-4.5" />
        </button>

        {activeTab === 'services-accessorials' || activeTab === 'pricing-services' ? (
          <PricingServicesPage
            onBackToMonitor={() => setActiveTab('monitor')}
            onOpenSimulator={() => setActiveTab('pricing-simulator')}
            onNotification={showToast}
          />
        ) : activeTab === 'pricing-simulator' ? (
          <PricingSimulatorPage
            onBackToMonitor={() => setActiveTab('monitor')}
            onNavigateToServices={() => setActiveTab('services-accessorials')}
            onNotification={showToast}
          />
        ) : activeTab === 'rate-cards' ? (
          <RateCardsPage
            onBackToMonitor={() => setActiveTab('monitor')}
            onOpenSimulator={() => setActiveTab('pricing-simulator')}
            onNotification={showToast}
          />
        ) : activeTab === 'billing-settings' ? (
          <BillingSettingsPage
            onBackToMonitor={() => setActiveTab('monitor')}
            onOpenSimulator={() => setActiveTab('pricing-simulator')}
            onNotification={showToast}
          />
        ) : activeTab === 'profile' ? (
          <ProfilePage
            onBackToMonitor={() => setActiveTab('monitor')}
            onNotification={showToast}
          />
        ) : activeTab === 'help' ? (
          <HelpSupportPage
            onBackToMonitor={() => setActiveTab('monitor')}
            onNotification={showToast}
          />
        ) : activeTab === 'customers' ? (
          <CustomersPage
            onBackToMonitor={() => setActiveTab('monitor')}
            onNotification={showToast}
            onSelectJob={handleLocateJobOnMap}
          />
        ) : activeTab === 'jobs' ? (
          <JobsPage
            jobs={jobs}
            drivers={drivers}
            onBackToMonitor={() => setActiveTab('monitor')}
            onSelectJob={handleLocateJobOnMap}
            onUpdateJob={handleUpdateJob}
            onCreateJob={handleCreateJob}
            onNotification={showToast}
          />
        ) : activeTab === 'drivers' ? (
          <DriversPage
            drivers={drivers}
            jobs={jobs}
            onBackToMonitor={() => setActiveTab('monitor')}
            onSelectDriver={handleLocateDriverOnMap}
            onUpdateDriver={handleUpdateDriver}
            onCreateDriver={handleCreateDriver}
            onNotification={showToast}
          />
        ) : activeTab === 'vehicles' ? (
          <VehiclesPage
            drivers={drivers}
            onBackToMonitor={() => setActiveTab('monitor')}
            onSelectDriver={handleLocateDriverOnMap}
            onNotification={showToast}
          />
        ) : activeTab === 'reports' ? (
          <ReportsPage
            onBackToMonitor={() => setActiveTab('monitor')}
            onNotification={showToast}
          />
        ) : (
          <>
            {/* MAPLIBRE GL / LEAFLET INTERACTIVE MAP CANVAS */}
        <TorontoMap
          mapRef={mapRef}
          mapInstanceRef={mapRef}
          drivers={drivers}
          jobs={jobs}
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
        />

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

        {/* COMPACT DATE CONTROL, NOTIFICATION & SEARCH ICONS */}
        <DateControl
          showCalendarPopover={showCalendarPopover}
          setShowCalendarPopover={setShowCalendarPopover}
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
          className="absolute bottom-6 left-6 z-30 h-10 px-3.5 bg-white rounded-xl shadow-md shadow-slate-900/10 border border-slate-200/90 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2 transition-all active:scale-95"
          title="Reset map camera to Vancouver overview"
        >
          <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
          <span>Vancouver Overview</span>
        </button>
          </>
        )}

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

      {/* FULL CLOSABLE DETAIL MODAL DIALOG (Z-[100] PORTAL OVERLAY) */}
      <DetailModalDialog
        state={modalDialog}
        onClose={handleCloseModal}
        drivers={drivers}
        jobs={jobs}
        needsAttentionItems={needsAttentionItems}
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
