import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/shipper', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
HTMLElement.prototype.scrollIntoView=()=>{};
const { render, screen, cleanup, waitFor } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { chat } = await import('../src/chat/api');
const { syncKey } = await import('../src/portal/sync');
const { OrderChat, ChatDialog } = await import('../src/components/chat/OrderChat');
const { MessagesInbox } = await import('../src/components/chat/MessagesInbox');
const original = { ...chat };
let activeCache: InstanceType<typeof QueryClient>;
afterEach(() => { cleanup(); activeCache?.clear(); Object.assign(chat, original); });

type Channel = Awaited<ReturnType<typeof chat.channels>>[number];
type Message = Awaited<ReturnType<typeof chat.send>>;
const channel = (kind: Channel['kind'], title: string, conversation_id: string | null, extra: Partial<Channel> = {}): Channel =>
  ({ kind, title, conversation_id, driver_id: null, can_send: true, closed_reason: null, unread: 0, last_message_at: null, ...extra });
const message = (seq: number, body: string, mine: boolean, conversation_id = 'c1'): Message =>
  ({ id: `m${seq}`, seq, conversation_id, sender_role: mine ? 'SHIPPER' : 'DISPATCHER', sender_name: mine ? 'Fresh Test' : 'Jo Dispatch', mine, body, created_at: '2026-10-10T10:00:00Z' });

function mount(node: React.ReactElement) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  activeCache = cache;
  cache.setQueryData(['account'], { role: 'DISPATCHER', organization: { slug: 'acme', name: 'Acme Transport' } });
  cache.setQueryData(syncKey('acme'), { unread: 0, unread_messages: 2 });
  render(React.createElement(QueryClientProvider, { client: cache }, node));
  return cache;
}

test('order chat opens the requested counterpart, sends with a retry-safe key and marks the other party read', async () => {
  const user = userEvent.setup({ document });
  const sends: { kind: string; body: string; key: string }[] = [];
  const reads: [string, number][] = [];
  let failNext = true;
  let channels = [channel('DISPATCH_SHIPPER', 'Dispatch', 'c1', { unread: 2 }), channel('DRIVER_SHIPPER', 'Dana Driver', null)];
  Object.assign(chat, {
    channels: async () => channels,
    messages: async (_slug: string, id: string) => ({ messages: id === 'c1' ? [message(1, 'Pickup moved to 3pm', false), message(2, 'Thanks', true), message(3, 'Confirmed', false)] : [message(9, 'Hi Dana', true, 'c2')], has_more: false }),
    read: async (_slug: string, id: string, seq: number) => { reads.push([id, seq]); return { unread: 0 }; },
    send: async (_slug: string, _order: string, kind: string, body: string, key: string) => {
      sends.push({ kind, body, key });
      if (failNext) { failNext = false; throw new Error('Network down'); }
      channels = [channels[0], { ...channels[1], conversation_id: 'c2' }];
      return message(9, body, true, 'c2');
    },
  });
  const cache = mount(React.createElement(OrderChat, { slug: 'acme', orderId: 'o1', initialKind: 'DRIVER_SHIPPER' }));
  assert.ok(await screen.findByText('No messages yet. Write to Dana Driver below.'));
  assert.equal(screen.getByRole('tab', { name: 'Dana Driver' }).getAttribute('aria-selected'), 'true');
  assert.ok(screen.getByRole('tab', { name: 'Dispatch, 2 unread' }));

  const box = screen.getByRole('textbox', { name: 'Message Dana Driver' });
  await user.type(box, 'Hi Dana{Enter}');
  assert.ok(await screen.findByRole('alert'));
  await user.click(screen.getByRole('button', { name: 'Send message' }));
  await waitFor(() => assert.equal(sends.length, 2));
  assert.deepEqual(sends.map(s => [s.kind, s.body]), [['DRIVER_SHIPPER', 'Hi Dana'], ['DRIVER_SHIPPER', 'Hi Dana']]);
  assert.equal(sends[0].key, sends[1].key, 'a retry reuses the idempotency key');
  await waitFor(() => assert.equal((box as HTMLTextAreaElement).value, ''));
  assert.ok(await screen.findByText('Hi Dana'));

  await user.click(screen.getByRole('tab', { name: 'Dispatch, 2 unread' }));
  assert.ok(await screen.findByText('Pickup moved to 3pm'));
  assert.ok(screen.getByRole('log', { name: 'Messages with Dispatch' }));
  await waitFor(() => assert.deepEqual(reads, [['c1', 3]]));
  await waitFor(() => assert.deepEqual(cache.getQueryData(syncKey('acme')), { unread: 0, unread_messages: 0 }));
});

