export interface AuditLogItem {
  id: string;
  timestamp: string;
  jobNumber: string;
  customerName: string;
  driverName: string;
  driverCode: string;
  serviceType: string;
  vehicleUnit: string;
  scheduledTime: string;
  actualArrival: string;
  slaStatus: 'on_time' | 'late' | 'ahead' | 'exception';
  varianceMinutes: number;
  totalBilled: number;
  accessorialsCharged: string[];
  podVerified: boolean;
  signatureReceived: boolean;
}

export interface DayPerformance {
  day: string;
  totalJobs: number;
  onTimeJobs: number;
  lateJobs: number;
  exceptionJobs: number;
  revenue: number;
}

export interface HourlyVolume {
  hour: string;
  volume: number;
  peak: boolean;
}

export const AUDIT_LOG_ITEMS: AuditLogItem[] = [
  {
    id: 'aud-101',
    timestamp: '2026-09-09 16:45',
    jobNumber: '#458',
    customerName: 'Pacific Fresh Logistics',
    driverName: 'Arles Morgan',
    driverCode: 'D14',
    serviceType: 'Rush Expedited',
    vehicleUnit: 'V12',
    scheduledTime: '15:30 – 16:30',
    actualArrival: '16:22',
    slaStatus: 'on_time',
    varianceMinutes: -8,
    totalBilled: 145.0,
    accessorialsCharged: ['Liftgate Delivery', 'Inside Delivery'],
    podVerified: true,
    signatureReceived: true
  },
  {
    id: 'aud-102',
    timestamp: '2026-09-09 15:20',
    jobNumber: '#455',
    customerName: 'Nordic Bio Health Supplies',
    driverName: 'Marcus Vance',
    driverCode: 'D28',
    serviceType: 'Direct Hotshot',
    vehicleUnit: 'V08',
    scheduledTime: '14:00 – 15:00',
    actualArrival: '15:12',
    slaStatus: 'late',
    varianceMinutes: 12,
    totalBilled: 230.0,
    accessorialsCharged: ['Temperature Controlled Reefer', 'Urgent Rush'],
    podVerified: true,
    signatureReceived: true
  },
  {
    id: 'aud-103',
    timestamp: '2026-09-09 14:10',
    jobNumber: '#449',
    customerName: 'Metro Retailers Group',
    driverName: 'Maria Garcia',
    driverCode: 'D09',
    serviceType: 'Same-Day Standard',
    vehicleUnit: 'V14',
    scheduledTime: '13:00 – 15:00',
    actualArrival: '13:48',
    slaStatus: 'ahead',
    varianceMinutes: -72,
    totalBilled: 95.0,
    accessorialsCharged: ['Standard Delivery'],
    podVerified: true,
    signatureReceived: true
  },
  {
    id: 'aud-104',
    timestamp: '2026-09-09 13:05',
    jobNumber: '#442',
    customerName: 'Apex Precision Engineering',
    driverName: 'Sam Jenkins',
    driverCode: 'D18',
    serviceType: 'Same-Day Standard',
    vehicleUnit: 'V04',
    scheduledTime: '11:30 – 13:30',
    actualArrival: '12:55',
    slaStatus: 'on_time',
    varianceMinutes: -35,
    totalBilled: 310.0,
    accessorialsCharged: ['Heavy Skids Surcharge', 'Liftgate Service', 'Dock Wait 20m'],
    podVerified: true,
    signatureReceived: true
  },
  {
    id: 'aud-105',
    timestamp: '2026-09-09 11:40',
    jobNumber: '#438',
    customerName: 'Granville Island Artisans',
    driverName: 'Chloe Bennett',
    driverCode: 'D31',
    serviceType: 'Scheduled Economy',
    vehicleUnit: 'V19',
    scheduledTime: '10:00 – 12:00',
    actualArrival: '11:15',
    slaStatus: 'on_time',
    varianceMinutes: -45,
    totalBilled: 65.0,
    accessorialsCharged: ['Downtown Green Zero-Emission'],
    podVerified: true,
    signatureReceived: true
  },
  {
    id: 'aud-106',
    timestamp: '2026-09-09 10:15',
    jobNumber: '#431',
    customerName: 'Pacific Coast Health Clinics',
    driverName: 'Marcus Vance',
    driverCode: 'D28',
    serviceType: 'Rush Expedited',
    vehicleUnit: 'V08',
    scheduledTime: '09:00 – 10:00',
    actualArrival: '10:11',
    slaStatus: 'late',
    varianceMinutes: 11,
    totalBilled: 160.0,
    accessorialsCharged: ['Medical Direct Protocol', 'Waiting Time'],
    podVerified: true,
    signatureReceived: true
  },
  {
    id: 'aud-107',
    timestamp: '2026-09-09 09:00',
    jobNumber: '#425',
    customerName: 'Urban Builders Supply Hub',
    driverName: 'Sam Jenkins',
    driverCode: 'D18',
    serviceType: 'Same-Day Standard',
    vehicleUnit: 'V04',
    scheduledTime: '08:00 – 09:30',
    actualArrival: '08:52',
    slaStatus: 'on_time',
    varianceMinutes: -38,
    totalBilled: 420.0,
    accessorialsCharged: ['Flatbed Offload', 'Heavy Cargo 3500kg'],
    podVerified: true,
    signatureReceived: true
  }
];

export const HOURLY_VOLUMES: HourlyVolume[] = [
  { hour: '07:00', volume: 8, peak: false },
  { hour: '08:00', volume: 18, peak: false },
  { hour: '09:00', volume: 34, peak: true },
  { hour: '10:00', volume: 42, peak: true },
  { hour: '11:00', volume: 38, peak: true },
  { hour: '12:00', volume: 29, peak: false },
  { hour: '13:00', volume: 31, peak: false },
  { hour: '14:00', volume: 39, peak: true },
  { hour: '15:00', volume: 27, peak: false },
  { hour: '16:00', volume: 22, peak: false },
  { hour: '17:00', volume: 14, peak: false }
];

export const SEVEN_DAYS_PERFORMANCE: DayPerformance[] = [
  { day: 'Thu 09/03', totalJobs: 48, onTimeJobs: 46, lateJobs: 2, exceptionJobs: 0, revenue: 4280 },
  { day: 'Fri 09/04', totalJobs: 56, onTimeJobs: 53, lateJobs: 3, exceptionJobs: 0, revenue: 5120 },
  { day: 'Sat 09/05', totalJobs: 24, onTimeJobs: 24, lateJobs: 0, exceptionJobs: 0, revenue: 2310 },
  { day: 'Sun 09/06', totalJobs: 18, onTimeJobs: 18, lateJobs: 0, exceptionJobs: 0, revenue: 1890 },
  { day: 'Mon 09/07', totalJobs: 52, onTimeJobs: 50, lateJobs: 2, exceptionJobs: 0, revenue: 4890 },
  { day: 'Tue 09/08', totalJobs: 58, onTimeJobs: 56, lateJobs: 2, exceptionJobs: 0, revenue: 5460 },
  { day: 'Today', totalJobs: 46, onTimeJobs: 44, lateJobs: 2, exceptionJobs: 0, revenue: 4320 }
];
