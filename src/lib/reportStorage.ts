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

export function summarizeAuditLogs(logs: AuditLogItem[]) {
  const total = logs.length;
  const onTime = logs.filter(log => log.slaStatus === 'on_time' || log.slaStatus === 'ahead').length;
  const revenue = logs.reduce((sum, log) => sum + log.totalBilled, 0);
  const podVerified = logs.filter(log => log.podVerified).length;
  const averageVariance = total ? logs.reduce((sum, log) => sum + Math.abs(log.varianceMinutes), 0) / total : null;
  const onTimePercent = total ? Math.round(onTime / total * 1000) / 10 : null;

  const hourCounts = new Map<number, number>();
  const dayCounts = new Map<string, DayPerformance>();
  const accessorialCounts = { liftgate: 0, reefer: 0, inside: 0, waiting: 0 };
  for (const log of logs) {
    const hour = Number(log.timestamp.slice(11, 13));
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    const day = log.timestamp.slice(0, 10);
    const performance = dayCounts.get(day) ?? { day, totalJobs: 0, onTimeJobs: 0, lateJobs: 0, exceptionJobs: 0, revenue: 0 };
    performance.totalJobs += 1;
    performance.onTimeJobs += Number(log.slaStatus === 'on_time' || log.slaStatus === 'ahead');
    performance.lateJobs += Number(log.slaStatus === 'late');
    performance.exceptionJobs += Number(log.slaStatus === 'exception');
    performance.revenue += log.totalBilled;
    dayCounts.set(day, performance);
    for (const charge of log.accessorialsCharged) {
      if (/liftgate/i.test(charge)) accessorialCounts.liftgate += 1;
      if (/reefer|temperature/i.test(charge)) accessorialCounts.reefer += 1;
      if (/inside|white glove/i.test(charge)) accessorialCounts.inside += 1;
      if (/wait|demurrage/i.test(charge)) accessorialCounts.waiting += 1;
    }
  }
  const hours = [...hourCounts.keys()].sort((a, b) => a - b);
  const peakVolume = Math.max(0, ...hourCounts.values());
  const hourlyVolumes: HourlyVolume[] = hours.length ? Array.from({ length: hours.at(-1)! - hours[0] + 1 }, (_, index) => {
    const hour = hours[0] + index;
    const volume = hourCounts.get(hour) ?? 0;
    return { hour: `${String(hour).padStart(2, '0')}:00`, volume, peak: volume > 0 && volume === peakVolume };
  }) : [];
  const dailyPerformance = [...dayCounts.values()].sort((a, b) => a.day.localeCompare(b.day));
  const peakHour = hourlyVolumes.find(item => item.peak);
  return { total, onTime, onTimePercent, revenue, podVerified, averageVariance, accessorialCounts,
    hourlyVolumes, dailyPerformance, peakHour };
}
