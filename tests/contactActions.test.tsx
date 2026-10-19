import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
import {afterEach,test} from 'node:test';
import React from 'react';
import type {Driver} from '../src/types';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/acme/',pretendToBeVisual:true});
for(const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage'])Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
const {render,screen,cleanup,fireEvent,waitFor,within}=await import('@testing-library/react');
const {QueryClient,QueryClientProvider}=await import('@tanstack/react-query');
const {chat}=await import('../src/chat/api');
const {PersonContactActions}=await import('../src/components/contact/PersonContactActions');
const {DriverChatDialog}=await import('../src/components/chat/DriverChatDialog');
const {OrderChatSection,ChatDialog}=await import('../src/components/chat/OrderChat');
const original={...chat};let cache:InstanceType<typeof QueryClient>|undefined;
afterEach(()=>{cleanup();cache?.clear();Object.assign(chat,original);});
function mount(node:React.ReactElement){cache=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0},mutations:{retry:false,gcTime:0}}});return render(<QueryClientProvider client={cache}>{node}</QueryClientProvider>);}
const driver={id:'d1',name:'Dana'} as Driver;
const channel={kind:'DISPATCH_DRIVER',title:'Dana',conversation_id:null,driver_id:'d1',can_send:true,closed_reason:null,unread:0,last_message_at:null} as Awaited<ReturnType<typeof chat.channels>>[number];

test('message is independent of phone and missing phone never launches a call',()=>{
 let opened=0;render(<PersonContactActions name="Dana" onMessage={()=>opened++}/>);
 assert.equal((screen.getByRole('button',{name:'Call Dana'}) as HTMLButtonElement).disabled,true);
 fireEvent.click(screen.getByRole('button',{name:'Message Dana'}));assert.equal(opened,1);assert.equal(document.querySelector('a[href^="sms:"]'),null);
});
test('call links dial the saved contact while unavailable chat is explicit',()=>{
 render(<PersonContactActions name="Dana" phone="+1 (604) 555-0102" labelled/>);
 assert.equal(screen.getByRole('link',{name:'Call Dana'}).getAttribute('href'),'tel:+16045550102');
 assert.equal((screen.getByRole('button',{name:'Message Dana'}) as HTMLButtonElement).disabled,true);
});
test('driver profile opens the ongoing company thread without selecting an order',async()=>{
 const requested:string[]=[];chat.companyChannel=async(_slug,id)=>{requested.push(id);return channel;};
 mount(<DriverChatDialog slug="acme" driver={driver} onClose={()=>{}}/>);
 assert.ok(await screen.findByRole('textbox',{name:'Message Dana'}));assert.deepEqual(requested,['d1']);
 assert.equal(screen.queryByText(/Choose an order/),null);assert.ok(screen.getByRole('dialog',{name:'Messages'}));
});
test('unavailable company chat explains the failure without launching SMS',async()=>{
 chat.companyChannel=async()=>{throw new Error('Network down');};mount(<DriverChatDialog slug="acme" driver={driver} onClose={()=>{}}/>);
 assert.ok(await screen.findByRole('alert'));assert.equal(screen.queryByRole('textbox'),null);assert.equal(document.querySelector('a[href^="sms:"]'),null);
});
test('order detail entry opens the reusable portalled popup and closes by Escape',async()=>{
 chat.channels=async()=>[channel];mount(<OrderChatSection slug="acme" orderId="one"/>);
 fireEvent.click(screen.getByRole('button',{name:'Open order messages'}));
 assert.ok(await screen.findByRole('textbox',{name:'Message Dana'}));const popup=screen.getByRole('dialog',{name:'Messages'});
 assert.equal(popup.parentElement,document.body);assert.equal(document.body.style.overflow,'hidden');
 fireEvent.keyDown(document,{key:'Escape'});await waitFor(()=>assert.equal(screen.queryByRole('dialog'),null));assert.equal(document.body.style.overflow,'');
});
test('the requested shipper or driver conversation gets the built-in send action',async()=>{
 const sent:unknown[]=[];chat.channels=async()=>[{...channel,kind:'DISPATCH_SHIPPER',driver_id:null,title:'Shipper'},channel];
 chat.send=async(slug,id,kind,body,key)=>{sent.push({slug,id,kind,body,key});return {id:'m1',seq:1,conversation_id:'c1',mine:true,body,sender_name:'Dispatcher',sender_role:'DISPATCHER',created_at:'2026-10-16T12:00:00Z'};};
 mount(<ChatDialog slug="acme" orderId="one" initialKind="DISPATCH_DRIVER" expectedDriverId="d1" onClose={()=>{}}/>);
 const box=await screen.findByRole('textbox',{name:'Message Dana'});fireEvent.change(box,{target:{value:'Pickup is ready'}});fireEvent.click(screen.getByRole('button',{name:'Send message'}));
 await waitFor(()=>assert.equal(sent.length,1));assert.deepEqual((sent[0] as {kind:string}).kind,'DISPATCH_DRIVER');assert.equal((sent[0] as {body:string}).body,'Pickup is ready');
});


test('switching driver contact resets the composer and cannot retain another recipient draft',async()=>{
 chat.companyChannel=async(_slug,id)=>({...channel,driver_id:id,title:id==='d1'?'Dana':'Sam'});
 const view=mount(<DriverChatDialog slug="acme" driver={driver} onClose={()=>{}}/>);
 const first=await screen.findByRole('textbox',{name:'Message Dana'});fireEvent.change(first,{target:{value:'Private draft'}});
 view.rerender(<QueryClientProvider client={cache!}><DriverChatDialog slug="acme" driver={{...driver,id:'d2',name:'Sam'}} onClose={()=>{}}/></QueryClientProvider>);
 const next=await screen.findByRole('textbox',{name:'Message Sam'});assert.equal((next as HTMLTextAreaElement).value,'');assert.equal(screen.queryByRole('textbox',{name:'Message Dana'}),null);
});
