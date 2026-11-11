// Local fixture accounts only: no production reads or writes.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin=process.env.E2E_ORIGIN || 'http://127.0.0.1:5319';
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const output='/tmp/dispatra-monitor-review';await mkdir(output,{recursive:true});
const settings={company_name:'Acme Logistics',tms_workspace:false,contact_name:'Dispatch',email:'',phone:'',address:null,logo_url:'',currency:'CAD',time_zone:'America/Vancouver',weight_unit:'lb',dimension_unit:'in',distance_unit:'km',tax_registration_number:'',gst_enabled:true,gst_percent:'5',provincial_enabled:false,provincial_percent:'0',fuel_enabled:false,fuel_percent:'0',maximum_active_orders:3,quote_validity_days:14,dispatch_mode:'MANUAL',dispatch_zones:[],default_service_id:null};
const draft={id:'draft-1',version:1,status:'NEEDS_REVIEW',received_at:'2026-11-09T12:00:00Z',from_name:'Khan',from_address:'khan@example.com',shipper_name:'Books Warehouse',subject:'Tomorrow’s book delivery',missing:['Drop-off postal code','Package weight'],summary:'One pallet of books',draft:{items:[],stops:[]},body:'One pallet of books, tomorrow at 2 pm.',extraction:null,shipper_id:null,sender_verified:true};
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {for (const width of [1440,390]) {
 const context=await browser.newContext({viewport:{width,height:900}});const errors=[];let saves=0;
 await context.addInitScript(()=>{window.WebSocket=undefined;});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,reply=json=>route.fulfill({json});
  if(url.origin!==origin)return route.abort();if(!path.startsWith('/api/'))return route.continue();
  if(path==='/api/v1/auth/me')return reply({id:'dispatcher',role:'DISPATCHER',login_id:'preview@example.com',display_name:'Dispatch',organization:{id:'org',slug:'acme',name:'Acme Logistics',active:true,payment_required:false},tms_workspace:false});
  if(path.endsWith('/settings'))return reply({id:'settings',version:1,data:settings});
  if(path.endsWith('/sync'))return reply({cursor:'1-0',changes:[],unread:1,unread_messages:0,reset:false,next_poll_ms:30000});
  if(path.endsWith('/monitor'))return reply({drivers:[],routes:[],needs_attention:[]});
  if(path.endsWith('/chat-unread'))return reply({unread:0});
  if(path.endsWith('/chat-inbox'))return reply({items:[],next_cursor:null});
  if(path.endsWith('/assistant/messages'))return reply({message:'No active orders today.',references:[],actions:[]});
  if(path.endsWith('/notifications'))return reply([{id:'note-1',version:1,kind:'intake.needs_review',severity:'WARNING',title:'Email order needs review',body:'An email from Khan needs details.',created_at:new Date().toISOString(),read_at:null,order_id:null,route_id:null}]);
  if(path.endsWith('/notifications/note-1/read'))return reply({id:'note-1',version:2,read_at:new Date().toISOString()});
  if(path.endsWith('/email-intake/messages'))return reply([draft]);
  if(path.endsWith('/email-intake/messages/draft-1/draft')){saves++;return reply({...draft,version:2});}
  if(path.endsWith('/email-intake/messages/draft-1'))return reply(draft);
  if(path.endsWith('/integrations/tms/inbox')||/\/(drivers|shippers|orders|routes|vehicles|catalog|rates|rate-cards)$/.test(path))return reply([]);
  return route.fulfill({status:404,json:{error:{message:'Unmocked local request: '+path}}});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/acme/');await page.getByText('1 order needs review',{exact:true}).waitFor();
 const map=page.getByLabel('Monitor map',{exact:true});await map.waitFor({state:'attached'});
 await page.screenshot({path:`${output}/monitor-${width}.png`});
 await page.getByRole('button',{name:'1 Needs Attention',exact:true}).click();
 await page.getByText('Incomplete requests',{exact:true}).waitFor();
 await page.screenshot({path:`${output}/needs-attention-${width}.png`});
 await page.getByRole('button',{name:/Incomplete requests/}).click();
 await page.getByRole('dialog',{name:'Requests needing review'}).waitFor();
 await page.getByRole('button',{name:/Books Warehouse/}).click();
 const form=page.getByRole('dialog',{name:'New Order',exact:true});await form.waitFor();
 assert.equal(new URL(page.url()).pathname,'/acme/');assert.equal(await map.count(),1);
 await form.getByRole('button',{name:'Save draft',exact:true}).click();await form.getByText('Draft saved.',{exact:true}).waitFor();assert.equal(saves,1);
 const overflow=await form.evaluate(el=>el.scrollWidth>el.clientWidth+1);assert.equal(overflow,false);
 await page.screenshot({path:`${output}/draft-${width}.png`});
 await page.keyboard.press('Escape');await form.waitFor({state:'detached'});
 await page.getByRole('button',{name:/^Notifications/}).click();
 await page.getByRole('button',{name:/Warning. Email order needs review/}).click();
 await page.getByRole('dialog',{name:'Requests needing review'}).waitFor();
 assert.equal(new URL(page.url()).pathname,'/acme/');
 assert.deepEqual(errors,[]);await context.close();console.log(`Monitor draft and notification flow passed at ${width}px`);
}} finally {await browser.close();}
