import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3000';
const output = process.env.HOME_SCREENSHOT_DIR || '/tmp/dispatra-homepage';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/api/v1/auth/me') return route.fulfill({ status: 401, json: { error: { message: 'Sign in' } } });
    if (url.pathname === '/api/v1/subscription/plan') return route.fulfill({ json: { name: 'Monthly subscription', interval: 'MONTHLY', trial_days: 30, monthly_price: null, currency: 'CAD', dispatch_monthly_price: null, dispatch_currency: 'CAD' } });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 401, json: { detail: 'Sign in' } });
    return route.continue();
  });
  const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.clock.install();
  await page.goto(origin);
  const workflow = page.getByRole('list', { name: 'Explore the sample order workflow' });
  const feed = page.getByRole('region', { name: 'Sample order activity' });
  const names = ['Receive', 'Prepare', 'Dispatch', 'Pick up', 'Capture proof', 'Complete'];
  const events = ['Order received from email', 'Order details prepared', 'Eligible driver assigned', 'Pickup confirmed', 'Delivery proof captured', 'Order completed'];
  for (let i = 0; i < names.length; i++) {
    const step = workflow.getByRole('button', { name: `Step ${i + 1}: ${names[i]}`, exact: true });
    await step.click();
    await feed.getByText(events[i], { exact: true }).waitFor();
    assert.equal(await step.getAttribute('aria-current'), 'step');
    await feed.getByRole('button', { name: 'Play preview animation' }).waitFor();
  }
  await feed.getByRole('button', { name: 'Play preview animation' }).click();
  await page.clock.fastForward(5500); await page.clock.runFor(50);
  await feed.getByText(events[0], { exact: true }).waitFor();
  assert.equal(await workflow.getByRole('button', { name: 'Step 1: Receive' }).getAttribute('aria-current'), 'step');
  await feed.getByRole('button', { name: 'Pause preview animation' }).click();
  console.log('Workflow selection and playback passed.');
  const team = page.getByRole('region', { name: 'One connected team', exact: true });
  for (const role of ['Driver', 'Shipper', 'Dispatcher']) {
    const tab = team.getByRole('tab', { name: role, exact: true }); await tab.click();
    assert.equal(await tab.getAttribute('aria-selected'), 'true');
    assert.equal(await team.getByRole('tabpanel').getAttribute('aria-labelledby'), await tab.getAttribute('id'));
    assert.equal(await team.getByRole('link', { name: `Sign in as a ${role.toLowerCase()}` }).getAttribute('href'), '/' + (role === 'Dispatcher' ? 'dispatch' : role.toLowerCase()));
    const img = team.getByRole('img'); await img.evaluate(el => el.decode());
    assert.ok(await img.evaluate(el => el.naturalWidth > 0), `${role} image loaded`);
  }
  await team.getByRole('tab', { name: 'Dispatcher', exact: true }).focus();
  await page.keyboard.press('End');
  assert.equal(await team.getByRole('tab', { name: 'Shipper' }).getAttribute('aria-selected'), 'true');
  await page.keyboard.press('ArrowRight');
  assert.equal(await team.getByRole('tab', { name: 'Dispatcher', exact: true }).getAttribute('aria-selected'), 'true');
  console.log('Role previews and keyboard navigation passed.');
  const questions = page.locator('#home-questions');
  await questions.getByText('Can my dispatchers stay in control?', { exact: true }).click();
  assert.ok(await questions.getByText(/Both modes optimize routes after assignment/).isVisible());
  assert.equal(await page.locator('#why-dispatra .why-dispatra-hub').count(), 0);
  await page.locator('#why-dispatra').scrollIntoViewIfNeeded();
  await page.clock.runFor(50);
  await page.getByRole('button', { name: 'Pause route constellation animation' }).click();
  console.log('FAQs and constellation passed.');
  await page.getByRole('link', { name: 'Explore the full workspace', exact: true }).click();
  await page.waitForURL(origin + '/plans#plan-full');
  await page.locator('#plan-full').waitFor();
  await page.waitForFunction(() => document.getElementById('plan-full').getBoundingClientRect().top < 60);
  console.log('Full plan landing passed.');
  await page.goto(origin);
  await page.getByRole('link', { name: 'Explore Smart Dispatching', exact: true }).click();
  await page.waitForURL(origin + '/plans#plan-dispatch');
  await page.locator('#plan-dispatch').waitFor();
  await page.waitForFunction(() => document.getElementById('plan-dispatch').getBoundingClientRect().top < 60);
  console.log('Dispatch plan landing passed.');
  await page.goto(origin);
  await page.getByRole('link', { name: 'Start Free Trial', exact: true }).click();
  await page.waitForURL(origin + '/plans');
  await page.getByRole('button', { name: 'Start free trial', exact: true }).click();
  await page.getByRole('dialog', { name: 'Start your free trial' }).waitFor();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.goto(origin);
  await page.getByRole('tab', { name: 'Driver', exact: true }).click();
  await page.getByRole('img', { name: 'Driver workspace with illustrative delivery orders' }).evaluate(el => el.decode());
  await page.screenshot({ path: output + '/homepage-desktop.png', fullPage: true });
  await page.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: output + '/homepage-intro.png', fullPage: true, clip: { x: 0, y: 0, width: 1440, height: 1390 } });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(origin);
    await page.getByRole('heading', { level: 1 }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px: page fits`);
    for (const label of names) await workflow.getByRole('button', { name: new RegExp(`Step \\d: ${label}$`) }).click();
    await feed.getByText('Order completed', { exact: true }).waitFor();
    for (const role of ['Dispatcher', 'Driver', 'Shipper']) {
      await team.getByRole('tab', { name: role, exact: true }).click();
      await team.getByRole('img').evaluate(el => el.decode());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px ${role}: fits`);
    }
    await page.screenshot({ path: output + `/homepage-${width}.png`, fullPage: true });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(origin);
  await feed.getByText('Order completed', { exact: true }).waitFor();
  await workflow.getByRole('button', { name: 'Step 1: Receive' }).click();
  await feed.getByText('Order received from email', { exact: true }).waitFor();
  const still = await feed.innerText(); await page.clock.fastForward(15000);
  assert.equal(await feed.innerText(), still);
  assert.equal(await page.getByRole('button', { name: /Pause .*animation/ }).count(), 0);
  // Exercise native IntersectionObserver with a real clock, independently of the timeline checks.
  const visibilityContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await visibilityContext.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    return url.pathname.startsWith('/api/') ? route.fulfill({ status: 401, json: { detail: 'Sign in' } }) : route.continue();
  });
  const visibilityPage = await visibilityContext.newPage();
  visibilityPage.on('pageerror', e => errors.push(e.message));
  await visibilityPage.goto(origin);
  const monitor = visibilityPage.locator('[data-preview-active]');
  await monitor.scrollIntoViewIfNeeded();
  await visibilityPage.waitForFunction(() => document.querySelector('[data-preview-active]')?.dataset.previewActive === 'true');
  await visibilityPage.getByRole('button', { name: 'Step 1: Receive', exact: true }).click();
  await visibilityPage.getByRole('button', { name: 'Play preview animation' }).click();
  await visibilityPage.locator('#home-questions').scrollIntoViewIfNeeded();
  await visibilityPage.waitForFunction(() => document.querySelector('[data-preview-active]')?.dataset.previewActive === 'false');
  const selectedStep = () => visibilityPage.locator('.home-demo-step[aria-current]').getAttribute('aria-label');
  const beforeHidden = await selectedStep();
  await visibilityPage.waitForTimeout(2800);
  assert.equal(await selectedStep(), beforeHidden, 'Offscreen Monitor progression is suspended');
  await monitor.scrollIntoViewIfNeeded();
  await visibilityPage.waitForFunction(() => document.querySelector('[data-preview-active]')?.dataset.previewActive === 'true');
  await visibilityPage.waitForFunction(label => document.querySelector('.home-demo-step[aria-current]')?.getAttribute('aria-label') !== label, beforeHidden);
  await visibilityContext.close();
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: six selectable stages, playback synchronization and native offscreen suspension, role tabs/images/keyboard navigation, plan deep links, FAQ, trial popup, preserved open-center constellation, desktop and 390/320px layouts, reduced motion; no browser errors.');
} finally { await browser.close(); }
