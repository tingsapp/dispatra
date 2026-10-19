import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '../portal/schema';
import { client, unwrap } from '../portal/api';
import { syncKey, type SyncSummary } from '../portal/sync';

export type ChatKind = components['schemas']['ChannelView']['kind'];
export type ChatChannel = components['schemas']['ChannelView'];
export type ChatMessage = components['schemas']['MessageView'];
export type ChatInboxItem = components['schemas']['InboxItem'];

/** Every chat query lives under ['chat', slug] so one `message` sync change refreshes them all. */
export const chatKeys = {
  all: (slug: string) => ['chat', slug] as const,
  company: (slug: string, driverId: string) => ['chat', slug, 'company', driverId] as const,
  inbox: (slug: string) => ['chat', slug, 'inbox'] as const,
  order: (slug: string, orderId: string) => ['chat', slug, 'order', orderId] as const,
  thread: (slug: string, conversationId: string) => ['chat', slug, 'thread', conversationId] as const,
};

/** While a thread is open and visible it refreshes on its own, faster than the workspace sync loop. */
export const THREAD_POLL_MS = 4_000;
export const PAGE_SIZE = 50;

export const chat = {
  companyChannel: async (slug: string, driverId: string) => unwrap(await client.GET('/api/v1/companies/{slug}/drivers/{driver_id}/chat', { params: { path: { slug, driver_id: driverId } } })),
  sendCompany: async (slug: string, driverId: string, body: string, key: string) => unwrap(await client.POST('/api/v1/companies/{slug}/drivers/{driver_id}/chat/messages', { body: { body }, params: { path: { slug, driver_id: driverId }, header: { 'Idempotency-Key': key } } })),
  inbox: async (slug: string) => unwrap(await client.GET('/api/v1/companies/{slug}/chats', { params: { path: { slug } } })),
  channels: async (slug: string, orderId: string) => unwrap(await client.GET('/api/v1/companies/{slug}/orders/{order_id}/chats', { params: { path: { slug, order_id: orderId } } })),
  messages: async (slug: string, conversationId: string, limit = PAGE_SIZE) => unwrap(await client.GET('/api/v1/companies/{slug}/chats/{conversation_id}/messages', { params: { path: { slug, conversation_id: conversationId }, query: { limit } } })),
  send: async (slug: string, orderId: string, kind: ChatKind, body: string, key: string) => unwrap(await client.POST('/api/v1/companies/{slug}/orders/{order_id}/chats/{kind}/messages', { body: { body }, params: { path: { slug, order_id: orderId, kind }, header: { 'Idempotency-Key': key } } })),
  read: async (slug: string, conversationId: string, seq: number) => unwrap(await client.POST('/api/v1/companies/{slug}/chats/{conversation_id}/read', { body: { seq }, params: { path: { slug, conversation_id: conversationId } } })),
};

/** Unread chat messages for the signed-in account, from the workspace sync loop. */
export function useUnreadMessages(slug: string | null | undefined) {
  const summary = useQuery<SyncSummary>({ queryKey: syncKey(slug ?? ''), queryFn: () => Promise.resolve({ unread: 0, unread_messages: 0 }), enabled: false, staleTime: Infinity, gcTime: Infinity });
  return slug ? summary.data?.unread_messages ?? 0 : 0;
}

export function useOrderChannels(slug: string, orderId: string) {
  return useQuery({ queryKey: chatKeys.order(slug, orderId), queryFn: () => chat.channels(slug, orderId) });
}

export function useCompanyChannel(slug: string, driverId: string) {
  return useQuery({ queryKey: chatKeys.company(slug, driverId), queryFn: () => chat.companyChannel(slug, driverId) });
}

export function useChatInbox(slug: string) {
  return useQuery({ queryKey: chatKeys.inbox(slug), queryFn: () => chat.inbox(slug) });
}

/** Newest messages of one conversation; `limit` grows when earlier messages are requested. */
export function useThread(slug: string, conversationId: string | null) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  useEffect(() => setLimit(PAGE_SIZE), [conversationId]);
  const query = useQuery({ queryKey: [...chatKeys.thread(slug, conversationId ?? ''), limit], queryFn: () => chat.messages(slug, conversationId!, limit),
    enabled: !!conversationId, refetchInterval: THREAD_POLL_MS, placeholderData: previous => previous });
  return { ...query, showEarlier: () => setLimit(value => Math.min(200, value + PAGE_SIZE)), canShowEarlier: !!query.data?.has_more && limit < 200 };
}

/** Marks the newest message from the other party as read and updates every unread badge. */
export function useMarkRead(slug: string, conversationId: string | null, messages: ChatMessage[] | undefined, active: boolean) {
  const cache = useQueryClient();
  const latest = messages?.filter(message => !message.mine).at(-1)?.seq;
  useEffect(() => {
    if (!active || !conversationId || !latest) return;
    let cancelled = false;
    chat.read(slug, conversationId, latest).then(view => {
      if (cancelled) return;
      cache.setQueryData<SyncSummary>(syncKey(slug), current => ({ unread: current?.unread ?? 0, unread_messages: view.unread }));
      void cache.invalidateQueries({ queryKey: chatKeys.inbox(slug) });
      void cache.invalidateQueries({ queryKey: ['chat', slug, 'order'] });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [slug, conversationId, latest, active, cache]);
}

export function useSendMessage(slug: string, orderId: string | undefined, kind: ChatKind, driverId?: string) {
  const cache = useQueryClient();
  return useMutation({
    // The key is fixed per attempt so a retried send never duplicates the message.
    mutationFn: ({ body, key }: { body: string; key: string }) => orderId ? chat.send(slug, orderId, kind, body, key) : driverId ? chat.sendCompany(slug, driverId, body, key) : Promise.reject(new Error('Conversation unavailable.')),
    onSuccess: message => Promise.all([cache.invalidateQueries({ queryKey: chatKeys.thread(slug, message.conversation_id) }),
      cache.invalidateQueries({ queryKey: chatKeys.all(slug) }), cache.invalidateQueries({ queryKey: chatKeys.inbox(slug) })]),
  });
}
