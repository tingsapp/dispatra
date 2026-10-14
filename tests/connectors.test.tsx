import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost/acme/integrations',pretendToBeVisual:true});
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','NodeFilter','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage','location','history']) Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name as keyof Window]});
HTMLElement.prototype.scrollIntoView=()=>{};
const {render,screen,cleanup,within,waitFor}=await import('@testing-library/react');
const {default:userEvent}=await import('@testing-library/user-event');
const {connectors}=await import('../src/integrations/connectors');
const {operations}=await import('../src/operations/api');
const {IntegrationsPage}=await import('../src/pages/IntegrationsPage');
const {ConnectorDialog}=await import('../src/components/integrations/connectors/ConnectorDialog');
const {ConnectorsTab}=await import('../src/components/integrations/connectors/ConnectorsTab');
const {ConfirmDialogHost}=await import('../src/components/ui/ConfirmDialog');
const {api}=await import('../src/portal/api');
const {WorkspaceAccount,useWorkspaceAccount}=await import('../src/portal/WorkspaceAccount');
const {Sidebar}=await import('../src/components/Sidebar');
import type {Account} from '../src/portal/api';
import type {SettingsView} from '../src/portal/WorkspaceAccount';
const originalApi={companySettings:api.companySettings,saveCompanySettings:api.saveCompanySettings};
import type {Connector} from '../src/integrations/connectors';
const original={...connectors};let cache:QueryClient;
const rows=[['rose-rocket','Rose Rocket','RR','oauth'],['cartoncloud','CartonCloud','CC','oauth'],['truckmate','Trimble TruckMate','TM','bearer'],['mcleod','McLeod','MC','api_key'],['aljex','Descartes Aljex','DA','session'],['turvo','Turvo','TU','client_credentials']].map(([id,name,initials,auth])=>({id,name,initials,auth,description:'Connect your transport workspace.',ready:false,status:'ACTIVATION_REQUIRED',credential_fields:[],version:null,account:null,last_sync_at:null,imported:0,review_count:0,message:'Activation required.'} as Connector));
function mount(node:React.ReactElement){cache=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});render(<QueryClientProvider client={cache}><ConfirmDialogHost />{node}</QueryClientProvider>);return userEvent.setup({document});}
afterEach(()=>{cleanup();cache?.clear();Object.assign(connectors,original);Object.assign(api,originalApi);localStorage.clear();});after(()=>dom.window.close());

