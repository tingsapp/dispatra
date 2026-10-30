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
const {operations}=await import('../src/operations/api');
const {IntegrationsPage}=await import('../src/pages/IntegrationsPage');
const {ConnectorDialog}=await import('../src/components/integrations/connectors/ConnectorDialog');
const {ConnectorsTab}=await import('../src/components/integrations/connectors/ConnectorsTab');
const {ConfirmDialogHost}=await import('../src/components/ui/ConfirmDialog');
const {api}=await import('../src/portal/api');
const {WorkspaceAccount,useWorkspaceAccount}=await import('../src/portal/WorkspaceAccount');
const {WorkspaceTransition,useWorkspaceTransition}=await import('../src/components/layout/WorkspaceTransition');
const {Sidebar}=await import('../src/components/Sidebar');
import type {Account} from '../src/portal/api';
import type {SettingsView} from '../src/portal/WorkspaceAccount';
const originalApi={companySettings:api.companySettings,saveCompanySettings:api.saveCompanySettings};
import type {Connector} from '../src/integrations/connectors';
const original={...connectors};let cache:QueryClient;
const rows=[['rose-rocket','Rose Rocket','RR','oauth'],['cartoncloud','CartonCloud','CC','oauth'],['truckbase','Truckbase','TB','request_setup'],['tailwind','Tailwind TMS','TW','request_setup'],['ascendtms','AscendTMS','AT','request_setup'],['samsara','Samsara','SA','request_setup']].map(([id,name,initials,auth])=>({id,name,initials,auth,description:'Connect your transport workspace.',ready:false,status:'ACTIVATION_REQUIRED',credential_fields:[],version:null,account:null,last_sync_at:null,imported:0,review_count:0,message:'Activation required.'} as Connector));
function mount(node:React.ReactElement){cache=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});render(<QueryClientProvider client={cache}><ConfirmDialogHost />{node}</QueryClientProvider>);return userEvent.setup({document});}
afterEach(()=>{cleanup();cache?.clear();Object.assign(connectors,original);Object.assign(api,originalApi);localStorage.clear();reducedMotion=false;});after(()=>dom.window.close());

async function settledWorkspace(mode:string){
 await waitFor(()=>{
  const page=document.querySelector('.integration-workspace')!;
  assert.equal(page.getAttribute('data-mode'),mode);
  assert.equal(page.getAttribute('data-transition'),'idle');
 },{timeout:2000});
}

test('Connectors is the first default tab with Dispatra before six connector cards; existing tabs still open their original forms',async()=>{
 connectors.list=async()=>rows.map(row=>row.auth==='oauth'?{...row,ready:true,status:'NOT_CONNECTED'}:row);operations.tms=async()=>null;operations.apiKey=async()=>({configured:false,prefix:null,created_at:null,last_used_at:null});operations.apiWebhook=async()=>null;
 const user=mount(<IntegrationsPage />);
 assert.deepEqual(screen.getAllByRole('tab').map(t=>t.textContent),['Connectors','TMS API','Dispatra API']);
 assert.equal(screen.getByRole('tab',{name:'Connectors'}).getAttribute('aria-selected'),'true');
 const guide=screen.getByRole('link',{name:'Integrations & API guide (opens in a new tab)'});
 assert.equal(guide.getAttribute('href'),'/docs/integrations');assert.equal(guide.getAttribute('target'),'_blank');assert.equal(guide.getAttribute('rel'),'noopener noreferrer');
 const panel=screen.getByRole('tabpanel',{name:'Connectors'});await within(panel).findByRole('article',{name:'Rose Rocket'});
 assert.equal(within(panel).getAllByRole('article').length,7);
 assert.equal(within(panel).getAllByRole('article')[0].getAttribute('aria-label'),'Dispatra');
 assert.equal(panel.parentElement?.getAttribute('data-page-width'),'reading');
 assert.equal(within(panel).queryByLabelText(/TMS field|Dispatra field|Base API URL/),null);
 await user.click(screen.getByRole('tab',{name:'TMS API'}));assert.ok(await screen.findByLabelText('Base API URL'));
 assert.equal(screen.getByRole('tabpanel',{name:'TMS API'}).parentElement?.getAttribute('data-page-width'),'reading');
 await user.click(screen.getByRole('tab',{name:'Dispatra API'}));assert.ok(await within(screen.getByRole('tabpanel',{name:'Dispatra API'})).findByText('API key',{exact:true}));
 assert.equal(screen.getByRole('tabpanel',{name:'Dispatra API'}).parentElement?.getAttribute('data-page-width'),'reading');
});

test('unready connectors open an explanation without submitting credentials',async()=>{
 connectors.list=async()=>rows;let connects=0;connectors.connect=async()=>{connects++;throw Error('Must not connect');};
 const user=mount(<ConnectorsTab slug="acme"/>);await screen.findByRole('article',{name:'Rose Rocket'});
 for(const row of rows){
  const card=screen.getByRole('article',{name:row.name});assert.equal(within(card).getByRole('status').textContent,'Configuration required');
  assert.equal(within(card).queryByText('Configuration needed to connect.'),null);
  const button=within(card).getByRole('button',{name:`Connect ${row.name}`});assert.equal((button as HTMLButtonElement).disabled,false);await user.click(button);
  assert.ok(screen.getByRole('dialog'));await user.click(screen.getByRole('button',{name:'Close dialog'}));
 }
 assert.equal(screen.queryByRole('button',{name:/Request/}),null);assert.equal(screen.queryByRole('dialog'),null);assert.equal(connects,0);
 assert.equal(screen.queryByText('External TMS workspace'),null);
});

