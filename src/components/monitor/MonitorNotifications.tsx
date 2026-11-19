import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { operations, type AppNotification } from '../../operations/api';
import { notificationsKey } from '../../portal/sync';
import { NotificationInbox } from '../../portal/Notifications';
import { useCompanyDay } from './useCompanyDay';
import { companyDay, isTodaysOrder, receivedOnDay } from './todaysPlanData';
import type { Job } from '../../types';

/** Page through the existing inbox until the company day ends; never cap today's unread count at 50. */
export async function todaysNotifications(slug: string, day: string, zone: string) {
  const rows: AppNotification[] = [];
  let before: string | undefined;
  for (;;) {
    const page = await operations.notifications(slug, before);
    rows.push(...page.filter(row => receivedOnDay(row.created_at, day, zone) && Date.parse(row.created_at) <= Date.now()));
    const last = page.at(-1);
    if (page.length < 50 || !last || last.id === before || companyDay(new Date(last.created_at), zone) < day) break;
    before = last.id;
  }
  return rows.sort((a,b) => Date.parse(b.created_at)-Date.parse(a.created_at) || b.id.localeCompare(a.id));
}

export function useMonitorNotifications(slug: string, zone: string, jobs: Job[], active: boolean) {
  const {day} = useCompanyDay(zone);
  const query = useQuery({queryKey:[...notificationsKey(slug),'monitor-day',day,zone],
    queryFn:()=>todaysNotifications(slug,day,zone),enabled:!!slug && active,refetchInterval:active?30_000:false});
  const ids=new Set(jobs.filter(job=>isTodaysOrder(job,day,zone)).map(job=>job.id));
  const rows=(query.data??[]).filter(row=>!row.order_id || ids.has(row.order_id));
  return {...query,rows,unread:rows.filter(row=>!row.read_at).length};
}

type Inbox = ReturnType<typeof useMonitorNotifications>;
export function MonitorNotificationPanel({slug,inbox,onOpen,onClose}:{slug:string;inbox:Inbox;onOpen:(row:AppNotification)=>void;onClose:()=>void}) {
  const cache=useQueryClient();
  const settle=()=>cache.invalidateQueries({queryKey:notificationsKey(slug)});
  const read=useMutation({mutationFn:(row:AppNotification)=>operations.readNotification(slug,row),onSuccess:settle});
  const readAll=useMutation({mutationFn:async()=>{
    const results=await Promise.allSettled(inbox.rows.filter(row=>!row.read_at).map(row=>operations.readNotification(slug,row)));
    await settle();
    const failed=results.find(row=>row.status==='rejected');
    if(failed?.status==='rejected') throw failed.reason;
  }});
  return <div><p className="mb-2 text-[11px] text-app-muted">Today only · newest first</p><NotificationInbox rows={inbox.rows} unread={inbox.unread} loading={inbox.isPending} loadError={inbox.error}
    readError={read.error||readAll.error} readingAll={readAll.isPending} onMarkAllRead={()=>readAll.mutate()}
    onOpen={row=>{if(!row.read_at)read.mutate(row);onOpen(row);}} onClose={onClose} emptyMessage="No notifications for today."/></div>;
}
