import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/shipper', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage','location','history']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
HTMLElement.prototype.scrollIntoView=()=>{};
const { render, screen, cleanup, waitFor } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { chat } = await import('../src/chat/api');
const { syncKey } = await import('../src/portal/sync');
const { OrderChat, ChatDialog } = await import('../src/components/chat/OrderChat');
const { allOperations, operations } = await import('../src/operations/api');
const originalAll = {...allOperations}; const originalOps = {...operations};
const original = { ...chat };
let activeCache: InstanceType<typeof QueryClient>;
afterEach(() => { cleanup(); activeCache?.clear(); Object.assign(chat, original); Object.assign(allOperations,originalAll); Object.assign(operations,originalOps); history.replaceState(null,'','/acme/shipper'); });

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
  assert.equal(screen.queryByRole('tablist'), null);
  assert.equal(screen.queryByRole('textbox', { name: 'Message Dispatch' }), null);

  const box = screen.getByRole('textbox', { name: 'Message Dana Driver' });
  await user.type(box, 'Hi Dana{Enter}');
  assert.ok(await screen.findByRole('alert'));
  await user.click(screen.getByRole('button', { name: 'Send message' }));
  await waitFor(() => assert.equal(sends.length, 2));
  assert.deepEqual(sends.map(s => [s.kind, s.body]), [['DRIVER_SHIPPER', 'Hi Dana'], ['DRIVER_SHIPPER', 'Hi Dana']]);
  assert.equal(sends[0].key, sends[1].key, 'a retry reuses the idempotency key');
  await waitFor(() => assert.equal((box as HTMLTextAreaElement).value, ''));
  assert.ok(await screen.findByText('Hi Dana'));

  assert.equal(screen.queryByText('Pickup moved to 3pm'), null);
  assert.deepEqual(reads, [], 'opening the driver must not mark company messages read');
  assert.deepEqual(cache.getQueryData(syncKey('acme')), { unread: 0, unread_messages: 2 });
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

test('shipper company page opens one ongoing thread and sends independently of any order', async () => {
  const { CompanyChatPage } = await import('../src/components/chat/CompanyChatDialog');
  const user = userEvent.setup({ document }); const sends: unknown[] = [];
  Object.assign(chat, {
    shipperCompanyChannel: async () => channel('DISPATCH_SHIPPER','Company','company-shipper',{shipper_id:'s1',unread:1}),
    messages: async () => ({messages:[message(11,'Earlier company conversation',false,'company-shipper')],has_more:false}),
    read: async () => ({unread:3}),
    send: async () => { throw new Error('Company chat must not send to an Order'); },
    sendShipperCompany: async (slug:string,id:string,body:string,key:string) => {sends.push({slug,id,body,key});return message(12,body,true,'company-shipper');},
  });
  mount(React.createElement(CompanyChatPage,{slug:'acme',shipperId:'s1',company:'Acme Transport'}));
  assert.ok(await screen.findByText('Earlier company conversation'));
  assert.equal(screen.queryByRole('tablist'),null);
  assert.equal(screen.queryByText(/order picker/i),null);
  await user.type(screen.getByRole('textbox',{name:'Message Company'}),'Question for my company{Enter}');
  await waitFor(()=>assert.equal(sends.length,1));
  assert.deepEqual((sends[0] as any).id,'s1'); assert.equal((sends[0] as any).body,'Question for my company'); assert.ok((sends[0] as any).key);
});

test('shipper order chat exposes only its driver and never falls back to company', async () => {
  Object.assign(chat, {channels:async()=>[channel('DISPATCH_SHIPPER','Dispatch','company'),channel('DRIVER_SHIPPER','Dana Driver',null)]});
  mount(React.createElement(OrderChat,{slug:'acme',orderId:'o1',driverOnly:true}));
  assert.ok(await screen.findByRole('textbox',{name:'Message Dana Driver'}));
  assert.equal(screen.queryByRole('tablist'),null);
  assert.equal(screen.queryByRole('textbox',{name:'Message Dispatch'}),null);
});

test('unassigned shipper order explains driver availability without showing a company composer', async () => {
  Object.assign(chat,{channels:async()=>[channel('DISPATCH_SHIPPER','Dispatch',null)]});
  mount(React.createElement(OrderChat,{slug:'acme',orderId:'o1',driverOnly:true}));
  assert.ok(await screen.findByText('Driver chat opens when a driver is assigned to this order.'));
  assert.equal(screen.queryByRole('textbox'),null);
});

test('dispatcher shipper contact opens its ongoing company conversation without an order', async () => {
  const user = userEvent.setup({document});
  Object.assign(chat,{
    inbox:async()=>[{conversation_id:'shipper-company',order_id:null,order_number:null,order_status:null,shipper_id:'s1',driver_id:null,kind:'DISPATCH_SHIPPER',title:'Fresh Test',can_send:true,unread:1,last_message:message(4,'Company request',false,'shipper-company'),last_message_at:'2026-10-10T10:00:00Z'}],
    shipperCompanyChannel:async()=>channel('DISPATCH_SHIPPER','Fresh Test','shipper-company',{shipper_id:'s1'}),
    messages:async()=>({messages:[message(4,'Company request',false,'shipper-company')],has_more:false}),read:async()=>({unread:0})
  });
  const { CompanyChatDialog } = await import('../src/components/chat/CompanyChatDialog');
  mount(React.createElement(CompanyChatDialog,{slug:'acme',shipperId:'s1',onClose:()=>{}}));
  assert.ok(await screen.findByRole('textbox',{name:'Message Fresh Test'}));
});

