import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/chat', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage','location','history','requestAnimationFrame']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
const { render, screen, cleanup, waitFor, fireEvent } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { chat, ADMIN_CHAT } = await import('../src/chat/api');
const { ChatWorkspace } = await import('../src/components/chat/ChatWorkspace');
const { IncomingChatNotice } = await import('../src/components/chat/IncomingChatNotice');
const { operations } = await import('../src/operations/api');
const original = {...chat}; const originalOperations = {...operations};
let cache: InstanceType<typeof QueryClient>;
afterEach(() => { cleanup(); cache?.clear(); Object.assign(chat,original); Object.assign(operations,originalOperations); });
const msg = (seq: number, cid='driver') => ({ id:`${cid}-${seq}`,seq,conversation_id:cid,sender_role:'DRIVER' as const,sender_name:'Dana',mine:false,body:`Message ${seq}`,created_at:'2026-11-08T10:00:00Z' });
const row = (id='driver', extra={}) => ({ conversation_id:id,kind:'DISPATCH_DRIVER' as const,title:'Dana',driver_id:'d1',order_id:null,order_number:null,order_status:null,unread:1,can_send:true,closed_reason:null,last_message_at:'2026-11-08T10:00:00Z',last_message:msg(250,id),...extra });
function mount(node: React.ReactElement) {
 cache=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0},mutations:{retry:false}}});
 return render(<QueryClientProvider client={cache}>{node}</QueryClientProvider>);
}

test('dispatcher pages complete history past 200 messages and preserves drafts when switching conversations',async()=>{
 const user=userEvent.setup({document}); const beforeSeen: (number|undefined)[]=[];
 chat.page=async()=>({items:[row(),row('shipper',{kind:'DISPATCH_SHIPPER',title:'Fresh Foods',shipper_id:'s1',driver_id:null})],next_cursor:null});
 chat.detail=async(_slug,id)=>id==='driver'?row():row('shipper',{kind:'DISPATCH_SHIPPER',title:'Fresh Foods',shipper_id:'s1',driver_id:null});
 chat.messages=async(_slug,id,_limit,before)=>{beforeSeen.push(before);const end=before?before-1:250;return{messages:Array.from({length:Math.min(50,end)},(_,i)=>msg(Math.max(1,end-49)+i,id)),has_more:end>50};};
 chat.read=async()=>({unread:0});
 mount(<ChatWorkspace slug="acme" timeZone="America/Vancouver" />);
 await user.click(await screen.findByRole('button',{name:'Dana, 1 unread'}));
 await screen.findByText('Message 250', {selector:'p'});
 for(let i=0;i<4;i++) await user.click(await screen.findByRole('button',{name:'Show earlier messages'}));
 await screen.findByText('Message 1'); assert.deepEqual(beforeSeen.slice(0,5),[undefined,201,151,101,51]);
 await user.type(screen.getByRole('textbox',{name:'Message Dana'}),'Keep this draft');
 await user.click(screen.getByRole('button',{name:'Fresh Foods, 1 unread'}));
 await screen.findByRole('textbox',{name:'Message Fresh Foods'});
 assert.equal((screen.getByRole('textbox',{name:'Message Fresh Foods'}) as HTMLTextAreaElement).value,'');
 await user.click(screen.getByRole('button',{name:'Dana, 1 unread'}));
 await waitFor(()=>assert.equal((screen.getByRole('textbox',{name:'Message Dana'}) as HTMLTextAreaElement).value,'Keep this draft'));
});

