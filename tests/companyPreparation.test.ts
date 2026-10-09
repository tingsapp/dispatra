import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { cityFromAddress, cityAreaId } from '../src/lib/driverCity';
import { companySlugForPath, pageForPath, pathForPage, PAGE_PATHS, RESERVED_SLUGS } from '../src/lib/pageRoutes';
import { scopedStorageKey } from '../src/lib/scopedStorage';
import { canonicalPortalPath, parsePortal, roleHome } from '../src/portal/PortalApp';
import { normalizeDriver, syncDriver } from '../src/lib/driverStorage';
import { INITIAL_DRIVERS } from '../src/data/mockData';
import { validateDriver } from '../src/domain/validation';
import { validateOperationalAssignment } from '../src/domain/assignment';

const dom = new JSDOM('', { url:'http://localhost/acme/' });
Object.defineProperty(globalThis, 'location', { configurable:true, value:dom.window.location });

test('public, admin and company paths stay separate', () => {
  assert.equal(pageForPath('/'), undefined);
  assert.equal(companySlugForPath('/admin'), undefined);
  assert.equal(pageForPath('/acme/'), 'monitor');
  assert.equal(pageForPath('/acme/shippers'), 'customers');
  assert.equal(pageForPath('/acme/drivers'), 'drivers');
  for (const path of ['/acme/shipper', '/acme/driver', '/acme/shipper-portal']) assert.equal(pageForPath(path), undefined);
  assert.equal(pathForPage('jobs','/acme/'), '/acme/orders');
  assert.deepEqual(parsePortal('/acme/'), { slug:'acme', portal:'dispatch', workspace:true });
  assert.deepEqual(parsePortal('/acme/integrations'), { slug:'acme', portal:'dispatch', workspace:true });
  assert.equal(parsePortal('/acme/shipper/integrations'), null);
  assert.equal(parsePortal('/acme/driver/integrations'), null);
  for (const path of ['/acme/shipper', '/acme/shipper/', '/acme/shipper/profile']) assert.deepEqual(parsePortal(path), { slug:'acme', portal:'customer' });
  for (const path of ['/acme/driver', '/acme/driver/profile']) assert.deepEqual(parsePortal(path), { slug:'acme', portal:'driver' });
  for (const path of ['/acme/shipper-portal', '/acme/shipper/payment-methods', '/acme/driver/unknown', '/acme/customer']) assert.equal(parsePortal(path), null);
});

test('singular portals never collide with plural dispatcher pages, and reserved words are not companies', () => {
  for (const path of Object.values(PAGE_PATHS)) assert.ok(!/^\/(shipper|driver)(\/|$)/.test(path), path);
  for (const word of ['admin', 'prototype', 'pricing', 'signup', 'shipper', 'driver', 'help']) { assert.ok(RESERVED_SLUGS.includes(word)); assert.equal(companySlugForPath(`/${word}`), undefined); }
});

test('old portal links redirect to the clean paths and each role has one home', () => {
  const cases: [string, string | undefined][] = [['/acme/shipper-portal', '/acme/shipper'], ['/acme/shipper-portal/orders/', '/acme/shipper'], ['/acme/shipper-portal/invoices', '/acme/shipper'], ['/acme/shipper/invoices', '/acme/shipper'],
    ['/acme/shipper-portal/settings', '/acme/shipper/profile'], ['/acme/shipper-portal/payment-methods', '/acme/shipper'], ['/acme/shipper/orders', '/acme/shipper'], ['/acme/driver/orders', '/acme/driver'],
    ['/acme/customer/login', '/acme/shipper'], ['/acme/dispatch', '/acme/'], ['/acme/dispatch/settings', '/acme/profile'], ['/acme/shipper', undefined], ['/acme/orders', undefined], ['/admin', undefined]];
  for (const [path, next] of cases) assert.equal(canonicalPortalPath(path), next, path);
  assert.deepEqual(['DISPATCHER', 'SHIPPER', 'DRIVER'].map(role => roleHome('acme', role)), ['/acme/', '/acme/shipper', '/acme/driver']);
});

test('local demo keys are company-scoped and never inherit old global records', () => {
  assert.equal(scopedStorageKey('orders','/acme/orders'), 'orders:company:acme');
  assert.equal(scopedStorageKey('orders','/other/orders'), 'orders:company:other');
  assert.equal(scopedStorageKey('orders','/prototype/orders'), 'orders');
});

test('driver coverage follows address city, including edits', () => {
  assert.equal(cityFromAddress('100 Main St, Vancouver, BC V6A 2S5, Canada'), 'Vancouver');
  assert.equal(cityFromAddress('20 King St, Toronto, Ontario M5V 1A1'), 'Toronto');
  assert.equal(cityFromAddress('100 Main St, BC V6A 2S5'), null);
  const driver = syncDriver({ ...normalizeDriver(INITIAL_DRIVERS[0]), phone:'6041234567', email:'driver@example.ca', address:'100 Main St, Vancouver, BC V6A 2S5' });
  assert.deepEqual(driver.serviceAreaIds, [cityAreaId('Vancouver')]);
  assert.deepEqual(syncDriver({ ...driver, address:'20 Main St, Surrey, BC V3T 1X1' }).serviceAreaIds, ['surrey']);
  assert.match(validateDriver({ ...driver, email:'' }, []).join(' '), /email/);
  assert.deepEqual(validateOperationalAssignment({ pickupAddress:'100 Main St, Vancouver, BC V6A 2S5' }, driver, []), []);
  assert.match(validateOperationalAssignment({ pickupAddress:'20 Main St, Surrey, BC V3T 1X1' }, driver, []).join(' '), /pickup city/);
});
