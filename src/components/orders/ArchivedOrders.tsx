import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, RotateCcw } from 'lucide-react';
import { allOperations, operations, type Order } from '../../operations/api';
import { Button } from '../ui/button';
import { usePendingAction } from '../ui/usePendingAction';
import { formatWhen } from './OrderDossierSections';

const STATUS: Record<string, string> = { CANCELLED: 'Cancelled', COMPLETED: 'Completed' };

/** Archived orders: closed orders kept for history, out of the Orders list until restored. */
export function ArchivedOrders({ slug, search, timeZone, onNotification }: { slug: string; search: string; timeZone: string; onNotification: (message: string) => void }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['operations', slug, 'orders', 'archived'], queryFn: () => allOperations.archivedOrders(slug) });
  const restore = usePendingAction();
  const term = search.trim().toLowerCase();
  const rows = (query.data ?? []).filter(order => !term || [order.number, (order.booking as { shipper?: { name?: string } }).shipper?.name ?? ''].some(text => text.toLowerCase().includes(term)))
    .sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? ''));
  const run = (order: Order) => restore.run(async () => {
    try { await operations.restoreOrder(slug, order); onNotification(`Order ${order.number} restored.`); }
    catch (error) { onNotification(error instanceof Error ? error.message : 'Could not restore the order.'); }
    finally { await queryClient.invalidateQueries({ queryKey: ['operations', slug, 'orders'] }); }
  }, order.id);
  if (query.isPending) return <p role="status" className="p-12 text-center text-xs text-slate-500">Loading archived orders…</p>;
  if (query.isError) return <p role="alert" className="p-12 text-center text-xs text-rose-700">Could not load archived orders.</p>;
  if (!rows.length) return <div className="p-12 text-center"><Archive className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="app-section-title text-slate-800">{term ? 'No archived orders match your search' : 'No archived orders'}</h3><p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Deleted orders are archived here with their history. Restore one to return it to the Orders list.</p></div>;
  return <div className="overflow-x-auto">
    <table aria-label="Archived orders" className="app-table w-full text-left border-collapse">
      <thead><tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-medium text-slate-600"><th className="py-3 px-4">Order / Status</th><th className="py-3 px-4">Shipper</th><th className="py-3 px-4">Scheduled</th><th className="py-3 px-4">Archived</th><th className="py-3 px-4 text-right">Actions</th></tr></thead>
      <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
        {rows.map(order => <tr key={order.id}>
          <td className="py-3.5 px-4 whitespace-nowrap"><div className="flex items-center gap-2"><span className="font-medium text-slate-900">{order.number}</span><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{STATUS[order.status] ?? order.status}</span></div></td>
          <td className="py-3.5 px-4 font-medium text-slate-800">{(order.booking as { shipper?: { name?: string } }).shipper?.name ?? '-'}</td>
          <td className="py-3.5 px-4 whitespace-nowrap text-slate-700">{formatWhen(order.scheduled_at, timeZone)}</td>
          <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">{order.archived_at ? formatWhen(order.archived_at, timeZone) : '-'}</td>
          <td className="py-3.5 px-4 text-right whitespace-nowrap"><Button type="button" variant="outline" size="sm" onClick={() => void run(order)} disabled={restore.pending} aria-label={`Restore order ${order.number}`}><RotateCcw />{restore.pendingKey === order.id ? 'Restoring…' : 'Restore'}</Button></td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}
