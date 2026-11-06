// Isolated recovery/assessment acceptance; no live tenants or provider calls.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:14128';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const diagnostics = [], writes = [], errors = [];
let reads = 0, mode = 'recover';
const time = new Date().toISOString();
const report = { id: 'technical-1', version: 1, organization_id: null, company_name: null, agent: 'TECHNICAL', kind: 'RUNTIME_ERROR',
  severity: 'CRITICAL', title: 'Web application error reported', description: 'Browser recovery was exhausted. Code changes need review.',
  diagnosis: 'The evidence is insufficient for a safe automatic code change. Next: inspect the failing component in an isolated test.',
  diagnosis_source: 'AI', diagnosed_at: time, status: 'NEEDS_ADMIN', action: null, automatic: false, fixed_count: 0, created_at: time, updated_at: time };
report.repair_stage = 'ESCALATED';
report.repair_summary = 'The proposed code fix affects permissions and needs admin review. No code was applied.';
page.on('pageerror', error => errors.push(error.message));
await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
await context.route('**/api/v1/**', async route => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/api/v1/auth/me') return route.fulfill({ json: { id: 'owner', role: 'ADMIN', login_id: 'owner', display_name: 'Test admin', organization: null, tms_workspace: false } });
  if (path === '/api/v1/diagnostics/runtime') {
    diagnostics.push(route.request().postDataJSON()); return route.fulfill({ status: 202, json: { accepted: true } });
  }
  if (route.request().method() !== 'GET') writes.push(path);
  if (path.endsWith('/agents/monitor')) {
    reads++;
    if ((mode === 'recover' && reads === 1) || mode === 'fail') return route.fulfill({ status: 503, json: { error: { message: 'Temporary failure' } } });
    return route.fulfill({ json: { observed_at: new Date().toISOString(), agents: ['ORDER','DISPATCH','OPERATIONAL','TECHNICAL','CHAT'].map(agent => ({agent, run:null, stale:false, queued:0, issue_count: agent === 'TECHNICAL' && mode === 'risk' ? 1 : 0})),
      running:0, awaiting_approval:0, needs_attention:mode === 'risk' ? 1 : 0, platform_attention:mode === 'risk' ? 1 : 0,
      automatic_fixes_24h:0, errors_24h:0, issues:mode === 'risk' ? [report] : [] } });
  }
  if (path.endsWith('/notifications')) return route.fulfill({ json: { items: [], unread: 0 } });
  if (path.endsWith('/agents/issues')) return route.fulfill({ json: { items:mode === 'risk' ? [report] : [], next_before:null } });
  if (path.endsWith('/agents/logs') || path.endsWith('/agents/operational/issues')) return route.fulfill({ json: { items:[], next_before:null } });
  return route.fulfill({ json: [] });
});
try {
  await page.goto(origin + '/admin/monitor', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByRole('region', { name: 'Agent activity', exact: true }).waitFor();
  assert.ok(reads >= 2);
  await page.waitForFunction(() => document.querySelector('.machine-monitor'));
  assert.equal(await page.getByRole('button', { name: /platform problem.*attention/ }).count(), 0);
  assert.ok(diagnostics.some(row => row.kind === 'READ_RECOVERED'));
  mode = 'fail'; await page.reload({waitUntil:'domcontentloaded', timeout:60_000});
  await page.getByRole('button', { name: 'Try again', exact:true }).waitFor();
  assert.ok(diagnostics.some(row => row.kind === 'READ_RECOVERY_FAILED'));
  mode = 'risk'; await page.reload({waitUntil:'domcontentloaded', timeout:60_000});
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: /Notifications/ }).click();
    await page.getByRole('button', { name: '1 platform problem needs attention · Review' }).click();
    const dialog = page.getByRole('dialog', { name: 'Platform log', exact: true }); await dialog.waitFor();
    await dialog.getByRole('button', { name: /^Details:/ }).click();
    await dialog.getByText('AI assessment · needs verification', { exact:true }).waitFor();
    await dialog.getByText('Code repair needs attention', { exact:true }).waitFor();
    await dialog.getByText(report.repair_summary, { exact:true }).waitFor();
    assert.equal(await dialog.getByRole('button', { name: 'Review repair', exact:true }).count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `/tmp/technical-recovery-${width}.png`, fullPage:true });
    await page.keyboard.press('Escape'); await dialog.waitFor({state:'hidden'});
  }
  assert.deepEqual(writes, []); assert.deepEqual(errors, []);
  assert.ok(diagnostics.every(row => Object.keys(row).sort().join(',') === 'kind,source'));
  console.log('PASS: silent read recovery, bounded exhaustion reporting, platform-wide alert, AI assessment, no unsafe repair/write, desktop and 320px layout.');
} finally { await browser.close(); }