test('credential retries retain one key while secrets never enter browser storage or query cache',async()=>{
 const row={...rows[2],id:'truckmate',name:'Trimble TruckMate',auth:'bearer' as const,ready:true,status:'NOT_CONNECTED' as const,credential_fields:[{key:'api_key',label:'TruckMate API key',secret:true}]};
 const inputs:{key:string;secret:string}[]=[];let saved=0;
 connectors.connect=async(_slug,_provider,body,key)=>{inputs.push({key,secret:body.credentials!.api_key});if(inputs.length===1)throw Error('Temporary connection error.');return {connector:{...row,status:'CONNECTED'},authorization_url:null};};
 const user=mount(<ConnectorDialog slug="acme" connector={row} onSaved={()=>saved++} onClose={()=>{}} />);
 await user.type(screen.getByLabelText('TruckMate API key'),'private-test-key');await user.click(screen.getByRole('button',{name:'Test connection & connect'}));
 await screen.findByRole('alert');await user.click(screen.getByRole('button',{name:'Test connection & connect'}));await waitFor(()=>assert.equal(saved,1));
 assert.equal(inputs[0].key,inputs[1].key);assert.equal(inputs[0].secret,'private-test-key');
 assert.equal((screen.getByLabelText('TruckMate API key') as HTMLInputElement).value,'');
 assert.equal(localStorage.length,0);assert.ok(!JSON.stringify(cache.getQueryCache().getAll()).includes('private-test-key'));
});

test('OAuth sends no credentials and uses the server-issued authorization URL',async()=>{
 const row={...rows[0],ready:true,status:'NOT_CONNECTED' as const};let destination='';
 connectors.connect=async(_slug,provider,body)=>{assert.equal(provider,'rose-rocket');assert.deepEqual(body.credentials,{});return {connector:row,authorization_url:'https://vendor.example/authorize?state=test-state'};};
 const user=mount(<ConnectorDialog slug="acme" connector={row} onSaved={()=>{}} onClose={()=>{}} navigate={url=>destination=url} />);
 assert.equal(screen.queryByRole('textbox'),null);await user.click(screen.getByRole('button',{name:'Continue to Rose Rocket'}));
 await waitFor(()=>assert.equal(destination,'https://vendor.example/authorize?state=test-state'));
});

test('ready and unready providers share the catalogue with distinct Connect availability',async()=>{
 connectors.list=async()=>rows.map(row=>row.auth==='oauth'?{...row,ready:true,status:'NOT_CONNECTED'}:row);
 mount(<ConnectorsTab slug="acme"/>);await screen.findByRole('article',{name:'Rose Rocket'});
 for(const name of ['Rose Rocket','CartonCloud'])assert.equal((screen.getByRole('button',{name:`Connect ${name}`}) as HTMLButtonElement).disabled,false);
 for(const name of ['Truckbase','Tailwind TMS','AscendTMS']){
  const card=screen.getByRole('article',{name});assert.equal(within(card).getByRole('status').textContent,'Configuration required');
  assert.equal((within(card).getByRole('button',{name:`Connect ${name}`}) as HTMLButtonElement).disabled,false);
 }
 assert.equal(screen.queryByRole('button',{name:/Request/}),null);
});

test('ready OAuth providers open a popup before starting authorization',async()=>{
 connectors.list=async()=>rows.map(row=>row.auth==='oauth'?{...row,ready:true,status:'NOT_CONNECTED'}:row);
 const destinations:string[]=[];const providers:string[]=[];
 connectors.connect=async(slug,provider,body,key)=>{assert.equal(slug,'acme');assert.deepEqual(body,{version:null,credentials:{}});assert.ok(key);providers.push(provider);return {connector:rows[0],authorization_url:`https://vendor.example/${provider}/authorize`};};
 const user=mount(<ConnectorsTab slug="acme" navigate={url=>destinations.push(url)} />);
 for(const [name,id] of [['Rose Rocket','rose-rocket'],['CartonCloud','cartoncloud']]){
  const card=await screen.findByRole('article',{name});
  const trigger=within(card).getByRole('button',{name:`Connect ${name}`});assert.equal(trigger.textContent,'Connect');
  await user.click(trigger);assert.ok(screen.getByRole('dialog'));await user.click(screen.getByRole('button',{name:`Continue to ${name}`}));await waitFor(()=>assert.ok(destinations.includes(`https://vendor.example/${id}/authorize`)));
  await user.click(screen.getByRole('button',{name:'Close dialog'}));
 }
 assert.deepEqual(providers,['rose-rocket','cartoncloud']);
});

