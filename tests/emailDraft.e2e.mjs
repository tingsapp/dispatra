// Browser-only draft workflow fixtures. Every API request is intercepted; no live writes or mail.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin=process.env.E2E_ORIGIN||'http://127.0.0.1:4177', output=process.env.E2E_OUTPUT||'/tmp/dispatra-email-draft-ui';
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname));await mkdir(output,{recursive:true});
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,time='2030-11-07T17:00:00Z';
const settings={company_name:'Example Logistics',tms_workspace:false,contact_name:'Dispatch',email:'',phone:'',address:null,logo_url:'',currency:'CAD',time_zone:'America/Vancouver',weight_unit:'lb',dimension_unit:'in',distance_unit:'km',tax_registration_number:'',gst_enabled:true,gst_percent:'5',provincial_enabled:false,provincial_percent:'0',fuel_enabled:false,fuel_percent:'0',maximum_active_orders:3,quote_validity_days:14,dispatch_mode:'MANUAL',dispatch_zones:[],default_service_id:null};
const address={text:'100 Warehouse Street, Vancouver, BC V5Y 1V4, Canada',city:'Vancouver',province:'BC',postal_code:'V5Y 1V4',country:'CA',latitude:49.2,longitude:-123.1};
const shipper={id:id(2),version:1,kind:'BUSINESS',name:'Example Shipper',company_name:'Example Shipper',status:'ACTIVE',email:'shipper@example.test',phone:'6045550101',warehouse:address,billing_address:address,discount:{kind:'NONE',value:'0'},contacts:[],instructions:'',driver_assignment:null,notification_preferences:{},data:{},created_at:time};
const service={id:id(3),version:1,kind:'SERVICE',code:'DIRECT',active:true,created_at:time,data:{name:'Direct Hotshot',description:'',amount:'0',exclusive_vehicle:true}};
const browser=await chromium.launch({headless:true,channel:'chrome'});const results=[];
try {for(const width of [1440,390]) {
 const context=await browser.newContext({viewport:{width,height:1000}});await context.addInitScript(()=>{window.WebSocket=undefined;});
 let row={id:id(1),version:1,status:'NEEDS_REVIEW',shipper_id:shipper.id,shipper_name:shipper.name,sender_verified:false,from_address:shipper.email,from_name:'Shipper',subject:'New Order',received_at:time,created_at:time,summary:'Two pallets of books, urgent delivery with liftgate.',missing:['Stop 2: complete address','Package 1: weight'],body:'Hi,\nI have 2 pallets of books 48x48x48. Please send a driver directly.\nThanks',order_id:null,order_number:null,error_code:null,extraction:null,completion_requested_at:null,completion_submitted_at:null,
 draft:{shipper_id:shipper.id,service_id:service.id,scheduled_at:time,stops:[{id:id(4),kind:'PICKUP',address,contact_name:'',phone:'',instructions:''},{id:id(5),kind:'DROPOFF',address:{text:'456 Lougheed hiway, Burnaby',city:'Burnaby',province:'',postal_code:'',country:'CA'},contact_name:'',phone:'',instructions:'Liftgate required'}],items:[{id:id(6),pickup_id:id(4),delivery_id:id(5),quantity:2,weight_kg:null,length_cm:'121.92',width_cm:'121.92',height_cm:'121.92',pallets:1,fragile:false,dangerous_goods:false,description:'Books'}],accessorials:[],internal_notes:'Dispatcher note'}};
 let saves=0,requests=0,submissions=0,role='DISPATCHER';const errors=[],unexpected=[];
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,reply=json=>route.fulfill({json});
  if(url.origin!==origin)return route.abort();if(!path.startsWith('/api/'))return route.continue();
  if(path==='/api/v1/auth/me')return reply({id:id(20),login_id:'dispatch',display_name:'Dispatch',role,tms_workspace:false,organization:{id:id(21),slug:'acme',name:'Example Logistics',active:true,payment_required:false}});
  if(path.endsWith('/shipper/profile'))return reply(shipper);
  if(path.endsWith('/booking-preferences'))return reply(settings);
  if(path.endsWith('/booking-options'))return reply([service]);
  if(path.endsWith('/booking-drivers'))return reply([]);
  if(path.endsWith(`/email-intake/drafts/${row.id}`)){const{internal_notes,shipper_id,...draft}=row.draft;return reply({id:row.id,version:row.version,draft,submitted_at:null});}
  if(path.endsWith(`/email-intake/drafts/${row.id}/submit`)){submissions++;const data=req.postDataJSON();assert.equal(data.draft.internal_notes,undefined);assert.equal(data.draft.shipper_id,undefined);return reply({id:row.id,version:row.version+1,draft:data.draft,submitted_at:time});}
  if(path.endsWith('/settings'))return reply({id:id(22),version:1,data:settings});
  if(path.endsWith('/sync'))return reply({cursor:'0',changes:[],unread:0,unread_messages:0,reset:false,next_poll_ms:60000});
  if(path.endsWith('/monitor'))return reply({drivers:[],routes:[],needs_attention:[]});
  if(path.endsWith('/email-intake/messages'))return reply([row]);
  if(path.endsWith(`/email-intake/messages/${row.id}`))return reply(row);
  if(path.endsWith(`/messages/${row.id}/draft`)) {assert.equal(req.method(),'PUT');saves++;row={...row,version:row.version+1,draft:req.postDataJSON().draft};return reply(row);}
  if(path.endsWith(`/messages/${row.id}/request-details`)){requests++;row={...row,version:row.version+1,completion_requested_at:time};return route.fulfill({status:202,json:{id:id(23),intake_id:row.id,status:'PENDING'}});}
  if(path.endsWith('/catalog'))return reply([service]);if(path.endsWith('/shippers'))return reply([shipper]);
  if(/\/(drivers|vehicles|orders|routes|quotes|notifications|rate-cards)$/.test(path))return reply([]);
  if(path.endsWith('/chat-unread'))return reply({unread:0});
  if(path.endsWith('/preview'))return route.fulfill({status:422,json:{error:{message:'Complete the address.'}}});
  if(path.endsWith('/chats'))return reply([]);
  if(path.endsWith('/chat'))return reply({conversation_id:id(25),kind:'DISPATCH_SHIPPER',title:'Dispatch',can_send:true,unread:0,last_message:null});
  if(path.endsWith('/chat-inbox'))return reply({items:[],next_cursor:null});
  unexpected.push(path);return route.fulfill({status:404,json:{error:{message:'Unmocked test request'}}});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(25000);
 await page.goto(origin+'/acme/orders');try { await page.getByTitle('Review draft').click(); } catch(error) { console.log(JSON.stringify({errors,unexpected,body:(await page.locator('body').innerText()).slice(0,3000)}));await page.screenshot({path:output+'/failure.png'});throw error; }
 const dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:'New Order',exact:true}).waitFor();
 assert.equal(await dialog.getByLabel('Package 1 quantity').inputValue(),'2');assert.equal(await dialog.getByLabel('Package 1 length').inputValue(),'48.0');assert.equal(await dialog.getByLabel('Package 1 weight').inputValue(),'');
 assert.equal(await dialog.getByText('Distance and duration are calculated',{exact:false}).count(),0);assert.equal(await dialog.getByText('The order can be created',{exact:false}).count(),0);
 await page.screenshot({path:`${output}/draft-form-${width}.png`,fullPage:true});
 const details=dialog.locator('details').filter({hasText:'Original email'});assert.equal(await details.getAttribute('open'),null);
 const order=await dialog.evaluate(el=>{const a=el.querySelector('[aria-label="Draft review"]'),b=[...el.querySelectorAll('details')].find(node=>node.querySelector('summary')?.textContent.includes('Original email'));return !!(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING);});assert.ok(order);
 await dialog.getByLabel('Package 1 weight').fill('200');await dialog.getByRole('button',{name:'Save draft',exact:true}).click();await dialog.getByText('Draft saved.',{exact:true}).waitFor();
 assert.equal(saves,1);assert.ok(Math.abs(Number(row.draft.items[0].weight_kg)-90.718474)<.001);assert.equal(row.draft.items[0].pallets,1);
 await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();await page.getByTitle('Review draft').click();await dialog.getByLabel('Package 1 weight').waitFor();assert.equal(await dialog.getByLabel('Package 1 weight').inputValue(),'200.0');
 await dialog.getByRole('button',{name:'Request details',exact:true}).click();await dialog.getByText('Completion link queued for the shipper.',{exact:true}).waitFor();assert.equal(requests,1);
 await details.locator('summary').click();assert.ok(await details.getByText(row.body,{exact:true}).isVisible());
 await details.scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/draft-bottom-${width}.png`,fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);await page.close();role='SHIPPER';row.draft.stops[1].address={...address,text:'500 Granville Street, Vancouver, BC V6C 1W6, Canada',postal_code:'V6C 1W6'};row.draft.items[0].weight_kg=null;
 const shipperPage=await context.newPage();shipperPage.on('pageerror',e=>errors.push(e.message));await shipperPage.goto(origin+`/acme/shipper?draft=${row.id}`);
 const form=shipperPage.getByRole('dialog');await form.getByRole('heading',{name:'New Order',exact:true}).waitFor();
 assert.equal(await form.getByLabel('Package 1 weight').inputValue(),'');assert.equal(await form.getByText('Original email',{exact:true}).count(),0);assert.equal(await form.getByText('Dispatcher note',{exact:true}).count(),0);
 await form.getByLabel('Package 1 weight').fill('200');await form.getByRole('button',{name:'Send details to dispatcher',exact:true}).click();await shipperPage.getByText('Details sent to your dispatcher for review.',{exact:true}).waitFor();assert.equal(submissions,1);assert.equal(new URL(shipperPage.url()).search,'');
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);results.push({width,directForm:true,blankFields:true,saveReopen:true,completionRequest:true,expandableEmail:true,shipperCompletion:true});await context.close();
}await writeFile(`${output}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));}finally{await browser.close();}
