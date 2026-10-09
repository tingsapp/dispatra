import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type DotProps, type TooltipContentProps } from 'recharts';
import { activityDays, sourceLabels, type Analytics } from '../../operations/analyticsAdapters';
import type { OrderDateSelection } from '../orders/OrderDateFilter';

const colors = { total: '#3b82f6', onTime: '#3b82f6', late: '#f59e0b', unknown: '#cbd5e1', sources: '#000000' };
const dayLabel = (date: string) => new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
const fullDate = (date: string) => new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
const axis = { fontSize: 11, fill: '#94a3b8' };
function SingleDateSegment({ cx, cy, stroke }: Pick<DotProps, 'cx' | 'cy' | 'stroke'>) {
  if (cx == null || cy == null) return null;
  return <path className="recharts-line-curve" d={`M${cx - 16},${cy}h32`} fill="none" stroke={stroke} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />;
}
function ChartTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const date = payload[0]?.payload;
  const heading = date?.date ? `${fullDate(date.date)}${date.end !== date.date ? ` – ${fullDate(date.end)}` : ''}` : label;
  return <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs shadow-lg">
    {heading && <p className="mb-2 font-medium text-slate-900">{heading}</p>}
    {payload.map(item => <div key={String(item.dataKey)} className="mt-1.5 flex items-center justify-between gap-6 text-slate-500">
      <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><span className="font-medium tabular-nums text-slate-900">{item.value}</span>
    </div>)}
  </div>;
}
function Legend({ items }: { items: [string, string][] }) {
  return <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">{items.map(([label, color]) => <span key={label} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}</div>;
}
function Panel({ title, empty, children, footer, className, emptyLabel = 'No orders for these dates' }: { title: string; empty: boolean; children: ReactNode; footer: ReactNode; className: string; emptyLabel?: string }) {
  return <section aria-label={title} className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 ${className}`}>
    <h2 className="text-sm font-medium text-slate-900">{title}</h2>
    <div className="mt-5 h-56 min-w-0">{empty ? <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">{emptyLabel}</div> : children}</div>
    <div className="mt-4">{footer}</div>
  </section>;
}
export function AnalyticsCharts({ data, filter, timeZone }: { data: Analytics; filter: OrderDateSelection; timeZone: string }) {
  const activity = activityDays(data, filter, timeZone);
  const sources = Object.entries(sourceLabels).map(([source, label]) => ({ label, count: data.source_counts[source] ?? 0 }));
  const unknown = Object.entries(data.source_counts).filter(([source]) => !(source in sourceLabels)).reduce((sum, [, count]) => sum + count, 0);
  if (unknown) sources.push({ label: 'Not recorded', count: unknown });
  const late = data.sla_known_orders - data.on_time_orders;
  const performance = [
    { name: 'On time', value: data.on_time_orders, fill: colors.onTime },
    { name: 'Late', value: late, fill: colors.late },
    { name: 'Not measured', value: data.completed_orders - data.sla_known_orders, fill: colors.unknown },
  ];
  const segments = performance.filter(item => item.value > 0);
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
    <Panel className="lg:col-span-4" title="Delivery performance" empty={!data.completed_orders} emptyLabel="No completed deliveries yet"
      footer={<div className="space-y-2.5 text-xs">{performance.map(item => <div key={item.name} className="flex items-center justify-between gap-3 text-slate-500"><span className="inline-flex items-center gap-2"><span className="size-2 rounded-full" style={{ backgroundColor: item.fill }} />{item.name}</span><span className="font-medium tabular-nums text-slate-700">{item.value.toLocaleString()}</span></div>)}</div>}>
      <div className="relative h-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart accessibilityLayer>
            <Pie data={segments} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="62%" outerRadius="84%" paddingAngle={segments.length > 1 ? 3 : 0} cornerRadius={4} stroke="white" strokeWidth={2} isAnimationActive={false}>
              {segments.map(item => <Cell key={item.name} fill={item.fill} />)}
            </Pie>
            <Tooltip content={ChartTooltip} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-medium tabular-nums tracking-tight text-slate-900">{data.completed_orders.toLocaleString()}</span><span className="mt-1 text-xs text-slate-400">completed</span></div>
      </div>
    </Panel>
    <Panel className="lg:col-span-8" title="Orders, drivers & shippers" empty={!data.orders}
      footer={<Legend items={[["Orders", colors.total], ["Drivers", '#000000'], ["Shippers", '#8b5cf6']]} />}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={activity} margin={{ top: 8, right: 16, left: -25, bottom: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="date" tickFormatter={dayLabel} tick={axis} axisLine={false} tickLine={false} minTickGap={25} dy={8} />
          <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={ChartTooltip} />
          <Line type="monotone" strokeLinecap="round" strokeLinejoin="round" dataKey="orders" name="Orders" stroke={colors.total} strokeWidth={2.5} dot={activity.length === 1 ? SingleDateSegment : false} activeDot={false} isAnimationActive={false} />
          <Line type="monotone" strokeLinecap="round" strokeLinejoin="round" dataKey="drivers" name="Drivers" stroke="#000000" strokeWidth={2} dot={activity.length === 1 ? SingleDateSegment : false} activeDot={false} isAnimationActive={false} />
          <Line type="monotone" strokeLinecap="round" strokeLinejoin="round" dataKey="shippers" name="Shippers" stroke="#8b5cf6" strokeWidth={2} dot={activity.length === 1 ? SingleDateSegment : false} activeDot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </Panel>
    <section aria-label="Order sources" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-12">
      <div className="grid gap-5 sm:grid-cols-[minmax(160px,1fr)_2fr] sm:items-center">
        <div><h2 className="text-sm font-medium text-slate-900">Order sources</h2><p className="mt-5 text-3xl font-medium tabular-nums tracking-tight text-slate-900">{data.orders.toLocaleString()}</p></div>
        <div className="h-40 min-w-0">{data.orders ? <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={sources} layout="vertical" margin={{ top: 0, right: 35, left: 0, bottom: 0 }} barSize={12} accessibilityLayer>
            <XAxis type="number" hide domain={[0, 'dataMax']} allowDecimals={false} /><YAxis type="category" dataKey="label" width={82} tick={{ ...axis, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip content={ChartTooltip} cursor={false} /><Bar dataKey="count" name="Orders" fill={colors.sources} radius={[0, 5, 5, 0]} background={{ fill: '#f8fafc', radius: 5 }} label={{ position: 'right', fontSize: 12, fill: '#64748b' }} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer> : <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">No order sources to show</div>}</div>
      </div>
    </section>
  </div>;
}
