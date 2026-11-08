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
