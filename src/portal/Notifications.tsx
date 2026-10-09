import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bell, CheckCircle2, Clock } from 'lucide-react';
import { FloatingPanel } from '../components/ui/FloatingPanel';
import { operations, type AppNotification } from '../operations/api';
import { notificationsKey, syncKey } from './sync';

const SEVERITY = {
  CRITICAL: { icon: AlertTriangle, tone: 'bg-rose-100 text-rose-600', label: 'Critical' },
  WARNING: { icon: Clock, tone: 'bg-amber-100 text-amber-600', label: 'Warning' },
  INFO: { icon: CheckCircle2, tone: 'bg-blue-100 text-blue-600', label: 'Information' },
} as const;

/** Compact age for inbox rows: Just now, 5m ago, 3h ago, then a short date. */
export function notificationAge(iso: string, now = Date.now()) {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ago`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(iso));
}

/** Unread count from the workspace sync loop (`useSync`). */
export function useUnreadNotifications(slug: string) {
  const summary = useQuery<{ unread: number }>({ queryKey: syncKey(slug), queryFn: () => Promise.resolve({ unread: 0 }), enabled: false, staleTime: Infinity, gcTime: Infinity });
  return summary.data?.unread ?? 0;
}

/** Inbox list with read and read-all actions; `onOpen` follows a notification to its record. */
export function NotificationPanel({ slug, onOpen }: { slug: string; onOpen?: (row: AppNotification) => void }) {
  const cache = useQueryClient();
  const unread = useUnreadNotifications(slug);
  const list = useQuery({ queryKey: notificationsKey(slug), queryFn: () => operations.notifications(slug) });
  const settle = (count: number) => {
    cache.setQueryData<{ unread: number }>(syncKey(slug), current => ({ unread: Math.max(0, (current?.unread ?? 0) - count) }));
    return cache.invalidateQueries({ queryKey: notificationsKey(slug) });
  };
  const read = useMutation({ mutationFn: (row: AppNotification) => operations.readNotification(slug, row), onSuccess: () => settle(1) });
  const readAll = useMutation({ mutationFn: () => operations.readAllNotifications(slug), onSuccess: result => settle(result.updated) });
  const open = (row: AppNotification) => { if (!row.read_at) read.mutate(row); onOpen?.(row); };
  const rows = list.data ?? [];
  return <div>
    <div className="flex items-center justify-between pb-2.5">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm text-slate-900">Notifications</span>
        {unread > 0 && <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium text-xs" aria-label={`${unread} unread`}>{unread}</span>}
      </div>
      <button type="button" disabled={readAll.isPending || !rows.some(row => !row.read_at)} onClick={() => readAll.mutate()} className="text-xs font-medium text-slate-700 hover:text-slate-900 disabled:opacity-40">Mark all read</button>
    </div>
    {(read.error || readAll.error) && <p role="alert" className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">Could not update notifications. Try again.</p>}
    <div className="mt-1 max-h-80 overflow-y-auto">
      {list.isPending ? <p role="status" className="py-6 text-center text-xs text-slate-500">Loading notifications…</p>
        : list.error ? <p role="alert" className="py-6 text-center text-xs text-red-700">Notifications could not be loaded.</p>
        : rows.length === 0 ? <p className="py-6 text-center text-xs text-slate-500">You're all caught up.</p>
        : <ul className="space-y-0.5">{rows.map(row => {
          const severity = SEVERITY[row.severity];
          const Icon = severity.icon;
          return <li key={row.id}><button type="button" onClick={() => open(row)} aria-label={`${row.read_at ? '' : 'Unread. '}${severity.label}. ${row.title}. ${row.body}`}
            className={`w-full text-left py-2.5 px-2 hover:bg-slate-50 rounded-xl transition-colors ${row.read_at ? '' : 'bg-blue-50/40'}`}>
            <span className="flex items-start gap-2">
              <span className={`mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${severity.tone}`}><Icon className="w-2.5 h-2.5 stroke-[2.5]" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className={`text-xs text-slate-800 truncate ${row.read_at ? '' : 'font-medium'}`}>{row.title}</span>
                  <span className="shrink-0 text-xs text-slate-400">{notificationAge(row.created_at)}</span>
                </span>
                <span className="block text-xs text-slate-500 mt-0.5 line-clamp-2">{row.body}</span>
              </span>
              {!row.read_at && <span aria-hidden className="mt-1.5 w-1.5 h-1.5 shrink-0 rounded-full bg-blue-600" />}
            </span>
          </button></li>;
        })}</ul>}
    </div>
  </div>;
}

/** Header bell for the Shipper and driver portals. */
export function NotificationBell({ slug, onOpen, surface = false }: { slug: string; onOpen?: (row: AppNotification) => void; surface?: boolean | 'white' }) {
  const [open, setOpen] = useState(false);
  const unread = useUnreadNotifications(slug);
  return <FloatingPanel open={open} onOpenChange={setOpen} label="Notifications" align="end" size="rich" className="p-3" trigger={
    <button type="button" className={`app-icon-button relative ${surface === 'white' ? 'app-icon-button-white' : surface ? 'app-icon-button-surface' : ''}`} aria-expanded={open} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} title="Notifications">
      <Bell className="w-4.5 h-4.5" strokeWidth={1.75} />
      {unread > 0 && <span aria-hidden className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />}
    </button>}>
    {open && <NotificationPanel slug={slug} onOpen={row => { setOpen(false); onOpen?.(row); }} />}
  </FloatingPanel>;
}
