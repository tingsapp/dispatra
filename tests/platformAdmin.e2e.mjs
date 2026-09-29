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
  await owner.getByRole('link', { name: 'Companies', exact: true }).click();
  await owner.waitForURL(`${origin}/admin/companies`);

  // Create a company with its first dispatcher.
  await owner.getByRole('button', { name: 'Add company' }).first().click();
  const form = owner.getByRole('form', { name: 'Add company' });
  await form.getByLabel('Company name', { exact: true }).fill(name);
  await form.getByLabel('Company identifier', { exact: true }).fill(slug);
  await form.getByLabel('Administrator login ID', { exact: true }).fill('first-desk');
  await form.getByLabel('Administrator name', { exact: true }).fill('First Desk');
  await form.getByRole('button', { name: 'Create company', exact: true }).click();
  const first = await credentials(owner);
  assert.ok(first.text.includes(`/${slug}/`) && first.password.length >= 12);
  await shot(owner, 'companies-with-credentials');
  await owner.getByLabel('Search companies').fill(slug);
  await owner.getByRole('link', { name: `Manage ${name}` }).click();
  await owner.getByRole('table', { name: 'Dispatcher accounts' }).waitFor();
  const detailUrl = owner.url();
  assert.match(new URL(detailUrl).pathname, /^\/admin\/companies\/[0-9a-f-]{36}$/);
  await owner.reload();
  await owner.getByRole('heading', { name, level: 1 }).waitFor();
  await owner.goBack(); await owner.waitForURL(`${origin}/admin/companies`);
  await owner.goForward(); await owner.waitForURL(detailUrl);
  await owner.getByRole('table', { name: 'Dispatcher accounts' }).waitFor();

  // Add a second dispatcher; its generated password is shown once.
  await owner.getByRole('button', { name: 'Add dispatcher' }).click();
  const add = owner.getByRole('form', { name: 'Add dispatcher' });
  await add.getByLabel('Login ID', { exact: true }).fill('second-desk');
  await add.getByLabel('Name', { exact: true }).fill('Second Desk');
  await add.getByRole('button', { name: 'Create dispatcher', exact: true }).click();
  await owner.getByRole('heading', { name: 'Login details ready' }).waitFor();
  await shot(owner, 'dispatcher-created');
  const second = await credentials(owner);
  const stored = await owner.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + location.href);
  assert.ok(!stored.includes(second.password) && !stored.includes(first.password), 'generated passwords stay out of browser storage and URLs');

  // The new dispatcher signs in to the company workspace.
  const desk = await open();
  await signIn(desk, `/${slug}/`, 'second-desk', second.password);
  await desk.waitForFunction(() => !document.querySelector('input[type=password]'));
  const signedIn = await me(desk);
  assert.equal(signedIn.body?.role, 'DISPATCHER');
  assert.equal(signedIn.body?.organization?.slug, slug);
  assert.equal((await desk.evaluate(() => fetch('/api/v1/platform/organizations').then(r => r.status))), 403, 'dispatchers cannot call owner endpoints');
  await desk.goto(`${origin}/admin`);
  await desk.getByRole('heading', { name: 'Sign in to this workspace' }).waitFor();
  assert.equal(await desk.getByRole('button', { name: 'Add company' }).count(), 0);

  // Owner sees recent access, revokes sessions, then deactivates the account.
  await owner.reload();
  const row = owner.getByRole('row').filter({ hasText: 'second-desk' });
  await row.getByRole('cell', { name: '1', exact: true }).waitFor();
  await row.getByRole('button', { name: 'Actions for second-desk' }).click();
  await owner.getByRole('menuitem', { name: 'Sign out sessions' }).click();
  await confirm(owner, 'Sign out sessions');
  await owner.getByText('Signed out 1 session(s).').waitFor();
  assert.equal((await me(desk)).status, 401);
  await signIn(desk, `/${slug}/`, 'second-desk', second.password);
  await desk.waitForFunction(() => !document.querySelector('input[type=password]'));
  assert.equal((await me(desk)).status, 200);
  await owner.reload();
  await owner.getByRole('row').filter({ hasText: 'second-desk' }).getByRole('button', { name: 'Actions for second-desk' }).click();
  await owner.getByRole('menuitem', { name: 'Deactivate', exact: true }).click();
  await confirm(owner, 'Deactivate');
  await owner.getByRole('row').filter({ hasText: 'second-desk' }).getByText('Deactivated').waitFor();
  assert.equal((await me(desk)).status, 401);
  await desk.reload();
  await desk.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  await signIn(desk, `/${slug}/`, 'second-desk', second.password);
  await desk.getByRole('alert').waitFor();
  assert.equal((await me(desk)).status, 401);
  // The first dispatcher is now the last active one and cannot be deactivated.
  await owner.getByRole('row').filter({ hasText: 'first-desk' }).getByRole('button', { name: 'Actions for first-desk' }).click();
  assert.equal(await owner.getByRole('menuitem', { name: 'Deactivate (last active)' }).getAttribute('aria-disabled'), 'true');
  await owner.keyboard.press('Escape');

  // Suspending the company blocks the first dispatcher with an explicit message.
  await owner.getByRole('button', { name: 'Suspend company' }).click();
  await confirm(owner, 'Suspend company');
  await owner.getByRole('button', { name: 'Activate company' }).waitFor();
  await signIn(desk, `/${slug}/`, 'first-desk', first.password);
  await desk.getByText('This company workspace is suspended. Contact Dispatra support.').waitFor();
  await owner.getByRole('table', { name: 'Administration history' }).getByText('Company suspended').waitFor();
  await shot(owner, 'company-suspended');

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
  console.log(`PASS: owner deep-link login, company ${slug} creation, detail refresh/Back/Forward, dispatcher creation and login, owner-endpoint denial, session revocation, deactivation, last-active guard, suspension and owner sign-out.`);
} finally { await browser.close(); }
