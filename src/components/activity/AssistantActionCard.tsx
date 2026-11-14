import { CircleCheck } from 'lucide-react';
import type { AssistantAction } from '../../operations/api';
import { Button } from '../ui/button';
import type { ActionState } from './useAssistantChat';

/** A checked assignment waiting for the dispatcher; nothing is saved until Confirm is pressed. */
export function AssistantActionCard({ action, state, disabled, onConfirm }: {
  action: AssistantAction; state: ActionState; disabled: boolean; onConfirm: () => Promise<void>;
}) {
  const move = !!action.current_driver_name;
  return <div aria-label={`${move ? 'Move' : 'Assign'} order ${action.order_number}`} className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs">
    <p className="font-medium">Order {action.order_number}</p>
    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-app-muted">
      {move && <><dt>From</dt><dd className="text-slate-900">{action.current_driver_name}</dd></>}
      <dt>{move ? 'To' : 'Driver'}</dt><dd className="text-slate-900">{action.driver_name}</dd>
      <dt>Vehicle</dt><dd className="text-slate-900">{action.vehicle_name}</dd>
    </dl>
    {state.error && <p role="alert" className="mt-2 text-rose-700">{state.error}</p>}
    {state.status === 'done' && <p className="mt-2 inline-flex items-center gap-1 text-emerald-700"><CircleCheck size={14} aria-hidden="true" />{move ? 'Moved' : 'Assigned'}</p>}
    {(state.status === 'open' || state.status === 'saving') && <Button type="button" size="xs" className="mt-2 px-3" loading={state.status === 'saving'} disabled={disabled} onClick={onConfirm}>Confirm</Button>}
  </div>;
}
