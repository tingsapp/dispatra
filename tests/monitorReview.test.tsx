import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','CustomEvent','MutationObserver','NodeFilter','getComputedStyle','localStorage','location','history']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
HTMLElement.prototype.scrollIntoView=()=>{};
const { render, screen, cleanup, fireEvent, waitFor, act } = await import('@testing-library/react');
const { MonitorReviewNotice, MonitorReviewDialog, useMonitorReview } = await import('../src/components/monitor/MonitorReview');
const { TodaysPlan } = await import('../src/components/monitor/TodaysPlan');
const { JobsPage } = await import('../src/pages/JobsPage');
const { VehiclesPage } = await import('../src/pages/VehiclesPage');
const { DriversPage } = await import('../src/pages/DriversPage');
const { CustomersPage } = await import('../src/pages/CustomersPage');
const { operations, allOperations } = await import('../src/operations/api');
const { api } = await import('../src/portal/api');
const { syncInvalidations } = await import('../src/portal/sync');
const original = {...operations}, originalAll = {...allOperations}, originalApi = {...api};
let cache: QueryClient;
afterEach(()=>{cleanup();cache?.clear();Object.assign(operations, original);Object.assign(allOperations, originalAll);Object.assign(api,originalApi);localStorage.clear();});
after(()=>dom.window.close());
const email = {id:'draft-1',version:1,status:'NEEDS_REVIEW',received_at:new Date().toISOString(),from_name:'Khan',from_address:'khan@example.com',shipper_name:'Books',subject:'Tomorrow’s delivery',missing:['Drop-off postal code'],summary:'One pallet',draft:{items:[],stops:[]},body:'One pallet',extraction:null,shipper_id:null,sender_verified:true} as any;
const settings={id:'settings',version:1,data:{time_zone:'America/Vancouver',currency:'CAD',weight_unit:'lb',dimension_unit:'in',distance_unit:'km',dispatch_mode:'MANUAL',quote_validity_days:14}} as any;
function mount(child: React.ReactNode, overrides: Partial<typeof operations> = {}, records: Partial<typeof allOperations> = {}) {
 cache = new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0,staleTime:Infinity},mutations:{retry:false}}});
 Object.assign(api,{companySettings:async()=>settings});
 Object.assign(allOperations,{orders:async()=>[],shippers:async()=>[],rates:async()=>[],catalog:async()=>[],vehicles:async()=>[],drivers:async()=>[],routes:async()=>[]},records);
 Object.assign(operations,{emailIntakes:async()=>[email],tmsInbox:async()=>[],emailIntake:async()=>email}, overrides);
 return render(<QueryClientProvider client={cache}>{child}</QueryClientProvider>);
}

test('review stays visible when the plan is collapsed and clears only when intake is resolved', async()=>{
 let rows=[email];let opens=0;
 function Harness(){const review=useMonitorReview('acme');return <TodaysPlan jobs={[]} attentionIds={new Set()} timeZone="UTC" chatOpen onRetry={()=>{}} onSelectOrder={()=>{}} reviewNotice={<MonitorReviewNotice review={review} onOpen={()=>{opens++;}}/>}/>;}
 mount(<Harness/>, {emailIntakes:async()=>rows});
 assert.ok(await screen.findByText('1 order needs review'));
 fireEvent.click(screen.getByRole('button',{name:'Review'}));assert.equal(opens,1);
 await act(async()=>{cache.setQueryData(['sync','acme'],{unread:0});});
 assert.ok(screen.getByText('1 order needs review'));
 rows=[];
 await act(async()=>{for(const queryKey of syncInvalidations('DISPATCHER','acme',[{entity:'intake'} as never])) await cache.invalidateQueries({queryKey});});
 await waitFor(()=>assert.equal(screen.queryByRole('button',{name:'Review'}),null));
 assert.equal(location.pathname,'/acme/');
});

test('review lists missing details, opens the selected draft and retains non-email review controls',async()=>{
 let selected='';
 function Harness(){const review=useMonitorReview('acme');return <MonitorReviewDialog slug="acme" review={review} onClose={()=>{}} onOpenDraft={id=>{selected=id;}}/>;}
 mount(<Harness/>, {tmsInbox:async()=>[{id:'import-1',external_id:'WEB-1',received_at:email.received_at,missing:['Pickup missing']} as never]});
 assert.ok(await screen.findByText('Drop-off postal code'));
 fireEvent.click(screen.getByRole('button',{name:/Books/}));assert.equal(selected,'draft-1');
 assert.ok(await screen.findByRole('button',{name:'Retry TMS order WEB-1'}));
 assert.equal(location.pathname,'/acme/');
});