test('popup authorization locks pending actions and keeps the retry identity after failure',async()=>{
 const row={...rows[0],ready:true,status:'RECONNECT_REQUIRED' as const,version:4};connectors.list=async()=>[row];
 const keys:string[]=[];let reject:(reason:Error)=>void=()=>{};let destination='';
 connectors.connect=async(_slug,_provider,body,key)=>{keys.push(key);assert.equal(body.version,4);if(keys.length===1)return new Promise((_resolve,fail)=>{reject=fail;});return {connector:row,authorization_url:'https://vendor.example/authorize'};};
 const user=mount(<ConnectorsTab slug="acme" navigate={url=>destination=url}/>);
 const button=await screen.findByRole('button',{name:'Reconnect Rose Rocket'});assert.equal(button.textContent,'Reconnect');
 await user.click(button);const continueButton=screen.getByRole('button',{name:'Continue to Rose Rocket'});await user.click(continueButton);assert.equal((continueButton as HTMLButtonElement).disabled,true);await user.click(continueButton);assert.equal(keys.length,1);
 await act(async()=>reject(Error('Vendor connection unavailable.')));await screen.findByRole('alert');
 await user.click(screen.getByRole('button',{name:'Continue to Rose Rocket'}));await waitFor(()=>assert.equal(destination,'https://vendor.example/authorize'));assert.equal(keys[0],keys[1]);
 assert.ok(screen.getByRole('dialog'));
});

test('a ready credential connector opens its secure credentials form instead of Request setup',async()=>{
 const row={...rows[0],id:'truckmate',name:'Trimble TruckMate',auth:'api_key' as const,ready:true,status:'NOT_CONNECTED' as const,credential_fields:[{key:'api_key',label:'API key',secret:true}]};connectors.list=async()=>[row];
 const user=mount(<ConnectorsTab slug="acme"/>);await user.click(await screen.findByRole('button',{name:'Connect Trimble TruckMate'}));
 assert.ok(screen.getByRole('dialog',{name:'Connect Trimble TruckMate'}));assert.ok(screen.getByLabelText('API key'));assert.equal(screen.queryByRole('button',{name:'Request setup'}),null);
});


test('administrator-paused connections cannot be reconnected or synchronized from the dispatcher card',async()=>{
 connectors.list=async()=>[{...rows[0],ready:true,status:'PAUSED',paused:true,version:3,message:'Synchronization is paused by the administrator.'}];
 mount(<ConnectorsTab slug="acme" />);
 const button=await screen.findByRole('button',{name:'Rose Rocket synchronization paused'});
 assert.equal((button as HTMLButtonElement).disabled,true);
 assert.ok(screen.getByText('Synchronization is paused by the administrator.'));
});

