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
    <div className="relative flex flex-col h-full w-full bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* TOP BAR */}
      <header className="flex-none bg-white border-b border-slate-200 px-6 py-4 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToMonitor}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Monitor
            </button>
            <div className="h-4 w-px bg-slate-300" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-blue-600" />
                Operational Reports & SLA Analytics
              </h1>
              <p className="text-xs text-slate-500">
                On-time compliance, hourly dispatch throughput, driver utilization, and billing audits
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Date Range Selector */}
            <div className="inline-flex bg-slate-100 p-0.5 border border-slate-300 rounded-lg text-xs font-medium">
              <button
                onClick={() => setDateRange('today')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  dateRange === 'today' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setDateRange('7days')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  dateRange === '7days' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setDateRange('month')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  dateRange === 'month' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Month to Date
              </button>
            </div>

            <button
              onClick={handlePrintSummary}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              Print PDF
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>
      </header>

      {/* BODY SCROLLABLE AREA */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* TOP KPI PERFORMANCE TILES */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
                <span>On-Time SLA</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  +1.4%
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">96.8%</div>
              <div className="text-[11px] text-slate-400 mt-1">Target threshold: 95.0%</div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <div className="text-xs font-medium text-slate-500">Dispatches Completed</div>
              <div className="text-2xl font-bold text-slate-900 mt-2">306</div>
              <div className="text-[11px] text-slate-400 mt-1">44 completed today</div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <div className="text-xs font-medium text-slate-500">Average Stop Dwell</div>
              <div className="text-2xl font-bold text-slate-900 mt-2">8.4 min</div>
              <div className="text-[11px] text-emerald-600 mt-1">1.2 min faster vs avg</div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <div className="text-xs font-medium text-slate-500">Fleet Distance</div>
              <div className="text-2xl font-bold text-slate-900 mt-2">1,840 km</div>
              <div className="text-[11px] text-slate-400 mt-1">Across 8 active units</div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <div className="text-xs font-medium text-slate-500">Dispatched Revenue</div>
              <div className="text-2xl font-bold text-slate-900 mt-2">$28,270</div>
              <div className="text-[11px] text-slate-400 mt-1">Avg $92.40 per stop</div>
            </div>
          </div>

          {/* VISUAL ANALYTICS: HOURLY THROUGHPUT & 7-DAY COMPLIANCE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Hourly Dispatch Volume */}
            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
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
                    <div key={item.hour} className="flex-1 flex flex-col items-center gap-1 group">
                      <div className="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.volume}
                      </div>
                      <div
                        className={`w-full rounded-t-sm transition-all duration-300 ${
                          item.peak
                            ? 'bg-blue-600 group-hover:bg-blue-700'
                            : 'bg-slate-200 group-hover:bg-slate-300'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                      <div className="text-[9px] text-slate-400 font-mono mt-1">{item.hour}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 mt-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-blue-600 rounded-xs" /> Priority Peak Windows (09:00 - 11:00, 14:00)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-slate-200 rounded-xs" /> Standard Flow
                </span>
              </div>
            </div>

            {/* Chart 2: 7-Day Performance & SLA Trend */}
            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
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
          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
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
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Dispatch Audit & SLA Variance Log</h3>
                <p className="text-xs text-slate-500">
                  Granular timestamp records of scheduled windows vs actual arrivals with proof of delivery
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search audit log..."
                    value={auditSearchQuery}
                    onChange={(e) => setAuditSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={slaFilter}
                  onChange={(e) => setSlaFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                >
                  <option value="all">All SLA Outcomes</option>
                  <option value="on_time">On Time</option>
                  <option value="late">Late (SLA Breached)</option>
                  <option value="ahead">Ahead of Schedule</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-medium">
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
                <tbody className="divide-y divide-slate-100">
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
