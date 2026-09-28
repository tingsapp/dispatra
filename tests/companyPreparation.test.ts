import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { cityFromAddress, cityAreaId } from '../src/lib/driverCity';
import { companySlugForPath, pageForPath, pathForPage } from '../src/lib/pageRoutes';
import { scopedStorageKey } from '../src/lib/scopedStorage';
import { parsePortal } from '../src/portal/PortalApp';
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
  assert.equal(pageForPath('/acme/shipper-portal'), undefined);
  assert.equal(pageForPath('/acme/driver'), undefined);
  assert.equal(pathForPage('jobs','/acme/'), '/acme/orders');
  assert.deepEqual(parsePortal('/acme/'), { slug:'acme', portal:'dispatch', settings:false, workspace:true });
  assert.deepEqual(parsePortal('/acme/shipper-portal'), { slug:'acme', portal:'customer', settings:false });
  assert.deepEqual(parsePortal('/acme/driver'), { slug:'acme', portal:'driver', settings:false });
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
