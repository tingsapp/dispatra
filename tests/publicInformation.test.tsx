import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost/ask-dispatra',pretendToBeVisual:true});
for (const name of ['window','document','navigator','HTMLElement','Element','Node','location','history']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
dom.window.scrollTo = () => {};
const { render, screen, cleanup, fireEvent, waitFor, within, act } = await import('@testing-library/react');
const { PublicChatAssistant } = await import('../src/components/home/PublicChatAssistant');
const { default: Information } = await import('../src/pages/PublicInformationPage');
const { api, ApiError } = await import('../src/portal/api');
const { companySlugForPath } = await import('../src/lib/pageRoutes');
const original = api.publicAssistant;
afterEach(() => {cleanup();api.publicAssistant=original;});
test('public chat sends the question and context, shows the real reply, and clears without persistence',async()=>{
 const requests: unknown[]=[];
 api.publicAssistant=async body=>{requests.push(body);return {message:'The trial lasts 30 days after email verification.'};};
 render(<PublicChatAssistant />);
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'How does the free trial work?'}});
 fireEvent.click(screen.getByRole('button',{name:'Send question'}));
 await screen.findByText('The trial lasts 30 days after email verification.');
 assert.deepEqual(requests[0],{message:'How does the free trial work?',history:[]});
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'Do I need a card?'}});
 fireEvent.click(screen.getByRole('button',{name:'Send question'}));
 await waitFor(()=>assert.equal(requests.length,2));
 assert.equal((requests[1] as {history:unknown[]}).history.length,2);
 await waitFor(()=>assert.equal(screen.getByRole('button',{name:'New chat'}).hasAttribute('disabled'),false));
 fireEvent.click(screen.getByRole('button',{name:'New chat'}));
 assert.equal(screen.queryByText('Do I need a card?'),null);
 assert.equal((screen.getByRole('textbox') as HTMLTextAreaElement).value,'');
 assert.equal(screen.queryByRole('log'),null);
});
test('failed chat offers retry of the same request without duplicating the visitor question',async()=>{
 let count=0;
 api.publicAssistant=async()=>{if(++count===1)throw new ApiError(503,'Chat is unavailable.');return {message:'Hello from Dispatra.'};};
 render(<PublicChatAssistant />);
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'Hello'}});
 fireEvent.click(screen.getByRole('button',{name:'Send question'}));
 assert.ok(await screen.findByRole('alert'));
 assert.equal(screen.getByRole('link',{name:'Email our team instead'}).getAttribute('href'),'mailto:dispatra@tingsapp.com');
 fireEvent.click(screen.getByRole('button',{name:'Try again'}));
 await screen.findByText('Hello from Dispatra.');
 assert.equal(screen.getAllByText('Hello',{exact:true}).length,1);
});
test('information pages and clean footer expose reachable pages and general app stores',()=>{
 for(const page of ['/about','/help'] as const){
  assert.equal(companySlugForPath(page),undefined);render(<Information page={page} />);
  assert.equal(screen.getAllByRole('heading',{level:1}).length,1);
  const footer=within(screen.getByRole('contentinfo'));
  assert.equal(within(footer.getByRole('navigation',{name:'Company'})).queryByRole('link',{name:'Contact'}),null);
  for(const [label,path] of [['About','/about'],['FAQs','/help'],['Ask dispatra','/ask-dispatra#dispatra-chat-title']])assert.equal(footer.getByRole('link',{name:label}).getAttribute('href'),path);
  assert.equal(footer.getByRole('link',{name:/Android/}).getAttribute('href'),'https://play.google.com/store/apps');
  assert.equal(footer.getByRole('link',{name:/iOS/}).getAttribute('href'),'https://www.apple.com/app-store/');
  assert.equal(footer.queryByText('YOUR NEXT DELIVERY DAY'),null);cleanup();
 }
});

test('voice entry is available without sending a text question',async()=>{
 let requests=0;api.publicAssistant=async()=>{requests++;return {message:'Text reply'};};
 render(<PublicChatAssistant />);
 const button=screen.getByRole('button',{name:'Start voice chat'});
 assert.equal(button.hasAttribute('disabled'),false);
 fireEvent.click(button);
 assert.match((await screen.findByRole('alert')).textContent!,/microphone support/);
 assert.equal(requests,0);
});

test('chat screen keeps the composer available while awaiting an answer and prevents duplicate requests',async()=>{
 let finish!: (value:{message:string})=>void;let count=0;
 api.publicAssistant=()=>{count++;return new Promise(resolve=>{finish=resolve;});};
 render(<PublicChatAssistant />);
 const field=screen.getByRole('textbox');
 assert.equal(field.getAttribute('rows'),'1');
 assert.ok(screen.getByRole('heading',{level:1,name:'How can I help you?'}));
 assert.equal(screen.queryByRole('log'),null);
 fireEvent.change(field,{target:{value:'How do I start?'}});
 fireEvent.keyDown(field,{key:'Enter'});
 await screen.findByRole('status');
 assert.equal(screen.getByRole('button',{name:'Start voice chat'}).hasAttribute('disabled'),true);
 fireEvent.click(screen.getByRole('button',{name:'Start voice chat'}));
 assert.equal(field.hasAttribute('disabled'),false);
 assert.equal(screen.getByRole('button',{name:'Send question'}).hasAttribute('disabled'),true);
 fireEvent.change(field,{target:{value:'And pricing?'}});
 fireEvent.keyDown(field,{key:'Enter'});
 assert.equal(count,1);
 assert.equal(screen.getByRole('button',{name:'New chat'}).hasAttribute('disabled'),true);
 finish({message:'Start at /plans.'});await screen.findByText('Start at /plans.');
 assert.equal((field as HTMLTextAreaElement).value,'And pricing?');
 assert.equal(screen.getByRole('button',{name:'Start voice chat'}).hasAttribute('disabled'),false);
 fireEvent.click(screen.getByRole('button',{name:'New chat'}));
 assert.equal(screen.queryByRole('log'),null);
 assert.equal((field as HTMLTextAreaElement).value,'');
});

