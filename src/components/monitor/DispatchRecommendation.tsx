import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, RefreshCw, Sparkles, X } from 'lucide-react';
import { operations, type DispatchDecision, type Order } from '../../operations/api';

const AI_DOWN: Record<string, string> = { AI_NOT_CONFIGURED: 'AI ranking is not configured', AI_RATE_LIMITED: 'AI ranking is busy', AI_AUTHENTICATION_FAILED: 'AI ranking cannot sign in' };

/** Dispatch agent recommendation for one unassigned Order. The API ranks only drivers that pass every hard check; Approve re-checks before saving. */
export function DispatchRecommendation({ slug, order, onClose, onAssigned }: { slug: string; order: Order; onClose: () => void; onAssigned: (message: string) => void }) {
  const queryClient = useQueryClient();
  const queryKey = ['operations', slug, 'dispatch-suggestion', order.id, order.version];
  const suggestion = useQuery({ queryKey, queryFn: () => operations.dispatchSuggestion(slug, order.id), staleTime: 60_000, retry: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const decision = suggestion.data;
  const refresh = async () => {
    setBusy('refresh'); setError('');
    try { queryClient.setQueryData(queryKey, await operations.dispatchSuggestion(slug, order.id, true)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not check drivers.'); }
    finally { setBusy(null); }
  };
  const approve = async (current: DispatchDecision, driverId: string, name: string) => {
    setBusy(driverId); setError('');
    try { await operations.approveDispatch(slug, current, driverId); onAssigned(`Assigned ${order.number} to ${name}.`); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not assign the driver.'); await refresh(); }
    finally { setBusy(null); }
  };
  const [best, ...others] = decision?.candidates ?? [];
  return <div className="app-menu-surface w-[310px] ring-1 ring-slate-900/10 p-4 text-xs">
    <div className="flex items-center justify-between pb-2">
      <div className="flex items-center gap-1.5 font-medium text-indigo-600 whitespace-nowrap"><Sparkles className="w-3.5 h-3.5 fill-indigo-600" /><span>AI Recommendation</span></div>
      <div className="flex items-center gap-1 shrink-0">
        {decision && <span title={decision.ranked_by === 'RULES' && decision.error_code ? `${AI_DOWN[decision.error_code] ?? 'AI ranking is unavailable'}; ranked by rules.` : undefined}
          className={`px-1.5 py-0.5 rounded-full border whitespace-nowrap ${decision.ranked_by === 'AI' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{decision.ranked_by === 'AI' ? 'AI ranked' : 'Rules'}</span>}
        <button type="button" onClick={refresh} disabled={!!busy || suggestion.isFetching} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md disabled:opacity-50" title="Check drivers again" aria-label="Check drivers again"><RefreshCw className={`w-3.5 h-3.5 ${busy === 'refresh' ? 'animate-spin' : ''}`} /></button>
        <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md" title="Close AI Recommendation" aria-label="Close AI Recommendation"><X className="w-3.5 h-3.5" /></button>
      </div>
    </div>
    {suggestion.isPending && <p className="py-3 text-slate-500" role="status">Checking every driver for {order.number}…</p>}
    {suggestion.isError && <p className="py-2 text-rose-700">{suggestion.error instanceof Error ? suggestion.error.message : 'Could not check drivers.'}</p>}
    {decision && !best && <div className="space-y-2">
      <p className="font-medium text-slate-900">No driver can take this order right now.</p>
      <ul className="space-y-1 text-slate-600 max-h-40 overflow-y-auto">{decision.excluded.map(item => <li key={item.driver_id}><span className="font-medium text-slate-800">{item.driver_name}</span> · {item.reason}</li>)}</ul>
      {!decision.excluded.length && <p className="text-slate-500">No active drivers are registered.</p>}
    </div>}
    {decision && best && <div>
      <div className="font-medium text-slate-900 text-sm">{best.driver_name} <span className="text-slate-500 font-normal">· {best.driver_number} · {best.vehicle_name}</span></div>
      {best.reason && <p className="mt-1 text-slate-700">{best.reason}</p>}
      <ul className="space-y-1.5 my-3 text-slate-600">{best.facts.map(fact => <li key={fact} className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-px" /><span>{fact}</span></li>)}</ul>
      <button type="button" disabled={!!busy} onClick={() => approve(decision, best.driver_id, best.driver_name)} className="app-action app-primary w-full text-white">{busy === best.driver_id ? 'Assigning…' : 'Approve'}</button>
      {others.length > 0 && <div className="mt-3 pt-2 border-t border-slate-100 space-y-1.5">
        <div className="text-slate-500">Other options</div>
        {others.slice(0, 3).map(other => <div key={other.driver_id} className="flex items-center justify-between gap-2">
          <div className="min-w-0"><div className="font-medium text-slate-800 truncate">{other.driver_name} · {other.driver_number}</div><div className="text-slate-500 truncate" title={other.reason}>{other.reason}</div></div>
          <button type="button" disabled={!!busy} onClick={() => approve(decision, other.driver_id, other.driver_name)} className="app-action app-secondary shrink-0">{busy === other.driver_id ? '…' : 'Assign'}</button>
        </div>)}
      </div>}
      {decision.excluded.length > 0 && <p className="mt-2 text-slate-500">{decision.excluded.length} other driver{decision.excluded.length === 1 ? '' : 's'} cannot take it.</p>}
    </div>}
    {error && <p className="mt-2 text-rose-700" role="alert">{error}</p>}
    {decision && <p className="mt-2 text-slate-400">Travel times are estimates; assignment re-checks the route.</p>}
  </div>;
}
