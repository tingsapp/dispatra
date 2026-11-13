// Browser regressions use real components with isolated API replies; no accounts or mail are created.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const base = {
  message: 'Check order intake and driver readiness before dispatching; no issues are shown in the current briefing card.',
  references: [], mode: 'AI', observed_at: '2026-11-05T11:23:00Z', limited: false,
  briefing: { day: '2026-11-05', time_zone: 'America/Vancouver', evening: false, received: 0, unassigned: 0, assigned: 0, in_progress: 0, completed: 0, open_incidents: 0, dispatch_mode: 'MANUAL', assigned_by_driver: [] },
};
const preamble = `<script type="module">
  import RefreshRuntime from '/@react-refresh';
  RefreshRuntime.injectIntoGlobalHook(window);
  window.$RefreshReg$ = () => {};
  window.$RefreshSig$ = () => type => type;
  window.__vite_plugin_react_preamble_installed__ = true;
</script>`;

try {
  const context = await browser.newContext({hasTouch:true});
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const entry = await (await context.request.get(origin + '/src/main.tsx')).text();
  const react = entry.match(/"([^"]*\/react\.js[^\"]*)"/)[1];
  const reactDom = entry.match(/"([^"]*\/react-dom_client\.js[^\"]*)"/)[1];
  const liveBriefing = await (await context.request.get(origin + '/src/components/activity/useLiveBriefing.ts')).text();
  const reactQuery = liveBriefing.match(/"([^"]*\/@tanstack_react-query\.js[^\"]*)"/)[1];
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  let reply = base;
  await page.route('**/api/v1/companies/preview/assistant/messages', route => route.fulfill({json:
    route.request().postDataJSON().kind === 'BRIEFING' ? reply : {
      message:'Workspace response. '.repeat(160),references:[],mode:'AI',observed_at:new Date().toISOString(),limited:false,
    },
  }));
  // The open card refetches deterministic totals; returning the opening facts keeps the commentary current.
  await page.route('**/api/v1/companies/preview/assistant/briefing', route => route.fulfill({json: { briefing: reply.briefing, observed_at: reply.observed_at }}));
  await page.route(origin + '/__briefing-preview', route => route.fulfill({ contentType: 'text/html', body: `
    <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="margin:0;background:#e8eef1"><div id="root"></div>${preamble}<script type="module">
    import React from '${react}';
    import ReactDOM from '${reactDom}';
    import {QueryClient, QueryClientProvider} from '${reactQuery}';
    import {MonitorActivity} from '/src/components/activity/MonitorActivity.tsx';
    import '/src/index.css';
    function Preview() {
      const [open,setOpen] = React.useState(true);
      return React.createElement('div',{style:{position:'fixed',bottom:24,left:24}},
        React.createElement(MonitorActivity,{slug:'preview',open,active:true,onOpenChange:setOpen}));
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider,{client:new QueryClient()},React.createElement(Preview)));
    </script></body></html>` }));

  const cases = [
    ['empty', base],
    ['busy', { ...base, message: 'Review unassigned orders and confirm driver readiness before dispatching. Check the recorded issues for any delivery constraints that need your attention before assigning more work.',
      briefing: { ...base.briefing, received: 1250, unassigned: 150, assigned: 200, in_progress: 300, completed: 600, open_incidents: 12, dispatch_mode: 'AUTO',
        assigned_by_driver: [{ driver_name: 'Alexandra Montgomery', orders: 420 }, { driver_name: 'Samuel Leblanc', orders: 380 }, { driver_name: 'Priya Raman', orders: 200 }, { driver_name: 'Jo Kim', orders: 100 }] } }],
    ['evening', { ...base, briefing: { ...base.briefing, evening: true, received: 1, completed: 1 } }],
    ['unavailable', { ...base, mode: 'SEARCH', message: 'Live totals are shown. AI commentary is unavailable.' }],
  ];
  for (const [name, fixture] of cases) {
    reply = fixture;
    for (const [width,height] of [[1440,900],[503,692],[390,844],[320,568]]) {
      await page.setViewportSize({width,height});
      await page.goto(origin + '/__briefing-preview');
      await page.getByLabel('Daily briefing', {exact:true}).waitFor();
      const measurements = await page.locator('.company-activity-panel').evaluate(panel => {
        const body = panel.querySelector('.assistant-panel-body');
        const rect = panel.getBoundingClientRect();
        return {scroll:body.scrollHeight-body.clientHeight,scrollTop:body.scrollTop,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,height:rect.height};
      });
      if (measurements.scroll > 1) await page.screenshot({path:`/tmp/dispatra-briefing-overflow-${width}.png`});
      assert.ok(measurements.scroll <= 1, `${name} ${width}x${height}: opening briefing scrolls ${JSON.stringify(measurements)}`);
      assert.equal(measurements.scrollTop,0);
      assert.ok(measurements.top >= 0 && measurements.bottom <= height && measurements.left >= 0 && measurements.right <= width);
      assert.equal(await page.getByLabel('Message Dispatra').isVisible(),true);
      assert.equal(await page.getByRole('button',{name:'Which orders need attention and why?',exact:true}).isVisible(),true);
      if (name === 'empty' && [503,320].includes(width)) await page.screenshot({path:`/tmp/dispatra-briefing-${width}.png`});
    }
  }
  await page.getByRole('button',{name:'List all new orders.',exact:true}).click();
  await page.getByText('Workspace response.',{exact:false}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.company-activity-panel')?.dataset.view==='conversation');
  assert.ok(await page.locator('.assistant-panel-body').evaluate(el=>el.scrollHeight>el.clientHeight),'Long conversations remain scrollable');
  await page.getByRole('button',{name:'Close Dispatra'}).click();
  await page.getByLabel('Message Dispatra').fill('Retained question');
  assert.equal(await page.getByRole('dialog',{name:'Dispatra'}).count(),0,'Composer focus does not reopen the panel');

  // Reproduce the account verification entry without sending mail or changing a database.
  const verifyContext = await browser.newContext({viewport:{width:390,height:844}});
  await verifyContext.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const verifyPage = await verifyContext.newPage();
  verifyPage.on('pageerror', error => errors.push(error.message));
  const account = {id:'dispatcher',login_id:'preview@example.com',display_name:'Preview',role:'DISPATCHER',tms_workspace:false,
    organization:{id:'preview',slug:'preview',name:'Preview',active:true,payment_required:false}};
  let verified = false, lateReads = 0;
  await verifyPage.route('**/api/v1/auth/verification',route=>{
    if(verified) {lateReads++;return route.fulfill({status:401,json:{error:{message:'Sign in to resume email verification.'}}});}
    return route.fulfill({json:{verification_required:true,email:'preview@example.com',expires_at:new Date(Date.now()+600000).toISOString(),resend_at:new Date(Date.now()-1000).toISOString(),delivery_status:'SENT'}});
  });
  await verifyPage.route('**/api/v1/auth/verification/confirm',route=>{
    if(route.request().postDataJSON().code!=='123456')return route.fulfill({status:400,json:{error:{message:'The code is incorrect. Please try again.'}}});
    verified=true;return route.fulfill({json:account});
  });
  await verifyPage.route(origin+'/preview/settings',route=>route.fulfill({contentType:'text/html',body:'<h1>Settings</h1>'}));
  await verifyPage.goto(origin+'/signup/verify');
  await verifyPage.getByLabel('Verification code').fill('000000');
  await verifyPage.getByRole('button',{name:'Verify email',exact:true}).click();
  await verifyPage.getByRole('alert').waitFor();
  await verifyPage.getByLabel('Verification code').fill('123456');
  await verifyPage.getByRole('alert').waitFor({state:'hidden'});
  const flashes=[];
  await verifyPage.exposeFunction('recordVerificationError',message=>flashes.push(message));
  await verifyPage.evaluate(()=>{
    new MutationObserver(()=>{
      for(const alert of document.querySelectorAll('[role="alert"]')) if(alert.textContent) window.recordVerificationError(alert.textContent);
    }).observe(document.body,{subtree:true,childList:true,characterData:true});
  });
  await verifyPage.getByRole('button',{name:'Verify email',exact:true}).click({noWaitAfter:true});
  await verifyPage.waitForURL(origin+'/preview/settings');
  await verifyPage.getByRole('heading',{name:'Settings',exact:true}).waitFor();
  assert.deepEqual(flashes,[],'Successful verification must not flash an error before navigation');
  assert.equal(lateReads,0);
  assert.deepEqual(errors,[]);
  console.log('PASS: verification retry/success/Settings redirect; empty, busy, evening and unavailable briefings fit at four viewport sizes; chat remains scrollable.');
} catch (error) {
  console.error('Browser errors:', errors);
  throw error;
} finally { await browser.close(); }