test('admin inbox queries only dispatcher contacts and sends through its support channel',async()=>{
 const user=userEvent.setup({document}); const sent: unknown[]=[];
 chat.page=async slug=>{assert.equal(slug,ADMIN_CHAT);return{items:[],next_cursor:null};};
 chat.contacts=async()=>({items:[{id:'dispatcher',name:'Jo',company_name:'Acme'}],next_cursor:null});
 chat.support=async()=>({...row('support'),kind:'ADMIN_DISPATCHER',title:'Jo',dispatcher_id:'dispatcher',driver_id:null,company_name:'Acme'});
 chat.messages=async()=>({messages:[],has_more:false});
 chat.sendSupport=async(...args)=>{sent.push(args);return msg(1,'support');};
 mount(<ChatWorkspace slug={ADMIN_CHAT} />);
 assert.equal(screen.queryByRole('button',{name:'Drivers'}),null);
 await user.click(screen.getAllByRole('button',{name:'New chat'})[0]);
 await user.click(await screen.findByRole('button',{name:/Jo.*Acme/}));
 await user.type(await screen.findByRole('textbox',{name:'Message Jo'}),'Hello dispatcher');
 await user.click(screen.getByRole('button',{name:'Send message'}));
 await waitFor(()=>assert.equal(sent.length,1));
 assert.deepEqual((sent[0] as unknown[]).slice(0,3),[ADMIN_CHAT,'dispatcher','Hello dispatcher']);
});

test('oversight has read-only history and does not expose a reply composer',async()=>{
 chat.page=async()=>({items:[],next_cursor:null});
 chat.detail=async()=>row('oversight',{kind:'DRIVER_SHIPPER',title:'Dana ↔ Fresh Foods',can_send:false,closed_reason:'Dispatch can read this chat but not reply.',order_id:'o1'});
 chat.messages=async()=>({messages:[msg(1,'oversight')],has_more:false});chat.read=async()=>({unread:0});
 mount(<ChatWorkspace slug="acme" initialTarget={{conversationId:'oversight'}} />);
 await screen.findByText('Message 1');
 assert.equal(screen.queryByRole('textbox'),null);
 assert.ok(screen.getByText('Dispatch can read this chat but not reply.'));
});

test('incoming notification banner ignores old notices and opens the exact newly received chat',async()=>{
 const old={id:'old',title:'Old message',kind:'message.created',conversation_id:'old-chat',read_at:null};
 operations.notifications=async()=>[old] as never;
 const opened:string[]=[];
 mount(<IncomingChatNotice slug="acme" onOpen={id=>opened.push(id)} />);
 await waitFor(()=>assert.ok(cache.getQueryData(['notifications','acme'])));
 assert.equal(screen.queryByRole('status'),null);
 cache.setQueryData(['notifications','acme'],[{...old,id:'new',title:'New message from driver',conversation_id:'new-chat'},old]);
 await userEvent.setup({document}).click(await screen.findByRole('button',{name:/New message from driver.*Open conversation/}));
 assert.deepEqual(opened,['new-chat']);
});

test('a hidden document does not mark messages read until it becomes visible',async()=>{
 const reads:number[]=[];
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
 chat.page=async()=>({items:[],next_cursor:null});chat.detail=async()=>row();chat.messages=async()=>({messages:[msg(1)],has_more:false});
 chat.read=async(_s,_c,seq)=>{reads.push(seq);return{unread:0};};
 mount(<ChatWorkspace slug="acme" initialTarget={{conversationId:'driver'}} />);
 await screen.findByText('Message 1');assert.deepEqual(reads,[]);
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});fireEvent(document,new Event('visibilitychange'));
 await waitFor(()=>assert.deepEqual(reads,[1]));
});


test('order replies bind the displayed recipient and preserve the draft when reassignment rejects a send',async()=>{
 const user=userEvent.setup({document}); const sent: unknown[][]=[];
 chat.page=async()=>({items:[],next_cursor:null});
 chat.detail=async()=>row('order-chat',{order_id:'order1',order_number:'ORD-1'});
 chat.messages=async()=>({messages:[],has_more:false});
 chat.send=async(...args)=>{sent.push(args);throw new Error('The assigned driver changed. Reopen chat before sending.');};
 mount(<ChatWorkspace slug="acme" initialTarget={{conversationId:'order-chat'}} />);
 const composer=await screen.findByRole('textbox',{name:'Message Dana'});
 await user.type(composer,'Keep this reply');
 await user.click(screen.getByRole('button',{name:'Send message'}));
 await screen.findByRole('alert');
 assert.deepEqual(sent[0].slice(0,4),['acme','order1','DISPATCH_DRIVER','Keep this reply']);
 assert.deepEqual(sent[0][5],{expected_conversation_id:'order-chat',expected_driver_id:'d1'});
 assert.equal((composer as HTMLTextAreaElement).value,'Keep this reply');
});