const tmsLabel='Use Dispatra TMS';
test('connector popups use only the header X and retain the pending connection lock',async()=>{
 let closed=0,saved=0;
 let finish:(value:Awaited<ReturnType<typeof connectors.connect>>)=>void=()=>{};
 const row={...rows[0],ready:true,status:'NOT_CONNECTED' as const};
 connectors.connect=()=>new Promise(resolve=>{finish=resolve;});
 const user=mount(<ConnectorDialog slug="acme" connector={row} onSaved={()=>saved++} onClose={()=>closed++} />);
 const close=screen.getByRole('button',{name:'Close dialog'});
 assert.equal(close.textContent,'');assert.ok(close.querySelector('svg'));
 assert.equal(screen.queryByRole('button',{name:'Close'}),null);
 await user.click(screen.getByRole('button',{name:'Continue to Rose Rocket'}));
 assert.equal((close as HTMLButtonElement).disabled,true);
 await user.click(close);await user.keyboard('{Escape}');assert.equal(closed,0);
 await act(async()=>finish({connector:{...row,status:'CONNECTED'},authorization_url:null}));
 assert.equal(saved,1);assert.equal(closed,1);
});
test('unavailable connector shows a disabled test action and its X dismisses it',async()=>{
 let closed=0;const user=mount(<ConnectorDialog slug="acme" connector={rows[0]} onSaved={()=>{}} onClose={()=>closed++} />);
 assert.equal((screen.getByRole('button',{name:'Test connection'}) as HTMLButtonElement).disabled,true);
 await user.click(screen.getByRole('button',{name:'Close dialog'}));assert.equal(closed,1);
});
const dispatcher={id:'dispatcher-1',role:'DISPATCHER',login_id:'dispatcher@example.com',display_name:'Dispatcher',tms_workspace:false,organization:{id:'company-1',slug:'acme',name:'Acme',active:true}} as Account;
function savedSettings(checked:boolean):SettingsView {
 return {id:'settings-1',version:5,created_at:'2026-10-14T00:00:00Z',data:{company_name:'Acme',tms_workspace:checked,contact_name:'Dispatcher',email:'dispatcher@example.com',phone:'6045550188',address:'Saved company address',logo_url:'',currency:'CAD',time_zone:'America/Vancouver',weight_unit:'kg',dimension_unit:'cm',distance_unit:'km',tax_registration_number:'',gst_enabled:true,gst_percent:'5',provincial_enabled:false,provincial_percent:'0',fuel_enabled:true,fuel_percent:'28.5',maximum_active_orders:3,quote_validity_days:14,dispatch_mode:'AUTO',default_service_id:null}};
}
function WorkspacePreferences(){
 const workspace=useWorkspaceAccount()!;
 const presentation=useWorkspaceTransition()!;
 return <><Sidebar tmsWorkspace={!presentation.displayedMode} activeTab="integrations" isOpen onToggle={()=>{}} setActiveTab={()=>{}}
 showAccountPopover={false} setShowAccountPopover={()=>{}} onActionNotification={()=>{}} dispatchMode={workspace.settings.data.dispatch_mode} onDispatchModeChange={()=>{}} />
 <IntegrationsPage /></>;
}
test('Dispatra checkbox reflects saved TMS preference and saves both choices without changing Auto dispatch',async()=>{
 let server=savedSettings(true);api.companySettings=async()=>server;connectors.list=async()=>rows.map(row=>row.auth==='oauth'?{...row,ready:true,status:'NOT_CONNECTED'}:row);
 const writes:Parameters<typeof api.saveCompanySettings>[1][]=[];
 api.saveCompanySettings=async(slug,body)=>{assert.equal(slug,'acme');writes.push(body);server={...server,version:body.version+1,data:body.data as SettingsView['data']};return server;};
 const user=mount(<WorkspaceAccount account={dispatcher}><WorkspacePreferences /></WorkspaceAccount>);
 cache.setQueryDefaults(['account'],{gcTime:Infinity});cache.setQueryData(['account'],dispatcher);
 const checkbox=await screen.findByRole('checkbox',{name:tmsLabel}) as HTMLInputElement;
 assert.equal(checkbox.checked,false);
 assert.equal(screen.queryByText('External TMS workspace'),null);
 const externalCard=await screen.findByRole('article',{name:'Rose Rocket'});
 const externalView=externalCard.closest('.integration-mode-view')!;
 const dispatraCard=screen.getByRole('article',{name:'Dispatra'});
 assert.equal(screen.queryByRole('region',{name:'Dispatra workspace'}),null);
 assert.deepEqual(within(screen.getByRole('navigation')).getAllByRole('button').map(e=>e.textContent),['Profile','Help']);
 assert.equal(screen.getByRole('switch',{name:'Auto dispatch'}).getAttribute('aria-checked'),'true');
 const surface=document.querySelector('.workspace-transition-surface')!;
 assert.ok(surface.contains(screen.getByRole('navigation')));
 assert.ok(surface.contains(document.querySelector('.integration-workspace')));
 await user.click(checkbox);await waitFor(()=>assert.equal(checkbox.checked,true));
 const loader=await screen.findByRole('status',{name:'Switching workspace'});
 assert.equal(loader.querySelectorAll('.workspace-loading-dot').length,3);
 assert.ok(Array.from(loader.querySelectorAll('.workspace-loading-dot')).every(dot=>dot.classList.contains('size-2')));
 assert.equal(loader.querySelector('svg'),null);
 await settledWorkspace('dispatra');
 assert.equal(surface.hasAttribute('inert'),false);
 assert.ok(screen.getByRole('region',{name:'Connectors'}));
 assert.ok(screen.getByText('Dispatra workspace'));
 assert.ok(screen.getByRole('heading',{name:'Manage operations in Dispatra.'}));
 assert.equal(screen.getByRole('article',{name:'Dispatra'}),dispatraCard);
 assert.equal(screen.getByRole('checkbox',{name:tmsLabel}),checkbox);
 assert.equal(externalView.getAttribute('data-active'),'false');
 assert.ok(externalView.hasAttribute('inert'));
 assert.ok(screen.getByRole('button',{name:'Dispatcher Account'}));assert.equal(screen.queryByRole('button',{name:'Log out'}),null);
 assert.deepEqual(screen.getAllByRole('article').map(e=>e.getAttribute('aria-label')),['Dispatra']);
 assert.equal(screen.queryByRole('tablist',{name:'Integration sections'}),null);
 assert.equal(screen.queryAllByRole('tab').length,0);
 await waitFor(()=>assert.equal(document.activeElement,checkbox));
 assert.equal(screen.queryByRole('tabpanel',{name:'Dispatra API'}),null);
 assert.equal(screen.getByRole('switch',{name:'Auto dispatch'}).getAttribute('aria-checked'),'true');
 assert.deepEqual(writes[0],{version:5,data:{...savedSettings(true).data,tms_workspace:false}});
 await user.click(checkbox);await waitFor(()=>assert.equal(checkbox.checked,false));
 await settledWorkspace('external');
 assert.equal(screen.queryByText('External TMS workspace'),null);
 assert.ok(screen.getByRole('heading',{name:'Connect your existing TMS.'}));
 assert.equal(screen.queryByRole('region',{name:'Dispatra workspace'}),null);
 assert.equal(screen.getByRole('article',{name:'Rose Rocket'}),externalCard);
 assert.equal(externalView.hasAttribute('inert'),false);
 assert.equal(screen.queryByRole('button',{name:'Log out'}),null);assert.ok(screen.getByRole('button',{name:'Dispatcher Account'}));
 await screen.findByRole('article',{name:'Rose Rocket'});assert.equal(screen.getAllByRole('article').length,7);
 assert.deepEqual(screen.getAllByRole('tab').map(e=>e.textContent),['Connectors','TMS API','Dispatra API']);
 assert.equal(writes[1].version,6);assert.equal(writes[1].data.dispatch_mode,'AUTO');
 assert.equal(cache.getQueryData<Account>(['account'])?.tms_workspace,true);
});
test('failed TMS preference saves retain the checked Dispatra state and retry the same operation',async()=>{
 const server=savedSettings(false);api.companySettings=async()=>server;connectors.list=async()=>rows;
 const keys:string[]=[];let finish:(value:SettingsView)=>void=()=>{};
 api.saveCompanySettings=async(_slug,body,key)=>{keys.push(key);if(keys.length===1)throw Error('Settings changed. Try again.');return new Promise(resolve=>{finish=resolve;});};
 const user=mount(<WorkspaceAccount account={dispatcher}><WorkspacePreferences /></WorkspaceAccount>);
 const checkbox=await screen.findByRole('checkbox',{name:tmsLabel}) as HTMLInputElement;assert.equal(checkbox.checked,true);
 assert.equal(screen.queryByRole('tab',{name:'Dispatra API'}),null);
 await user.click(checkbox);await screen.findByRole('alert');assert.equal(checkbox.checked,true);assert.ok(screen.getByRole('button',{name:'Dispatcher Account'}));
 assert.ok(screen.getByText('Dispatra workspace'));
 assert.equal(screen.queryByRole('tab',{name:'Dispatra API'}),null);
 await user.click(checkbox);await waitFor(()=>assert.equal(checkbox.disabled,true));assert.equal(keys[0],keys[1]);
 assert.ok(screen.getByText('Dispatra workspace'),'the layout must not switch before its preference is saved');
 assert.ok(screen.getByText('Switching workspace…'));
 finish({...server,version:6,data:{...server.data,tms_workspace:true}});
 await waitFor(()=>assert.equal(checkbox.checked,false));assert.equal(checkbox.disabled,false);
 await settledWorkspace('external');
 assert.equal(screen.queryByText('External TMS workspace'),null);
 assert.equal(screen.queryByText('Switching workspace…'),null);
});

