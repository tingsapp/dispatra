import { ArrowUpRight, CircleCheck, CircleAlert, Package } from 'lucide-react';
import type { AssistantReply } from '../../operations/api';

export function BriefingCard({ reply, pending, onFollowUp }: { reply: AssistantReply; pending: boolean; onFollowUp?: (prompt: string) => void }) {
  const data = reply.briefing;
  if (!data) return null;
  const attention = data.open_incidents > 0;
  const Icon = attention ? CircleAlert : CircleCheck;
  const updated = new Intl.DateTimeFormat('en-CA', { timeZone: data.time_zone, hour: 'numeric', minute: '2-digit' }).format(new Date(reply.observed_at));
  return <div aria-label="Daily briefing" className="assistant-briefing">
    <div className="briefing-overview">
      <div className="briefing-heading">
        <h4>{data.evening ? 'Today’s summary' : 'Today so far'}</h4>
        <time dateTime={reply.observed_at} title={`Updated in ${data.time_zone}`} aria-label={`Updated ${updated}`}>
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
      <p className={`briefing-issues ${attention ? 'text-amber-700' : 'text-slate-600'}`}><Icon size={15} className="shrink-0" aria-hidden="true" />{attention ? `${data.open_incidents} open ${data.open_incidents === 1 ? 'issue' : 'issues'} to review` : 'No open issues recorded'}<span className="sr-only"> across your workspace</span></p>
      <p className="briefing-recommendation">{reply.message}</p>
    </div>
    <div className="briefing-actions" aria-label="Briefing follow-ups">{[['Unassigned', 'Show unassigned', 'Show my unassigned orders.'], ['Review issues', 'Review issues', 'Which orders need attention and why?']].map(([label, accessibleLabel, prompt]) => <button key={label} type="button" aria-label={accessibleLabel} disabled={pending || !onFollowUp} onClick={() => onFollowUp?.(prompt)}>{label}<ArrowUpRight size={14} aria-hidden="true" /></button>)}</div>
  </div>;
}
