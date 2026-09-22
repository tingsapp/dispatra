import { ListSummary } from '../components/layout/ListSummary';
import { Button } from '../components/ui/button';
import {
PackageCheck,
Timer,
Route,
Wallet,
Truck,
Snowflake,
HandHeart,
AlertTriangle,
CheckCircle2,
Clock,
Download,
Printer
} from 'lucide-react';
import { useMemo,useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Select';
import {
AUDIT_LOG_ITEMS,
HOURLY_VOLUMES,
SEVEN_DAYS_PERFORMANCE
} from '../lib/reportStorage';

interface ReportsPageProps {
  onNotification: (message: string) => void;
}

export function ReportsPage({ onNotification }: ReportsPageProps) {
  const [dateRange, setDateRange] = useState<'today' | '7days' | 'month' | 'quarter'>('7days');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [slaFilter, setSlaFilter] = useState<'all' | 'on_time' | 'late' | 'ahead'>('all');

  const filteredAuditLogs = useMemo(() => {
    return AUDIT_LOG_ITEMS.filter((item) => {
      const q = auditSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.jobNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        item.driverName.toLowerCase().includes(q) ||
        item.serviceType.toLowerCase().includes(q);

      const matchesSla = slaFilter === 'all' || item.slaStatus === slaFilter;

      return matchesSearch && matchesSla;
    });
  }, [auditSearchQuery, slaFilter]);

  const handleExportCSV = () => {
    const headers = [
      'Timestamp',
      'Job Number',
      'Shipper',
      'Driver',
      'Service',
      'Vehicle',
      'Scheduled',
      'Actual Arrival',
      'SLA Status',
      'Variance (min)',
      'Billed Amount ($)',
      'Accessorials'
    ];
    const rows = filteredAuditLogs.map((log) => [
      log.timestamp,
      log.jobNumber,
      `"${log.customerName}"`,
      `"${log.driverName} (${log.driverCode})"`,
      `"${log.serviceType}"`,
      log.vehicleUnit,
      `"${log.scheduledTime}"`,
      log.actualArrival,
      log.slaStatus,
      log.varianceMinutes,
      log.totalBilled,
      `"${log.accessorialsCharged.join(', ')}"`
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dispatra_sla_audit_report_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotification(`Downloaded SLA Audit Log report (${filteredAuditLogs.length} records)`);
  };

  const handlePrintSummary = () => {
    onNotification('Preparing printable PDF operational summary report...');
    setTimeout(() => {
      window.print();
    }, 400);
  };

  return (
    <div className="app-page app-list-page h-full w-full flex flex-col overflow-hidden font-sans">
      {/* TOP BAR */}
      <PageHeader title="Analytics" description="Delivery performance, driver utilization and billing summaries." actions={<>
          {/* Date Range Selector */}
          <div className="app-list-status">
            <button
              aria-pressed={dateRange === 'today'}
              onClick={() => setDateRange('today')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                dateRange === 'today' ? 'bg-app-selected text-app-text' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              aria-pressed={dateRange === '7days'}
              onClick={() => setDateRange('7days')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                dateRange === '7days' ? 'bg-app-selected text-app-text' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 7 Days
            </button>
            <button
              aria-pressed={dateRange === 'month'}
              onClick={() => setDateRange('month')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                dateRange === 'month' ? 'bg-app-selected text-app-text' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Month to Date
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrintSummary}
            className="app-action app-secondary"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print PDF</span>
          </button>
          <Button
            type="button"
            onClick={handleExportCSV}
            className="app-action app-primary flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>
      </>} />

      {/* BODY CONTENT */}
      <div className="page-content flex-1 overflow-y-auto py-6">
        <div className="space-y-6">
          {/* TOP KPI PERFORMANCE TILES */}
          <ListSummary label="Analytics summary" items={[
            { label: 'On-time SLA', value: '96.8%', icon: CheckCircle2, description: '+1.4% · Target 95.0%' },
            { label: 'Dispatches completed', value: 306, icon: PackageCheck, description: '44 completed today' },
            { label: 'Average stop dwell', value: '8.4 min', icon: Timer, description: '1.2 min faster vs avg' },
            { label: 'Fleet distance', value: '1,840 km', icon: Route, description: 'Across 8 active units' },
            { label: 'Dispatched revenue', value: '$28,270', icon: Wallet, description: 'Avg $92.40 per stop' },
          ]} />

          {/* VISUAL ANALYTICS: HOURLY THROUGHPUT & 7-DAY COMPLIANCE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Hourly Dispatch Volume */}
            <div className="app-panel min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="app-section-title text-slate-900">Hourly Dispatch Volume & Rush Peaks</h3>
                  <p className="text-xs text-slate-500">Metro Vancouver delivery volume distribution throughout shift</p>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                  Peak: 10:00 AM (42 jobs)
                </span>
              </div>

              {/* Bar Chart Visualization */}
              <div className="overflow-x-auto"><div className="h-44 min-w-[30rem] flex items-end gap-1 pt-6 pb-2">
                {HOURLY_VOLUMES.map((item) => {
                  const heightPercent = Math.round((item.volume / 45) * 100);
                  return (
                    <div key={item.hour} className="flex-1 h-full flex flex-col items-center gap-1 group">
                      <div className="text-xs font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.volume}
                      </div>
                      {/* flex-1 gives this track a resolved height so the bar's % height applies */}
                      <div className="flex-1 w-full flex items-end">
                        <div
                          className={`w-full rounded-t-sm transition-all duration-300 ${
                            item.peak
                              ? 'bg-slate-900 group-hover:bg-slate-700'
                              : 'bg-slate-200 group-hover:bg-slate-300'
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-1">{item.hour}</div>
                    </div>
                  );
                })}
              </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 mt-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-slate-900 rounded-xs" /> Priority Peak Windows (09:00 - 11:00, 14:00)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-slate-200 rounded-xs" /> Standard Flow
                </span>
              </div>
            </div>

            {/* Chart 2: 7-Day Performance & SLA Trend */}
            <div className="app-panel min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="app-section-title text-slate-900">7-Day SLA Trend & Revenue</h3>
                  <p className="text-xs text-slate-500">Daily dispatches and on-time SLA fulfillment rates</p>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                  96.8% Average
                </span>
              </div>

              {/* Trend table/bars */}
              <div className="space-y-2.5 pt-2">
                {SEVEN_DAYS_PERFORMANCE.map((day) => {
                  const onTimePercent = Math.round((day.onTimeJobs / day.totalJobs) * 100);
                  return (
                    <div key={day.day} className="flex items-center gap-3 text-xs">
                      <span className="w-20 font-medium text-slate-700 text-xs">{day.day}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden flex">
                        <div
                          className="bg-emerald-500 h-full rounded-l-full"
                          style={{ width: `${onTimePercent}%` }}
                          title={`On Time: ${day.onTimeJobs}`}
                        />
                        {day.lateJobs > 0 && (
                          <div
                            className="bg-rose-400 h-full"
                            style={{ width: `${100 - onTimePercent}%` }}
                            title={`Late: ${day.lateJobs}`}
                          />
                        )}
                      </div>
                      <span className="w-12 text-right font-mono font-medium text-slate-800 text-xs">
                        {onTimePercent}%
                      </span>
                      <span className="w-16 text-right text-slate-500 text-xs font-mono">
                        ${day.revenue.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 mt-4 pt-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-xs" /> Delivered On-Time (SLA Passed)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-rose-400 rounded-xs" /> Delay / Variance
                </span>
              </div>
            </div>
          </div>

          {/* ACCESSORIAL BREAKDOWN TILES */}
          <div className="app-panel app-panel-plain">
            <h3 className="app-section-title text-slate-900 mb-1">Accessorial Surcharges & Extra Services</h3>
            <p className="text-xs text-slate-500 mb-4">Value-add billing captured during dispatch and offload</p>

            <ListSummary label="Accessorial summary" items={[
              { label: 'Liftgate services', value: 48, icon: Truck, description: 'Dispatches · $1,680 billed ($35 ea)' },
              { label: 'Reefer temp controlled', value: 26, icon: Snowflake, description: 'Dispatches · $1,170 billed ($45 ea)' },
              { label: 'Inside / white glove', value: 32, icon: HandHeart, description: 'Dispatches · $1,280 billed ($40 ea)' },
              { label: 'Waiting time / demurrage', value: 14, icon: Timer, description: 'Dispatches · $630 billed ($1.50/min)' },
            ]} />
          </div>

          {/* SLA DISPATCH AUDIT LOG TABLE */}
          <div className="app-table-shell bg-white overflow-hidden">
            <div className="py-4 space-y-4">
              <div>
                <h3 className="app-section-title text-slate-900">Dispatch Audit & SLA Variance Log</h3>
                <p className="text-xs text-slate-500">
                  Granular timestamp records of scheduled windows vs actual arrivals with proof of delivery
                </p>
              </div>

              <div className="app-list-toolbar">
                <SearchInput
                  className="app-list-search"
                  value={auditSearchQuery}
                  onChange={setAuditSearchQuery}
                  placeholder="Search audit log..."
                />

                <Select
                  aria-label="Filter by SLA outcome"
                  value={slaFilter}
                  onValueChange={(v) => setSlaFilter(v as any)}
                  align="end"
                  options={[
                    { value: 'all', label: 'All SLA Outcomes' },
                    { value: 'on_time', label: 'On Time' },
                    { value: 'late', label: 'Late (SLA Breached)' },
                    { value: 'ahead', label: 'Ahead of Schedule' }
                  ]}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table aria-label="Analytics audit log" className="app-table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-medium text-slate-600">
                    <th className="py-3 px-4">Timestamp / Job</th>
                    <th className="py-3 px-4">Shipper</th>
                    <th className="py-3 px-4">Driver & Vehicle</th>
                    <th className="py-3 px-4">Scheduled Window</th>
                    <th className="py-3 px-4">Actual Arrival</th>
                    <th className="py-3 px-4">SLA Outcome</th>
                    <th className="py-3 px-4">Accessorials & Billing</th>
                    <th className="py-3 px-4 text-center">POD Verified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                  {filteredAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-medium text-slate-900">{log.jobNumber}</span>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{log.timestamp}</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                        {log.customerName}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-slate-800 font-medium">{log.driverName}</div>
                        <div className="text-xs text-slate-400 font-mono">{log.driverCode} • {log.vehicleUnit}</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                        {log.scheduledTime}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                        {log.actualArrival}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.slaStatus === 'on_time' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            On Time ({log.varianceMinutes}m)
                          </span>
                        )}
                        {log.slaStatus === 'late' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Late (+{log.varianceMinutes}m)
                          </span>
                        )}
                        {log.slaStatus === 'ahead' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            <Clock className="w-3 h-3 text-blue-600" />
                            Ahead ({Math.abs(log.varianceMinutes)}m early)
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">${log.totalBilled.toFixed(2)}</div>
                        <div className="text-xs text-slate-500 truncate max-w-xs">
                          {log.accessorialsCharged.join(', ')}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {log.podVerified ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Signature
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