const {Tabs}=await import('../src/components/ui/Tabs');
const {useWorkspaceModeTransition}=await import('../src/components/integrations/connectors/useWorkspaceModeTransition');
function TransitionProbe({native}:{native:boolean}){
 const {displayedMode,phase}=useWorkspaceModeTransition(native);
 return <output data-testid="transition" data-phase={phase}>{String(displayedMode)}</output>;
}
function ShellProbe(){
 const presentation=useWorkspaceTransition()!;
 return <><nav data-testid="mode-menu">{presentation.displayedMode?'Dispatra menu':'External menu'}</nav><main data-testid="mode-page">{presentation.displayedMode?'Dispatra page':'External page'}</main></>;
}
test('the shared transition contains the sidebar and page, and swaps both only while hidden',()=>{
 const originalTimeout=window.setTimeout,originalClear=window.clearTimeout;
 const timers=new Map<number,()=>void>();
 window.setTimeout=((callback:()=>void,delay:number)=>{timers.set(delay,callback);return delay;}) as typeof window.setTimeout;
 window.clearTimeout=((identity:number)=>{timers.delete(identity);}) as typeof window.clearTimeout;
 try{
  const view=render(<WorkspaceTransition nativeTms={false}><ShellProbe /></WorkspaceTransition>);
  const menu=screen.getByTestId('mode-menu'),page=screen.getByTestId('mode-page');
  const surface=menu.closest('.workspace-transition-surface')!;
  assert.ok(surface.contains(page));
  view.rerender(<WorkspaceTransition nativeTms><ShellProbe /></WorkspaceTransition>);
  assert.equal(surface.getAttribute('data-transition'),'out');assert.ok(surface.hasAttribute('inert'));
  assert.equal(menu.textContent,'External menu');assert.equal(page.textContent,'External page');
  act(()=>timers.get(180)!());
  const loader=screen.getByRole('status',{name:'Switching workspace'});
  assert.equal(surface.contains(loader),false);
  assert.equal(menu.textContent,'External menu');
  act(()=>timers.get(780)!());
  assert.equal(menu.textContent,'Dispatra menu');assert.equal(page.textContent,'Dispatra page');
  act(()=>timers.get(1000)!());assert.equal(surface.hasAttribute('inert'),false);
  view.unmount();assert.equal(timers.size,0);
 }finally{window.setTimeout=originalTimeout;window.clearTimeout=originalClear;}
});

test('the transition fades out, holds the old layout for the loader, then reveals the new layout',()=>{
 const originalTimeout=window.setTimeout,originalClear=window.clearTimeout;
 const timers=new Map<number,()=>void>();
 window.setTimeout=((callback:()=>void,delay:number)=>{timers.set(delay,callback);return delay;}) as typeof window.setTimeout;
 window.clearTimeout=((identity:number)=>{timers.delete(identity);}) as typeof window.clearTimeout;
 try{
  const view=render(<TransitionProbe native={false} />);
  view.rerender(<TransitionProbe native />);
  const output=screen.getByTestId('transition');
  assert.equal(output.getAttribute('data-phase'),'out');assert.equal(output.textContent,'false');
  act(()=>timers.get(180)!());
  assert.equal(output.getAttribute('data-phase'),'loading');assert.equal(output.textContent,'false');
  act(()=>timers.get(780)!());
  assert.equal(output.getAttribute('data-phase'),'in');assert.equal(output.textContent,'true');
  act(()=>timers.get(1000)!());assert.equal(output.getAttribute('data-phase'),'idle');
  view.unmount();assert.equal(timers.size,0);
 }finally{window.setTimeout=originalTimeout;window.clearTimeout=originalClear;}
});
test('reversing a requested mode cancels pending phase timers instead of revealing stale content',async()=>{
 const view=render(<TransitionProbe native={false} />);
 view.rerender(<TransitionProbe native />);
 assert.equal(screen.getByTestId('transition').getAttribute('data-phase'),'out');
 view.rerender(<TransitionProbe native={false} />);
 assert.equal(screen.getByTestId('transition').getAttribute('data-phase'),'idle');
 await act(async()=>{await new Promise(resolve=>window.setTimeout(resolve,800));});
 assert.equal(screen.getByTestId('transition').textContent,'false');
 assert.equal(screen.getByTestId('transition').getAttribute('data-phase'),'idle');
});