test('failed source is visible rather than showing a false empty queue',async()=>{
 function Harness(){return <MonitorReviewNotice review={useMonitorReview('acme')} onOpen={()=>{}}/>;}
 mount(<Harness/>, {emailIntakes:async()=>{throw Error('Offline');}});
 await waitFor(()=>assert.ok(screen.getByText('Review queue unavailable')));
});

test('Monitor review excludes old and future requests without filtering the shared inbox cache', async()=>{
 const old={...email,id:'old',shipper_name:'Old request',received_at:'2000-01-01T12:00:00Z'};
 const future={...email,id:'future',shipper_name:'Future request',received_at:'2099-01-01T12:00:00Z'};
 const imported=(id:string,received_at:string)=>({id,external_id:id,received_at,missing:['Pickup missing']} as never);
 function Harness(){const review=useMonitorReview('acme','America/Vancouver');return <><MonitorReviewNotice review={review} onOpen={()=>{}}/><MonitorReviewDialog slug="acme" review={review} onClose={()=>{}} onOpenDraft={()=>{}}/></>;}
 mount(<Harness/>,{emailIntakes:async()=>[old,email,future],tmsInbox:async()=>[imported('old-import',old.received_at),imported('today-import',email.received_at),imported('future-import',future.received_at)]});
 assert.ok(await screen.findByText('2 orders need review'));
 assert.ok(await screen.findByRole('button',{name:'Retry TMS order today-import'}));
 assert.equal(screen.queryByText('Old request'),null);
 assert.equal(screen.queryByText('Future request'),null);
 assert.equal(screen.queryByRole('button',{name:'Retry TMS order old-import'}),null);
 assert.equal(screen.queryByRole('button',{name:'Retry TMS order future-import'}),null);
 assert.equal(cache.getQueryData<any[]>(['operations','acme','email-intakes','drafts'])?.length,3);
 assert.equal(cache.getQueryData<any[]>(['operations','acme','tms-inbox'])?.length,3);
});

const jobProps={jobs:[],drivers:[],onSelectJob:()=>{},onUpdateJob:()=>{},onCreateJob:()=>{},onNotification:()=>{}};
test('draft opens the shared form directly over the Monitor and saves without navigation',async()=>{
 let saved=0, closed=0;
 function Harness(){const[id,setId]=React.useState<string|undefined>('draft-1');return <><div aria-label="Monitor map"/><JobsPage {...jobProps} dialogsOnly draftId={id} onDraftHandled={()=>setId(undefined)} onDialogsClose={()=>{closed++;}}/></>;}
 mount(<Harness/>);operations.saveEmailDraft=async()=>{saved++;return {...email,version:2};};
 assert.ok(await screen.findByRole('dialog',{name:'New Order'},{timeout:5000}));
 assert.equal(screen.queryByText('Orders summary'),null);
 fireEvent.click(screen.getByRole('button',{name:'Save draft'}));
 assert.ok(await screen.findByText('Draft saved.'));assert.equal(saved,1);
 assert.ok(screen.getByLabelText('Monitor map'));assert.equal(location.pathname,'/acme/');
 fireEvent.keyDown(document,{key:'Escape'});
 await waitFor(()=>assert.equal(closed,1));
});

test('failed draft detail read can retry the same draft without leaving the map',async()=>{
 let calls=0;
 function Harness(){const[id,setId]=React.useState<string|undefined>('draft-1');return <JobsPage {...jobProps} dialogsOnly draftId={id} onDraftHandled={()=>setId(undefined)} onDialogsClose={()=>{}}/>;}
 mount(<Harness/>, {emailIntake:async()=>{if(++calls===1) throw Error('Connection lost');return email;}});
 assert.ok(await screen.findByText('Connection lost'));
 fireEvent.click(screen.getByRole('button',{name:'Try again'}));
 assert.ok(await screen.findByRole('dialog',{name:'New Order'}));assert.equal(calls,2);assert.equal(location.pathname,'/acme/');
});

for (const kind of ['vehicle','driver','shipper'] as const) test(`${kind} overlay has a closeable unavailable state instead of opening its list page`, async()=>{
 let closed=0;const common={dialogsOnly:true,onDialogsClose:()=>{closed++;},onNotification:()=>{}};
 mount(kind==='vehicle'?<VehiclesPage {...common} drivers={[]} openVehicleId="missing"/>:kind==='driver'?<DriversPage {...common} drivers={[]} jobs={[]} openDriverId="missing" onSelectDriver={()=>{}} onUpdateDriver={()=>{}} onCreateDriver={()=>{}}/>:<CustomersPage {...common} openCustomerId="missing" onBackToMonitor={()=>{}}/>);
 assert.ok(await screen.findByText('This record is no longer available.'));
 assert.equal(screen.queryByText(kind==='vehicle'?'Register Vehicle':kind==='driver'?'Add Driver':'New Shipper'),null);
 fireEvent.click(screen.getByRole('button',{name:'Close dialog'}));assert.equal(closed,1);assert.equal(location.pathname,'/acme/');
});

