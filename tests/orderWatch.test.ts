import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/admin/monitor', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','NodeFilter','Event','CustomEvent','PopStateEvent','MutationObserver','getComputedStyle','location','history']) Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name as keyof Window]});
window.scrollTo = () => {}; HTMLElement.prototype.scrollIntoView = () => {};
const { render, screen, cleanup, waitFor, configure } = await import('@testing-library/react');
// The first Monitor render includes lazy-loaded modules on slower build hosts.
configure({ asyncUtilTimeout: 10000 });
const { default: userEvent } = await import('@testing-library/user-event');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { api, ApiError } = await import('../src/portal/api');
const { AdminPortal } = await import('../src/portal/admin/AdminPortal');
const { DriverQuestions } = await import('../src/portal/DriverQuestions');
const original = { ...api };
const time = new Date().toISOString();
const owner = { id:'owner',role:'ADMIN',login_id:'owner',display_name:'Owner',organization:null } as never;
const incident = () => ({ id:'incident',version:1,organization_id:'company',company_name:'Acme',order_id:'order',order_number:'DAO-1842',stop_id:'stop',kind:'STOP_OVERRUN',title:'Stop progress needs clarification',description:'Elapsed stop time exceeds the recorded plan; cause unconfirmed.',severity:'WARNING' as const,certainty:'NEEDS_CONFIRMATION' as const,status:'OPEN' as 'OPEN'|'ACKNOWLEDGED',evidence:[{label:'Recorded arrival',value:time,source:'Stop execution',at:time}],suggestions:['Ask the driver for current progress.'],response_due_at:time,acknowledged_at:null as string|null,resolved_at:null,resolution:'',driver_reply:null,created_at:time,updated_at:time });
let cache: InstanceType<typeof QueryClient>;
beforeEach(() => Object.assign(api, {
  agentMonitor: async () => ({ observed_at:time,agents:(['ORDER','DISPATCH','TECHNICAL','OPERATIONAL','CHAT'] as const).map(agent=>({agent,run:null,queued:0,stale:false,issue_count:agent==='OPERATIONAL'?1:0})),running:0,awaiting_approval:0,needs_attention:1,automatic_fixes_24h:0,errors_24h:0,issues:[] }),
  operationalIssues: async () => ({items:[incident()],next_before:null}),
  platformNotifications: async () => ({items:[],unread:0}),technicalReports: async () => ({items:[],next_before:null}),agentLogs: async()=>({items:[],next_before:null}),
}));
afterEach(() => { cleanup();cache?.clear();Object.assign(api,original);history.replaceState(null,'','/admin/monitor'); });
after(()=>dom.window.close());
function mount(child: React.ReactNode=React.createElement(AdminPortal,{account:owner,onLogout:()=>{},loggingOut:false,logoutError:null})) {
  cache=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0},mutations:{retry:false,gcTime:0}}});
  render(React.createElement(QueryClientProvider,{client:cache},child));
}

test('Operational card shows evidence without technical repair controls',async()=>{
  const user=userEvent.setup({document});let technicalCalls=0;
  api.technicalReports=async()=>{technicalCalls++;return {items:[],next_before:null};};
  mount();await user.click(await screen.findByRole('button',{name:'Operational agent: 1 open issue'}));
  await screen.findByRole('dialog',{name:'Operational agent log'});
  await user.click(await screen.findByRole('button',{name:/DAO-1842 · Stop progress/}));
  assert.ok(screen.getByText('Needs confirmation'));assert.ok(screen.getByText('Suggested responses'));
  assert.equal(screen.queryByRole('button',{name:'Review repair'}),null);assert.equal(technicalCalls,0);
});

test('Acknowledgement keeps the issue open',async()=>{
  const user=userEvent.setup({document});let latest=incident();
  api.operationalIssues=async()=>({items:[latest],next_before:null});
  api.acknowledgeOperationalIssue=async()=>{latest={...latest,version:2,status:'ACKNOWLEDGED',acknowledged_at:time};return latest;};
  mount();await user.click(await screen.findByRole('button',{name:'Operational agent: 1 open issue'}));
  await user.click(await screen.findByRole('button',{name:/DAO-1842 · Stop progress/}));
  await user.click(screen.getByRole('button',{name:'Acknowledge issue'}));
  await screen.findByText('Acknowledged · still open');assert.equal(screen.queryByText('Resolved'),null);
});

test('Monitor opens operational evidence without queuing a worker',async()=>{
  const user=userEvent.setup({document});let reviews=0;let technical=0;
  api.runOperationalCheck=async()=>{reviews++;throw new Error('Unexpected operational review');};
  api.runTechnicalCheck=async()=>{technical++;throw new Error('Unexpected technical review');};
  mount();await user.click(await screen.findByRole('button',{name:'Operational agent: 1 open issue'}));
  await screen.findByRole('dialog',{name:'Operational agent log'});
  assert.equal(screen.queryByRole('button',{name:'Review orders'}),null);
  assert.equal(reviews,0);assert.equal(technical,0);
});

test('Driver selects a reason and retry preserves payload and key',async()=>{
  const user=userEvent.setup({document});let pending=true;
  const question={id:'q',version:1,order_id:'order',order_number:'DAO-1842',prompt:'What is happening at pickup?',choices:[{value:'ITEMS_NOT_READY' as const,label:'Items not ready'},{value:'OTHER' as const,label:'Another issue'}],status:'OPEN' as const,reason:null,details:'',estimated_ready_at:null,created_at:time,answered_at:null};
  api.driverOperationalQuestions=async()=>pending?[question]:[];
  const attempts: {body:unknown;key:string}[]=[];
  api.replyToOperationalQuestion=async(_slug,_id,body,key)=>{attempts.push({body,key});if(attempts.length===1)throw new ApiError(503,'Please retry.');pending=false;return {...question,...body,status:'ANSWERED',answered_at:time};};
  mount(React.createElement(DriverQuestions,{slug:'acme',driverId:'driver'}));
  const send=await screen.findByRole('button',{name:'Send progress update'});
  assert.equal((send as HTMLButtonElement).disabled,true);
  await user.click(screen.getByRole('button',{name:'Items not ready'}));
  await user.type(screen.getByLabelText('Additional details'),'Warehouse needs time');
  await user.type(screen.getByLabelText('Expected ready in minutes (optional)'),'30');
  await user.click(send);await screen.findByText('Please retry.');await user.click(send);
  await waitFor(()=>assert.equal(screen.queryByText('What is happening at pickup?'),null));
  assert.equal(attempts.length,2);assert.deepEqual(attempts[0],attempts[1]);
});