test('hiding the complete tab bar exposes a labelled region and preserves its draft',async()=>{
 const items=[{id:'connectors',label:'Connectors',content:<input aria-label="Workspace draft" defaultValue="" />}];
 const user=userEvent.setup({document});const view=render(<Tabs label="Integration sections" items={items} />);
 await user.type(screen.getByLabelText('Workspace draft'),'keep this draft');
 view.rerender(<Tabs label="Integration sections" items={items} hideTabList />);
 assert.equal(screen.queryByRole('tablist'),null);assert.equal(screen.queryAllByRole('tab').length,0);
 assert.ok(screen.getByRole('region',{name:'Connectors'}));
 assert.equal((screen.getByLabelText('Workspace draft') as HTMLInputElement).value,'keep this draft');
 view.rerender(<Tabs label="Integration sections" items={items} />);
 assert.ok(screen.getByRole('tab',{name:'Connectors'}));
 assert.equal((screen.getByLabelText('Workspace draft') as HTMLInputElement).value,'keep this draft');
});

test('reduced motion switches workspace without a loading pause or spinner',async()=>{
 reducedMotion=true;
 let server=savedSettings(false);api.companySettings=async()=>server;connectors.list=async()=>rows;
 api.saveCompanySettings=async(_slug,body)=>{server={...server,version:body.version+1,data:body.data as SettingsView['data']};return server;};
 const user=mount(<WorkspaceAccount account={dispatcher}><IntegrationsPage /></WorkspaceAccount>);
 const checkbox=await screen.findByRole('checkbox',{name:tmsLabel});
 assert.equal(screen.queryAllByRole('tab').length,0);
 await user.click(checkbox);await settledWorkspace('external');
 assert.equal(screen.queryByRole('status',{name:'Switching workspace'}),null);
 assert.deepEqual(screen.getAllByRole('tab').map(tab=>tab.textContent),['Connectors','TMS API','Dispatra API']);
});

test('removing the selected TMS tab falls back to an available tab without a blank panel',async()=>{
 const items=[{id:'connectors',label:'Connectors',content:<p>Connector selection</p>},{id:'tms',label:'TMS API',content:<p>TMS form</p>}];
 const view=render(<Tabs label="Integration sections" items={items} initialActiveId="tms" />);
 assert.equal(screen.getByRole('tab',{name:'TMS API'}).getAttribute('aria-selected'),'true');
 view.rerender(<Tabs label="Integration sections" items={items.slice(0,1)} />);
 assert.equal(screen.getByRole('tab',{name:'Connectors'}).getAttribute('aria-selected'),'true');
 assert.ok(screen.getByRole('tabpanel',{name:'Connectors'}));
 view.rerender(<Tabs label="Integration sections" items={items} />);
 assert.equal(screen.getByRole('tab',{name:'Connectors'}).getAttribute('aria-selected'),'true');
});

for(const label of ['TMS API','Dispatra API'])test(`hiding ${label} keeps its mounted draft while removing its visible tab and panel`,async()=>{
 const items=[{id:'connectors',label:'Connectors',content:<p>Connector selection</p>},{id:'api',label,content:<input aria-label="API draft" defaultValue="" />}];
 const user=userEvent.setup({document});const view=render(<Tabs label="Integration sections" items={items} initialActiveId="api" />);
 await user.type(screen.getByLabelText('API draft'),'unsaved endpoint');
 view.rerender(<Tabs label="Integration sections" items={[items[0],{...items[1],hidden:true}]} />);
 assert.equal(screen.queryByRole('tab',{name:label}),null);assert.equal(screen.queryByRole('tabpanel',{name:label}),null);
 assert.equal(screen.getByRole('tab',{name:'Connectors'}).getAttribute('aria-selected'),'true');
 view.rerender(<Tabs label="Integration sections" items={items} />);await user.click(screen.getByRole('tab',{name:label}));
 assert.equal((screen.getByLabelText('API draft') as HTMLInputElement).value,'unsaved endpoint');
});

