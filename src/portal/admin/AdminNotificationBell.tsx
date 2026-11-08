import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type PlatformNotification } from '../api';
import { NotificationDropdown, NotificationInbox } from '../Notifications';

export function AdminNotificationBell({ accountId, onOpenCompany, onOpenMonitor, onOpenOperational, onOpenChat, platformAttention = 0 }: { accountId: string; onOpenChat?: (id: string) => void; onOpenCompany: (id: string) => void; onOpenMonitor: () => void; onOpenOperational?: () => void; platformAttention?: number }) {
  const cache = useQueryClient();
  const key = ['platform', 'notifications', accountId];
  const { data, isPending, error } = useQuery({ queryKey: key, queryFn: api.platformNotifications, refetchInterval: 15_000 });
  const refresh = () => cache.invalidateQueries({ queryKey: key });
  const read = useMutation({ mutationFn: (row: PlatformNotification) => api.readPlatformNotification(row, crypto.randomUUID()), onSuccess: refresh });
  const readAll = useMutation({ mutationFn: () => api.readAllPlatformNotifications(crypto.randomUUID()), onSuccess: refresh });
  const readError = read.error || readAll.error;
  const readingAll = readAll.isPending;
  return <NotificationDropdown unread={(data?.unread ?? 0) + platformAttention} surface>{close => <>
    {platformAttention > 0 && <button type="button" className="mb-3 w-full rounded-lg bg-red-50 p-3 text-left text-xs text-red-800" onClick={() => { close(); onOpenMonitor(); }}>
      {platformAttention} platform problem{platformAttention === 1 ? '' : 's'} need{platformAttention === 1 ? 's' : ''} attention · Review
    </button>}
    <NotificationInbox rows={(data?.items ?? []).map(row => ({ ...row, title: `${row.company_name} · ${row.title}` }))}
      emptyMessage={platformAttention ? 'No other notifications.' : undefined}
      unread={data?.unread ?? 0} loading={isPending} loadError={error} readError={readError}
      readingAll={readingAll} onClose={close} onMarkAllRead={() => readAll.mutate()} onOpen={row => {
        if (!row.read_at) read.mutate(row);
        close(); if (row.target === 'chat' && row.conversation_id) onOpenChat?.(row.conversation_id); else if (row.target === 'operational') (onOpenOperational ?? onOpenMonitor)(); else if (row.target === 'monitor') onOpenMonitor(); else onOpenCompany(row.organization_id);
      }} /></>
  }</NotificationDropdown>;
}
