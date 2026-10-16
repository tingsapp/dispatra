// Layout and interaction acceptance with isolated API fixtures; never writes tenant data.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:14128';
const shots = process.env.E2E_SCREENSHOT_DIR;
if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, reducedMotion: 'no-preference' });
const page = await context.newPage(); const errors = []; const unexpected = [];
page.on('pageerror', error => errors.push(error.message));
const time = new Date().toISOString(); let mode = 'mixed'; let progress = 45; let monitorFails = false; let checks = 0; let reviews = 0;
const agents = () => ['ORDER', 'DISPATCH', 'OPERATIONAL', 'TECHNICAL', 'CHAT'].map((agent, index) => ({ agent,
  run: mode === 'empty' ? null : { id: `run-${agent}`, agent, status: index === 0 ? 'RUNNING' : index === 1 ? 'FAILED' : index === 2 ? 'QUEUED' : 'SUCCEEDED', progress: index === 0 ? progress : 100,
    step: 'Saved run status', created_at: time, heartbeat_at: time, finished_at: index > 2 || index === 1 ? time : null },
  stale: mode === 'stale' && index === 0, queued: index === 2 && mode !== 'empty' ? 1 : 0, issue_count: mode !== 'empty' && index === 1 ? 2 : 0 }));
const report = { id: 'issue-1', version: 1, organization_id: 'company-1', company_name: 'Sample company', agent: 'DISPATCH', kind: 'WORKER_PROGRESS', severity: 'WARNING', title: 'Dispatch progress needs investigation', description: 'Review saved worker progress.', status: 'NEEDS_ADMIN', action: null, automatic: false, fixed_count: 0, created_at: time, updated_at: time };
await context.route('**/api/v1/**', async route => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/api/v1/auth/me') return route.fulfill({ json: { id: 'owner', role: 'ADMIN', login_id: 'owner', display_name: 'Demo Admin', organization: null, tms_workspace: false } });
  if (path.endsWith('/agents/monitor')) return route.fulfill(monitorFails ? { status: 503, json: { error: { message: 'Monitoring unavailable.' } } } : { json: { observed_at: time, agents: agents(), running: mode === 'empty' ? 0 : 1, awaiting_approval: 0, needs_attention: mode === 'empty' ? 0 : 2, automatic_fixes_24h: mode === 'empty' ? 0 : 4, errors_24h: 1, issues: mode === 'empty' ? [] : [report] } });
  if (path.endsWith('/notifications')) return route.fulfill({ json: { items: [], unread: 0 } });
  if (path.endsWith('/agents/technical/check')) { checks++; return route.fulfill({ json: { ...agents()[3].run, status: 'QUEUED' } }); }
  if (path.endsWith('/agents/operational/check')) { reviews++; return route.fulfill({ json: { ...agents()[2].run, status: 'QUEUED' } }); }
  if (path.endsWith('/agents/issues')) return route.fulfill({ json: { items: mode === 'empty' ? [] : [report], next_before: null } });
  if (path.endsWith('/agents/operational/issues') || path.endsWith('/agents/logs')) return route.fulfill({ json: { items: [], next_before: null } });
  unexpected.push(`${route.request().method()} ${path}`); return route.fulfill({ json: [] });
});
const close = async () => { await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' }); };
try {
  await page.goto(origin + '/admin/monitor');
  await page.getByRole('region', { name: 'Agent activity', exact: true }).waitFor();
  await page.getByRole('button', { name: '2 reports need attention ↗', exact: true }).waitFor();
  assert.equal(await page.getByRole('progressbar', { name: 'Order agent progress' }).getAttribute('aria-valuenow'), '45');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1080 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}`);
    assert.equal(await page.locator('[data-machine-agent]').count(), 5);
    for (const card of await page.locator('[data-machine-agent]').all()) {
      assert.ok(await card.evaluate(node => node.scrollWidth <= node.clientWidth), `Node ${await card.getAttribute("data-machine-node")} overflow at ${width}: ${JSON.stringify(await card.evaluate(node => ({scroll:node.scrollWidth,client:node.clientWidth})))}`);
      assert.ok((await card.getByRole('button').boundingBox()).height >= 44);
    }
    await page.locator('.app-page').evaluate(node => node.scrollTop = 0);
    if (shots) await page.screenshot({ path: `${shots}/monitor-${width}.png`, fullPage: true });
    const dispatch = page.getByRole('button', { name: 'Dispatch agent: 2 open issues' });
    await dispatch.click();
    const dialog = page.getByRole('dialog', { name: 'Dispatch agent log', exact: true }); await dialog.waitFor();
    await dialog.getByText(report.title, { exact: true }).waitFor();
    await dialog.getByRole('button', { name: /^Details:/ }).click();
    await dialog.getByText(report.description, { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Dialog overflow at ${width}`);
    if (shots && width === 390) await page.screenshot({ path: `${shots}/monitor-report-390.png`, fullPage: true });
    await close();
    assert.ok(await dispatch.evaluate(node => node === document.activeElement));
    for (const key of ['Enter', 'Space']) { await dispatch.press(key); await dialog.waitFor(); await close(); }
  }
  await page.getByRole('button', { name: '2 reports need attention ↗', exact: true }).click();
  await page.getByRole('dialog', { name: 'Platform log', exact: true }).waitFor(); await close();
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.getByRole('button', { name: 'Demo flow', exact: true }).click();
  await page.getByRole('button', { name: 'Pause demonstration', exact: true }).click();
  let event = await page.locator('.machine-demo-event').innerText();
  await page.getByRole('button', { name: 'Next demonstration step', exact: true }).click();
  assert.notEqual(await page.locator('.machine-demo-event').innerText(), event);
  assert.equal(await page.locator('[data-machine-node="ORDER"]').getAttribute('data-active'), 'true');
  assert.ok(await page.locator('.machine-signal').count() > 0);
  assert.equal(await page.locator('.machine-signal').first().evaluate(node => getComputedStyle(node).animationPlayState), 'paused');
  if (shots) { await page.locator('.app-page').evaluate(node => node.scrollTop = 0); await page.screenshot({ path: `${shots}/machine-demo.png`, fullPage: true }); }
  await page.getByRole('button', { name: 'Play demonstration', exact: true }).click();
  event = await page.locator('.machine-demo-event').innerText();
  await page.waitForFunction(previous => document.querySelector('.machine-demo-event')?.innerText !== previous, event);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.machine-signal').first().evaluate(node => getComputedStyle(node).animationName), 'none');
  await page.getByRole('button', { name: 'Live system', exact: true }).click();
  assert.equal(await page.locator('.machine-playback').count(), 0);
  progress = 75; await page.reload();
  await page.getByRole('progressbar', { name: 'Order agent progress' }).waitFor();
  assert.equal(await page.getByRole('progressbar', { name: 'Order agent progress' }).getAttribute('aria-valuenow'), '75');
  mode = 'stale'; await page.reload(); await page.getByText('Progress overdue', { exact: true }).waitFor(); assert.equal(await page.getByRole('progressbar').count(), 0);
  mode = 'empty'; await page.reload(); await page.getByRole('button', { name: 'View platform log ↗', exact: true }).waitFor();
  assert.equal(await page.getByText('No recorded run yet.', { exact: true }).count(), 5);
  await page.getByRole('button', { name: 'View platform log ↗', exact: true }).click(); await page.getByRole('dialog', { name: 'Platform log', exact: true }).waitFor(); await close();
  await page.getByRole('button', { name: 'Run checks', exact: true }).click(); await page.getByText('Platform checks requested.', { exact: true }).waitFor(); assert.equal(checks, 1);
  assert.equal(await page.getByRole('button', { name: /Review orders|Order review queued or running/ }).count(), 0); assert.equal(reviews, 0);
  monitorFails = true; await page.reload(); await page.getByRole('button', { name: 'Try again', exact: true }).waitFor();
  monitorFails = false; await page.getByRole('button', { name: 'Try again', exact: true }).click(); await page.getByRole('region', { name: 'Platform summary', exact: true }).waitFor();
  assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
  console.log('PASS: connected machine, real signals, demo animation/pause/step/reduced motion,  summary, all five agents, desktop/tablet/390/320px bounds, visible issue counts, progress updates and overdue state, empty history, scoped/combined reports, full-card click/keyboard/focus, check command and no manual order-review control, loading failure/retry and no browser errors.');
} finally { await browser.close(); }
