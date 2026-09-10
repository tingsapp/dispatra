export interface Driver {
  id: string;
  name: string;
  avatar: string;
  status: 'on_route' | 'available' | 'idle' | 'offline';
  statusLabel: string;
  vehicle: string;
  currentJob?: string;
  nextStop: string;
  eta: string;
  distance: string;
  lastUpdate: string;
  rating?: number;
  phone?: string;
  email?: string;
  licenseClass?: string;
  shiftStart?: string;
  hoursWorked?: string;
  speed?: number;
  completedJobsToday?: number;
  fuelBattery?: string;
  lat: number;
  lng: number;
  routeId?: string;
}

export interface Job {
  id: string;
  jobNumber: string;
  status: 'at_risk' | 'on_time' | 'late_start' | 'no_driver' | 'completed';
  statusLabel: string;
  riskText?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  pickupAddress: string;
  dropoffAddress: string;
  scheduledTime: string;
  jobType: string;
  assignedDriverId?: string;
  driverName?: string;
  serviceLevel?: string;
  cargoDescription?: string;
  cargoWeight?: string;
  palletCount?: number;
  billingAmount?: string;
  handlingInstructions?: string;
  stopsCount: number;
  lat: number;
  lng: number;
  routeId?: string;
}

export interface NeedsAttentionItem {
  id: string;
  jobNumber: string;
  statusType: 'at_risk' | 'late_start' | 'no_driver' | 'gps_stale';
  statusLabel: string;
  subtitle: string;
  pickupAddress: string;
  badgeColor: 'red' | 'amber';
  bulletColor: 'green' | 'red' | 'orange';
}

export interface EligibleDriver {
  id: string;
  code: string;
  name: string;
  avatar: string;
  distance: string;
  status: 'available' | 'on_route';
  eta: string;
  selected?: boolean;
}

export interface MapLayerConfig {
  mode: 'map' | 'satellite';
  traffic: boolean;
  labels: boolean;
}

export type ModalDialogType =
  | 'job_detail'
  | 'driver_detail'
  | 'all_jobs'
  | 'all_drivers'
  | 'all_exceptions'
  | 'pricing_services';

export interface ModalDialogState {
  isOpen: boolean;
  type: ModalDialogType | null;
  data?: any;
}
