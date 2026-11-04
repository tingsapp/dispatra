import { ArrowUpRight, CircleCheck, CircleAlert } from 'lucide-react';
import type { AssistantReply } from '../../operations/api';

export function BriefingCard({ reply, pending, onFollowUp }: { reply: AssistantReply; pending: boolean; onFollowUp?: (prompt: string) => void }) {
  const data = reply.briefing;
  if (!data) return null;
  const attention = data.open_incidents > 0;
  const Icon = attention ? CircleAlert : CircleCheck;
  return <div aria-label="Daily briefing" className="space-y-4 py-2">
    <div className="flex items-center justify-between gap-3">
      <h4 className="text-sm font-medium text-slate-900">{data.evening ? 'Today’s summary' : 'Today so far'}</h4>
      <time dateTime={reply.observed_at} className="text-[10px] text-slate-400">{new Intl.DateTimeFormat('en-CA', { timeZone: data.time_zone, hour: 'numeric', minute: '2-digit' }).format(new Date(reply.observed_at))}</time>
    </div>
    <p className="flex items-baseline gap-2"><strong className="text-3xl font-semibold tracking-tight tabular-nums">{data.received}</strong><span className="text-xs text-slate-500">orders received today</span></p>
    <dl className="grid grid-cols-4 gap-2 rounded-xl bg-slate-50 px-3 py-3">
      {[['Unassigned', data.unassigned], ['Assigned', data.assigned], ['In progress', data.in_progress], ['Completed', data.completed]].map(([label, value]) => <div key={label}><dt className="text-[10px] text-slate-500">{label}</dt><dd className="mt-1 text-base font-medium tabular-nums text-slate-900">{value}</dd></div>)}
    </dl>
    <p className={`flex items-center gap-2 text-xs ${attention ? 'text-amber-700' : 'text-slate-500'}`}><Icon size={14} className="shrink-0" />{attention ? `${data.open_incidents} open issues to review` : 'No open issues recorded'}<span className="sr-only"> across your workspace</span></p>
    <p className="break-words text-[13px] leading-5 text-slate-700">{reply.message}</p>
    <div className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Briefing follow-ups">{[['Show unassigned', 'Show my unassigned orders.'], ['Review issues', 'Which orders need attention and why?']].map(([label, prompt]) => <button key={label} type="button" disabled={pending} onClick={() => onFollowUp?.(prompt)} className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-900 focus-visible:outline-2 disabled:opacity-50">{label}<ArrowUpRight size={12} /></button>)}</div>
  </div>;
}
