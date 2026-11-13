import { CircleCheck } from 'lucide-react';
import type { AssistantChange } from '../../operations/api';
import { Button } from '../ui/button';
import type { ActionState } from './useAssistantChat';

/** A drafted record change waiting for the dispatcher; nothing is saved until Confirm is pressed. */
export function AssistantChangeCard({ change, state, disabled, onConfirm, onCancel }: {
  change: AssistantChange; state: ActionState; disabled: boolean; onConfirm: () => Promise<void>; onCancel: () => void;
}) {
  return <div aria-label={`${change.title}: ${change.subject}`} className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs">
    <p className="font-medium">{change.title}</p>
    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-app-muted">
      {change.lines.map(line => <div key={line.field} className="contents">
        <dt>{line.field}</dt>
        <dd className="break-words text-slate-900">
          {line.before != null && <><span className="text-app-muted line-through">{line.before}</span>{' → '}</>}
          {line.after ?? <span className="text-app-muted">Empty</span>}
        </dd>
      </div>)}
    </dl>
    {state.error && <p role="alert" className="mt-2 text-rose-700">{state.error}</p>}
    {state.status === 'done' && <p className="mt-2 inline-flex items-center gap-1 text-emerald-700"><CircleCheck size={14} aria-hidden="true" />Saved</p>}
    {state.password && <p className="mt-1 break-all">Temporary password (shown once): <span className="font-mono text-slate-900">{state.password}</span></p>}
    {state.status === 'cancelled' && <p className="mt-2 text-app-muted">Not changed</p>}
    {(state.status === 'open' || state.status === 'saving') && <div className="mt-2 flex gap-2">
      <Button type="button" size="sm" variant={change.destructive ? 'destructive' : 'default'} loading={state.status === 'saving'} disabled={disabled} onClick={onConfirm}>Confirm</Button>
      <Button type="button" size="sm" variant="outline" disabled={disabled || state.status === 'saving'} onClick={onCancel}>Cancel</Button>
    </div>}
  </div>;
}
