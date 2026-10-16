// Controlled API fixtures for presentation acceptance. No real company or business writes.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:14129';
const shots = process.env.E2E_SCREENSHOT_DIR;
if (shots) await mkdir(shots, {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const context = await browser.newContext({viewport:{width:1440,height:1080},reducedMotion:'no-preference'});
const page = await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
let transfer=null, fail=false, processing=true;
const baseline={id:'EVENT:baseline',source:'EVENT',kind:'order.created',from_node:'ORDER',to_node:'data',title:'Order saved',level:'INFO',company_name:'Acceptance company',reference:'DAO-1000',created_at:new Date(Date.now()-60_000).toISOString()};
function snapshot(){
 const at=new Date().toISOString();
 const definitions=[['ORDER',processing?'PROCESSING':'WAITING',processing?'Validating the saved email booking.':'2 emails waiting for the Order agent.'],['DISPATCH','WAITING','3 automatic orders waiting; 1 has no eligible driver in its latest evaluation.'],['OPERATIONAL','WAITING','Waiting for the next order review.'],['TECHNICAL','ERROR','Database check failed; investigation required.'],['CHAT','WAITING','Waiting for a workspace question.']];
 const agents=definitions.map(([agent,state,detail])=>({agent,stale:false,queued:agent==='ORDER'?2:agent==='DISPATCH'?3:0,issue_count:agent==='TECHNICAL'?1:0,run:{id:`run-${agent}`,agent,status:state==='PROCESSING'?'RUNNING':state==='ERROR'?'FAILED':'SUCCEEDED',progress:state==='PROCESSING'?45:100,step:detail,created_at:at,heartbeat_at:at,finished_at:state==='PROCESSING'?null:at}}));
 return {observed_at:at,agents,running:processing?1:0,awaiting_approval:0,needs_attention:1,automatic_fixes_24h:2,errors_24h:1,issues:[],machine:{observed_at:at,agents:definitions.map(([agent,state,detail])=>({agent,state,detail,company_name:state==='PROCESSING'?'Acceptance company':null,heartbeat_at:at,queued:agent==='ORDER'?2:agent==='DISPATCH'?3:0})),workload:{emails_waiting:2,emails_review:1,emails_failed:1,orders_waiting:5,auto_waiting:3,manual_waiting:2,no_driver:1,orders_assigned:4,orders_in_progress:2,routes_in_progress:1,completed_24h:6},activity:transfer?[transfer,baseline]:[baseline],activity_truncated:false,window_seconds:86400}};
}
await context.route('**/api/v1/**',async route=>{
 const path=new URL(route.request().url()).pathname;
 if(path==='/api/v1/auth/me')return route.fulfill({json:{id:'owner',role:'ADMIN',login_id:'owner',display_name:'Demo Admin',organization:null,tms_workspace:false}});
 if(path.endsWith('/agents/monitor'))return route.fulfill(fail?{status:503,json:{error:{message:'Monitoring unavailable.'}}}:{json:snapshot()});
 if(path.endsWith('/notifications'))return route.fulfill({json:{items:[],unread:0}});
 assert.equal(route.request().method(),'GET','No operational mutation is allowed by this acceptance test');
 if(path.endsWith('/agents/logs')||path.endsWith('/agents/issues')||path.endsWith('/agents/operational/issues'))return route.fulfill({json:{items:[],next_before:null}});
 return route.fulfill({json:[]});
});
try{
 await page.goto(origin+'/admin/monitor');
 await page.getByText('2 emails waiting',{exact:true}).waitFor();
 assert.equal(await page.getByRole('banner').count(),1);
 const header=page.getByRole('banner',{name:'Workspace header'});
 assert.equal(await header.getByRole('heading',{level:1,name:'One connected machine.',exact:true}).count(),1);
 assert.equal(await page.getByRole('button',{name:/Review orders|Order review queued or running/}).count(),0);
 for(const name of ['Live system','Demo flow','Run checks','Notifications'])assert.equal(await header.getByRole('button',{name,exact:true}).count(),1);
 assert.equal(await page.locator('.machine-header').count(),0);
 assert.equal(await page.locator('.machine-monitor').evaluate(node=>getComputedStyle(node).borderTopWidth),'0px');
 assert.equal(await page.locator('.machine-monitor').evaluate(node=>getComputedStyle(node).borderRadius),'0px');
 assert.ok(await page.locator('.app-page-machine').evaluate(node=>getComputedStyle(node).backgroundImage.includes('radial-gradient')));
 assert.equal(await page.locator('[data-transfer-id]').count(),0,'Old history must never look like current traffic');
 await page.getByRole('region',{name:'Order agent',exact:true}).getByText(/^Processing/).waitFor();
 await page.getByRole('region',{name:'Dispatch agent',exact:true}).getByText('Waiting',{exact:true}).waitFor();
 await page.getByRole('region',{name:'Technical agent',exact:true}).getByText('Error',{exact:true}).waitFor();
 assert.equal(await page.locator('.machine-signal').count(),0,'A running worker alone must not fabricate live handoffs');
 transfer={...baseline,id:'EVENT:live',reference:'DAO-1001',created_at:new Date().toISOString()};
 const moving=page.locator('g[data-transfer-id="EVENT:live"]');await moving.waitFor({timeout:10_000});
 const first=await moving.evaluate(node=>({x:node.getCTM().e,y:node.getCTM().f}));
 await page.waitForTimeout(200);
 const second=await moving.evaluate(node=>({x:node.getCTM().e,y:node.getCTM().f}));
 assert.ok(Math.hypot(second.x-first.x,second.y-first.y)>1,'The real-reference token moves along its confirmed path');
 assert.ok((await moving.textContent()).includes('DAO-1001'));
 await moving.waitFor({state:'hidden',timeout:6000});
 await page.waitForTimeout(5200);
 assert.equal(await page.locator('[data-transfer-id]').count(),0,'Polling the same event must not replay its animation');
 for(const width of [1440,1024,768,390,320]){
  await page.setViewportSize({width,height:1080});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Canvas overflow at ${width}`);
  assert.equal(await page.getByRole('banner').count(),1);
  assert.equal(await page.locator('[data-machine-agent]').count(),5);
  assert.equal(await page.locator('[data-machine-link]').count(),9);
  await page.locator('.app-page').evaluate(node=>node.scrollTop=0);
  if(shots)await page.screenshot({path:`${shots}/live-${width}.png`,fullPage:true});
 }
 await page.getByRole('button',{name:'Technical agent: 1 open issue'}).click();
 await page.getByRole('dialog',{name:'Technical agent log'}).waitFor();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Demo flow',exact:true}).click();await page.getByText('DEMONSTRATION · SAMPLE DATA',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Live system',exact:true}).click();
 assert.equal(await page.locator('[data-transfer-id]').count(),0,'Exiting demo does not animate its backlog as real work');
 processing=false;await page.getByRole('region',{name:'Order agent',exact:true}).getByText('Waiting',{exact:true}).waitFor({timeout:10_000});
 assert.equal(await page.locator('[data-machine-node="ORDER"]').getAttribute('data-active'),'false');
 fail=true;await page.getByText(/Showing previously loaded data|Showing previously loaded|Showing previously/).waitFor({timeout:20_000});
 await page.getByText('Live updates are delayed. Motion is paused until a fresh snapshot arrives.',{exact:true}).waitFor();
 assert.equal(await page.locator('[data-transfer-id]').count(),0);
 fail=false;await page.getByRole('button',{name:'Retry',exact:true}).click();
 await page.getByRole('region',{name:'Order agent',exact:true}).getByText('Waiting',{exact:true}).waitFor();
 assert.equal(await page.locator('[data-transfer-id]').count(),0,'Reconnect must not replay old handoffs');
 await page.emulateMedia({reducedMotion:'reduce'});
 transfer={...baseline,id:'EVENT:reduced',reference:'DAO-1002',created_at:new Date().toISOString()};
 await page.locator('text[data-transfer-id="EVENT:reduced"]').waitFor({timeout:10_000});
 assert.equal(await page.locator('g[data-transfer-id="EVENT:reduced"]').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: whole-page pattern/single header; real processing/waiting/error explanations and counts; initial-history suppression; one finite labelled handoff per new event; no unchanged/reconnect/demo replay; polling, pause on read failure, retry, reduced motion; desktop/tablet/390/320px bounds and scoped logs.');
}catch(error){
 if(shots)await page.screenshot({path:`${shots}/failure.png`,fullPage:true});
 throw error;
}finally{await browser.close();}
