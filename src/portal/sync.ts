import { useEffect } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { operations, type SyncChange } from '../operations/api';
import { streamSync } from './streamSync';
import { companySettingsKey } from './WorkspaceAccount';

export type SyncRole = 'DISPATCHER' | 'SHIPPER' | 'DRIVER';
export const notificationsKey = (slug: string) => ['notifications', slug] as const;
/** Latest `/sync` summary shared with every bell and chat badge in the workspace. */
export const syncKey = (slug: string) => ['sync', slug] as const;
export type SyncSummary = { unread: number; unread_messages: number };
/** Order chat queries (inbox, per-order channels, threads) share this prefix. */
const chatKey = (slug: string) => ['chat', slug];

function dispatcherKeys(slug: string, change: SyncChange): QueryKey[] {
  const ops = (...rest: string[]) => ['operations', slug, ...rest];
  const order = change.order_id ? [['tracking', slug, change.order_id], ['delivery-proof', slug, change.order_id]] : [];
  switch (change.entity) {
    case 'order': case 'stop': case 'evidence': case 'issue': return [ops('orders'), ops('routes'), ops('monitor'), ops('analytics'), ...order];
    case 'route': return [ops('routes'), ops('orders'), ops('monitor'), ops('drivers'), ...order];
    case 'driver': case 'duty': return [ops('drivers'), ops('monitor'), ops('driver-activity')];
    case 'vehicle': return [ops('vehicles'), ops('drivers'), ops('monitor')];
    case 'shipper': return [ops('shippers'), ['customers', slug]];
    case 'email': return [ops('quotes')];
    case 'quote': return [ops('quotes')];
    case 'intake': return [ops('email-intakes'), ops('orders')];
    case 'mailbox': return [ops('mailbox')];
    // Dispatch agent decisions change Needs Attention; the assignment itself arrives as order/route changes.
    case 'dispatch': return [ops('monitor')];
    case 'rate': return [ops('rates')];
    case 'catalog': return [ops('catalog')];
    case 'settings': case 'organization': return [companySettingsKey(slug), ops('settings'), ops('catalog'), ops('rates')];
    case 'notification': return [notificationsKey(slug)];
    case 'message': return [chatKey(slug)];
    default: return [ops()];
  }
}

function shipperKeys(slug: string, change: SyncChange): QueryKey[] {
  const order = change.order_id ? [['tracking', slug, change.order_id], ['tracking-path', slug, change.order_id], ['delivery-proof', slug, change.order_id]] : [];
  switch (change.entity) {
    case 'order': case 'stop': case 'evidence': case 'issue': return [['shipper-orders', slug], ...order];
    case 'shipper': return [['shipper-profile', slug], ['booking-preferences', slug]];
    case 'notification': return [notificationsKey(slug)];
    case 'message': return [chatKey(slug)];
    default: return [];
  }
}

function driverKeys(slug: string, change: SyncChange): QueryKey[] {
  switch (change.entity) {
    case 'order': case 'route': case 'stop': case 'evidence': case 'issue': return [['driver-orders', slug], ['driver-routes', slug], ['driver-evidence', slug]];
    case 'driver': case 'duty': case 'vehicle': return [['driver-profile', slug]];
    case 'notification': return [notificationsKey(slug)];
    case 'message': return [chatKey(slug)];
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
 * One recoverable WebSocket feed per signed-in workspace, with HTTP polling fallback.
 * Events invalidate queries; operational data always comes from authorized reads.
 */
export function useSync(slug: string | null | undefined, role: SyncRole) {
  const cache = useQueryClient();
  useEffect(() => {
    if (!slug) return;
    // The summary must outlive bells that mount and unmount (the portal cache uses gcTime 0).
    cache.setQueryDefaults(syncKey(slug), { gcTime: Infinity, staleTime: Infinity });
    const feed = streamSync(slug, {
      read: cursor => operations.sync(slug, cursor),
      apply: async view => {
        if (view.reset) await cache.invalidateQueries();
        else await Promise.all(syncInvalidations(role, slug, view.changes).map(queryKey => cache.invalidateQueries({ queryKey })));
        cache.setQueryData<SyncSummary>(syncKey(slug), { unread: view.unread, unread_messages: view.unread_messages });
      },
      expired: () => { void cache.invalidateQueries({ queryKey: ['account'] }); },
    });
    const now = () => { if (document.visibilityState === 'visible') feed.recover(); };
    document.addEventListener('visibilitychange', now);
    window.addEventListener('online', now);
    return () => { feed.stop(); document.removeEventListener('visibilitychange', now); window.removeEventListener('online', now); };
  }, [slug, role, cache]);
}
