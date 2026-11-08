import { useEffect, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export const ADMIN_CHAT = '__admin__';
export type InboxFilter = { search?: string; kind?: ChatKind; unread_only?: boolean };
export const chat = {
  page: async (slug: string, filter: InboxFilter, cursor?: string) => slug === ADMIN_CHAT
    ? unwrap(await client.GET('/api/v1/platform/chats', { params: { query: { ...filter, cursor } } }))
    : unwrap(await client.GET('/api/v1/companies/{slug}/chat-inbox', { params: { path: { slug }, query: { ...filter, cursor } } })),
  detail: async (slug: string, identity: string) => slug === ADMIN_CHAT
    ? unwrap(await client.GET('/api/v1/platform/chats/{identity}', { params: { path: { identity } } }))
    : unwrap(await client.GET('/api/v1/companies/{slug}/chats/{identity}', { params: { path: { slug, identity } } })),
  support: async (slug: string, dispatcherId?: string) => slug === ADMIN_CHAT
    ? unwrap(await client.GET('/api/v1/platform/dispatchers/{dispatcher_id}/chat', { params: { path: { dispatcher_id: dispatcherId! } } }))
    : unwrap(await client.GET('/api/v1/companies/{slug}/admin-chat', { params: { path: { slug } } })),
  sendSupport: async (slug: string, dispatcherId: string, body: string, key: string) => slug === ADMIN_CHAT
    ? unwrap(await client.POST('/api/v1/platform/dispatchers/{dispatcher_id}/chat/messages', { body: { body }, params: { path: { dispatcher_id: dispatcherId }, header: { 'Idempotency-Key': key } } }))
    : unwrap(await client.POST('/api/v1/companies/{slug}/admin-chat/messages', { body: { body }, params: { path: { slug }, header: { 'Idempotency-Key': key } } })),
  contacts: async (search: string, cursor?: string) => unwrap(await client.GET('/api/v1/platform/chat-contacts', { params: { query: { search, cursor } } })),
  adminUnread: async () => unwrap(await client.GET('/api/v1/platform/chat-unread')),
  companyChannel: async (slug: string, driverId: string) => unwrap(await client.GET('/api/v1/companies/{slug}/drivers/{driver_id}/chat', { params: { path: { slug, driver_id: driverId } } })),
  sendCompany: async (slug: string, driverId: string, body: string, key: string) => unwrap(await client.POST('/api/v1/companies/{slug}/drivers/{driver_id}/chat/messages', { body: { body }, params: { path: { slug, driver_id: driverId }, header: { 'Idempotency-Key': key } } })),
  shipperCompanyChannel: async (slug: string, shipperId: string) => unwrap(await client.GET('/api/v1/companies/{slug}/shippers/{shipper_id}/chat', { params: { path: { slug, shipper_id: shipperId } } })),
  sendShipperCompany: async (slug: string, shipperId: string, body: string, key: string) => unwrap(await client.POST('/api/v1/companies/{slug}/shippers/{shipper_id}/chat/messages', { body: { body }, params: { path: { slug, shipper_id: shipperId }, header: { 'Idempotency-Key': key } } })),
  inbox: async (slug: string) => unwrap(await client.GET('/api/v1/companies/{slug}/chats', { params: { path: { slug } } })),
  channels: async (slug: string, orderId: string) => unwrap(await client.GET('/api/v1/companies/{slug}/orders/{order_id}/chats', { params: { path: { slug, order_id: orderId } } })),
  messages: async (slug: string, conversationId: string, limit = PAGE_SIZE, before?: number) => slug === ADMIN_CHAT
    ? unwrap(await client.GET('/api/v1/platform/chats/{identity}/messages', { params: { path: { identity: conversationId }, query: { limit, before } } }))
    : unwrap(await client.GET('/api/v1/companies/{slug}/chats/{conversation_id}/messages', { params: { path: { slug, conversation_id: conversationId }, query: { limit, before } } })),
  send: async (slug: string, orderId: string, kind: ChatKind, body: string, key: string, expected?: { expected_conversation_id?: string; expected_driver_id?: string }) => unwrap(await client.POST('/api/v1/companies/{slug}/orders/{order_id}/chats/{kind}/messages', { body: { body, ...expected }, params: { path: { slug, order_id: orderId, kind }, header: { 'Idempotency-Key': key } } })),
  read: async (slug: string, conversationId: string, seq: number) => slug === ADMIN_CHAT ? unwrap(await client.POST('/api/v1/platform/chats/{identity}/read', { body: { seq }, params: { path: { identity: conversationId } } })) : unwrap(await client.POST('/api/v1/companies/{slug}/chats/{conversation_id}/read', { body: { seq }, params: { path: { slug, conversation_id: conversationId } } })),
};

/** Unread chat messages for the signed-in account, from the workspace sync loop. */
export function useUnreadMessages(slug: string | null | undefined) {
  const summary = useQuery<SyncSummary>({ queryKey: syncKey(slug ?? ''), queryFn: () => Promise.resolve({ unread: 0, unread_messages: 0 }), enabled: false, staleTime: Infinity, gcTime: Infinity });
  return slug ? summary.data?.unread_messages ?? 0 : 0;
}

export function useOrderChannels(slug: string, orderId: string) {
  return useQuery({ queryKey: chatKeys.order(slug, orderId), queryFn: () => chat.channels(slug, orderId) });
}

export function useCompanyChannel(slug: string, driverId?: string, shipperId?: string) {
  return useQuery({ queryKey: shipperId ? ['chat', slug, 'company', 'shipper', shipperId] : chatKeys.company(slug, driverId ?? ''),
    queryFn: () => shipperId ? chat.shipperCompanyChannel(slug, shipperId) : chat.companyChannel(slug, driverId!), enabled: !!(driverId || shipperId) });
}

export function useChatInbox(slug: string, enabled = true) {
  return useQuery({ queryKey: chatKeys.inbox(slug), queryFn: () => chat.inbox(slug), enabled });
}

/** Keyset pages keep all history reachable without copying another conversation's messages. */
export function useThread(slug: string, conversationId: string | null) {
  const query = useInfiniteQuery({ queryKey: chatKeys.thread(slug, conversationId ?? ''), initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) => chat.messages(slug, conversationId!, PAGE_SIZE, pageParam),
    getNextPageParam: page => page.has_more ? page.messages[0]?.seq : undefined,
    enabled: !!conversationId, refetchInterval: THREAD_POLL_MS });
  const messages = query.data?.pages.flatMap(page => page.messages).sort((a,b) => a.seq-b.seq);
  return { ...query, data: messages ? { messages: [...new Map(messages.map(row => [row.id, row])).values()] } : undefined,
    showEarlier: () => query.fetchNextPage(), canShowEarlier: query.hasNextPage, loadingEarlier: query.isFetchingNextPage };
}

