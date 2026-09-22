import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.E2E_ORIGIN || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
async function rail(label) {
  const sidebar = page.getByRole('complementary', { name: label });
  await page.waitForFunction(label => {
    const sidebar = document.querySelector(`aside[aria-label="${label}"]`);
    return sidebar?.getBoundingClientRect().width === 64;
  }, label);
  const bounds = await sidebar.boundingBox();
  assert.equal(bounds.width, 64);
  assert.ok(await sidebar.locator('img').first().isVisible());
  const logo = sidebar.getByRole('button', { name: 'Expand menu', exact: true });
  assert.equal(await logo.locator('img').count(), 1);
  assert.equal(await logo.locator('svg').count(), 0);
  assert.equal(await sidebar.getByRole('button', { name: 'Collapse menu', exact: true }).count(), 0);
  for (const button of await sidebar.getByRole('button').all()) {
    const box = await button.boundingBox();
    assert.ok(box.x >= bounds.x && box.x + box.width <= bounds.x + bounds.width, 'Rail controls fit inside sidebar');
  }
}
try {
  await page.goto(origin + '/orders');
  await page.getByRole('button', { name: 'Collapse menu', exact: true }).click();
  await rail('Main navigation');
  assert.equal(await page.getByRole('button', { name: 'Open menu', exact: true }).isVisible(), false);
  for (const name of ['Orders', 'Drivers', 'Vehicles', 'Shippers', 'Analytics']) {
    const button = page.getByRole('button', { name, exact: true });
    assert.ok(await button.isVisible());
    assert.equal(await button.getAttribute('title'), name);
  }
  await page.getByRole('button', { name: 'Drivers', exact: true }).click();
  await page.waitForURL(origin + '/drivers');
  await page.getByRole('heading', { name: 'Drivers', exact: true }).waitFor();
  await rail('Main navigation');
  await page.getByRole('button', { name: 'Dispatcher Account', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Account menu', exact: true });
  await menu.waitFor();
  await page.waitForFunction(() => {
    const bounds = document.querySelector('[role="menu"][aria-label="Account menu"]')?.getBoundingClientRect();
    return bounds && bounds.width >= 220 && bounds.x >= 64 && bounds.right <= 1440;
  });
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Company', exact: true }).click();
  await page.waitForURL(origin + '/settings/company');
  await page.getByLabel('Company name', { exact: true }).fill('Sidebar draft');
  await page.getByRole('button', { name: 'Expand menu', exact: true }).click();
  assert.equal(new URL(page.url()).pathname, '/settings/company');
  await page.getByRole('button', { name: 'Collapse menu', exact: true }).click();
  await rail('Main navigation');
  assert.equal(await page.getByLabel('Company name', { exact: true }).inputValue(), 'Sidebar draft');
  await page.screenshot({ path: '/tmp/dispatra-sidebar-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Main navigation' }).waitFor();
  await page.screenshot({ path: '/tmp/dispatra-sidebar-mobile.png' });
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await page.getByRole('complementary', { name: 'Main navigation' }).count(), 0);
  assert.equal(await page.getByLabel('Company name', { exact: true }).inputValue(), 'Sidebar draft');
  await page.setViewportSize({ width: 1440, height: 900 });
  await rail('Main navigation');
  await page.getByRole('button', { name: 'Drivers', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await page.waitForURL(origin + '/drivers');

  // Exercise the presentational portal shell without API credentials or prototype stores.
  await page.route(origin + '/__sidebar-portal', route => route.fulfill({ contentType: 'text/html', body: `
    <html><body><div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    </script><script type="module">
    import React from '/node_modules/.vite/deps/react.js';
    import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
    import {Users} from '/node_modules/.vite/deps/lucide-react.js';
    import {PortalShell} from '/src/portal/PortalShell.tsx';
    import '/src/index.css';
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(PortalShell, {
      company:'Example Company', login:'dispatcher', primary:'Shippers', icon:Users, settings:false,
      onHome:()=>{}, onSettings:()=>{}, onLogout:()=>{}, loggingOut:false,
      children:React.createElement('input', {'aria-label':'Portal draft'})
    }));</script></body></html>` }));
  await page.goto(origin + '/__sidebar-portal');
  await page.getByLabel('Portal draft').fill('Retained portal draft');
  await page.getByRole('button', { name: 'Collapse menu', exact: true }).click();
  await rail('Workspace sidebar');
  await page.getByRole('button', { name: 'Account settings', exact: true }).click();
  await page.getByRole('button', { name: 'Expand menu', exact: true }).click();
  assert.equal(await page.getByLabel('Portal draft').inputValue(), 'Retained portal draft');
  assert.deepEqual(errors, []);
  console.log('Sidebar browser checks passed: 64px rails, visible logo/icons, navigation, account/settings menus, draft retention, portal shell and mobile drawer.');
} catch (error) {
  console.error('Page errors:', errors);
  throw error;
} finally {
  await browser.close();
}