test('shipper sidebar company badge excludes driver messages and opens a single company thread', async () => {
  const { ShipperPortal } = await import('../src/portal/ShipperPortal');
  history.replaceState(null,'','/acme/shipper/messages');
  operations.ownShipper = async () => ({id:'s1',name:'Alice Shipper'}) as never;
  operations.sync = async () => ({cursor:'1-0',changes:[],unread:0,unread_messages:5,reset:false,next_poll_ms:60000});
  allOperations.orders = async () => [];
  chat.inbox = async () => [{kind:'DRIVER_SHIPPER',order_id:'o1',unread:3},{kind:'DISPATCH_SHIPPER',order_id:null,unread:2}] as never;
  chat.shipperCompanyChannel = async () => channel('DISPATCH_SHIPPER','Company',null,{shipper_id:'s1',unread:2});
  mount(React.createElement(ShipperPortal,{slug:'acme',company:'Acme Transport',login:'alice@example.com',onLogout:()=>{},loggingOut:false,logoutError:null}));
  assert.ok(await screen.findByRole('link',{name:'Chat, 2 unread'}));
  assert.ok(screen.getByRole('link',{name:'Orders, 3 unread'}));
  assert.ok(await screen.findByRole('textbox',{name:'Message Company'}));
  assert.equal(screen.queryByRole('tablist'),null);
  assert.equal(screen.queryByRole('textbox',{name:'Message Dana Driver'}),null);
  assert.equal(screen.queryByRole('searchbox',{name:'Search your orders'}),null);
  assert.ok(screen.getByRole('button',{name:/Notifications/}));
  const user = userEvent.setup({document});
  await user.click(screen.getByRole('link',{name:'Orders, 3 unread'}));
  assert.ok(await screen.findByRole('searchbox',{name:'Search your orders'}));
  await user.click(screen.getByRole('link',{name:'Chat, 2 unread'}));
  assert.ok(await screen.findByRole('textbox',{name:'Message Company'}));
  assert.equal(screen.queryByRole('searchbox',{name:'Search your orders'}),null);
});

test('dispatcher shipper row shows company unread count and opens chat before any orders exist', async () => {
  const { CustomersPage } = await import('../src/pages/CustomersPage');
  history.replaceState(null,'','/acme/shippers');
  allOperations.shippers = async () => [{id:'s1',number:'S01',name:'Alice Shipper',company_name:'Fresh Test',kind:'BUSINESS',email:'alice@example.com',phone:'6045550101',warehouse:{text:'350 West Georgia Street, Vancouver, BC V6B 6B1',city:'Vancouver',province:'BC',postal_code:'V6B 6B1',country:'CA'},status:'ACTIVE',assigned_driver_id:null,assigned_driver_name:null,rate_card_id:null,discount:{kind:'NONE',value:'0'},instructions:'',created_at:'2026-10-20T00:00:00Z',email_updates:true}] as never;
  allOperations.rates = async () => [];allOperations.drivers = async () => [];
  chat.inbox = async () => [{kind:'DISPATCH_SHIPPER',shipper_id:'s1',order_id:null,unread:2},{kind:'DRIVER_SHIPPER',shipper_id:'s1',order_id:'o1',unread:8}] as never;
  chat.shipperCompanyChannel = async () => channel('DISPATCH_SHIPPER','Fresh Test',null,{shipper_id:'s1',unread:2});
  mount(React.createElement(CustomersPage,{onBackToMonitor:()=>{}}));
  const user = userEvent.setup({document});
  await user.click(await screen.findByRole('button',{name:'Chat with Alice Shipper, 2 unread'}));
  assert.ok(await screen.findByRole('textbox',{name:'Message Fresh Test'}));
  assert.equal(screen.queryByRole('tablist'),null);
});


test('a requested conversation ID exposes only its transcript and marks only that conversation read', async () => {
  const fetched: string[] = []; const reads: [string, number][] = [];
  Object.assign(chat, {
    channels: async () => [channel('DISPATCH_DRIVER', 'Dana', 'driver', {driver_id:'d1'}), channel('DISPATCH_SHIPPER', 'Fresh Test', 'shipper', {unread:2})],
    messages: async (_slug:string,id:string) => { fetched.push(id); return {messages:[message(3,id==='shipper'?'Shipper message':'Driver message',false,id)],has_more:false}; },
    read: async (_slug:string,id:string,seq:number) => {reads.push([id,seq]);return {unread:0};},
  });
  const cache = mount(React.createElement(ChatDialog,{slug:'acme',orderId:'o1',initialConversation:'shipper',onClose(){}}));
  assert.ok(await screen.findByText('Shipper message'));
  assert.equal(screen.queryByRole('tablist'),null);
  assert.equal(screen.queryByText('Driver message'),null);
  assert.deepEqual(fetched,['shipper']);
  await waitFor(()=>assert.deepEqual(reads,[['shipper',3]]));
  await waitFor(()=>assert.deepEqual(cache.getQueryData(syncKey('acme')),{unread:0,unread_messages:0}));
});
