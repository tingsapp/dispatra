import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin = process.env.E2E_ORIGIN || 'http://localhost:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = '/tmp/dispatra-settings-loading';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const time = '2026-11-09T00:00:00Z';
try {
  for (const width of (process.env.E2E_WIDTHS || '1440,390').split(',').map(Number)) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    page.setDefaultTimeout(60000);
    await page.addInitScript(() => { window.WebSocket = undefined; });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let release; let writes = 0;
    let rate = { id: 'rate-fixed', code: 'FIXED', active: true, is_default: false, version: 1, created_at: time,
      data: { name: 'Fixed per delivery', method: 'FIXED', fixed_amount: '95', base_fee: '0', included_km: '0', per_km: '0', hourly_rate: '0', minimum_minutes: 60, increment_minutes: 15, minimum_subtotal: '0', dimensional_divisor: '5000', zones: [], weight_bands: [], apply_fuel: true, apply_service: true, apply_vehicle: true, apply_accessorials: true } };
    let settings = { id: 'settings', version: 1, created_at: time, data: { company_name: 'Zia', contact_name: 'Zia', email: 'preview@example.com', phone: '', address: '', logo_url: '', currency: 'CAD', time_zone: 'America/Vancouver', weight_unit: 'lb', dimension_unit: 'in', distance_unit: 'km', tax_registration_number: '', gst_enabled: true, gst_percent: '5', provincial_enabled: false, provincial_percent: '0', fuel_enabled: true, fuel_percent: '20', maximum_active_orders: 3, quote_validity_days: 14, dispatch_mode: 'MANUAL', dispatch_zones: [], tms_workspace: false } };
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname;
      if (url.origin !== origin) return route.abort();
      if (!path.startsWith('/api/')) return route.continue();
      if (request.method() !== 'GET') {
        if (request.method() === 'PUT' && (path.endsWith('/rate-cards/rate-fixed') || path.endsWith('/settings'))) {
          writes++; const result = await new Promise(resolve => { release = resolve; });
          if (result === 'error') return route.fulfill({ status: 409, json: { error: { message: 'Save failed. Try again.' } } });
          const body = request.postDataJSON();
          if (path.endsWith('/settings')) { settings = { ...settings, version: settings.version + 1, data: body.data }; return route.fulfill({ json: settings }); }
          rate = { ...rate, ...body, version: rate.version + 1 }; return route.fulfill({ json: rate });
        }
        return route.fulfill({ status: 202, json: { accepted: true } });
      }
      if (path === '/api/v1/auth/me') return route.fulfill({ json: { id: 'preview-user', login_id: 'preview@example.com', display_name: 'Zia', role: 'DISPATCHER', tms_workspace: false, organization: { id: 'preview-company', slug: 'zia', name: 'Zia', active: true, payment_required: false } } });
      if (path.endsWith('/settings')) return route.fulfill({ json: settings });
      if (path.endsWith('/rate-cards')) return route.fulfill({ json: [rate] });
      if (path.endsWith('/monitor')) return route.fulfill({ json: { drivers: [], routes: [], needs_attention: [] } });
      if (path.endsWith('/sync')) return route.fulfill({ json: { cursor: '0', changes: [], reset: false, unread: 0, unread_messages: 0, next_poll_ms: 60000 } });
      if (path.endsWith('/unread-summary')) return route.fulfill({ json: { unread: 0, conversations: [] } });
      if (/\/(drivers|vehicles|shippers|catalog|orders|routes|quotes|notifications)$/.test(path)) return route.fulfill({ json: [] });
      return route.fulfill({ json: { items: [], next_after: null, unread: 0 } });
    });
    await page.goto(origin + '/zia/settings', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const amount = page.getByLabel('Fixed Amount per Delivery');
    try { await amount.waitFor(); } catch (error) { console.log(JSON.stringify({ errors, url: page.url(), body: (await page.locator('body').innerText()).slice(0,1800) })); await page.screenshot({path: `${output}/failure.png`}); throw error; }
    await amount.fill('105');
    await page.getByRole('button', { name: 'Save Card', exact: true }).click();
    const saving = page.getByRole('button', { name: 'Saving…', exact: true });
    await saving.locator('[data-button-spinner]').waitFor({ state: 'visible' });
    assert.equal(await saving.isDisabled(), true);
    assert.equal(await amount.isDisabled(), true);
    assert.equal(await saving.locator('svg').evaluate(el => getComputedStyle(el).animationName), 'app-button-spin');
    await page.screenshot({ path: `${output}/rate-card-${width}.png`, fullPage: true });
    assert.equal(writes, 1); release('success'); await page.getByRole('button', { name: 'Saved', exact: true }).waitFor();
    await amount.fill('115'); await page.getByRole('button', { name: 'Save Card', exact: true }).click();
    await saving.locator('[data-button-spinner]').waitFor({ state: 'visible' }); release('error');
    const retry = page.getByRole('button', { name: 'Save Card', exact: true }); await retry.waitFor();
    assert.equal(await amount.inputValue(), '115'); assert.equal(await retry.isEnabled(), true);
    // Resolve another save before navigating so the unsaved-edits guard stays meaningful.
    await retry.click(); await saving.waitFor(); release('success'); await page.getByRole('button', { name: 'Saved', exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Fuel Surcharge', exact: true }).click();
    await page.getByLabel('Fuel surcharge (%)').fill('25');
    const fuel = page.getByRole('button', { name: 'Save Fuel Surcharge', exact: true }); await fuel.click();
    await fuel.locator('[data-button-spinner]').waitFor({ state: 'visible' });
    await page.screenshot({ path: `${output}/fuel-${width}.png`, fullPage: true });
    release('error'); await fuel.locator('[data-button-spinner]').waitFor({ state: 'detached' });
    assert.equal(await fuel.isEnabled(), true);
    assert.deepEqual(errors, []);
    await page.close(); console.log(`PASS ${width}px Settings: actual Save Card and fuel buttons, visible spinner, lock, success, error, retry`);
  }
} finally { await browser.close(); }