test('reading older messages pauses following; Jump to latest restores it',async()=>{
 let finish!: (value:{message:string})=>void;
 api.publicAssistant=()=>new Promise(resolve=>{finish=resolve;});
 const originalScroll=window.scrollTo;const calls: ScrollToOptions[]=[];
 window.scrollTo=((options:ScrollToOptions)=>{calls.push(options);}) as typeof window.scrollTo;
 try {
  render(<PublicChatAssistant />);
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'Explain the workflow'}});
  fireEvent.click(screen.getByRole('button',{name:'Send question'}));await screen.findByRole('status');
  const log=screen.getByRole('log');const end=log.nextElementSibling as HTMLElement;
  const dock=document.querySelector('.public-chat-dock') as HTMLElement;
  end.getBoundingClientRect=()=>({bottom:1400} as DOMRect);
  dock.getBoundingClientRect=()=>({top:600,bottom:700,height:100} as DOMRect);
  calls.length=0;fireEvent.scroll(window);
  await screen.findByRole('button',{name:'Jump to latest'});
  finish({message:'A new answer arrived while you were reading.'});
  await screen.findByText('A new answer arrived while you were reading.');
  assert.equal(calls.length,0,'incoming answers must not move a reader away from older messages');
  fireEvent.click(screen.getByRole('button',{name:'Jump to latest'}));
  assert.equal(calls.length,1);assert.equal(calls[0].top,1500-window.innerHeight);
  assert.equal(screen.queryByRole('button',{name:'Jump to latest'}),null);
  fireEvent.click(screen.getByRole('button',{name:'New chat'}));
  assert.equal(calls.at(-1)?.top,0);assert.equal(screen.queryByRole('log'),null);
 } finally {window.scrollTo=originalScroll;}
});


test('replies reveal progressively, keep complete history, and cancel on New chat',async()=>{
 const originalFrame=window.requestAnimationFrame;const originalCancel=window.cancelAnimationFrame;
 const frames=new Map<number,FrameRequestCallback>();let sequence=0;
 window.requestAnimationFrame=callback=>{frames.set(++sequence,callback);return sequence;};
 window.cancelAnimationFrame=id=>{frames.delete(id);};
 const step=(time:number)=>act(()=>{const current=[...frames.values()];frames.clear();current.forEach(callback=>callback(time));});
 const reply='Hello! Dispatra helps your team manage orders, dispatch drivers, and track deliveries.';
 const requests: {message:string;history?:unknown[]}[]=[];
 api.publicAssistant=async body=>{requests.push(body);return {message:reply};};
 try {
  render(<PublicChatAssistant />);
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'Explain Dispatra'}});
  fireEvent.click(screen.getByRole('button',{name:'Send question'}));
  await waitFor(()=>assert.equal(screen.queryByRole('status'),null));
  step(0);step(120);
  const log=screen.getByRole('log');
  assert.ok(log.textContent?.includes('Hello! Dispa'));
  assert.equal(screen.queryByText(reply),null);
  assert.equal(log.getAttribute('aria-busy'),'true');
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'And tracking?'}});
  fireEvent.keyDown(screen.getByRole('textbox'),{key:'Enter'});
  assert.equal(requests.length,1);
  step(10000);
  assert.ok(screen.getByText(reply));assert.equal(log.getAttribute('aria-busy'),'false');
  assert.equal((screen.getByRole('textbox') as HTMLTextAreaElement).value,'And tracking?');
  fireEvent.click(screen.getByRole('button',{name:'Send question'}));
  await waitFor(()=>assert.equal(requests.length,2));
  assert.deepEqual(requests[1].history,[{role:'user',content:'Explain Dispatra'},{role:'assistant',content:reply}]);
  await waitFor(()=>assert.equal(screen.queryByRole('status'),null));
  step(11000);
  assert.equal(screen.getAllByText(reply).length,1,'older replies remain complete');
  fireEvent.click(screen.getByRole('button',{name:'New chat'}));step(20000);
  assert.equal(screen.queryByRole('log'),null);assert.equal(screen.queryByText(reply),null);
 } finally {cleanup();window.requestAnimationFrame=originalFrame;window.cancelAnimationFrame=originalCancel;}
});

test('reduced motion displays the complete reply immediately',async()=>{
 const originalMatch=window.matchMedia;
 window.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}} as unknown as MediaQueryList);
 try {
  api.publicAssistant=async()=>({message:'Full reply without typing animation.'});
  render(<PublicChatAssistant />);
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'Hello'}});
  fireEvent.click(screen.getByRole('button',{name:'Send question'}));
  assert.ok(await screen.findByText('Full reply without typing animation.'));
  assert.equal(screen.getByRole('log').getAttribute('aria-busy'),'false');
  assert.equal(document.querySelector('.public-chat-typing-cursor'),null);
 } finally {cleanup();window.matchMedia=originalMatch;}
});