test('shipper password change lives in Edit Shipper, not the details popup', async()=>{
 const shipper={id:'shipper-1',version:3,number:'CUST-1001',name:'Alex Morgan',kind:'BUSINESS',company_name:'Pacific Fresh',email:'alex@example.com',phone:'',status:'ACTIVE',warehouse:{text:'1420 Derwent Way, Delta, BC V3M 6M7',city:'Delta'},assigned_driver_id:null,assigned_driver_name:null,rate_card_id:null,discount:{kind:'NONE',value:'0'},instructions:'',created_at:new Date().toISOString()} as any;
 function Harness(){const[id,setId]=React.useState<string|undefined>('shipper-1');return <CustomersPage dialogsOnly openCustomerId={id} onOpenHandled={()=>setId(undefined)} onDialogsClose={()=>{}} onNotification={()=>{}} onBackToMonitor={()=>{}}/>;}
 mount(<Harness/>,{},{shippers:async()=>[shipper]});
 const details=await screen.findByRole('dialog',{name:'Alex Morgan'});
 assert.equal(screen.queryByRole('region',{name:'Account password'}),null);
 fireEvent.click(screen.getByRole('button',{name:'Edit Account'}));
 await screen.findByRole('heading',{name:'Edit Shipper'});assert.ok(!details.isConnected);
 assert.ok(screen.getByRole('region',{name:'Account password'}));
 assert.equal(document.querySelector('#shipper-form [aria-label="Account password"]'),null);
});

for (const kind of ['vehicle','driver','shipper'] as const) test(`${kind} shared details open and dismiss over the retained map`,async()=>{
 history.replaceState(null,'','/prototype');
 try {
  const {loadVehicles}=await import('../src/lib/vehicleStorage');
  const {loadCustomers}=await import('../src/lib/customerStorage');
  const {INITIAL_DRIVERS}=await import('../src/data/mockData');
  const record=kind==='vehicle'?loadVehicles()[0]:kind==='driver'?INITIAL_DRIVERS[0]:loadCustomers()[0];
  let closed=0;
  function Harness(){const[id,setId]=React.useState<string|undefined>(record.id);const common={dialogsOnly:true,onOpenHandled:()=>setId(undefined),onDialogsClose:()=>{closed++;},onNotification:()=>{}};
   return <><div aria-label="Retained map"/>{kind==='vehicle'?<VehiclesPage {...common} drivers={INITIAL_DRIVERS} openVehicleId={id}/>:kind==='driver'?<DriversPage {...common} drivers={INITIAL_DRIVERS} jobs={[]} openDriverId={id} onSelectDriver={()=>{}} onUpdateDriver={()=>{}} onCreateDriver={()=>{}}/>:<CustomersPage {...common} openCustomerId={id} onBackToMonitor={()=>{}}/>}</>;
  }
  mount(<Harness/>);
  await waitFor(()=>{assert.ok(screen.getByRole('dialog'));assert.equal(screen.queryByText('This record is no longer available.'),null);});
  assert.ok(screen.getByLabelText('Retained map'));assert.equal(location.pathname,'/prototype');
  fireEvent.keyDown(document,{key:'Escape'});await waitFor(()=>assert.equal(closed,1));
 } finally {history.replaceState(null,'','/acme/');}
});