test('Connectors is the first default tab with Dispatra before six TMS cards; existing tabs still open their original forms',async()=>{
 connectors.list=async()=>rows;operations.tms=async()=>null;operations.apiKey=async()=>({configured:false,prefix:null,created_at:null,last_used_at:null});operations.apiWebhook=async()=>null;
 const user=mount(<IntegrationsPage />);
 assert.deepEqual(screen.getAllByRole('tab').map(t=>t.textContent),['Connectors','TMS API','Dispatra API']);
 assert.equal(screen.getByRole('tab',{name:'Connectors'}).getAttribute('aria-selected'),'true');
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

test('unactivated Connect opens an honest explanation without credentials, mapping or a simulated connection',async()=>{
 connectors.list=async()=>rows;let connects=0;connectors.connect=async()=>{connects++;throw Error('Must not connect');};
 const user=mount(<ConnectorsTab slug="acme" />);const card=await screen.findByRole('article',{name:'Rose Rocket'});
 const trigger=within(card).getByRole('button',{name:'Connect Rose Rocket'});await user.click(trigger);
 const dialog=screen.getByRole('dialog',{name:'Connect Rose Rocket'});
 assert.ok(within(dialog).getByText(/needs activation by Dispatra/));assert.equal(within(dialog).queryByRole('textbox'),null);
 await user.keyboard('{Escape}');assert.equal(screen.queryByRole('dialog'),null);assert.equal(document.activeElement,trigger);assert.equal(connects,0);
});

test('credential retries retain one key while secrets never enter browser storage or query cache',async()=>{
 const row={...rows[2],ready:true,status:'NOT_CONNECTED' as const,credential_fields:[{key:'api_key',label:'TruckMate API key',secret:true}]};
 const inputs:{key:string;secret:string}[]=[];let saved=0;
 connectors.connect=async(_slug,_provider,body,key)=>{inputs.push({key,secret:body.credentials!.api_key});if(inputs.length===1)throw Error('Temporary connection error.');return {connector:{...row,status:'CONNECTING'},authorization_url:null};};
 const user=mount(<ConnectorDialog slug="acme" connector={row} onSaved={()=>saved++} onClose={()=>{}} />);
 await user.type(screen.getByLabelText('TruckMate API key'),'private-test-key');await user.click(screen.getByRole('button',{name:'Connect'}));
 await screen.findByRole('alert');await user.click(screen.getByRole('button',{name:'Connect'}));await waitFor(()=>assert.equal(saved,1));
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

const tmsLabel='Use Dispatra TMS';
const dispatcher={id:'dispatcher-1',role:'DISPATCHER',login_id:'dispatcher@example.com',display_name:'Dispatcher',tms_workspace:false,organization:{id:'company-1',slug:'acme',name:'Acme',active:true}} as Account;
function savedSettings(checked:boolean):SettingsView {
 return {id:'settings-1',version:5,created_at:'2026-10-14T00:00:00Z',data:{company_name:'Acme',tms_workspace:checked,contact_name:'Dispatcher',email:'dispatcher@example.com',phone:'6045550188',address:'Saved company address',logo_url:'',currency:'CAD',time_zone:'America/Vancouver',weight_unit:'kg',dimension_unit:'cm',distance_unit:'km',tax_registration_number:'',gst_enabled:true,gst_percent:'5',provincial_enabled:false,provincial_percent:'0',fuel_enabled:true,fuel_percent:'28.5',maximum_active_orders:3,quote_validity_days:14,dispatch_mode:'AUTO',default_service_id:null}};
}
function WorkspacePreferences(){
 const workspace=useWorkspaceAccount()!;
 return <><Sidebar tmsWorkspace={workspace.settings.data.tms_workspace} activeTab="integrations" isOpen onToggle={()=>{}} setActiveTab={()=>{}}
 showAccountPopover={false} setShowAccountPopover={()=>{}} onActionNotification={()=>{}} dispatchMode={workspace.settings.data.dispatch_mode} onDispatchModeChange={()=>{}} />
 <IntegrationsPage /></>;
}
test('Dispatra checkbox reflects saved TMS preference and saves both choices without changing Auto dispatch',async()=>{
 let server=savedSettings(true);api.companySettings=async()=>server;connectors.list=async()=>rows;
 const writes:Parameters<typeof api.saveCompanySettings>[1][]=[];
 api.saveCompanySettings=async(slug,body)=>{assert.equal(slug,'acme');writes.push(body);server={...server,version:body.version+1,data:body.data as SettingsView['data']};return server;};
 const user=mount(<WorkspaceAccount account={dispatcher}><WorkspacePreferences /></WorkspaceAccount>);
 cache.setQueryDefaults(['account'],{gcTime:Infinity});cache.setQueryData(['account'],dispatcher);
 const checkbox=await screen.findByRole('checkbox',{name:tmsLabel}) as HTMLInputElement;
 assert.equal(checkbox.checked,false);
 assert.deepEqual(within(screen.getByRole('navigation')).getAllByRole('button').map(e=>e.textContent),['Profile','Integration','Help']);
 assert.equal(screen.getByRole('switch',{name:'Auto dispatch'}).getAttribute('aria-checked'),'true');
 await user.click(checkbox);await waitFor(()=>assert.equal(checkbox.checked,true));
 assert.ok(screen.getByRole('button',{name:'Dispatcher Account'}));assert.equal(screen.queryByRole('button',{name:'Log out'}),null);
 assert.deepEqual(screen.getAllByRole('article').map(e=>e.getAttribute('aria-label')),['Dispatra']);
 assert.deepEqual(screen.getAllByRole('tab').map(e=>e.textContent),['Connectors','Dispatra API']);
 assert.equal(screen.getByRole('switch',{name:'Auto dispatch'}).getAttribute('aria-checked'),'true');
 assert.deepEqual(writes[0],{version:5,data:{...savedSettings(true).data,tms_workspace:false}});
 await user.click(checkbox);await waitFor(()=>assert.equal(checkbox.checked,false));
 assert.ok(screen.getByRole('button',{name:'Log out'}));assert.equal(screen.queryByRole('button',{name:'Dispatcher Account'}),null);
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
 await user.click(checkbox);await screen.findByRole('alert');assert.equal(checkbox.checked,true);assert.ok(screen.getByRole('button',{name:'Dispatcher Account'}));
 await user.click(checkbox);await waitFor(()=>assert.equal(checkbox.disabled,true));assert.equal(keys[0],keys[1]);
 finish({...server,version:6,data:{...server.data,tms_workspace:true}});
 await waitFor(()=>assert.equal(checkbox.checked,false));assert.equal(checkbox.disabled,false);
});

const {Tabs}=await import('../src/components/ui/Tabs');
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

test('hiding TMS API keeps its mounted draft while removing its visible tab and panel',async()=>{
 const items=[{id:'connectors',label:'Connectors',content:<p>Connector selection</p>},{id:'tms',label:'TMS API',content:<input aria-label="TMS draft" defaultValue="" />}];
 const user=userEvent.setup({document});const view=render(<Tabs label="Integration sections" items={items} initialActiveId="tms" />);
 await user.type(screen.getByLabelText('TMS draft'),'unsaved endpoint');
 view.rerender(<Tabs label="Integration sections" items={[items[0],{...items[1],hidden:true}]} />);
 assert.equal(screen.queryByRole('tab',{name:'TMS API'}),null);assert.equal(screen.queryByRole('tabpanel',{name:'TMS API'}),null);
 assert.equal(screen.getByRole('tab',{name:'Connectors'}).getAttribute('aria-selected'),'true');
 view.rerender(<Tabs label="Integration sections" items={items} />);await user.click(screen.getByRole('tab',{name:'TMS API'}));
 assert.equal((screen.getByLabelText('TMS draft') as HTMLInputElement).value,'unsaved endpoint');
});