test('a read-only chat shows why and has no composer', async () => {
  Object.assign(chat, {
    channels: async () => [channel('DRIVER_SHIPPER', 'Dana Driver ↔ Fresh Test', 'c3', { can_send: false, closed_reason: 'Dispatch can read this chat but not reply.' })],
    messages: async () => ({ messages: [message(4, 'On my way', false, 'c3')], has_more: false }),
    read: async () => ({ unread: 0 }),
  });
  mount(React.createElement(OrderChat, { slug: 'acme', orderId: 'o1' }));
  assert.ok(await screen.findByText('On my way'));
  assert.ok(screen.getByText('Dispatch can read this chat but not reply.'));
  assert.equal(screen.queryByRole('textbox'), null);
  assert.equal(screen.queryByRole('tablist'), null);
});

test('messages inbox lists chats newest first and opens the selected order chat', async () => {
  const user = userEvent.setup({ document });
  const item = (conversation_id: string, kind: Channel['kind'], title: string, order_number: string, unread: number, can_send = true) => ({ conversation_id, order_id: `order-${conversation_id}`, order_number,
    order_status: 'ASSIGNED', kind, title, can_send, unread, last_message: message(1, `Hello from ${title}`, false, conversation_id), last_message_at: '2026-10-10T10:00:00Z' });
  Object.assign(chat, {
    inbox: async () => [item('c1', 'DISPATCH_SHIPPER', 'Fresh Test', 'ORD-1', 1), item('c2', 'DISPATCH_DRIVER', 'Dana Driver', 'ORD-2', 0), item('c3', 'DRIVER_SHIPPER', 'Dana Driver ↔ Fresh Test', 'ORD-2', 0, false)],
    channels: async () => [channel('DISPATCH_DRIVER', 'Dana Driver', 'c2')],
    messages: async () => ({ messages: [message(1, 'Hello from Dana Driver', false, 'c2')], has_more: false }),
    read: async () => ({ unread: 0 }),
  });
  mount(React.createElement(MessagesInbox, { slug: 'acme' }));
  assert.ok(await screen.findByRole('button', { name: /^1 unread\. Fresh Test, order ORD-1/ }));
  assert.ok(screen.getByText('Read-only'));
  await user.click(screen.getByRole('button', { name: /Dana Driver, order ORD-2/ }));
  assert.ok(await screen.findByRole('dialog', { name: 'Chat with Dana Driver · ORD-2' }));
  assert.ok(await screen.findByRole('textbox', { name: 'Message Dana Driver' }));
});


test('a missing or reassigned requested counterpart never falls back to another recipient', async () => {
  Object.assign(chat, {channels: async () => [channel('DISPATCH_SHIPPER','Shipper',null),channel('DISPATCH_DRIVER','New Driver',null,{driver_id:'new-driver'})]});
  mount(React.createElement(OrderChat,{slug:'acme',orderId:'o1',initialKind:'DISPATCH_DRIVER',expectedDriverId:'old-driver'}));
  assert.ok(await screen.findByText('This conversation is unavailable. Reopen the order to view its current chats.'));
  assert.equal(screen.queryByRole('textbox'),null);
});


test('driver contact opens one ongoing company conversation without choosing an order', async () => {
  const { DriverChatDialog } = await import('../src/components/chat/DriverChatDialog');
  const user = userEvent.setup({ document });
  const sends: unknown[][] = [];
  Object.assign(chat, {
    companyChannel: async (_slug: string, driverId: string) => { assert.equal(driverId, 'driver-1'); return channel('DISPATCH_DRIVER', 'Dana Driver', null, { driver_id: 'driver-1' }); },
    channels: async () => { throw new Error('Company chat must not request order channels'); },
    sendCompany: async (...args: unknown[]) => { sends.push(args); return message(1, 'Hello driver', true); },
  });
  mount(React.createElement(DriverChatDialog, { slug: 'acme', driver: { id: 'driver-1', name: 'Dana Driver' } as never, onClose: () => {} }));
  const box = await screen.findByRole('textbox', { name: 'Message Dana Driver' });
  assert.equal(screen.queryByRole('tablist'), null);
  assert.equal(screen.queryByText(/Choose an order/), null);
  await user.type(box, 'Hello driver');
  await user.click(screen.getByRole('button', { name: 'Send message' }));
  await waitFor(() => assert.equal(sends.length, 1));
  assert.deepEqual(sends[0].slice(0,3), ['acme','driver-1','Hello driver']);
});

