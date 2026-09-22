import { X } from 'lucide-react';

export interface MonitorBriefData { name: string; orders: number; driversOnDuty: number; attention: number; now?: Date }

const greeting = (hour: number) => hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

/** The day's numbers, shown once as the map settles after the flight. */
export function MonitorBrief({ data, onClose }: { data: MonitorBriefData; onClose: () => void }) {
  const now = data.now ?? new Date();
  const first = data.name.trim().split(/\s+/)[0] || 'there';
  return <section role="status" aria-label="Today's brief" className="monitor-brief app-dialog-surface">
    <div className="min-w-0">
      <p className="text-sm font-medium text-slate-900">{greeting(now.getHours())}, {first}</p>
      <p className="mt-1 text-sm text-slate-600">
        <strong className="font-medium text-slate-900">{data.orders}</strong> {data.orders === 1 ? 'order' : 'orders'} today · <strong className="font-medium text-slate-900">{data.driversOnDuty}</strong> {data.driversOnDuty === 1 ? 'driver' : 'drivers'} on duty · <strong className={`font-medium ${data.attention ? 'text-amber-700' : 'text-slate-900'}`}>{data.attention}</strong> need{data.attention === 1 ? 's' : ''} attention
      </p>
    </div>
    <button type="button" onClick={onClose} aria-label="Dismiss brief" className="app-dialog-close"><X className="w-4 h-4" /></button>
  </section>;
}
