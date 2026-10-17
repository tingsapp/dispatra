import { useState } from 'react';
import type { Driver, Job } from '../../types';
import { ArrowLeft } from 'lucide-react';
import { ChatPopup } from './ChatPopup';
import { ChatDialog } from './OrderChat';

/** A driver can have several private order chats; never silently choose an unrelated order. */
export function DriverChatDialog({ slug, driver, jobs, onClose }: { slug: string; driver: Driver; jobs: Job[]; onClose: () => void }) {
  const orders = jobs.filter(job => job.assignedDriverId === driver.id && ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(job.lifecycleStatus ?? ''));
  const [selected, setSelected] = useState<string | null>(() => orders.length === 1 ? orders[0].id : null);
  const current = orders.find(order => order.id === selected);
  if (!current) return <ChatPopup onClose={onClose}>
    <p className="text-sm text-slate-600">{orders.length ? `Choose an order to message ${driver.name}.` : `No order conversations are available for ${driver.name}. Chat becomes available when an order is assigned.`}</p>
    {!!orders.length && <ul className="divide-y divide-slate-100">{orders.map(order => <li key={order.id}><button type="button" onClick={() => setSelected(order.id)} aria-label={`Order ${order.jobNumber}, ${order.customerName}`} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-app-accent"><span className="font-medium">{order.jobNumber}</span><span className="text-xs text-slate-500">{order.customerName}</span></button></li>)}</ul>}
  </ChatPopup>;
  return <ChatDialog slug={slug} orderId={current.id} orderNumber={current.jobNumber} initialKind="DISPATCH_DRIVER" expectedDriverId={driver.id} onClose={onClose}
    orderPicker={orders.length > 1 && <button type="button" onClick={() => setSelected(null)} className="inline-flex items-center gap-1.5 rounded text-xs text-slate-500 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-app-accent"><ArrowLeft size={13} aria-hidden="true" />Change order</button>} />;
}
