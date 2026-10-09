import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React, { useState } from 'react';
import { PAGE_PATHS, pageForPath, pathForPage } from '../src/lib/pageRoutes';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/orders' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event', 'CustomEvent']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name as keyof Window] });
}
const { render, screen, cleanup, fireEvent, waitFor } = await import('@testing-library/react');
const { usePageNavigation } = await import('../src/lib/usePageNavigation');
const { useSettingsGuard } = await import('../src/components/settings/useSettingsGuard');
const { ConfirmDialogHost } = await import('../src/components/ui/ConfirmDialog');

function SettingsDraft() {
  const [draft, setDraft] = useState('');
  useSettingsGuard(draft !== '');
  return React.createElement('input', { 'aria-label': 'Draft', value: draft, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDraft(event.target.value) });
}
function Navigation() {
  const [page, navigate] = usePageNavigation();
  return React.createElement(React.Fragment, null,
    React.createElement(ConfirmDialogHost),
    React.createElement('output', { 'aria-label': 'Current page' }, page),
    ...Object.keys(PAGE_PATHS).map(key => React.createElement('button', { key, onClick: () => navigate(key) }, key)),
    page === 'profile' && React.createElement(SettingsDraft),
  );
}
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
async function at(path: string, page: string) {
  await waitFor(() => {
    assert.equal(window.location.pathname, path);
    assert.equal(screen.getByLabelText('Current page').textContent, page);
  });
}
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/acme/orders'); });

test('all operational destinations resolve directly, including prototype URLs; tenant routes stay separate', () => {
  for (const [page, path] of Object.entries(PAGE_PATHS)) {
    assert.equal(pageForPath(`/acme${path}`), page);
    assert.equal(pageForPath(`/prototype${path}`), page);
    assert.equal(pathForPage(page, '/acme/orders'), `/acme${path}`);
    assert.equal(pathForPage(page, '/prototype/orders'), `/prototype${path === '/' ? '' : path}`);
  }
  assert.equal(pageForPath('/acme/settings/company'), 'profile');
  assert.equal(pathForPage('company-settings', '/acme/'), undefined);
  for (const path of ['/platform', '/acme/dispatch', '/acme/customer/settings', '/prototype-company/dispatch', '/acme/orders/customer', '/acme/settings/services', '/prototype/settings/services', '/acme/unknown', '/acme/shipper', '/acme/driver']) {
    assert.equal(pageForPath(path), undefined);
  }
});

test('removed services page has no navigation entry or legacy page alias', () => {
  assert.equal(pathForPage('services-accessorials', '/'), undefined);
  assert.equal(pathForPage('pricing-services', '/prototype'), undefined);
  assert.equal(pathForPage('rate-cards', '/demo/orders'), '/demo/settings');
  for (const old of ['/demo/pricing', '/demo/settings/pricing', '/demo/settings']) assert.equal(pageForPath(old), 'rate-cards');
});

test('navigation updates the URL, avoids duplicate entries, restores Back/Forward and survives remount', async () => {
  const view = render(React.createElement(React.StrictMode, null, React.createElement(Navigation)));
  await at('/acme/orders', 'jobs');
  click('drivers'); await at('/acme/drivers', 'drivers');
  const length = window.history.length;
  click('drivers'); assert.equal(window.history.length, length);
  click('vehicles'); await at('/acme/vehicles', 'vehicles');
  window.history.back(); await at('/acme/drivers', 'drivers');
  window.history.back(); await at('/acme/orders', 'jobs');
  window.history.forward(); await at('/acme/drivers', 'drivers');
  view.unmount(); render(React.createElement(Navigation)); await at('/acme/drivers', 'drivers');
  window.history.forward(); await at('/acme/vehicles', 'vehicles');
});

test('sidebar navigation preserves draft and URL on cancel, then leaves on confirmation', async () => {
  window.history.replaceState(null, '', '/acme/profile');
  render(React.createElement(Navigation));
  fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Unsaved company' } });
  click('drivers');
  assert.ok(screen.getByRole('alertdialog'));
  await at('/acme/profile', 'profile');
  click('Keep editing');
  assert.equal((screen.getByLabelText('Draft') as HTMLInputElement).value, 'Unsaved company');
  click('drivers'); click('Discard changes');
  await at('/acme/drivers', 'drivers');
});

test('Back cancellation restores URL and draft; confirmed Back and Forward retain the history stack', async () => {
  render(React.createElement(Navigation));
  click('profile');
  fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Unsaved company' } });
  window.history.back();
  await screen.findByRole('alertdialog');
  await at('/acme/profile', 'profile');
  click('Keep editing');
  assert.equal((screen.getByLabelText('Draft') as HTMLInputElement).value, 'Unsaved company');
  window.history.back();
  await screen.findByRole('alertdialog');
  click('Discard changes');
  await at('/acme/orders', 'jobs');
  window.history.forward(); await at('/acme/profile', 'profile');
  assert.equal((screen.getByLabelText('Draft') as HTMLInputElement).value, '');
});

test('prototype navigation keeps its prefix', async () => {
  window.history.replaceState(null, '', '/prototype/orders');
  render(React.createElement(Navigation));
  click('drivers'); await at('/prototype/drivers', 'drivers');
  click('monitor'); await at('/prototype', 'monitor');
  window.history.back(); await at('/prototype/drivers', 'drivers');
});

test('Integrations retains company scope and restores through Back, Forward and direct loading', async () => {
  const view = render(React.createElement(Navigation));
  click('integrations'); await at('/acme/integrations', 'integrations');
  click('jobs'); await at('/acme/orders', 'jobs');
  window.history.back(); await at('/acme/integrations', 'integrations');
  window.history.forward(); await at('/acme/orders', 'jobs');
  view.unmount(); window.history.replaceState(null, '', '/other/integrations');
  render(React.createElement(Navigation)); await at('/other/integrations', 'integrations');
});
