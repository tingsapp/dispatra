import { CircleCheck, CircleAlert, Package } from 'lucide-react';
import type { AssistantReply, BriefingTotals } from '../../operations/api';
import { useLiveBriefing } from './useLiveBriefing';

/** Questions a dispatcher most often needs answered at the start of a shift; each is sent as a normal chat message. */
export const BRIEFING_QUESTIONS = ['List all new orders.', 'Which orders need attention and why?'];

type Briefing = BriefingTotals['briefing'];
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

export function BriefingCard({ slug, reply, pending, onFollowUp }: { slug?: string; reply: AssistantReply; pending: boolean; onFollowUp?: (prompt: string) => void }) {
  const live = useLiveBriefing(slug, reply);
  if (!live) return null;
  const data = live.briefing;
  const attention = data.open_incidents > 0;
  const Icon = attention ? CircleAlert : CircleCheck;
  const updated = new Intl.DateTimeFormat('en-CA', { timeZone: data.time_zone, hour: 'numeric', minute: '2-digit' }).format(new Date(live.observed_at));
  return <div aria-label="Daily briefing" className="assistant-briefing">
    <div className="briefing-overview">
      <div className="briefing-heading">
        <h4>{data.evening ? 'Today’s summary' : 'Today so far'}</h4>
        <time dateTime={live.observed_at} title={`Updated in ${data.time_zone}`} aria-label={`Updated ${updated}`}>
          {updated}
        </time>
      </div>
      <div className="briefing-total">
        <div><strong>{data.received.toLocaleString()}</strong><span>{data.received === 1 ? 'order received today' : 'orders received today'}</span></div>
        <span className="briefing-order-icon" aria-hidden="true"><Package size={22} strokeWidth={1.5} /></span>
      </div>
    </div>
    <dl className="briefing-counts" aria-label="Status of orders received today">
      {[['Unassigned', data.unassigned], ['Assigned', data.assigned], ['In progress', data.in_progress], ['Completed', data.completed]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value.toLocaleString()}</dd></div>)}
    </dl>
    <div className="briefing-guidance">
      <p className="briefing-dispatch">{dispatchSummary(data)}</p>
      <p className={`briefing-issues ${attention ? 'text-amber-700' : 'text-slate-600'}`}><Icon size={15} className="shrink-0" aria-hidden="true" />{attention ? `${data.open_incidents} open ${data.open_incidents === 1 ? 'issue' : 'issues'} to review` : 'No open issues recorded'}<span className="sr-only"> across your workspace</span></p>
      {live.recommendation && <p className="briefing-recommendation">{live.recommendation}</p>}
    </div>
    <div className="briefing-questions" aria-label="Suggested questions">{BRIEFING_QUESTIONS.map(question => <button key={question} type="button" disabled={pending || !onFollowUp} onClick={() => onFollowUp?.(question)}>{question}</button>)}</div>
  </div>;
}
