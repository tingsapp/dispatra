// Real portals and simulated accounts: all API requests are intercepted, with no live writes.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const origin=process.env.E2E_ORIGIN||'http://127.0.0.1:5318',output=process.env.E2E_OUTPUT||'/tmp/dispatra-chat-ui';
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname));await mkdir(output,{recursive:true});
const settings={company_name:'Acme Logistics',tms_workspace:false,contact_name:'Jo Dispatch',email:'',phone:'',address:null,logo_url:'',currency:'CAD',time_zone:'America/Vancouver',weight_unit:'lb',dimension_unit:'in',distance_unit:'km',tax_registration_number:'',gst_enabled:true,gst_percent:'5',provincial_enabled:false,provincial_percent:'0',fuel_enabled:false,fuel_percent:'0',maximum_active_orders:3,quote_validity_days:14,dispatch_mode:'MANUAL',dispatch_zones:[],default_service_id:null};
const browser=await chromium.launch({headless:true,channel:'chrome'}),results=[];
try{for(const admin of [false,true]){
 const mode=admin?'admin':'dispatcher',context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.addInitScript(()=>{window.WebSocket=undefined;});
 const message=(id,seq,body,mine=false)=>({id:`${id}-${seq}`,seq,conversation_id:id,sender_role:admin?'DISPATCHER':'DRIVER',sender_name:admin?'Jo Dispatch':'Dana Driver',mine,body,created_at:'2026-11-08T15:20:00Z'});
 const rows=(admin?[['support','ADMIN_DISPATCHER','Jo Dispatch','Acme Logistics'],['support2','ADMIN_DISPATCHER','Avery','North Shore Couriers']]:[['driver','DISPATCH_DRIVER','Dana Driver'],['shipper','DISPATCH_SHIPPER','Fresh Foods'],['oversight','DRIVER_SHIPPER','Dana ↔ Fresh Foods'],['support','ADMIN_DISPATCHER','Admin']]).map(([id,kind,title,company_name],i)=>({conversation_id:id,kind,title,company_name,dispatcher_id:kind==='ADMIN_DISPATCHER'?'dispatcher':null,shipper_id:kind==='DISPATCH_SHIPPER'?'s1':null,driver_id:kind==='DISPATCH_DRIVER'?'d1':null,order_id:kind==='DRIVER_SHIPPER'?'o1':null,order_number:kind==='DRIVER_SHIPPER'?'ORD-1042':null,order_status:kind==='DRIVER_SHIPPER'?'IN_PROGRESS':null,can_send:kind!=='DRIVER_SHIPPER',closed_reason:kind==='DRIVER_SHIPPER'?'Dispatch can read this chat but not reply.':null,unread:i===0?1:0,last_message:message(id,2,'The delivery entrance is on the east side.'),last_message_at:'2026-11-08T15:20:00Z'}));
 const messages=Object.fromEntries(rows.map(r=>[r.conversation_id,[message(r.conversation_id,1,'Good morning. Can you confirm the delivery entrance?',true),r.last_message]]));
 let notes=[],changed=false;const unexpected=[],errors=[];
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,reply=json=>route.fulfill({json});
  if(url.origin!==origin)return route.abort();if(!path.startsWith('/api/'))return route.continue();
  if(path==='/api/v1/auth/me')return reply({id:admin?'owner':'dispatcher',role:admin?'ADMIN':'DISPATCHER',login_id:'preview@example.com',display_name:admin?'Platform Admin':'Jo Dispatch',organization:admin?null:{id:'org',slug:'acme',name:'Acme Logistics',active:true,payment_required:false},tms_workspace:false});
  if(path.endsWith('/test-new-message')){const r=rows[1];r.unread=1;messages[r.conversation_id].push(message(r.conversation_id,3,'A new incoming message for this test.'));notes=[{id:'new-note',version:1,kind:'message.created',conversation_id:r.conversation_id,order_id:null,route_id:null,organization_id:'org',company_name:r.company_name??'Acme Logistics',target:'chat',severity:'INFO',title:admin?'New message from Dispatch':'New message from Shipper',body:'Open chat to reply.',read_at:null,created_at:new Date().toISOString()}];changed=true;return reply({ok:true});}
  if(path.endsWith('/sync')){const changes=changed?[{id:'event',type:'notification.created',entity:'notification',entity_id:'new-note',actor_type:'USER',entity_version:1,order_id:null,route_id:null,created_at:new Date().toISOString()}]:[];changed=false;return reply({cursor:'1-0',changes,unread:notes.filter(n=>!n.read_at).length,unread_messages:rows.reduce((s,r)=>s+r.unread,0),reset:false,next_poll_ms:500});}
  if(path==='/api/v1/platform/agents/monitor')return reply({agents:[],needs_attention:0,platform_attention:0});
  if(path.endsWith('/settings'))return reply({id:'settings',version:1,data:settings});
  if(path.endsWith('/monitor'))return reply({drivers:[],routes:[],needs_attention:[]});
  if(path.endsWith('/chat-unread'))return reply({unread:rows.reduce((s,r)=>s+r.unread,0)});
  if(path.endsWith('/notifications'))return reply(admin?{items:notes,unread:notes.filter(n=>!n.read_at).length}:notes);
  if(path.includes('/notifications/')&&path.endsWith('/read')){notes=notes.map(n=>({...n,read_at:new Date().toISOString()}));return reply(notes[0]);}
  if(path.endsWith('/email-intake/messages'))return reply([]);
  if(path.endsWith('/drivers/d1/chat'))return reply(rows[0]);
  if(path.endsWith('/shippers/s1/chat'))return reply(rows[1]);
  if(path.endsWith('/orders/o1/chats'))return reply([rows[0]]);
  if(path.endsWith('/chat-inbox')||path==='/api/v1/platform/chats')return reply({items:rows,next_cursor:null});
  const match=path.match(/\/chats\/([^/]+)(?:\/(messages|read))?$/);
  if(match){const[,id,action]=match;if(action==='messages')return reply({messages:messages[id]??[],has_more:false});if(action==='read'){rows.find(r=>r.conversation_id===id).unread=0;notes=notes.map(n=>n.conversation_id===id?{...n,read_at:new Date().toISOString()}:n);return reply({unread:rows.reduce((s,r)=>s+r.unread,0),notifications_unread:notes.filter(n=>!n.read_at).length});}return reply(rows.find(r=>r.conversation_id===id));}
  if(path.endsWith('/chats'))return reply(rows);if(/\/(drivers|shippers|orders|routes|vehicles|catalog|rates|rate-cards)$/.test(path))return reply([]);
  unexpected.push(path);return route.fulfill({status:404,json:{error:{message:'Unmocked local request'}}});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const assertCircularSend=async scope=>{
  const size=await scope.locator('.public-chat-send').evaluate(el=>{const box=el.getBoundingClientRect(),css=getComputedStyle(el);return {width:box.width,height:box.height,radius:css.borderRadius};});
  assert.ok(size.width>0&&Math.abs(size.width-size.height)<0.5,`${mode} send button stays circular: ${JSON.stringify(size)}`);
  assert.ok(size.radius==='50%'||parseFloat(size.radius)>=size.width/2);
 };

 await page.goto(origin+(admin?'/admin/chat':'/acme/chat'));
 await page.getByRole('heading',{name:'Conversations',exact:true}).waitFor();
 const checkFilters=async()=>{
  const filters=page.getByLabel('Filter conversations');
  assert.deepEqual(await filters.locator('button').allTextContents(),admin?['All','Unread']:['All','Drivers','Shippers','D–S','Admin']);
  const layout=await filters.evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,tops:[...el.querySelectorAll('button')].map(button=>button.getBoundingClientRect().top)}));
  assert.equal(new Set(layout.tops).size,1,`${mode} filters stay on one line`);
  assert.ok(layout.scrollWidth<=layout.width,`${mode} filters fit without horizontal scrolling`);
  if(!admin)assert.equal(await filters.getByRole('button',{name:'Driver–Shipper',exact:true}).getAttribute('title'),'Driver–Shipper');
 };
 await checkFilters();
 await page.getByRole('button',{name:admin?'Jo Dispatch, 1 unread':'Dana Driver, 1 unread',exact:true}).click();
 await page.getByRole('textbox',{name:admin?'Message Jo Dispatch':'Message Dana Driver'}).waitFor();
 await assertCircularSend(page);
 await page.screenshot({path:`${output}/${mode}-desktop.png`,fullPage:true,animations:'disabled'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(admin){assert.equal(await page.getByRole('button',{name:'Drivers',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Shippers',exact:true}).count(),0);}
 // Browser fetch is intercepted like every other API request.
 await page.evaluate(()=>fetch('/api/v1/test-new-message'));
 await page.getByRole('button',{name:/New message from.*Open conversation/}).click({timeout:12000});
 const recipient=admin?'Message Avery':'Message Fresh Foods';await page.getByRole('textbox',{name:recipient}).waitFor();
 await page.getByText('A new incoming message for this test.',{exact:true}).waitFor();
 if(!admin){
  assert.equal(new URL(page.url()).searchParams.get('conversation'),'driver','Popup leaves inbox selection unchanged');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:`${output}/dispatcher-popup-mobile.png`,fullPage:true,animations:'disabled'});
  const popupBox=await page.locator('.app-chat-popup').boundingBox();assert.ok(popupBox.x>=0&&popupBox.x+popupBox.width<=390&&popupBox.y+popupBox.height<=844);
  assert.equal(Math.round(popupBox.height),340);await assertCircularSend(page.getByRole('dialog'));
  await page.keyboard.press('Escape');
 }
 await page.reload();await page.getByRole('textbox',{name:admin?recipient:'Message Dana Driver'}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${output}/${mode}-mobile.png`,fullPage:true,animations:'disabled'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const box=await page.getByRole('textbox',{name:admin?recipient:'Message Dana Driver'}).boundingBox();assert.ok(box.y+box.height<=844,`${mode} mobile composer fits`);
 await page.getByRole('button',{name:'Back to conversations'}).click();assert.ok(await page.getByRole('heading',{name:'Conversations',exact:true}).isVisible());
 await checkFilters();
 if(!admin){
  // Exercise every shared contact target through the real dispatcher app outside Chat.
  await page.goto(origin+'/acme/orders');
  await page.getByRole('heading',{name:'Orders',exact:true}).waitFor();
  const originalUrl=page.url();
  for(const [target,name] of [[{driverId:'d1'},'Dana Driver'],[{shipperId:'s1'},'Fresh Foods'],[{orderId:'o1',kind:'DISPATCH_DRIVER',driverId:'d1'},'Dana Driver'],[{conversationId:'shipper'},'Fresh Foods']]){
   await page.evaluate(target=>window.dispatchEvent(new CustomEvent('dispatra-open-chat',{detail:target})),target);
   const composer=page.getByRole('dialog').getByRole('textbox',{name:'Message '+name});await composer.waitFor();
   assert.equal(page.url(),originalUrl);assert.equal(await page.getByLabel('All conversations',{exact:true}).count(),0);
   await composer.fill('A draft kept on this page');
   await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);assert.equal(page.url(),originalUrl);
  }
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('dispatra-open-chat',{detail:{driverId:'d1'}})));
  await page.getByRole('dialog').getByRole('textbox',{name:'Message Dana Driver'}).waitFor();
  const popup=page.locator('.app-chat-popup'),bounds=await popup.boundingBox();assert.equal(Math.round(bounds.width),480);assert.equal(Math.round(bounds.height),340);await assertCircularSend(popup);
  await page.screenshot({path:`${output}/dispatcher-popup-desktop.png`,fullPage:true,animations:'disabled'});
  await page.keyboard.press('Escape');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);results.push({mode,desktop:true,mobile:true,notificationOpensExactChat:true,refreshKeepsConversation:true,contactActionsStayOnPage:!admin});await context.close();
}await writeFile(`${output}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));}finally{await browser.close();}
