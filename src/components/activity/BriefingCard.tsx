import { CircleCheck, CircleAlert, Hand, Zap } from 'lucide-react';
import type { AssistantReply, BriefingTotals } from '../../operations/api';
import { useLiveBriefing } from './useLiveBriefing';

type Briefing = BriefingTotals['briefing'];
const STATUSES = [['Unassigned', 'unassigned'], ['Assigned', 'assigned'], ['In progress', 'in_progress'], ['Completed', 'completed']] as const;
const orders = (count: number) => `${count.toLocaleString()} ${count === 1 ? 'order' : 'orders'}`;

/** One plain sentence on who dispatches today and where today's orders went, e.g. "Auto dispatch is on. 3 orders assigned to Alex, 1 to Sam and 2 more drivers." */
export function dispatchSummary(data: Briefing) {
  const mode = data.dispatch_mode === 'AUTO' ? 'Auto dispatch is on.' : 'Auto dispatch is off.';
  const drivers = data.assigned_by_driver ?? [];
  if (!drivers.length) return `${mode} ${data.dispatch_mode === 'MANUAL' && data.unassigned ? `${orders(data.unassigned)} waiting for you to assign.` : 'No orders assigned yet today.'}`;
  const shown = drivers.slice(0, 2).map((row, index) => `${index ? row.orders.toLocaleString() : orders(row.orders)} ${index ? 'to' : 'assigned to'} ${row.driver_name}`);
  const more = drivers.length > 2 ? ` and ${drivers.length - 2} more ${drivers.length === 3 ? 'driver' : 'drivers'}` : '';
  return `${mode} ${shown.join(', ')}${more}. You can still change them.`;
}

export function BriefingCard({ slug, reply }: { slug?: string; reply: AssistantReply }) {
  const live = useLiveBriefing(slug, reply);
  if (!live) return null;
  const data = live.briefing;
  const attention = data.open_incidents > 0;
  const Icon = attention ? CircleAlert : CircleCheck;
  const updated = new Intl.DateTimeFormat('en-CA', { timeZone: data.time_zone, hour: 'numeric', minute: '2-digit' }).format(new Date(live.observed_at));
  const Mode = data.dispatch_mode === 'AUTO' ? Zap : Hand;
  return <div aria-label="Daily briefing" className="assistant-briefing">
    <section className="briefing-overview" aria-label={data.evening ? 'Today’s summary' : 'Today so far'}>
      <div className="briefing-heading">
        <h4>{data.evening ? 'Today’s summary' : 'Today so far'}</h4>
        <time dateTime={live.observed_at} title={`Updated in ${data.time_zone}`} aria-label={`Updated ${updated}`}><span className="briefing-live" aria-hidden="true" />{updated}</time>
      </div>
      <div className="briefing-total"><strong>{data.received.toLocaleString()}</strong><span>{data.received === 1 ? 'order for today' : 'orders for today'}</span></div>
      <div className="briefing-bar" aria-hidden="true">{STATUSES.map(([, key]) => data[key] > 0 && <span key={key} data-status={key} style={{ flexGrow: data[key] }} />)}</div>
      <dl className="briefing-counts" aria-label="Status of today’s orders">
        {STATUSES.map(([label, key]) => <div key={key} data-status={key}><dt>{label}</dt><dd>{data[key].toLocaleString()}</dd></div>)}
      </dl>
    </section>
    <ul className="briefing-guidance">
      <li className="briefing-dispatch"><Mode size={15} className="shrink-0 text-slate-500" aria-hidden="true" /><span>{dispatchSummary(data)}</span></li>
      <li className={`briefing-issues ${attention ? 'text-amber-700' : 'text-emerald-700'}`}><Icon size={15} className="shrink-0" aria-hidden="true" />{attention ? `${data.open_incidents} open ${data.open_incidents === 1 ? 'issue' : 'issues'} to review` : 'No open issues recorded'}<span className="sr-only"> across your workspace</span></li>
    </ul>
  </div>;
}
