import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost/acme/integrations',pretendToBeVisual:true});
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','NodeFilter','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage','location','history']) Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name as keyof Window]});
HTMLElement.prototype.scrollIntoView=()=>{};
let reducedMotion=false;
window.matchMedia=(()=>({matches:reducedMotion,addEventListener(){},removeEventListener(){}})) as never;
const {render,screen,cleanup,within,waitFor,act}=await import('@testing-library/react');
const {default:userEvent}=await import('@testing-library/user-event');
const {connectors}=await import('../src/integrations/connectors');
const {ConfirmDialogHost}=await import('../src/components/ui/ConfirmDialog');
const {changeDispatchMode}=await import('../src/operations/changeDispatchMode');
const {api}=await import('../src/portal/api');
const {Sidebar}=await import('../src/components/Sidebar');
import type {SettingsView} from '../src/portal/WorkspaceAccount';
import type {Connector} from '../src/integrations/connectors';
const originalList=connectors.list, originalSave=api.saveCompanySettings;
let cache:QueryClient;
afterEach(()=>{cleanup();cache?.clear();connectors.list=originalList;api.saveCompanySettings=originalSave;});
after(()=>dom.window.close());
const settings={version:5,data:{dispatch_mode:'MANUAL',tms_workspace:true}} as SettingsView;
const row={ready:true,status:'CONNECTED',last_sync_at:'2026-10-15T00:00:00Z'} as Connector;
let writes=0,opened=0;
function Harness({external=true,initial='MANUAL'}:{external?:boolean;initial?:'AUTO'|'MANUAL'}){
 const [saved,setSaved]=React.useState({...settings,data:{...settings.data,tms_workspace:external,dispatch_mode:initial}});
 const [pending,setPending]=React.useState(false);
 return <Sidebar tmsWorkspace={external} activeTab="monitor" isOpen onToggle={()=>{}} setActiveTab={()=>{}} showAccountPopover={false} setShowAccountPopover={()=>{}} onActionNotification={()=>{}} dispatchMode={saved.data.dispatch_mode} dispatchModePending={pending} onDispatchModeChange={async mode=>{
  setPending(true);try{const result=await changeDispatchMode('acme',saved,mode,()=>opened++);if(result)setSaved(result);}finally{setPending(false);}
 }} />;
}
function mount(props:React.ComponentProps<typeof Harness>={}){
 writes=0;opened=0;api.saveCompanySettings=async(_slug,body)=>{writes++;return {...settings,version:6,data:body.data} as SettingsView;};
 cache=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
 render(<QueryClientProvider client={cache}><ConfirmDialogHost/><Harness {...props}/></QueryClientProvider>);
 return userEvent.setup({document});
}
for (const status of ['ACTIVATION_REQUIRED','NOT_CONNECTED','CONNECTING','RECONNECT_REQUIRED','SYNC_FAILED','DISCONNECTED','SYNCING'] as const) {
 test(`external ${status} without a verified connection keeps switch off and explains resolution`,async()=>{
  connectors.list=async()=>[{...row,status,last_sync_at:null}];const user=mount();
  await user.click(screen.getByRole('switch',{name:'Auto dispatch'}));
  const popup=await screen.findByRole('alertdialog',{name:'Auto dispatch unavailable'});
  assert.ok(within(popup).getByText(/Use Dispatra TMS.*unchecked.*no TMS connector is connected/));
  assert.equal(screen.getByRole('switch').getAttribute('aria-checked'),'false');assert.equal(writes,0);
  await user.click(within(popup).getByRole('button',{name:'Open Integration'}));
  assert.equal(opened,1);assert.equal(writes,0);
 });
}
test('empty connectors can be dismissed with Escape without saving',async()=>{
 connectors.list=async()=>[];const user=mount();const toggle=screen.getByRole('switch');
 await user.click(toggle);await screen.findByRole('alertdialog');await user.keyboard('{Escape}');
 await waitFor(()=>assert.equal(toggle.getAttribute('aria-disabled'),'false'));
 assert.equal(document.activeElement,toggle);assert.equal(writes,0);assert.equal(opened,0);
});
for(const status of ['CONNECTED','SYNCING'] as const){
 test(`external ${status} verified connector allows normal confirmation and saves AUTO`,async()=>{
  connectors.list=async()=>[{...row,status}];const user=mount();
  await user.click(screen.getByRole('switch'));const popup=await screen.findByRole('alertdialog',{name:'Turn on auto dispatch?'});
  assert.equal(writes,0);await user.click(within(popup).getByRole('button',{name:'Turn on'}));
  await waitFor(()=>assert.equal(screen.getByRole('switch').getAttribute('aria-checked'),'true'));assert.equal(writes,1);
 });
}
test('native mode confirms without needing connectors and cancellation stays off',async()=>{
 connectors.list=async()=>{throw Error('Should not read external connectors');};const user=mount({external:false});
 await user.click(screen.getByRole('switch'));await screen.findByRole('alertdialog',{name:'Turn on auto dispatch?'});
 await user.click(screen.getByRole('button',{name:'Cancel'}));assert.equal(writes,0);
 await user.click(screen.getByRole('switch'));await user.click(await screen.findByRole('button',{name:'Turn on'}));
 await waitFor(()=>assert.equal(writes,1));
});
test('turning off AUTO never depends on a connection',async()=>{
 connectors.list=async()=>{throw Error('Should not check');};const user=mount({initial:'AUTO'});
 await user.click(screen.getByRole('switch'));await waitFor(()=>assert.equal(screen.getByRole('switch').getAttribute('aria-checked'),'false'));
 assert.equal(writes,1);assert.equal(screen.queryByRole('alertdialog'),null);
});
test('connection lookup failure does not save or claim no connection',async()=>{
 connectors.list=async()=>{throw Error('Connection check failed. Try again.');};const user=mount();
 await user.click(screen.getByRole('switch'));const popup=await screen.findByRole('alertdialog',{name:'Auto dispatch could not be turned on'});
 assert.ok(within(popup).getByText('Connection check failed. Try again.'));assert.equal(writes,0);
 assert.equal(within(popup).getAllByRole('button').length,1);
 await user.click(within(popup).getByRole('button',{name:'Close dialog'}));
 assert.equal(screen.queryByRole('alertdialog'),null);assert.equal(writes,0);
});
test('server rejection after a successful precheck appears in popup and leaves switch off',async()=>{
 connectors.list=async()=>[row];const user=mount();api.saveCompanySettings=async()=>{throw Error('The connector was disconnected. Open Integration.');};
 await user.click(screen.getByRole('switch'));await user.click(await screen.findByRole('button',{name:'Turn on'}));
 await screen.findByRole('alertdialog',{name:'Auto dispatch could not be turned on'});
 assert.equal(screen.getByRole('switch').getAttribute('aria-checked'),'false');
 assert.ok(screen.getByText('The connector was disconnected. Open Integration.'));
});
test('pending checks ignore repeated switch clicks',async()=>{
 let checks=0;let finish:(rows:Connector[])=>void=()=>{};
 connectors.list=()=>{checks++;return new Promise(resolve=>{finish=resolve;});};const user=mount();
 const toggle=screen.getByRole('switch');await user.click(toggle);await user.click(toggle);
 assert.equal(checks,1);assert.equal(toggle.getAttribute('aria-busy'),'true');assert.equal(writes,0);
 await act(async()=>finish([]));await screen.findByRole('alertdialog',{name:'Auto dispatch unavailable'});
 await user.click(screen.getByRole('button',{name:'Close dialog'}));
 await waitFor(()=>assert.equal(toggle.getAttribute('aria-disabled'),'false'));
});

test('Samsara account verification alone does not qualify as an External TMS',async()=>{
 connectors.list=async()=>[{...row,id:'samsara'}];const user=mount();
 await user.click(screen.getByRole('switch',{name:'Auto dispatch'}));
 assert.ok(await screen.findByRole('alertdialog',{name:'Auto dispatch unavailable'}));
 assert.equal(writes,0);assert.equal(screen.getByRole('switch').getAttribute('aria-checked'),'false');
});
