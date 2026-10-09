import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.PORTAL_BASE_URL || 'http://127.0.0.1:3000';
const slug = process.env.PORTAL_COMPANY || 'demo';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
try {
  await page.goto(`${origin}/${slug}/shipper`);
  await page.getByLabel('Email or login ID', { exact: true }).fill(process.env.SHIPPER_LOGIN || 'shipper@example.com');
  await page.getByLabel('Password', { exact: true }).fill(process.env.SHIPPER_PASSWORD || '123456');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Orders', exact: true }).waitFor();
  const nav = page.getByRole('navigation', { name: 'Portal navigation' });
  assert.deepEqual(await nav.getByRole('link').allTextContents(), ['Orders']);
  for (const retired of ['shipper/invoices', 'shipper-portal/invoices']) {
    await page.goto(`${origin}/${slug}/${retired}`);
    await page.waitForURL(`**/${slug}/shipper`);
    await page.getByRole('heading', { name: 'Orders', exact: true }).waitFor();
    assert.equal(await page.getByText('Invoices', { exact: true }).count(), 0);
  }
  for (const [name,path,content] of [
    ['Orders','','Orders'],
  ]) {
    await nav.getByRole('link', { name, exact: true }).click();
    await page.waitForURL(`**/${slug}/shipper${path ? `/${path}` : ''}`);
    await page.getByRole('heading', { name: content, exact: true }).last().waitFor();
    assert.equal(await nav.getByRole('link', { name, exact: true }).getAttribute('aria-current'), 'page');
    await page.reload();
    await page.getByRole('heading', { name: content, exact: true }).last().waitFor();
    assert.equal(await page.getByRole('alert').count(), 0);
  }
  await page.getByRole('button',{name:'Shipper account',exact:true}).click();
  assert.deepEqual(await page.getByRole('menu',{name:'Account menu'}).getByRole('menuitem').allTextContents(), ['Profile','Logout']);
  await page.getByRole('menuitem',{name:'Profile'}).click();
  await page.waitForURL(`**/${slug}/shipper/profile`);
  await page.getByRole('heading',{name:'Contact details',exact:true}).waitFor();
  await page.getByRole('button',{name:'Security',exact:true}).click();
  await page.getByRole('heading',{name:'Change password',exact:true}).waitFor();
  await nav.getByRole('link',{name:'Orders',exact:true}).click();
  await page.getByRole('button',{name:'New order',exact:true}).click();
  await page.getByRole('dialog',{name:'New Order',exact:true}).waitFor();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.reload();
  await page.getByRole('button',{name:'Open menu',exact:true}).click();
  await nav.getByRole('link',{name:'Orders',exact:true}).click();
  await page.getByRole('heading',{name:'Orders',exact:true}).waitFor();
  assert.equal(await page.getByRole('dialog',{name:'Workspace sidebar'}).count(),0);
  console.log('Live API: sidebar pages, account menu, active links, reloads and mobile navigation passed.');
} finally { await browser.close(); }