test('sidebar account uses Profile name and company logo, follows saved settings and keeps the Settings gear', async () => {
 const {saveUserProfile,loadUserProfile}=await import('../src/lib/profileStorage');
 saveUserProfile({...loadUserProfile(),name:'Stale Local User',avatarUrl:'/user-avatar.png'});
 api.companySettings=async()=>({...savedSettings(false),data:{...savedSettings(false).data,company_name:'Demo',contact_name:'  John Smith  ',logo_url:'/company-logo.png'}});
 const account={...dispatcher,display_name:'Stale Session Name'};
 function AccountSidebar(){
  const [open,setOpen]=React.useState(false);
  return <Sidebar activeTab="monitor" isOpen onToggle={()=>{}} setActiveTab={()=>{}} showAccountPopover={open}
   setShowAccountPopover={setOpen} onActionNotification={()=>{}} onOpenPricing={()=>{}} dispatchMode="AUTO" onDispatchModeChange={()=>{}} />;
 }
 const user=mount(<WorkspaceAccount account={account}><AccountSidebar /></WorkspaceAccount>);
 const card=await screen.findByRole('button',{name:'Dispatcher Account'});
 assert.equal(card.querySelector('.app-account-name')?.textContent?.trim(),'John');
 assert.ok(within(card).getByText('Demo',{exact:true}));
 assert.equal(card.querySelector('img')?.getAttribute('src'),'/company-logo.png');
 assert.equal(card.querySelector('img')?.getAttribute('alt'),'Demo logo');
 assert.equal(within(card).queryByText('Dispatcher',{exact:true}),null);
 act(()=>saveUserProfile({...loadUserProfile(),avatarUrl:'/updated-avatar.png'}));
 assert.equal(card.querySelector('img')?.getAttribute('src'),'/company-logo.png');
 act(()=>cache.setQueryData(['company-settings','acme'],{...savedSettings(false),data:{...savedSettings(false).data,company_name:'Demo',logo_url:'/updated-company-logo.png'}}));
 await waitFor(()=>assert.equal(card.querySelector('img')?.getAttribute('src'),'/updated-company-logo.png'));
 assert.ok(card.querySelector('img')?.classList.contains('object-contain'));
 act(()=>cache.setQueryData(['company-settings','acme'],{...savedSettings(false),data:{...savedSettings(false).data,company_name:'Demo',logo_url:''}}));
 await waitFor(()=>assert.equal(card.querySelector('img'),null));
 assert.ok(within(card).getByText('D',{exact:true}));
 act(()=>cache.setQueryData(['company-settings','acme'],{...savedSettings(false),data:{...savedSettings(false).data,company_name:'Updated Company'}}));
 await waitFor(()=>assert.ok(within(card).getByText('Updated Company',{exact:true})));
 await user.click(card);
 const settings=screen.getByRole('menuitem',{name:'Settings'});
 assert.ok(settings.querySelector('svg.lucide-settings'));
 assert.equal(settings.querySelector('svg.lucide-file-text'),null);
 await user.keyboard('{Escape}');
 assert.equal(document.activeElement,card);
});


test('prototype sidebar follows saved company logo changes and removal without navigation', async () => {
 const {loadBillingConfig,saveBillingConfig}=await import('../src/lib/billingStorage');
 const {loadUserProfile,saveUserProfile}=await import('../src/lib/profileStorage');
 saveUserProfile({...loadUserProfile(),name:'John Smith',avatarUrl:'/personal-avatar.png'});
 const config=loadBillingConfig();
 saveBillingConfig({...config,company:{...config.company,name:'Demo',logoDataUrl:'/demo-logo.png'}});
 mount(<Sidebar activeTab="profile" isOpen onToggle={()=>{}} setActiveTab={()=>{}} showAccountPopover={false}
  setShowAccountPopover={()=>{}} onActionNotification={()=>{}} dispatchMode="AUTO" onDispatchModeChange={()=>{}} />);
 const card=screen.getByRole('button',{name:'Dispatcher Account'});
 assert.equal(card.querySelector('img')?.getAttribute('src'),'/demo-logo.png');
 act(()=>saveBillingConfig({...config,company:{...config.company,name:'New Company',logoDataUrl:'/new-company-logo.png'}}));
 assert.equal(card.querySelector('img')?.getAttribute('src'),'/new-company-logo.png');
 assert.equal(card.querySelector('img')?.getAttribute('alt'),'New Company logo');
 assert.ok(within(card).getByText('John',{exact:true}));
 assert.ok(within(card).getByText('New Company',{exact:true}));
 act(()=>saveBillingConfig({...config,company:{...config.company,name:'New Company',logoDataUrl:''}}));
 assert.equal(card.querySelector('img'),null);
 assert.ok(within(card).getByText('N',{exact:true}));
});

test('saving Profile contact name and company logo updates the mounted authenticated sidebar', async () => {
 const {CompanyProfilePage}=await import('../src/portal/CompanyProfilePage');
 Object.defineProperty(globalThis,'FileReader',{configurable:true,value:dom.window.FileReader});
 let saved={...savedSettings(false),data:{...savedSettings(false).data,company_name:'Demo',contact_name:'John Smith',logo_url:''}};
 api.companySettings=async()=>saved;
 api.saveCompanySettings=async(_slug,body)=>{saved={...saved,version:saved.version+1,data:{...body.data,gst_percent:String(body.data.gst_percent),provincial_percent:String(body.data.provincial_percent),fuel_percent:String(body.data.fuel_percent)}};return saved;};
 const user=mount(<WorkspaceAccount account={{...dispatcher,display_name:'John Smith'}}>
  <Sidebar activeTab="profile" isOpen onToggle={()=>{}} setActiveTab={()=>{}} showAccountPopover={false}
   setShowAccountPopover={()=>{}} onActionNotification={()=>{}} dispatchMode="AUTO" onDispatchModeChange={()=>{}} />
  <CompanyProfilePage />
 </WorkspaceAccount>);
 const card=await screen.findByRole('button',{name:'Dispatcher Account'});
 const png=new dom.window.File([Uint8Array.from([137,80,78,71])],'company.png',{type:'image/png'});
 await user.upload(document.querySelector('input[type=file]') as HTMLInputElement,png);
 await screen.findByRole('button',{name:'Change company logo'});
 assert.equal(card.querySelector('img'),null,'Unsaved draft must not replace the saved logo.');
 await user.clear(screen.getByLabelText('Full Name'));
 await user.type(screen.getByLabelText('Full Name'),'Jane Brown');
 assert.equal(card.querySelector('.app-account-name')?.textContent?.trim(),'John');
 await user.click(screen.getByRole('button',{name:'Save Company'}));
 await waitFor(()=>assert.ok(card.querySelector('img')?.getAttribute('src')?.startsWith('data:image/png;base64,')));
 assert.equal(card.querySelector('img')?.getAttribute('src'),saved.data.logo_url);
 assert.equal(card.querySelector('.app-account-name')?.textContent?.trim(),'Jane');
 await user.click(screen.getByRole('button',{name:'Remove company logo'}));
 assert.ok(card.querySelector('img'),'Removal is still an unsaved draft.');
 await user.click(screen.getByRole('button',{name:'Save Company'}));
 await waitFor(()=>assert.equal(card.querySelector('img'),null));
 assert.ok(within(card).getByText('D',{exact:true}));
 assert.equal(saved.data.logo_url,'');
});


