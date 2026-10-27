// Live owner monitor journey; TEST_* URLs must point to a disposable migrated *_test database.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN;
if (!origin || !process.env.E2E_OWNER_PASSWORD || !process.env.TEST_OWNER_DATABASE_URL?.endsWith('_test') || !process.env.DATABASE_URL?.endsWith('_test')) throw new Error('Use disposable test servers and credentials.');
const apiRoot = fileURLToPath(new URL('../../api/', import.meta.url));
const run = code => execFileSync(`${apiRoot}.venv/bin/python`, ['-c', code], { cwd: apiRoot, env: process.env, encoding: 'utf8' }).trim();
const worker = () => run('from app.agents.technical_worker import cycle; assert cycle(force=True)');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })).newPage();
const errors = []; page.on('pageerror', error => errors.push(error.message));
const shots = process.env.E2E_SCREENSHOT_DIR;
const companyName = `Monitor acceptance ${Date.now()}`;
if (shots) await mkdir(shots, { recursive: true });
const close = () => page.getByRole('button', { name: 'Close agent details', exact: true }).click();
try {
  await page.goto(`${origin}/admin/monitor`);
  await page.getByLabel('Email', { exact: true }).fill(process.env.E2E_OWNER_LOGIN || 'owner');
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_OWNER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('region', { name: 'Agent activity', exact: true }).waitFor();
  const headingRow = page.locator('.app-page-header');
  const titleBox = await headingRow.getByRole('heading', { name: 'One connected machine.', exact: true }).boundingBox();
  const descriptionBox = await headingRow.getByText('Live engines, agents and data flow.', { exact: true }).boundingBox();
  const checkBox = await headingRow.getByRole('button', { name: 'Run checks', exact: true }).boundingBox();
  assert.ok(checkBox.x > titleBox.x + titleBox.width && checkBox.y >= titleBox.y - 2 && checkBox.y + checkBox.height <= descriptionBox.y + descriptionBox.height + 2, 'Platform checks aligns beside the title and description');
  assert.equal(await page.locator('[data-machine-agent]').count(), 5);
  assert.equal(await page.getByRole('region', { name: 'Platform summary', exact: true }).count(), 1);
  assert.equal(await page.getByRole('region', { name: 'Report entries' }).count(), 0);
  const org = await page.evaluate(async name => {
    const response = await fetch('/api/v1/platform/organizations', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'Dispatra', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ name, slug: `monitor-${Date.now()}`, admin_login: 'desk', password: 'Monitor-test-password-123!' }) });
    if (!response.ok) throw new Error(`Test company creation failed: ${response.status}`);
    return response.json();
  }, companyName);
  const identity = run(`
import os
from uuid import UUID
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.main import app
from app.models import now
from app.intake.models import EmailIntake
from app.agents import diagnostics
with Session(create_engine(os.environ['TEST_OWNER_DATABASE_URL'])) as db, db.begin():
    row = EmailIntake(organization_id=UUID('${org.id}'), message_id='monitor-e2e', received_at=now(), from_address='private@example.com', body='PRIVATE_BOOKING_CONTENT', status='FAILED', error_code='AI_UNAVAILABLE')
    db.add(row); db.flush(); print(row.id)
diagnostics.record('WEB', 'RUNTIME_ERROR', UUID('${org.id}'))
`);
  worker(); await page.reload();
  const issueCard = page.getByRole('button', { name: /^Order agent: \d+ open issues?$/ });
  await issueCard.waitFor();
  assert.ok(await page.getByRole('region', { name: 'Order agent', exact: true }).getByText(/open issues?/).count());
  assert.equal(await page.getByRole('region', { name: 'Report entries' }).count(), 0);
  if (shots) await page.screenshot({ path: `${shots}/monitor-desktop.png`, fullPage: true });
  await issueCard.click();
  await page.getByRole('dialog', { name: 'Order agent log', exact: true }).waitFor();
  const repair = page.getByRole('article', { name: `Order agent processing failed · ${companyName}`, exact: true });
  await repair.getByText('Awaiting approval', { exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog', { name: 'Order agent log', exact: true }).getByText('Web application error reported', { exact: true }).count(), 0, 'Order card opens only Order-agent reports');
  assert.ok(!(await page.locator('body').innerText()).includes('PRIVATE_BOOKING_CONTENT'));
  assert.ok(!(await page.locator('body').innerText()).includes('private@example.com'));
  await page.waitForFunction(() => { const panel = document.querySelector('[data-entity-dialog]'); const surface = panel?.querySelector('.app-dialog-surface'); return panel && surface && getComputedStyle(panel).opacity === '1' && getComputedStyle(surface).opacity === '1'; });
  if (shots) await page.screenshot({ path: `${shots}/monitor-agent-issues-desktop.png`, fullPage: true, animations: 'disabled' });
  assert.equal(await repair.getByRole('button', { name: 'Review repair', exact: true }).isVisible(), false);
  await repair.getByRole('button', { name: /^Details:/ }).click();
  if (shots) await page.screenshot({ path: `${shots}/monitor-issue-expanded-desktop.png`, fullPage: true, animations: 'disabled' });
  await repair.getByRole('button', { name: 'Review repair', exact: true }).click();
  await page.getByRole('alertdialog').waitFor(); await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog', { name: 'Order agent log', exact: true }).count(), 1);
  assert.equal(run(`import os; from uuid import UUID; from sqlalchemy import create_engine; from sqlalchemy.orm import Session; from app.main import app; from app.intake.models import EmailIntake; db=Session(create_engine(os.environ['TEST_OWNER_DATABASE_URL'])); print(db.get(EmailIntake, UUID('${identity}')).status)`), 'FAILED');
  await repair.getByRole('button', { name: 'Review repair', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Approve repair', exact: true }).click();
  await repair.getByText('Approved · queued', { exact: true }).waitFor();
  worker(); await page.reload();
  await page.getByRole('region', { name: 'Order agent', exact: true }).getByRole('button').click();
  await repair.waitFor({ state: 'hidden' });
  assert.equal(run(`import os; from uuid import UUID; from sqlalchemy import create_engine; from sqlalchemy.orm import Session; from app.main import app; from app.intake.models import EmailIntake; db=Session(create_engine(os.environ['TEST_OWNER_DATABASE_URL'])); print(db.get(EmailIntake, UUID('${identity}')).status)`), 'RECEIVED');
  await close();
  await page.getByRole('region', { name: 'Technical agent', exact: true }).getByRole('button').click();
  const investigation = page.getByRole('article', { name: `Web application error reported · ${companyName}`, exact: true });
  assert.equal(await investigation.getByRole('button', { name: 'Review repair' }).count(), 0);
  await investigation.getByRole('button', { name: /^Details:/ }).click();
  await investigation.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Dismiss report', exact: true }).click();
  await investigation.waitFor({ state: 'hidden' });
  await close(); assert.equal(await page.getByRole('region', { name: 'Report entries' }).count(), 0);
  await page.getByRole('button', { name: 'Run checks', exact: true }).click();
  await page.getByRole('button', { name: 'Checks queued or running', exact: true }).waitFor();
  worker(); await page.reload();
  await page.getByRole('button', { name: 'Run checks', exact: true }).waitFor();
  run(`
from app.main import app
from app.agents.telemetry import monitor_run
with monitor_run('ORDER') as progress:
    for index in range(80): progress.step(f'Checking saved task {index} through normal validation. ' + 'Progress detail for the administrator. ' * 4)
`);
  await page.getByRole('region', { name: 'Order agent', exact: true }).getByRole('button').click();
  await page.getByRole('region', { name: 'Agent log', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Details: Recorded activity', exact: true }).count(), 0);
  assert.equal(await page.getByText(/Checking saved task/).count(), 0);
  if (shots) await page.screenshot({ path: `${shots}/monitor-agent-issues-only-desktop.png`, fullPage: true });
  await close();
  // A fresh Technical report gives mobile acceptance its own unresolved issue card after dismissal above.
  run(`from uuid import UUID; from app.main import app; from app.agents import diagnostics; diagnostics.record('API', 'HTTP_5XX', UUID('${org.id}'))`);
  worker(); await page.reload();
  // Controlled monitor responses verify running progress without starting an operational worker.
  let fixtureProgress = 45, fixtureStale = false, fixturePhase = 'RUNNING';
  const monitorPattern = '**/api/v1/platform/agents/monitor';
  await page.route(monitorPattern, async route => {
    const response = await route.fetch(), body = await response.json();
    const agent = body.agents.find(row => row.agent === 'ORDER');
    agent.run = { ...agent.run, status: fixturePhase, progress: fixtureProgress, step: 'Validating booking facts.', heartbeat_at: new Date().toISOString(), finished_at: fixturePhase === 'FAILED' ? new Date().toISOString() : null };
    agent.stale = fixtureStale;
    const state = body.machine?.agents.find(row => row.agent === 'ORDER');
    if (state) { state.state = fixtureStale || fixturePhase === 'FAILED' ? 'ERROR' : 'PROCESSING'; state.detail = fixtureStale ? 'Progress is overdue.' : fixturePhase === 'FAILED' ? 'Run failed.' : 'Validating booking facts.'; }
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  const workingCard = page.getByRole('region', { name: 'Order agent', exact: true });
  const filledHeader = workingCard;
  await workingCard.getByText(/^Processing/).waitFor();
  const fillRatio = async () => filledHeader.evaluate(node => { const fill = node.querySelector('[data-agent-card-fill]'); return fill.getBoundingClientRect().width / fill.parentElement.getBoundingClientRect().width; });
  assert.ok(Math.abs(await fillRatio() - .45) < .01);
  assert.equal(await filledHeader.getByRole('progressbar').getAttribute('aria-valuenow'), '45');
  assert.equal(await filledHeader.getByRole('button').count(), 1);
  if (shots) await page.screenshot({ path: `${shots}/monitor-working-desktop.png`, fullPage: true, animations: 'disabled' });
  await filledHeader.getByRole('button').click();
  await page.getByRole('dialog', { name: 'Order agent log', exact: true }).waitFor(); await close();
  fixtureProgress = 75; await page.reload();
  await workingCard.getByText(/^Processing/).waitFor();
  assert.ok(Math.abs(await fillRatio() - .75) < .01);
  fixturePhase = 'FAILED'; await page.reload();
  await workingCard.getByText('Error', { exact: true }).waitFor();
  assert.equal(await filledHeader.locator('[data-agent-card-fill]').count(), 0);
  fixturePhase = 'RUNNING'; fixtureStale = true; await page.reload();
  await workingCard.getByText('Error', { exact: true }).waitFor();
  assert.equal(await filledHeader.locator('[data-agent-card-fill]').count(), 0);
  fixtureProgress = 45; fixtureStale = false; await page.reload();
  await workingCard.getByText(/^Processing/).waitFor();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Monitor overflow at ${width}px`);
    assert.equal(await page.locator('[data-machine-agent]').count(), 5);
    if (shots) await page.screenshot({ path: `${shots}/monitor-${width}.png`, fullPage: true, animations: 'disabled' });
    const technicalCard = page.getByRole('button', { name: /^Technical agent: \d+ open issues?$/ });
    const technicalCardBox = await technicalCard.boundingBox();
    await technicalCard.click({ position: { x: technicalCardBox.width - 24, y: technicalCardBox.height / 2 } });
    await page.getByRole('dialog', { name: 'Technical agent log', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Issue dialog overflow at ${width}px`);
    assert.equal(await page.locator('.app-dialog-surface').evaluate(node => node.scrollWidth > node.clientWidth), false, `Popup surface clips horizontally at ${width}px`);
    assert.equal(await page.locator('.app-dialog-body').evaluate(node => node.scrollWidth > node.clientWidth), false, `Popup body clips horizontally at ${width}px`);
    if (shots) await page.screenshot({ path: `${shots}/monitor-agent-issues-${width}.png`, fullPage: true, animations: 'disabled' });
    const mobileIssue = page.getByRole('article').first();
    await mobileIssue.getByRole('button', { name: /^Details:/ }).click();
    assert.equal(await page.locator('.app-dialog-body').evaluate(node => node.scrollWidth > node.clientWidth), false, `Expanded issue clips horizontally at ${width}px`);
    await mobileIssue.getByRole('button', { name: /^Details:/ }).click();
    assert.equal(await page.getByRole('combobox').count(), 0);
    const report = page.getByRole('dialog').getByRole('button', { name: /^Details:/ }).first();
    if (await report.count()) {
      await report.click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Expanded report overflow at ${width}px`);
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await technicalCard.press('Enter');
    await page.getByRole('dialog', { name: 'Technical agent log', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await technicalCard.press('Space');
    await page.getByRole('dialog', { name: 'Technical agent log', exact: true }).waitFor();
    await page.keyboard.press('Escape');
  }
  await page.unroute(monitorPattern);
  assert.deepEqual(errors, []);
  console.log('PASS: summary and agent cards, full-card mouse/keyboard scoped reports, approval Escape/cancellation/requeue, resolved-report removal, dismissal, checks, routine activity filtering, recorded progress, desktop and 390/320px layout.');
} finally { await browser.close(); }