test('contact actions open one popup on the current page, retain drafts and restore focus', async () => {
 const { DispatcherChatPopup } = await import('../src/components/chat/DispatcherChatPopup');
 const { openDispatcherChat } = await import('../src/chat/navigation');
 const user = userEvent.setup({document});
 history.replaceState(null, '', '/acme/monitor?view=drivers');
 chat.companyChannel = async () => row();
 chat.shipperCompanyChannel = async () => row('shipper', {kind:'DISPATCH_SHIPPER', title:'Fresh Foods', driver_id:null, shipper_id:'s1'});
 chat.messages = async () => ({messages:[],has_more:false});
 const sent: unknown[][] = [];
 chat.sendCompany = async (...args) => {sent.push(args);return msg(1);};
 mount(<><button onClick={() => openDispatcherChat({driverId:'d1'})}>Message driver</button><button onClick={() => openDispatcherChat({shipperId:'s1'})}>Message shipper</button><DispatcherChatPopup slug="acme" /></>);
 const trigger = screen.getByRole('button',{name:'Message driver'});
 await user.click(trigger);
 const composer = await screen.findByRole('textbox',{name:'Message Dana'});
 assert.equal(location.pathname+location.search,'/acme/monitor?view=drivers');
 assert.equal(screen.queryByLabelText('Conversations'),null);
 await user.type(composer,'Keep my draft');
 await user.keyboard('{Escape}');
 assert.equal(screen.queryByRole('dialog'),null);
 assert.equal(document.activeElement,trigger);
 assert.equal(document.body.style.overflow,'');
 await user.click(screen.getByRole('button',{name:'Message shipper'}));
 assert.equal((await screen.findByRole('textbox',{name:'Message Fresh Foods'}) as HTMLTextAreaElement).value,'');
 await user.click(screen.getByRole('button',{name:'Close dialog'}));
 await user.click(trigger);
 await waitFor(() => assert.equal((screen.getByRole('textbox',{name:'Message Dana'}) as HTMLTextAreaElement).value,'Keep my draft'));
 await user.click(screen.getByRole('button',{name:'Send message'}));
 await waitFor(() => assert.equal(sent.length,1));
 assert.deepEqual(sent[0].slice(0,3),['acme','d1','Keep my draft']);
 assert.equal(location.pathname+location.search,'/acme/monitor?view=drivers');
});

test('popup resolves order and notification targets without falling back to a different recipient', async () => {
 const { DispatcherChatPopup } = await import('../src/components/chat/DispatcherChatPopup');
 const { openDispatcherChat } = await import('../src/chat/navigation');
 const user = userEvent.setup({document});
 history.replaceState(null, '', '/acme/orders');
 chat.channels = async () => [row('current',{driver_id:'new-driver'})];
 chat.detail = async (_slug,id) => {assert.equal(id,'oversight');return row(id,{kind:'DRIVER_SHIPPER',can_send:false,closed_reason:'Read only'});};
 chat.messages = async () => ({messages:[],has_more:false});
 mount(<><button onClick={() => openDispatcherChat({orderId:'o1',kind:'DISPATCH_DRIVER',driverId:'old-driver'})}>Old driver</button><button onClick={() => openDispatcherChat({conversationId:'oversight'})}>Notification</button><DispatcherChatPopup slug="acme" /></>);
 await user.click(screen.getByRole('button',{name:'Old driver'}));
 await screen.findByRole('alert');
 assert.equal(screen.queryByRole('textbox'),null);
 chat.channels = async () => [row('old',{driver_id:'old-driver'})];
 await user.click(screen.getByRole('button',{name:'Try again'}));
 await screen.findByRole('textbox',{name:'Message Dana'});
 await user.keyboard('{Escape}');
 await user.click(screen.getByRole('button',{name:'Notification'}));
 await screen.findByText('Read only');
 assert.equal(screen.queryByRole('textbox'),null);
 assert.equal(location.pathname,'/acme/orders');
});