for (const surface of ['menu', 'full list'] as const) test(`Needs Attention ${surface} includes unresolved requests and opens review over the map`, async()=>{
 const { TopMetrics } = await import('../src/components/TopMetrics');
 const { DetailModalDialog } = await import('../src/components/DetailModalDialog');
 let rows=[email];
 function Harness(){
  const review=useMonitorReview('acme');const [open,setOpen]=React.useState(true);const [reviewOpen,setReviewOpen]=React.useState(false);
  const props={reviewCount:(review.drafts.data?.length??0)+(review.imports.data?.length??0),reviewPending:review.drafts.isPending||review.imports.isPending,reviewFailed:review.drafts.isError||review.imports.isError,onOpenReview:()=>setReviewOpen(true)};
  return <><div aria-label="Monitor map"/>{surface==='menu'?<TopMetrics {...props} drivers={[]} availableDriversCount={0} needsAttentionCount={0} needsAttentionItems={[]} showAvailableDriversMenu={false} setShowAvailableDriversMenu={()=>{}} showNeedsAttentionPopover={open} setShowNeedsAttentionPopover={setOpen} onSelectJob={()=>{}} onSelectDriver={()=>{}} onActionNotification={()=>{}}/>:<DetailModalDialog {...props} isOpen={open} type="all_exceptions" needsAttentionItems={[]} onClose={()=>setOpen(false)} onActionNotification={()=>{}}/>}
   {reviewOpen&&<MonitorReviewDialog slug="acme" review={review} onClose={()=>setReviewOpen(false)} onOpenDraft={()=>{}}/>}</>;
 }
 mount(<Harness/>,{emailIntakes:async()=>rows});
 assert.ok(await screen.findByText('1 need review'));
 assert.equal(screen.queryByText('No alerts requiring attention.'),null);
 await act(async()=>{cache.setQueryData(['sync','acme'],{unread:0});});
 assert.ok(screen.getByText('1 need review'));
 fireEvent.click(screen.getByRole('button',{name:/Incomplete requests/}));
 assert.ok(await screen.findByRole('dialog',{name:'Requests needing review'}));
 assert.ok(screen.getByLabelText('Monitor map'));assert.equal(location.pathname,'/acme/');
 rows=[];
 await act(async()=>{await cache.invalidateQueries({queryKey:['operations','acme','email-intakes']});});
 assert.ok(await screen.findByText('No requests need review.'));
 if(surface==='menu')assert.ok(screen.getByRole('button',{name:/^0\s*Needs Attention$/}));
});

test('Needs Attention full list preserves combined capped counts and partial failures',async()=>{
 const { DetailModalDialog } = await import('../src/components/DetailModalDialog');
 mount(<DetailModalDialog isOpen type="all_exceptions" onClose={()=>{}} onActionNotification={()=>{}} reviewCount={200} reviewCapped reviewFailed onOpenReview={()=>{}}
  needsAttentionItems={[{id:'issue',jobNumber:'DZO-1',statusType:'at_risk',statusLabel:'At risk',badgeColor:'red',subtitle:'Driver unavailable',pickupAddress:'Warehouse'}]}/>);
 assert.ok(screen.getByText('201+ alerts'));assert.ok(screen.getByText('200+ need review'));
 assert.ok(screen.getByText('Some requests could not be loaded. Open review to try again.'));
 assert.ok(screen.getByText('Driver unavailable'));
});


test('Monitor notifications exclude adjacent days and future timestamps and page all of today',async()=>{
 const {todaysNotifications}=await import('../src/components/monitor/MonitorNotifications');
 const calls:(string|undefined)[]=[];
 const at=new Date().toISOString();
 const rows=Array.from({length:50},(_,i)=>({id:`n-${i}`,created_at:at,read_at:null} as any));
 operations.notifications=async(_slug,before)=>{calls.push(before);return before ? [{id:'last-today',created_at:at},{id:'old',created_at:'2000-01-01T12:00:00Z'}] as any : rows;};
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const result=await todaysNotifications('acme',day,'UTC');
 assert.equal(result.length,51);assert.deepEqual(calls,[undefined,'n-49']);
 operations.notifications=async()=>[{id:'future',created_at:'2099-01-01T12:00:00Z'},{id:'old',created_at:'2000-01-01T12:00:00Z'}] as any;
 assert.equal((await todaysNotifications('acme',day,'UTC')).length,0);
});


test('Orders sidebar badge persists on selection and disappears when issues are resolved',async()=>{
 const {Sidebar}=await import('../src/components/Sidebar');
 window.matchMedia=(()=>({matches:false,addEventListener(){},removeEventListener(){}})) as any;
 let selected='';
 const props={activeTab:'monitor',isOpen:true,onToggle(){},setActiveTab:(tab:string)=>{selected=tab;},showAccountPopover:false,setShowAccountPopover:()=>{},onActionNotification(){},dispatchMode:'MANUAL' as const,onDispatchModeChange(){}};
 const view=mount(<Sidebar {...props} ordersAttentionCount={3}/>);
 fireEvent.click(screen.getByRole('button',{name:'Orders, 3 need attention'}));
 assert.equal(selected,'jobs');
 assert.ok(screen.getByRole('button',{name:'Orders, 3 need attention'}));
 view.rerender(<QueryClientProvider client={cache}><Sidebar {...props} ordersAttentionCount={0}/></QueryClientProvider>);
 assert.ok(screen.getByRole('button',{name:/^Orders$/}));
 assert.equal(screen.queryByRole('button',{name:'Orders, 3 need attention'}),null);
});
