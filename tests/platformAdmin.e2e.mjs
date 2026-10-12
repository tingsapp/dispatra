// Owner → company → dispatcher → revoke journey against a live API and a disposable database.
// Provide the disposable owner's credentials through E2E_OWNER_LOGIN / E2E_OWNER_PASSWORD; they are never written to disk.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3001';
const ownerLogin = process.env.E2E_OWNER_LOGIN || 'owner';
const ownerPassword = process.env.E2E_OWNER_PASSWORD;
if (!ownerPassword) throw new Error('Set E2E_OWNER_PASSWORD for the owner of a disposable local database.');
const slug = `admin-e2e-${Date.now().toString(36)}`;
const name = `Admin Journey ${slug.slice(-6)}`;
const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'chrome', headless: true });
const errors = [];
const shots = process.env.E2E_SCREENSHOT_DIR;
const shot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }); };
const open = async () => { const context = await browser.newContext({ viewport: { width: 1365, height: 900 } }); const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); return page; };
const signIn = async (page, path, id, password) => {
  await page.goto(origin + path);
  await page.getByLabel('Login ID', { exact: true }).fill(id);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
};
const me = page => page.evaluate(async () => { const r = await fetch('/api/v1/auth/me'); return { status: r.status, body: r.ok ? await r.json() : null }; });
const credentials = async page => {
  await page.getByRole('heading', { name: 'Login details ready' }).waitFor();
  const text = await page.getByLabel('Login details', { exact: true }).inputValue();
  const password = text.match(/Password: (.+)/)[1];
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  return { text, password };
};
const confirm = async (page, action) => { const dialog = page.getByRole('alertdialog'); await dialog.waitFor(); await dialog.getByRole('button', { name: action, exact: true }).click(); };
try {
  const owner = await open();
  // Deep links survive sign-in, and a wrong password is rejected.
  await signIn(owner, '/admin/profile', ownerLogin, 'not-the-password');
  await owner.getByRole('alert').waitFor();
  await owner.getByLabel('Password', { exact: true }).fill(ownerPassword);
  await owner.getByRole('button', { name: 'Sign in', exact: true }).click();
  await owner.getByRole('heading', { name: 'Owner account' }).waitFor();
  assert.equal(new URL(owner.url()).pathname, '/admin/profile');
  const previousInbox = await owner.evaluate(() => fetch('/api/v1/platform/notifications').then(response => response.json()));
  if (previousInbox.unread) {
    await owner.getByRole('button', { name: /^Notifications, \d+ unread$/ }).click();
    await owner.getByRole('dialog', { name: 'Notifications' }).getByRole('button', { name: 'Mark all read', exact: true }).click();
    await owner.getByRole('button', { name: 'Notifications', exact: true }).waitFor();
    await owner.keyboard.press('Escape');
  }
  await owner.getByRole('link', { name: 'Companies', exact: true }).click();
  await owner.waitForURL(`${origin}/admin/companies`);

  // Create a company with its first dispatcher.
  await owner.getByRole('button', { name: 'Add company' }).first().click();
  const form = owner.getByRole('form', { name: 'Add company' });
  await form.getByLabel('Company name', { exact: true }).fill(name);
  await form.getByLabel('Company phone', { exact: true }).fill('6045550100');
  await form.getByLabel('Company address', { exact: true }).fill('123 Main Street, Vancouver, BC');
  await form.getByLabel('Company identifier', { exact: true }).fill(slug);
  await form.getByLabel('Administrator login ID', { exact: true }).fill('first-desk');
  await form.getByLabel('Administrator name', { exact: true }).fill('First Desk');
  await form.getByRole('button', { name: 'Create company', exact: true }).click();
  const first = await credentials(owner);
  assert.ok(first.text.includes(`/${slug}/`) && first.password.length >= 12);
  await shot(owner, 'companies-with-credentials');
  await owner.getByLabel('Search companies').fill(slug);
  await owner.getByRole('link', { name: `Manage ${name}` }).click();
  await owner.getByRole('tab', { name: 'Overview', exact: true }).click();
  await owner.getByRole('region', { name: 'Company details' }).waitFor();
  const detailUrl = owner.url();
  assert.match(new URL(detailUrl).pathname, /^\/admin\/companies\/[0-9a-f-]{36}$/);
  await owner.reload();
  await owner.getByRole('heading', { name, level: 1 }).waitFor();
  await owner.goBack(); await owner.waitForURL(`${origin}/admin/companies`);
  await owner.goForward(); await owner.waitForURL(detailUrl);
  await owner.getByRole('tab', { name: 'Overview', exact: true }).click();
  await owner.getByRole('region', { name: 'Company details' }).waitFor();

  // One prefilled Overview form saves company and dispatcher edits together.
  assert.equal(await owner.getByRole('tab').count(), 2);
  assert.deepEqual(await owner.getByLabel('Company totals').getByRole('term').allTextContents(), ['Total Shippers', 'Total Drivers', 'Total Orders']);
  assert.deepEqual(await owner.getByLabel('Company totals').getByRole('definition').allTextContents(), ['0', '0', '0']);
  assert.equal(await owner.getByLabel('Company name', { exact: true }).inputValue(), name);
  assert.equal(await owner.getByLabel('Full name', { exact: true }).inputValue(), 'First Desk');
  assert.equal(await owner.getByLabel('Company phone', { exact: true }).inputValue(), '(604) 555-0100');
  assert.equal(await owner.getByLabel('Company address', { exact: true }).inputValue(), '123 Main Street, Vancouver, BC');
  await owner.getByLabel('Company phone', { exact: true }).fill('6045550199');
  await owner.getByLabel('Company address', { exact: true }).fill('456 Saved Street, Vancouver, BC');
  await owner.getByLabel('Company name', { exact: true }).fill(name + ' Updated');
  await owner.getByLabel('Full name', { exact: true }).fill('Saved Desk');
  await owner.getByLabel('Email', { exact: true }).fill('saved@example.com');
  await owner.getByRole('button', { name: 'Save changes', exact: true }).click();
  await owner.getByText('Changes saved.', { exact: true }).waitFor();
  await owner.reload();
  await owner.getByRole('heading', { name: name + ' Updated', level: 1 }).waitFor();
  assert.equal(await owner.getByLabel('Email', { exact: true }).inputValue(), 'saved@example.com');
  assert.equal(await owner.getByLabel('Company phone', { exact: true }).inputValue(), '(604) 555-0199');
  assert.equal(await owner.getByLabel('Company address', { exact: true }).inputValue(), '456 Saved Street, Vancouver, BC');
  await owner.getByRole('tab', { name: 'History', exact: true }).click();
  assert.equal(await owner.getByLabel('Company totals').isVisible(), true);
  await owner.getByRole('tab', { name: 'Overview', exact: true }).click();

  // Only the company dispatcher is available; direct attempts to add another fail too.
  assert.equal(await owner.getByRole('button', { name: 'Add dispatcher' }).count(), 0);
  const addStatus = await owner.evaluate(async id => {
    const response = await fetch(`/api/v1/platform/organizations/${id}/dispatchers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'Dispatra', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ login_id: 'second-desk', display_name: 'Second Desk' }),
    });
    return response.status;
  }, new URL(detailUrl).pathname.split('/').at(-1));
  assert.equal(addStatus, 409);
  const stored = await owner.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + location.href);
  assert.ok(!stored.includes(first.password), 'generated passwords stay out of browser storage and URLs');

  // The company dispatcher signs in to the company workspace.
  const desk = await open();
  await signIn(desk, `/${slug}/`, 'saved@example.com', first.password);
  await desk.waitForFunction(() => !document.querySelector('input[type=password]'));
  const signedIn = await me(desk);
  assert.equal(signedIn.body?.role, 'DISPATCHER');
  assert.equal(signedIn.body?.organization?.slug, slug);
  const settings = await desk.evaluate(slug => fetch(`/api/v1/companies/${slug}/settings`).then(r => r.json()), slug);
  assert.equal(settings.data.phone, '(604) 555-0199');
  assert.equal(settings.data.address, '456 Saved Street, Vancouver, BC');
  // Profile logo appears in the owner list without changing the company name or navigation.
  const logoUrl = `${origin}/dispatra.png`;
  const logoSaved = await desk.evaluate(async ({ slug, settings, logoUrl }) => {
    const response = await fetch(`/api/v1/companies/${slug}/settings`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'Dispatra', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ version: settings.version, data: { ...settings.data, logo_url: logoUrl } }),
    });
    return response.status;
  }, { slug, settings, logoUrl });
  assert.equal(logoSaved, 200);
  await owner.getByRole('button', { name: 'All companies', exact: true }).click();
  await owner.getByLabel('Search companies').fill(slug);
  const companyRow = owner.getByRole('cell', { name: name + ' Updated', exact: true });
  await companyRow.waitFor();
  assert.equal(await companyRow.locator('img').getAttribute('src'), logoUrl);
  await companyRow.locator('img').evaluate(image => image.decode());
  assert.ok(await companyRow.locator('img').evaluate(image => image.naturalWidth > 0));
  await owner.getByRole('link', { name: `Manage ${name} Updated`, exact: true }).click();
  const rates = await desk.evaluate(slug => fetch(`/api/v1/companies/${slug}/rate-cards`).then(response => response.json()), slug);
  const imported = rates.filter(rate => rate.data.method === 'IMPORTED');
  assert.equal(imported.length, 1, 'new companies receive one Imported price card');
  assert.ok(imported[0].active && !imported[0].is_default);
  assert.equal((await desk.evaluate(() => fetch('/api/v1/platform/organizations').then(r => r.status))), 403, 'dispatchers cannot call owner endpoints');
  await desk.goto(`${origin}/admin`);
  await desk.getByRole('heading', { name: 'Sign in to this workspace' }).waitFor();
  assert.equal(await desk.getByRole('button', { name: 'Add company' }).count(), 0);

  // Administrative notices use the owner inbox, not a tenant inbox.
  await owner.reload();
  await owner.getByRole('button', { name: 'Notifications, 1 unread', exact: true }).click();
  const inbox = owner.getByRole('dialog', { name: 'Notifications' });
  await inbox.getByRole('button', { name: /^Unread\. Information\..*Company settings updated/ }).waitFor();
  await inbox.getByRole('button', { name: 'Mark all read', exact: true }).click();
  await owner.getByRole('button', { name: 'Notifications', exact: true }).waitFor();
  await owner.keyboard.press('Escape');
  const contactSaved = await desk.evaluate(async slug => {
    const profile = await fetch(`/api/v1/companies/${slug}/settings`).then(r => r.json());
    return fetch(`/api/v1/companies/${slug}/settings`, { method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'Dispatra', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ version: profile.version, data: { ...profile.data, contact_name: 'Updated contact' } }) }).then(r => r.status);
  }, slug);
  assert.equal(contactSaved, 200);
  await owner.reload();
  await owner.getByRole('button', { name: 'Notifications, 1 unread', exact: true }).click();
  await owner.getByRole('dialog', { name: 'Notifications' }).getByRole('button', { name: /^Unread\. Information\..*Company settings updated/ }).click();
  await owner.getByLabel('Company name', { exact: true }).waitFor();
  await owner.getByRole('button', { name: 'Notifications', exact: true }).waitFor();
  // The inline password form uses the same Save and revokes the old session.
  await owner.reload();
  await owner.getByLabel('New password', { exact: true }).waitFor();
  const changedPassword = 'Inline-password-change-2026!';
  await owner.getByLabel('New password', { exact: true }).fill(changedPassword);
  await owner.getByLabel('Confirm password', { exact: true }).fill(changedPassword);
  assert.equal(await owner.getByRole('button', { name: 'Suspend', exact: true }).isDisabled(), true);
  await owner.getByRole('button', { name: 'Save changes', exact: true }).click();
  await owner.getByText('Changes saved.', { exact: true }).waitFor();
  assert.equal(await owner.getByRole('alertdialog').count(), 0);
  assert.equal(await owner.getByLabel('New password', { exact: true }).inputValue(), '');
  assert.equal(await owner.getByLabel('Confirm password', { exact: true }).inputValue(), '');
  assert.equal((await me(desk)).status, 401);
  await signIn(desk, `/${slug}/`, 'saved@example.com', first.password);
  await desk.getByRole('alert').waitFor();
  assert.equal((await me(desk)).status, 401);
  await signIn(desk, `/${slug}/`, 'saved@example.com', changedPassword);
  await desk.waitForFunction(() => !document.querySelector('input[type=password]'));
  assert.equal((await me(desk)).status, 200);
  assert.ok(!(await owner.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + location.href)).includes(changedPassword));

  // Suspend/Activate appears only inside Overview, independently of Save.
  await owner.getByRole('tab', { name: 'History', exact: true }).click();
  assert.equal(await owner.getByRole('button', { name: 'Suspend', exact: true }).count(), 0);
  await owner.getByRole('tab', { name: 'Overview', exact: true }).click();
  await owner.getByRole('tabpanel', { name: 'Overview' }).getByRole('button', { name: 'Suspend', exact: true }).click();
  await confirm(owner, 'Suspend');
  await owner.getByRole('button', { name: 'Activate', exact: true }).waitFor();
  assert.equal((await me(desk)).status, 401);
  await signIn(desk, `/${slug}/`, 'saved@example.com', changedPassword);
  await desk.getByText('This company workspace is suspended. Contact Dispatra support.').waitFor();
  assert.equal(await owner.getByRole('heading', { level: 1 }).evaluate(e => e.parentElement.textContent.includes('Suspended')), true);
  await owner.getByRole('tab', { name: 'History', exact: true }).click();
  await owner.getByRole('table', { name: 'Administration history' }).getByText('Company suspended').waitFor();
  await shot(owner, 'company-suspended');
  assert.equal(await owner.getByRole('button', { name: 'Activate', exact: true }).count(), 0);
  await owner.getByRole('tab', { name: 'Overview', exact: true }).click();
  await owner.getByRole('button', { name: 'Activate', exact: true }).click();
  await confirm(owner, 'Activate');
  await owner.getByRole('button', { name: 'Suspend', exact: true }).waitFor();
  await signIn(desk, `/${slug}/`, 'saved@example.com', changedPassword);
  await desk.waitForFunction(() => !document.querySelector('input[type=password]'));
  assert.equal((await me(desk)).status, 200);

  // Owner signs out from the account menu.
  await owner.setViewportSize({ width: 390, height: 844 });
  assert.equal(await owner.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow on mobile');
  await shot(owner, 'company-mobile');
  await owner.getByRole('button', { name: 'Open menu' }).click();
  await owner.getByRole('button', { name: 'Platform owner account' }).click();
  await owner.getByRole('menuitem', { name: 'Logout' }).click();
  await owner.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  assert.equal((await me(owner)).status, 401);
  assert.deepEqual(errors, []);
  console.log(`PASS: owner deep-link login, company ${slug} creation, detail refresh/Back/Forward, combined Overview save, company-list logo, single-dispatcher restriction and login, owner-endpoint denial, inline password change/session revocation, Overview suspension/activation and title badge and owner sign-out.`);
} finally { await browser.close(); }
