import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.PORTAL_BASE_URL || 'http://127.0.0.1:3000';
const slug = process.env.PORTAL_COMPANY || 'demo';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
try {
  await page.goto(`${origin}/${slug}/shipper-portal`);
  await page.getByLabel('Email or login ID', { exact: true }).fill(process.env.SHIPPER_LOGIN || 'shipper@example.com');
  await page.getByLabel('Password', { exact: true }).fill(process.env.SHIPPER_PASSWORD || '123456');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Orders', exact: true }).waitFor();
  const nav = page.getByRole('navigation', { name: 'Portal navigation' });
  assert.deepEqual(await nav.getByRole('link').allTextContents(), ['Orders','Invoices','Payment Methods']);
  for (const [name,path,content] of [
    ['Orders','orders','Orders'], ['Invoices','invoices','Invoices'],
    ['Payment Methods','payment-methods','Pay by invoice'],
  ]) {
    await nav.getByRole('link', { name, exact: true }).click();
    await page.waitForURL(`**/${slug}/shipper-portal/${path}`);
    await page.getByRole('heading', { name: content, exact: true }).last().waitFor();
    assert.equal(await nav.getByRole('link', { name, exact: true }).getAttribute('aria-current'), 'page');
    await page.reload();
    await page.getByRole('heading', { name: content, exact: true }).last().waitFor();
    assert.equal(await page.getByRole('alert').count(), 0);
  }
  await page.getByRole('button',{name:'Shipper account',exact:true}).click();
  assert.deepEqual(await page.getByRole('menu',{name:'Account menu'}).getByRole('menuitem').allTextContents(), ['Profile','Logout']);
  await page.getByRole('menuitem',{name:'Profile'}).click();
  await page.waitForURL(`**/${slug}/shipper-portal/profile`);
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
  // Browser contract check only: no calls to Stripe and no real card is created.
  await page.route('**/api/v1/companies/*/shipper/payment-methods', route => route.fulfill({json:{
    configured:true,test_mode:true,terms:'NET15',cards:[{id:'pm_test',brand:'visa',last4:'4242',exp_month:12,exp_year:2030}],
  }}));
  let setupPayload;
  await page.route('**/api/v1/companies/*/shipper/payment-methods/setup', async route => {
    setupPayload=route.request().postDataJSON();
    assert.ok(route.request().headers()['idempotency-key']);
    await route.fulfill({json:{url:'https://checkout.stripe.com/c/pay/test'}});
  });
  await page.route('https://checkout.stripe.com/**', route => route.fulfill({body:'Stripe test redirect intercepted',contentType:'text/plain'}));
  await page.goto(`${origin}/${slug}/shipper-portal/payment-methods`);
  await page.getByText('ending in 4242',{exact:false}).waitFor();
  assert.ok(await page.getByRole('button',{name:'Add credit card',exact:true}).isDisabled());
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Add credit card',exact:true}).click();
  await page.waitForURL('https://checkout.stripe.com/c/pay/test');
  assert.deepEqual(setupPayload,{consent:true});
  console.log('Mocked Stripe UI: masked cards, consent, idempotency and hosted redirect passed.');
} finally { await browser.close(); }