test('an unverified credential response keeps the dialog open with an error',async()=>{
 const row={...rows[0],ready:true,auth:'bearer' as const,credential_fields:[{key:'api_key',label:'Token',secret:true}]};
 let saved=0,closed=0;connectors.connect=async()=>({connector:{...row,status:'CONNECTING'},authorization_url:null});
 const user=mount(<ConnectorDialog slug="acme" connector={row} onSaved={()=>saved++} onClose={()=>closed++}/>);
 await user.type(screen.getByLabelText('Token'),'private-token');await user.click(screen.getByRole('button',{name:'Test connection & connect'}));
 assert.ok(await screen.findByRole('alert'));assert.equal(saved,0);assert.equal(closed,0);
});

test('unconfigured CartonCloud shows its credential fields without claiming a working connection',()=>{
 const row={...rows[1],credential_fields:[{key:'base_url',label:'CartonCloud API URL',secret:false},{key:'tenant',label:'CartonCloud Tenant ID',secret:false},{key:'client_id',label:'CartonCloud Client ID',secret:false},{key:'client_secret',label:'CartonCloud Client Secret',secret:true}]};
 mount(<ConnectorDialog slug="acme" connector={row} onSaved={()=>{}} onClose={()=>{}}/>);
 assert.equal((screen.getByLabelText('CartonCloud API URL') as HTMLInputElement).value,'https://api.cartoncloud.com');
 assert.ok(screen.getByLabelText('CartonCloud Tenant ID'));assert.ok(screen.getByLabelText('CartonCloud Client ID'));assert.ok(screen.getByLabelText('CartonCloud Client Secret'));
 assert.ok(screen.getByText(/Connection testing is unavailable/));assert.equal((screen.getByRole('button',{name:'Test connection'}) as HTMLButtonElement).disabled,true);
});

test('Samsara tests a token without saving, then connects after verification and clears secrets',async()=>{
 const row={...rows[5],auth:'bearer' as const,ready:true,status:'NOT_CONNECTED' as const,credential_fields:[{key:'api_key',label:'Samsara API token',secret:true}]};
 let tested=0,connected=0,saved=0,closed=0;
 connectors.test=async(_slug,provider,body)=>{assert.equal(provider,'samsara');assert.deepEqual(body.credentials,{api_key:'private-token'});tested++;return {account_id:'fleet-1',account:'Test Fleet'};};
 connectors.connect=async(_slug,provider,body)=>{assert.equal(provider,'samsara');assert.deepEqual(body.credentials,{api_key:'private-token'});connected++;return {connector:{...row,status:'CONNECTED',account:'Test Fleet'},authorization_url:null};};
 const user=mount(<ConnectorDialog slug="acme" connector={row} onSaved={()=>saved++} onClose={()=>closed++}/>);
 assert.equal(screen.queryByLabelText('Samsara API URL'),null);
 const save=screen.getByRole('button',{name:/^Connect$/});assert.equal((save as HTMLButtonElement).disabled,true);
 await user.type(screen.getByLabelText('Samsara API token'),'private-token');await user.click(screen.getByRole('button',{name:/^Test connection$/}));
 await screen.findByText(/Token verified for Test Fleet/);assert.equal(tested,1);assert.equal(connected,0);assert.equal(saved,0);
 await user.click(save);await waitFor(()=>assert.equal(saved,1));assert.equal(connected,1);assert.equal(closed,1);
 assert.equal(localStorage.length,0);assert.ok(!JSON.stringify(cache.getQueryCache().getAll()).includes('private-token'));
});

test('editing a verified Samsara token requires a new test and rejection never enables Connect',async()=>{
 const row={...rows[5],auth:'bearer' as const,ready:true,credential_fields:[{key:'api_key',label:'Samsara API token',secret:true}]};
 let attempts=0;connectors.test=async()=>{attempts++;if(attempts>1)throw Error('Samsara rejected this token.');return {account_id:'fleet-1',account:'Test Fleet'};};
 const user=mount(<ConnectorDialog slug="acme" connector={row} onSaved={()=>{throw Error('Must not save');}} onClose={()=>{}}/>);
 await user.type(screen.getByLabelText('Samsara API token'),'token-one');await user.click(screen.getByRole('button',{name:/^Test connection$/}));await screen.findByText(/Token verified/);
 await user.type(screen.getByLabelText('Samsara API token'),'changed');assert.equal(screen.queryByText(/Token verified/),null);
 const save=screen.getByRole('button',{name:/^Connect$/});assert.equal((save as HTMLButtonElement).disabled,true);
 await user.click(screen.getByRole('button',{name:/^Test connection$/}));assert.ok(await screen.findByRole('alert'));assert.equal((save as HTMLButtonElement).disabled,true);
});
