import { useEffect } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { operations, type SyncChange } from '../operations/api';
import { ApiError } from './api';
import { companySettingsKey } from './WorkspaceAccount';

export type SyncRole = 'DISPATCHER' | 'SHIPPER' | 'DRIVER';
export const notificationsKey = (slug: string) => ['notifications', slug] as const;
/** Latest `/sync` summary ({ unread }) shared with every bell in the workspace. */
export const syncKey = (slug: string) => ['sync', slug] as const;

function dispatcherKeys(slug: string, change: SyncChange): QueryKey[] {
  const ops = (...rest: string[]) => ['operations', slug, ...rest];
  const order = change.order_id ? [['tracking', slug, change.order_id], ['delivery-proof', slug, change.order_id]] : [];
  switch (change.entity) {
    case 'order': case 'stop': case 'evidence': case 'issue': return [ops('orders'), ops('routes'), ops('monitor'), ops('analytics'), ...order];
    case 'route': return [ops('routes'), ops('orders'), ops('monitor'), ops('drivers'), ...order];
    case 'driver': case 'duty': return [ops('drivers'), ops('monitor'), ops('driver-activity')];
    case 'vehicle': return [ops('vehicles'), ops('drivers'), ops('monitor')];
    case 'shipper': return [ops('shippers'), ['customers', slug]];
    case 'invoice': case 'email': return [ops('invoices'), ops('orders'), ops('analytics')];
    case 'quote': return [ops('quotes')];
    case 'rate': return [ops('rates')];
    case 'catalog': return [ops('catalog')];
    case 'settings': case 'organization': return [companySettingsKey(slug), ops('settings'), ops('catalog'), ops('rates')];
    case 'notification': return [notificationsKey(slug)];
    default: return [ops()];
  }
}

function shipperKeys(slug: string, change: SyncChange): QueryKey[] {
  const order = change.order_id ? [['tracking', slug, change.order_id], ['tracking-path', slug, change.order_id], ['delivery-proof', slug, change.order_id]] : [];
  switch (change.entity) {
    case 'order': case 'stop': case 'evidence': case 'issue': return [['shipper-orders', slug], ...order];
    case 'invoice': return [['shipper-invoices', slug], ['shipper-orders', slug]];
    case 'shipper': return [['shipper-profile', slug], ['booking-preferences', slug]];
    case 'notification': return [notificationsKey(slug)];
    default: return [];
  }
}

function driverKeys(slug: string, change: SyncChange): QueryKey[] {
  switch (change.entity) {
    case 'order': case 'route': case 'stop': case 'evidence': case 'issue': return [['driver-orders', slug], ['driver-routes', slug], ['driver-evidence', slug]];
    case 'driver': case 'duty': case 'vehicle': return [['driver-profile', slug]];
    case 'notification': return [notificationsKey(slug)];
    default: return [];
  }
}

/** Query keys (prefix-matched) to refetch for a batch of changes; each key appears once. */
export function syncInvalidations(role: SyncRole, slug: string, changes: SyncChange[]): QueryKey[] {
  const keys = role === 'DISPATCHER' ? dispatcherKeys : role === 'SHIPPER' ? shipperKeys : driverKeys;
  const unique = new Map<string, QueryKey>();
  for (const change of changes) for (const key of keys(slug, change)) unique.set(JSON.stringify(key), key);
  return [...unique.values()];
}

/** Back-off after failed sync requests: 5s, 10s, 20s, 40s, then 60s. */
export const retryDelay = (failures: number) => Math.min(60_000, 5_000 * 2 ** Math.min(Math.max(failures - 1, 0), 4));

/**
 * One feed loop per signed-in workspace. The server chooses the poll delay; visibility and
 * network recovery sync immediately. Changes only invalidate queries, so data still comes
 * from the normal authorized reads.
 */
export function useSync(slug: string | null | undefined, role: SyncRole) {
  const cache = useQueryClient();
  useEffect(() => {
    if (!slug) return;
    // The summary must outlive bells that mount and unmount (the portal cache uses gcTime 0).
    cache.setQueryDefaults(syncKey(slug), { gcTime: Infinity, staleTime: Infinity });
    let cursor: string | undefined, timer: number | undefined, failures = 0, running = false, stopped = false;
    const schedule = (delay: number) => { window.clearTimeout(timer); if (!stopped) timer = window.setTimeout(tick, delay); };
    async function tick() {
      if (running || stopped) return;
      running = true;
      try {
        const view = await operations.sync(slug!, cursor);
        if (stopped) return;
        failures = 0;
        if (view.reset) await cache.invalidateQueries();
        else await Promise.all(syncInvalidations(role, slug!, view.changes).map(queryKey => cache.invalidateQueries({ queryKey })));
        cursor = view.cursor;
        cache.setQueryData(syncKey(slug!), { unread: view.unread });
        schedule(view.next_poll_ms);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) { stopped = true; void cache.invalidateQueries({ queryKey: ['account'] }); return; }
        schedule(retryDelay(++failures));
      } finally { running = false; }
    }
    const now = () => { if (document.visibilityState === 'visible') schedule(0); };
    document.addEventListener('visibilitychange', now);
    window.addEventListener('online', now);
    void tick();
    return () => { stopped = true; window.clearTimeout(timer); document.removeEventListener('visibilitychange', now); window.removeEventListener('online', now); };
  }, [slug, role, cache]);
}
