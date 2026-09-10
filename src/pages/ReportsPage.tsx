import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  BarChart2,
  Download,
  Calendar,
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Truck,
  DollarSign,
  Package,
  Layers,
  Printer,
  ChevronDown
} from 'lucide-react';
import { Select } from '../components/ui/Select';
import { SearchInput } from '../components/ui/SearchInput';
import {
  AUDIT_LOG_ITEMS,
  SEVEN_DAYS_PERFORMANCE,
  HOURLY_VOLUMES,
  AuditLogItem
} from '../lib/reportStorage';

interface ReportsPageProps {
  onBackToMonitor: () => void;
  onNotification: (message: string) => void;
}

export function ReportsPage({ onBackToMonitor, onNotification }: ReportsPageProps) {
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
      'Customer',
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
    <div className="h-full w-full bg-slate-50 flex flex-col overflow-hidden font-sans">
      {/* TOP BAR */}
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
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-tight">
                Operational Reports & SLA Analytics
              </h1>
              <p className="text-[11px] text-slate-500 leading-tight">
                On-time compliance, hourly dispatch throughput, driver utilization, and billing audits
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Range Selector */}
          <div className="inline-flex bg-slate-50 p-0.5 border border-slate-200 rounded-lg text-xs font-medium">
            <button
              onClick={() => setDateRange('today')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                dateRange === 'today' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateRange('7days')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                dateRange === '7days' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setDateRange('month')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                dateRange === 'month' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Month to Date
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrintSummary}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print PDF</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </header>

      {/* BODY CONTENT */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {/* TOP KPI PERFORMANCE TILES */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
                <span>On-Time SLA</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  +1.4%
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">96.8%</div>
              <div className="mt-1 text-[11px] text-slate-500">Target threshold: 95.0%</div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">Dispatches Completed</div>
              <div className="text-2xl font-bold text-slate-900 mt-2">306</div>
              <div className="mt-1 text-[11px] text-slate-500">44 completed today</div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">Average Stop Dwell</div>
              <div className="text-2xl font-bold text-slate-900 mt-2">8.4 min</div>
              <div className="text-[11px] text-emerald-600 mt-1">1.2 min faster vs avg</div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">Fleet Distance</div>
              <div className="text-2xl font-bold text-slate-900 mt-2">1,840 km</div>
              <div className="mt-1 text-[11px] text-slate-500">Across 8 active units</div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">Dispatched Revenue</div>
              <div className="text-2xl font-bold text-slate-900 mt-2">$28,270</div>
              <div className="mt-1 text-[11px] text-slate-500">Avg $92.40 per stop</div>
            </div>
          </div>

          {/* VISUAL ANALYTICS: HOURLY THROUGHPUT & 7-DAY COMPLIANCE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Hourly Dispatch Volume */}
            <div className="p-5 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Hourly Dispatch Volume & Rush Peaks</h3>
                  <p className="text-xs text-slate-500">Metro Vancouver delivery volume distribution throughout shift</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                  Peak: 10:00 AM (42 jobs)
                </span>
              </div>

              {/* Bar Chart Visualization */}
              <div className="h-44 flex items-end gap-2 pt-6 pb-2 border-b border-slate-100">
                {HOURLY_VOLUMES.map((item) => {
                  const heightPercent = Math.round((item.volume / 45) * 100);
                  return (
                    <div key={item.hour} className="flex-1 h-full flex flex-col items-center gap-1 group">
                      <div className="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      <div className="text-[9px] text-slate-400 font-mono mt-1">{item.hour}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 mt-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-slate-900 rounded-xs" /> Priority Peak Windows (09:00 - 11:00, 14:00)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-slate-200 rounded-xs" /> Standard Flow
                </span>
              </div>
            </div>

            {/* Chart 2: 7-Day Performance & SLA Trend */}
            <div className="p-5 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">7-Day SLA Trend & Revenue</h3>
                  <p className="text-xs text-slate-500">Daily dispatches and on-time SLA fulfillment rates</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                  96.8% Average
                </span>
              </div>

              {/* Trend table/bars */}
              <div className="space-y-2.5 pt-2">
                {SEVEN_DAYS_PERFORMANCE.map((day) => {
                  const onTimePercent = Math.round((day.onTimeJobs / day.totalJobs) * 100);
                  return (
                    <div key={day.day} className="flex items-center gap-3 text-xs">
                      <span className="w-20 font-medium text-slate-700 text-[11px]">{day.day}</span>
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
                      <span className="w-12 text-right font-mono font-bold text-slate-800 text-[11px]">
                        {onTimePercent}%
                      </span>
                      <span className="w-16 text-right text-slate-500 text-[11px] font-mono">
                        ${day.revenue.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
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
          <div className="p-5 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Accessorial Surcharges & Extra Services</h3>
            <p className="text-xs text-slate-500 mb-4">Value-add billing captured during dispatch and offload</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-slate-500 font-medium">Liftgate Services</div>
                <div className="text-lg font-bold text-slate-900 mt-1">48 Dispatches</div>
                <div className="text-[11px] text-blue-600 font-semibold mt-0.5">$1,680 billed ($35 ea)</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-slate-500 font-medium">Reefer Temp Controlled</div>
                <div className="text-lg font-bold text-slate-900 mt-1">26 Dispatches</div>
                <div className="text-[11px] text-blue-600 font-semibold mt-0.5">$1,170 billed ($45 ea)</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-slate-500 font-medium">Inside / White Glove</div>
                <div className="text-lg font-bold text-slate-900 mt-1">32 Dispatches</div>
                <div className="text-[11px] text-blue-600 font-semibold mt-0.5">$1,280 billed ($40 ea)</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-slate-500 font-medium">Waiting Time / Demurrage</div>
                <div className="text-lg font-bold text-slate-900 mt-1">14 Dispatches</div>
                <div className="text-[11px] text-amber-600 font-semibold mt-0.5">$630 billed ($1.50/min)</div>
              </div>
            </div>
          </div>

          {/* SLA DISPATCH AUDIT LOG TABLE */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Dispatch Audit & SLA Variance Log</h3>
                <p className="text-xs text-slate-500">
                  Granular timestamp records of scheduled windows vs actual arrivals with proof of delivery
                </p>
              </div>

              <div className="flex items-center gap-2">
                <SearchInput
                  className="w-64"
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
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-600 tracking-wide uppercase">
                    <th className="py-3 px-4">Timestamp / Job</th>
                    <th className="py-3 px-4">Customer</th>
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
                        <span className="font-bold text-slate-900">{log.jobNumber}</span>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{log.timestamp}</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                        {log.customerName}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-slate-800 font-medium">{log.driverName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{log.driverCode} • {log.vehicleUnit}</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                        {log.scheduledTime}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                        {log.actualArrival}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.slaStatus === 'on_time' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            On Time ({log.varianceMinutes}m)
                          </span>
                        )}
                        {log.slaStatus === 'late' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Late (+{log.varianceMinutes}m)
                          </span>
                        )}
                        {log.slaStatus === 'ahead' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <Clock className="w-3 h-3 text-blue-600" />
                            Ahead ({Math.abs(log.varianceMinutes)}m early)
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">${log.totalBilled.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-xs">
                          {log.accessorialsCharged.join(', ')}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {log.podVerified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Signature
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Pending</span>
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
