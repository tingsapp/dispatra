// Owner company agreements and revenue against a disposable PostgreSQL API.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3005';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
assert.equal(process.env.E2E_DISPOSABLE, 'true', 'Use a disposable API database.');
assert.ok(process.env.E2E_OWNER_PASSWORD, 'Provide the disposable owner password.');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/admin/billing', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Login ID', { exact: true }).fill(process.env.E2E_OWNER_LOGIN || 'browser-owner');
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_OWNER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Subscription', exact: true }).waitFor();
  await page.getByLabel('TMS + Smart Dispatching price per vehicle per month', { exact: true }).fill('49.95');
  await page.getByLabel('TMS + Smart Dispatching currency', { exact: true }).fill('USD');
  await page.getByRole('button', { name: 'Save plans', exact: true }).click();
  await page.getByText('Subscription plans saved.', { exact: true }).waitFor();
  const stamp = Date.now().toString(36);
  const create = async suffix => {
    const slug = `billing-${suffix}-${stamp}`;
    const response = await context.request.post(origin + '/api/v1/platform/organizations', {
      headers: { Origin: origin, 'X-Requested-With': 'Dispatra', 'Idempotency-Key': crypto.randomUUID() },
      data: { slug, name: slug, admin_login: slug + '@example.com', password: 'Test-password-123!' },
    });
    assert.equal(response.status(), 201, await response.text()); return response.json();
  };
  const first = await create('first'); const second = await create('second');
  const seedFleet = async (company, count) => {
    const driverContext = await browser.newContext();
    try {
      const headers = { Origin: origin, 'X-Requested-With': 'Dispatra' };
      const login = await driverContext.request.post(origin + '/api/v1/auth/login', { headers,
        data: { portal: 'dispatch', login_id: company.slug + '@example.com', password: 'Test-password-123!' } });
      assert.equal(login.status(), 200, await login.text());
      const catalogue = await driverContext.request.get(origin + `/api/v1/companies/${company.slug}/catalog`, { headers });
      const type = (await catalogue.json()).find(row => row.code === 'veh_1_ton');
      for (let index = 0; index < count; index++) {
        const result = await driverContext.request.post(origin + `/api/v1/companies/${company.slug}/vehicles`, {
          headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: {
            name: `Billing van ${index}`, unit_number: `BILL-${index}`, type_id: type.id, plate: `BILL${index}`, province: 'BC',
            payload_kg: 1000, volume_m3: 12, length_cm: 300, width_cm: 180, height_cm: 180, pallet_capacity: 2,
          },
        });
        assert.equal(result.status(), 201, await result.text());
      }
    } finally { await driverContext.close(); }
  };
  await seedFleet(first, 2); await seedFleet(second, 3);
  const configure = async (company, price, currency) => {
    const terms = await context.request.get(origin + `/api/v1/platform/organizations/${company.id}/subscription`);
    const current = await terms.json();
    const configured = await context.request.patch(origin + `/api/v1/platform/organizations/${company.id}/subscription`, {
      headers: { Origin: origin, 'X-Requested-With': 'Dispatra', 'Idempotency-Key': crypto.randomUUID() },
      data: { version: current.version, status: 'ACTIVE', monthly_price: price, currency, starts_on: '2026-01-31' },
    });
    assert.equal(configured.status(), 200, await configured.text());
    await page.goto(origin + `/admin/companies/${company.id}/subscription`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('tabpanel', { name: 'Subscription & billing', exact: true }).waitFor();
    const panel = page.getByRole('tabpanel', { name: 'Subscription & billing', exact: true });
    await panel.locator('dd').filter({ hasText: currency + ' ' + price }).waitFor();
    assert.equal(await panel.locator('input, select, textarea, form').count(), 0);
    assert.equal(await panel.getByRole('tablist').count(), 0);
  };
  await configure(first, '89.95', 'CAD');
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.ok(await page.locator('dd').filter({ hasText: 'CAD 89.95' }).isVisible());
  await configure(second, '49.95', 'USD');
  await page.getByRole('link', { name: 'Subscription', exact: true }).click();
  await page.getByLabel('TMS + Smart Dispatching price per vehicle per month', { exact: true }).fill('75.00');
  await page.getByRole('button', { name: 'Save plans', exact: true }).click();
  await page.getByText('Subscription plans saved.', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Revenue', exact: true }).click();
  await page.getByRole('heading', { name: 'Revenue', exact: true }).waitFor();
  const cad = page.getByRole('region', { name: 'CAD recurring revenue' });
  const usd = page.getByRole('region', { name: 'USD recurring revenue' });
  await cad.getByText('CAD 179.90', { exact: true }).waitFor();
  assert.ok(await cad.getByText('CAD 2,158.80', { exact: true }).isVisible());
  assert.ok(await usd.getByText('USD 149.85', { exact: true }).isVisible());
  assert.ok(await page.getByText('Expected recurring revenue.', { exact: true }).isVisible());
  assert.equal(await page.getByRole('heading', { name: 'Recurring revenue', exact: true }).count(), 0);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `/tmp/dispatra-platform-revenue-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('link', { name: `View ${first.name} subscription`, exact: true }).click();
  await page.waitForURL(origin + `/admin/companies/${first.id}/subscription`);
  assert.ok(await page.locator('dd').filter({ hasText: 'CAD 89.95' }).isVisible());
  const latest = await (await context.request.get(origin + `/api/v1/platform/organizations/${first.id}/subscription`)).json();
  const paused = await context.request.patch(origin + `/api/v1/platform/organizations/${first.id}/subscription`, {
    headers: { Origin: origin, 'X-Requested-With': 'Dispatra', 'Idempotency-Key': crypto.randomUUID() },
    data: { version: latest.version, status: 'PAUSED', monthly_price: latest.monthly_price, currency: latest.currency, starts_on: latest.starts_on },
  });
  assert.equal(paused.status(), 200);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('tabpanel', { name: 'Subscription & billing', exact: true }).getByText('Paused', { exact: true }).waitFor();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `/tmp/dispatra-company-subscription-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await page.getByRole('cell', { name: 'Company subscription updated', exact: true }).first().waitFor();
  await page.getByRole('link', { name: 'Revenue', exact: true }).click();
  await page.getByRole('region', { name: 'USD recurring revenue' }).waitFor();
  await page.waitForFunction(() => !document.querySelector('section[aria-label="CAD recurring revenue"]'));
  assert.deepEqual(errors, []);
  console.log('PASS: read-only company terms/reload, default preservation, per-currency revenue, pause exclusion, audit history, deep links and 1440/390/320px layouts.');
} finally { await browser.close(); }
