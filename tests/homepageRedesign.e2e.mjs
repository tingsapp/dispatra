import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3000';
const output = process.env.HOME_SCREENSHOT_DIR || '/tmp/dispatra-homepage';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
 const context = await browser.newContext({ reducedMotion: 'reduce' });
 await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.origin !== origin) return route.abort();
  if (url.pathname === '/api/v1/subscription/plan') return route.fulfill({ json: { trial_enabled: true, trial_days: 30, monthly_price: null, currency: 'CAD', dispatch_monthly_price: null, dispatch_currency: 'CAD' } });
  if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 401, json: { detail: 'Sign in' } });
  return route.continue();
 });
 const page = await context.newPage(), errors = [];
 page.on('pageerror', error => errors.push(error.message));
 const labels = ['Order agent', 'Dispatch agent', 'Route optimizer', 'Driver'];
 for (const width of [1440, 768, 390, 320]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(origin, { timeout: 90000 });
  const section = page.locator('#how-it-works');
  const steps = section.getByRole('list', { name: 'Explore the dispatch process' });
  assert.equal(await steps.getByRole('button').count(), 4);
  for (let index = 0; index < labels.length; index++) {
   const step = steps.getByRole('button', { name: labels[index], exact: true });
   await step.click();
   assert.equal(await step.getAttribute('aria-current'), 'step');
   await section.getByRole('region', { name: `${labels[index]} demonstration` }).waitFor();
   await section.locator(`.agent-panel-slide[data-stage="${index}"]`).waitFor();
   assert.equal(await section.locator('.agent-process-panel').count(), 1);
   assert.equal(await section.locator('.process-route-map').count(), index === 2 ? 1 : 0);
   if(index === 0) { for(const source of ['Email', 'Shipper portal', 'Dispatcher', 'TMS / API']) await section.getByText(source, {exact:true}).waitFor(); }
   if(index === 1) assert.equal(await section.locator('.process-driver[data-selected="true"]').count(), 1);
   if(index === 2) { assert.equal(await section.locator('.process-route-option').count(), 2); await section.getByText('Best path selected', {exact:true}).waitFor(); }
   if(index === 3) { await section.getByText('Completed', {exact:true}).waitFor(); await section.getByText('Signature collected', {exact:true}).waitFor(); }
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px ${labels[index]} fits`);
   await section.screenshot({ path: `${output}/process-${width}-${index + 1}.png` });
  }
  await page.keyboard.press('Home');
  assert.equal(await steps.getByRole('button', { name: 'Order agent', exact: true }).getAttribute('aria-current'), 'step');
  await page.keyboard.press('ArrowDown');
  assert.equal(await steps.getByRole('button', { name: 'Dispatch agent', exact: true }).getAttribute('aria-current'), 'step');
  console.log(`Passed four panels, keyboard and page fit at ${width}px.`);
 }
 assert.deepEqual(errors, []);
 console.log('PASS: one four-step sidebar, one dynamic panel, contextual maps, keyboard and reduced-motion layouts.');
} finally { await browser.close(); }
