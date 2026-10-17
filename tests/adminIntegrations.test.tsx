import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
import {afterEach,test} from 'node:test';
import React from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/admin/integrations',pretendToBeVisual:true});
for(const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','NodeFilter','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage','location','history'])Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name as keyof Window]});
window.scrollTo=()=>{};HTMLElement.prototype.scrollIntoView=()=>{};
const {render,screen,cleanup,within,waitFor}=await import('@testing-library/react');
const {default:userEvent}=await import('@testing-library/user-event');
const {AdminPortal}=await import('../src/portal/admin/AdminPortal');
const {AdminIntegrationsPage}=await import('../src/portal/admin/AdminIntegrationsPage');
const {ConfirmDialogHost}=await import('../src/components/ui/ConfirmDialog');
const {integrationAdmin}=await import('../src/integrations/admin');
const {api}=await import('../src/portal/api');
const {adminRoute}=await import('../src/portal/admin/adminRoutes');
import type {Provider} from '../src/integrations/admin';
const original={...integrationAdmin};const originalApi={...api};let cache:QueryClient;
const makeProviders=():Provider[]=>[
 ['rose-rocket','Rose Rocket','RR'],['cartoncloud','CartonCloud','CC'],['truckbase','Truckbase','TB'],['tailwind','Tailwind TMS','TW'],['ascendtms','AscendTMS','AT']
].map(([id,name,initials],i)=>({id,name,initials,connected_dispatchers:i===0?3:0}));
function defaults(){integrationAdmin.providers=async()=>makeProviders();api.agentMonitor=async()=>({agents:[],running:0,awaiting_approval:0,needs_attention:0,automatic_fixes_24h:0,errors_24h:0,issues:[],observed_at:'2026-10-16T00:00:00Z'} as never);api.platformNotifications=async()=>({items:[],unread:0});}
function mount(node:React.ReactElement){cache=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0},mutations:{retry:false}}});render(<QueryClientProvider client={cache}><ConfirmDialogHost/>{node}</QueryClientProvider>);return userEvent.setup({document});}
afterEach(()=>{cleanup();cache?.clear();Object.assign(integrationAdmin,original);Object.assign(api,originalApi);localStorage.clear();history.replaceState(null,'','/admin/integrations');});

test('admin Integrations is a simple page without company integration routes',()=>{
 assert.deepEqual(adminRoute('/admin/integrations'),{page:'integrations'});
 assert.equal(adminRoute('/admin/integrations/extra'),null);
 assert.equal(adminRoute('/admin/companies/11111111-1111-4111-8111-111111111111/integrations'),null);
});

test('owner connector cards show counts without tabs, setup requests or management actions',async()=>{
 defaults();mount(<AdminPortal account={{id:'owner',role:'ADMIN',login_id:'owner'} as never} onLogout={()=>{}} loggingOut={false} logoutError={null}/>);
 assert.ok(screen.getByRole('link',{name:'Integrations'}));await screen.findByRole('article',{name:'Rose Rocket'});
 assert.equal(screen.getAllByRole('article').length,5);
 const card=screen.getByRole('article',{name:'Rose Rocket'});assert.ok(within(card).getByText('Connected dispatchers'));assert.ok(within(card).getByText('3'));
 assert.equal(screen.queryByRole('tab'),null);assert.equal(within(card).queryByRole('button'),null);
 assert.equal(screen.queryByText(/setup requests|Preparation pending|Vendor access/i),null);
});

test('connector cards support read retry and an honest empty state',async()=>{
 defaults();let fail=true;integrationAdmin.providers=async()=>{if(fail)throw Error('Connectors unavailable.');return [];};
 const user=mount(<AdminIntegrationsPage/>);await screen.findByRole('alert');fail=false;
 await user.click(screen.getByRole('button',{name:'Try again'}));await screen.findByText('No connectors listed yet.');
 assert.equal(screen.queryByRole('article'),null);assert.equal(screen.queryByRole('tab'),null);
});
