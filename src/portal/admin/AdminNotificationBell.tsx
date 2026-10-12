import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type PlatformNotification } from '../api';
import { NotificationDropdown, NotificationInbox } from '../Notifications';

export function AdminNotificationBell({ accountId, onOpenCompany, onOpenMonitor }: { accountId: string; onOpenCompany: (id: string) => void; onOpenMonitor: () => void }) {
  const cache = useQueryClient();
  const key = ['platform', 'notifications', accountId];
  const { data, isPending, error } = useQuery({ queryKey: key, queryFn: api.platformNotifications, refetchInterval: 15_000 });
  const refresh = () => cache.invalidateQueries({ queryKey: key });
  const read = useMutation({ mutationFn: (row: PlatformNotification) => api.readPlatformNotification(row, crypto.randomUUID()), onSuccess: refresh });
  const readAll = useMutation({ mutationFn: () => api.readAllPlatformNotifications(crypto.randomUUID()), onSuccess: refresh });
  const readError = read.error || readAll.error;
  const readingAll = readAll.isPending;
  return <NotificationDropdown unread={data?.unread ?? 0} surface>{close =>
    <NotificationInbox rows={(data?.items ?? []).map(row => ({ ...row, title: `${row.company_name} · ${row.title}` }))}
      unread={data?.unread ?? 0} loading={isPending} loadError={error} readError={readError}
      readingAll={readingAll} onMarkAllRead={() => readAll.mutate()} onOpen={row => {
        if (!row.read_at) read.mutate(row);
        close(); if (row.target === 'monitor') onOpenMonitor(); else onOpenCompany(row.organization_id);
      }} />
  }</NotificationDropdown>;
}