test('company inbox opens its driver conversation without a fabricated order', async () => {
  const user = userEvent.setup({ document });
  Object.assign(chat, {
    inbox: async () => [{ conversation_id: 'company-1', order_id: null, order_number: null, order_status: null, driver_id: 'driver-1', kind: 'DISPATCH_DRIVER', title: 'Dana Driver', can_send: true, unread: 0, last_message: null, last_message_at: null }],
    companyChannel: async () => channel('DISPATCH_DRIVER', 'Dana Driver', null, { driver_id: 'driver-1' }),
  });
  mount(React.createElement(MessagesInbox, { slug: 'acme' }));
  await user.click(await screen.findByRole('button', { name: /Dana Driver, company conversation/ }));
  assert.ok(await screen.findByRole('textbox', { name: 'Message Dana Driver' }));
  assert.equal(screen.queryByRole('tablist'), null);
});


test('popup header follows the selected recipient and preserves order context and read-only controls', async () => {
  const user = userEvent.setup({ document });
  chat.channels = async () => [channel('DISPATCH_DRIVER', 'John', null), channel('DISPATCH_SHIPPER', 'Fresh Foods', null),
    channel('DRIVER_SHIPPER', 'John ↔ Fresh Foods', null, { can_send: false, closed_reason: 'Dispatch can read this chat but not reply.' })];
  mount(React.createElement(ChatDialog, { slug: 'acme', orderId: 'o1', orderNumber: 'ORD-1', onClose() {} }));
  assert.ok(await screen.findByRole('heading', { name: 'John' }));
  assert.ok(screen.getByText('Driver · ORD-1'));
  assert.equal(screen.queryByText('Company conversation'), null);
  assert.equal(screen.queryByText(/A private conversation/), null);
  assert.equal(screen.queryByRole('heading', { name: /Messages/ }), null);
  assert.equal(screen.getByRole('log').tabIndex, 0, 'the transcript remains keyboard accessible');
  assert.ok(screen.getByRole('button', { name: 'Send message' }).querySelector('.lucide-arrow-up'));
  await user.click(screen.getByRole('tab', { name: 'Fresh Foods' }));
  assert.ok(screen.getByRole('heading', { name: 'Fresh Foods' }));
  assert.ok(screen.getByText('Shipper · ORD-1'));
  assert.ok(screen.getByRole('dialog', { name: 'Chat with Fresh Foods · ORD-1' }));
  await user.click(screen.getByRole('tab', { name: 'John ↔ Fresh Foods, read-only' }));
  assert.ok(screen.getByRole('heading', { name: 'John ↔ Fresh Foods' }));
  assert.ok(screen.getByText('Driver · Shipper · ORD-1'));
  assert.ok(screen.getByText('Dispatch can read this chat but not reply.'));
  assert.equal(screen.queryByRole('textbox'), null);
});

for (const [role, kind, title, expected] of [
  ['SHIPPER', 'DISPATCH_SHIPPER', 'Dispatch', 'Acme Transport'],
  ['SHIPPER', 'DRIVER_SHIPPER', 'John', 'Driver'],
  ['DRIVER', 'DISPATCH_DRIVER', 'Company', 'Acme Transport'],
  ['DRIVER', 'DRIVER_SHIPPER', 'Fresh Foods', 'Shipper'],
] as const) test(`${role} popup identifies ${title} as ${expected}`, async () => {
  chat.channels = async () => [channel(kind, title, null)];
  const cache = mount(React.createElement(ChatDialog, { slug: 'acme', orderId: 'o1', onClose() {} }));
  cache.setQueryData(['account'], { role, organization: { slug: 'acme', name: 'Acme Transport' } });
  assert.ok(await screen.findByRole('heading', { name: title }));
  assert.ok(await screen.findByText(expected));
  assert.ok(screen.getByRole('textbox', { name: `Message ${title}` }));
});