test('chat closes above a details dialog without losing its edits or closing the details', async () => {
 const { DispatcherChatPopup } = await import('../src/components/chat/DispatcherChatPopup');
 const { openDispatcherChat } = await import('../src/chat/navigation');
 const { Dialog, DialogBody, DialogHeader } = await import('../src/components/ui/Dialog');
 const { useEntityDialog } = await import('../src/components/entities/useEntityDialog');
 const user = userEvent.setup({document});
 let detailsClosed = false;
 function Details() {
  useEntityDialog(true, () => {detailsClosed = true;}, 'Driver details');
  return <Dialog onClose={() => {detailsClosed = true;}}><DialogHeader title="Driver details" onClose={() => {detailsClosed = true;}} /><DialogBody><input aria-label="Driver notes" defaultValue="Unsaved detail" /><button onClick={() => openDispatcherChat({driverId:'d1'})}>Chat with driver</button></DialogBody></Dialog>;
 }
 chat.companyChannel = async () => row();chat.messages = async () => ({messages:[],has_more:false});
 mount(<><Details /><DispatcherChatPopup slug="acme" /></>);
 const trigger = screen.getByRole('button',{name:'Chat with driver'});
 await user.click(trigger);
 await screen.findByRole('textbox',{name:'Message Dana'});
 assert.equal(screen.getAllByRole('dialog').length,2);
 await user.keyboard('{Escape}');
 assert.equal(detailsClosed,false);
 assert.equal(screen.getAllByRole('dialog').length,1);
 assert.equal((screen.getByRole('textbox',{name:'Driver notes'}) as HTMLInputElement).value,'Unsaved detail');
 assert.equal(document.activeElement,trigger);
});

test('dispatcher order details open only the chosen shipper or assigned driver on the same page', async () => {
 const { OrderDetailsDialog } = await import('../src/components/orders/OrderDetailsDialog');
 const { DispatcherChatPopup } = await import('../src/components/chat/DispatcherChatPopup');
 const { INITIAL_JOBS, INITIAL_DRIVERS } = await import('../src/data/mockData');
 const { loadPricingContext } = await import('../src/lib/orderPricing');
 const user = userEvent.setup({document});
 history.replaceState(null, '', '/acme/orders');
 let closes = 0;
 const job = {...INITIAL_JOBS[0], id:'o1', customerId:'s1', assignedDriverId:'d1'};
 chat.shipperCompanyChannel = async (_slug,id) => {assert.equal(id,'s1');return row('shipper',{kind:'DISPATCH_SHIPPER',title:'Fresh Foods',driver_id:null,shipper_id:'s1'});};
 chat.channels = async (_slug,id) => {assert.equal(id,'o1');return [row(),row('other',{kind:'DRIVER_SHIPPER',title:'Oversight',can_send:false})];};
 chat.messages = async () => ({messages:[],has_more:false});
 mount(<><OrderDetailsDialog job={job} ctx={loadPricingContext()} drivers={INITIAL_DRIVERS} onClose={() => closes++} onReassign={() => {}} /><DispatcherChatPopup slug="acme" /></>);
 await user.click(screen.getByRole('button',{name:'Chat with shipper'}));
 await screen.findByRole('textbox',{name:'Message Fresh Foods'});
 assert.equal(screen.queryByRole('textbox',{name:'Message Dana'}),null);
 await user.keyboard('{Escape}');
 await user.click(screen.getByRole('button',{name:'Chat with driver'}));
 await screen.findByRole('textbox',{name:'Message Dana'});
 assert.equal(screen.queryByRole('tablist'),null);
 assert.equal(screen.queryByRole('textbox',{name:'Message Fresh Foods'}),null);
 assert.equal(location.pathname,'/acme/orders');
 await user.keyboard('{Escape}');
 assert.equal(closes,0);
 assert.ok(screen.getByRole('button',{name:'Chat with driver'}));
});