export function useChatPages(slug: string, filter: InboxFilter) {
  return useInfiniteQuery({ queryKey: [...chatKeys.inbox(slug), 'pages', filter], initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => chat.page(slug, filter, pageParam), getNextPageParam: page => page.next_cursor ?? undefined,
    refetchInterval: slug === ADMIN_CHAT ? THREAD_POLL_MS : false });
}

export function useAdminUnread() {
  return useQuery({ queryKey: ['chat', ADMIN_CHAT, 'unread'], queryFn: chat.adminUnread, refetchInterval: THREAD_POLL_MS });
}

/** Marks the newest message from the other party as read and updates every unread badge. */
export function useMarkRead(slug: string, conversationId: string | null, messages: ChatMessage[] | undefined, active: boolean) {
  const cache = useQueryClient();
  const [visible, setVisible] = useState(document.visibilityState !== 'hidden');
  useEffect(() => { const update = () => setVisible(document.visibilityState !== 'hidden'); document.addEventListener('visibilitychange', update); return () => document.removeEventListener('visibilitychange', update); }, []);
  const latest = messages?.filter(message => !message.mine).at(-1)?.seq;
  useEffect(() => {
    if (!active || !visible || !conversationId || !latest) return;
    let cancelled = false;
    chat.read(slug, conversationId, latest).then(view => {
      if (cancelled) return;
      cache.setQueryData<SyncSummary>(syncKey(slug), current => ({ unread: view.notifications_unread ?? current?.unread ?? 0, unread_messages: view.unread }));
      void cache.invalidateQueries({ queryKey: ['chat', slug, 'unread'] });
      void cache.invalidateQueries({ queryKey: ['chat', slug, 'detail'] });
      void cache.invalidateQueries({ queryKey: ['notifications', slug] });
      void cache.invalidateQueries({ queryKey: ['platform', 'notifications'] });
      void cache.invalidateQueries({ queryKey: chatKeys.inbox(slug) });
      void cache.invalidateQueries({ queryKey: ['chat', slug, 'order'] });
      void cache.invalidateQueries({ queryKey: ['chat', slug, 'company'] });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [slug, conversationId, latest, active, visible, cache]);
}

export function useSendMessage(slug: string, orderId: string | undefined, kind: ChatKind, driverId?: string, shipperId?: string, dispatcherId?: string, expected?: { expected_conversation_id?: string; expected_driver_id?: string }) {
  const cache = useQueryClient();
  return useMutation({
    // The key is fixed per attempt so a retried send never duplicates the message.
    mutationFn: ({ body, key }: { body: string; key: string }) => kind === 'ADMIN_DISPATCHER' ? chat.sendSupport(slug, dispatcherId!, body, key) : orderId ? chat.send(slug, orderId, kind, body, key, expected) : shipperId ? chat.sendShipperCompany(slug, shipperId, body, key) : driverId ? chat.sendCompany(slug, driverId, body, key) : Promise.reject(new Error('Conversation unavailable.')),
    onSuccess: message => Promise.all([cache.invalidateQueries({ queryKey: chatKeys.thread(slug, message.conversation_id) }),
      cache.invalidateQueries({ queryKey: chatKeys.all(slug) }), cache.invalidateQueries({ queryKey: chatKeys.inbox(slug) })]),
  });
}
