import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'CustomEvent', 'localStorage', 'HTMLCanvasElement', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
}
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: () => null });
// Scene motion is covered in the browser; keep these interaction checks deterministic.
Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
const { render, screen, cleanup, waitFor, within, fireEvent } = await import('@testing-library/react');
const { accountWorkspace, signupDestination, dispatcherPageAvailable } = await import('../src/lib/workspaceEntry');
const { PublicHome } = await import('../src/pages/PublicHome');
const { api, ApiError } = await import('../src/portal/api');
import type { Account } from '../src/portal/api';
const originalMe = api.me;
const originalPlan = api.subscriptionPlan;
beforeEach(()=>{api.subscriptionPlan=async()=>({name:'Monthly subscription',interval:'MONTHLY',trial_enabled:true,trial_days:30,monthly_price:null,currency:'CAD',dispatch_monthly_price:null,dispatch_currency:'CAD'});});
const anonymous = async () => { throw new ApiError(401, 'Sign in'); };
const account = (role: Account['role']): Account => ({ id: 'user-1', login_id: 'user@example.com', display_name: 'User', role, tms_workspace: false,
  organization: role === 'ADMIN' ? null : { id: 'company-1', name: 'Acme', slug: 'acme', active: true, payment_required: false } });
afterEach(() => { cleanup(); localStorage.clear(); api.me = originalMe; api.subscriptionPlan = originalPlan; });

test('resume destinations use the authenticated role and company rather than remembered entry', () => {
  assert.deepEqual((['DISPATCHER', 'SHIPPER', 'DRIVER', 'ADMIN'] as const).map(role => accountWorkspace(account(role))), ['/acme/', '/acme/shipper', '/acme/driver', '/admin']);
  assert.equal(accountWorkspace(), undefined);
  assert.equal(accountWorkspace({ ...account('DRIVER'), role: 'UNKNOWN' } as unknown as Account), undefined);
  assert.equal(accountWorkspace({ ...account('DRIVER'), organization: null }), undefined);
  assert.equal(accountWorkspace({ ...account('DISPATCHER'), tms_workspace: true }), '/acme/integrations');
  assert.equal(accountWorkspace({ ...account('SHIPPER'), tms_workspace: true }), '/acme/shipper');
  assert.equal(accountWorkspace({ ...account('DRIVER'), tms_workspace: true }), '/acme/driver');
});
test('homepage offers a direct free-trial action without a workspace input', async () => {
  api.me = anonymous;
  render(React.createElement(PublicHome));
  const trial = await screen.findByRole('link', { name: 'Start Free Trial' }, {timeout:5000});
  const hero = screen.getByRole('heading', { level: 1, name: /AI that runs your dispatch while keeping you in control/ }).closest('section');
  assert.ok(hero?.contains(trial));
  assert.equal(within(hero!).queryByRole('link', { name: 'See how it works' }), null);
  assert.equal(trial.getAttribute('href'), '/plans');
  assert.equal(screen.queryByRole('textbox'), null);
  assert.equal(screen.queryByText('dispatra.com/'), null);
  assert.equal(within(hero!).queryByRole('link', { name: /^Sign in$/ }), null);
  assert.equal(within(hero!).queryByText('AI for delivery teams'), null);
  assert.equal(within(hero!).queryByText(/No credit card required/), null);
  assert.equal(within(hero!).queryByRole('link', { name: /The full TMS workspace/ }), null);
  assert.equal(within(hero!).queryByRole('link', { name: /Smart Dispatching for your TMS/ }), null);
  assert.equal(screen.queryByRole('radio'), null);
  assert.equal(screen.getByRole('link', { name: 'Sign in to your workspace' }).getAttribute('href'), '/login');
  assert.equal(within(screen.getByRole('banner')).queryByRole('link', { name: 'Login' }), null);
  const footer = within(screen.getByRole('contentinfo'));
  assert.ok(footer.getByText(`Dispatra © ${new Date().getFullYear()}`));
  assert.equal(footer.getByRole('link', { name: 'Plans & free trial' }).getAttribute('href'), '/plans');
  assert.equal(footer.queryByRole('link', { name: 'How it works' }), null);
  const header = within(screen.getByRole('banner'));
  assert.equal(header.getByRole('link', { name: 'Let’s talk' }).getAttribute('href'), '/contact');
  assert.equal(header.queryByRole('navigation'), null);
  assert.equal(header.queryByRole('button', { name: 'Open website menu' }), null);
  assert.deepEqual(['Dispatchers', 'Shippers', 'Drivers'].map(name => footer.getByRole('link', { name }).getAttribute('href')), ['/dispatch', '/shipper', '/driver']);
});
test('company identifiers produce signup destinations and reject URLs or reserved names', () => {
  assert.equal(signupDestination(' My-Company '), '/plans?company=my-company');
  for (const invalid of ['', 'admin', 'signup', 'plans', 'contact', 'driver', 'a', 'x'.repeat(64), 'https://dispatra.com/acme/', '/acme', 'my company', 'acme?redirect=evil']) {
    assert.equal(signupDestination(invalid), undefined, invalid);
  }
});
test('authenticated resume uses the session company even with a remembered company', async () => {
  localStorage.setItem('dispatra_public_workspace_v1', JSON.stringify({ slug: 'last-company', role: 'shipper' }));
  api.me = async () => account('DRIVER');
  render(React.createElement(PublicHome));
  assert.equal(screen.queryByRole('textbox'), null);
  assert.equal((await screen.findByRole('link', { name: 'Start Free Trial' }, {timeout:5000})).getAttribute('href'), '/plans');
  await waitFor(() => assert.equal(screen.getByRole('link', { name: 'Open my workspace' }).getAttribute('href'), '/acme/driver'));
});

test('Monitor is available in both TMS modes while External TMS keeps its other page restrictions',()=>{
 for(const external of [false,true])assert.equal(dispatcherPageAvailable('monitor',external),true);
 for(const page of ['profile','help','integrations'])assert.equal(dispatcherPageAvailable(page,true),true);
 for(const page of ['jobs','drivers','vehicles','customers','reports','rate-cards',undefined])assert.equal(dispatcherPageAvailable(page,true),false);
 assert.equal(dispatcherPageAvailable('jobs',false),true);
});


test('homepage role views support selection and arrow-key navigation with matching destinations', () => {
  api.me = anonymous;
  render(React.createElement(PublicHome));
  const driver = screen.getByRole('tab', { name: 'Driver' });
  assert.equal(screen.getByRole('tab', { name: 'Dispatcher' }).getAttribute('aria-selected'), 'true');
  fireEvent.click(driver);
  assert.equal(screen.getByRole('link', { name: 'Sign in as a driver' }).getAttribute('href'), '/driver');
  fireEvent.click(screen.getByRole('tab', { name: 'Shipper' }));
  assert.equal(screen.getByRole('link', { name: 'Sign in as a shipper' }).getAttribute('href'), '/shipper');
  fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
  assert.equal(screen.getByRole('tab', { name: 'Dispatcher' }).getAttribute('aria-selected'), 'true');
  assert.equal(document.activeElement, screen.getByRole('tab', { name: 'Dispatcher' }));
  assert.equal(screen.getByRole('link', { name: 'Sign in as a dispatcher' }).getAttribute('href'), '/dispatch');
});

test('four agent steps show sources, driver comparison, route choices and signed completion', async () => {
  api.me = anonymous;
  render(React.createElement(PublicHome));
  const workflow = screen.getByRole('list', { name: 'Explore the dispatch process' });
  assert.equal(within(workflow).getAllByRole('button').length, 4);
  const panel = () => screen.getByRole('region', { name: /demonstration$/ });
  assert.ok(within(panel()).getByText('Email'));
  assert.ok(within(panel()).getByText('Shipper portal'));
  assert.ok(within(panel()).getByText('TMS / API'));
  assert.ok(within(panel()).getByText('Dispatcher'));
  assert.ok(within(panel()).getByText('Dispatra order'));
  fireEvent.click(within(workflow).getByRole('button', { name: 'Dispatch agent' }));
  await waitFor(() => assert.equal(panel().querySelectorAll('.process-driver').length, 3));
  assert.equal(panel().querySelectorAll('.process-driver[data-selected="true"]').length, 1);
  assert.ok(within(panel()).getByText('Alex selected'));
  fireEvent.click(within(workflow).getByRole('button', { name: 'Route optimizer' }));
  await waitFor(() => assert.equal(panel().querySelectorAll('.process-route-option').length, 2));
  assert.equal(panel().querySelectorAll('.process-route-selected').length, 1);
  assert.ok(within(panel()).getByText('Best path selected'));
  fireEvent.keyDown(workflow, { key: 'ArrowDown' });
  assert.equal(document.activeElement, within(workflow).getByRole('button', { name: 'Driver' }));
  await waitFor(() => assert.ok(within(panel()).getByText('Completed')));
  assert.ok(within(panel()).getByText('Signature collected'));
  fireEvent.keyDown(workflow, { key: 'Home' });
  await waitFor(() => assert.ok(within(panel()).getByText('Dispatra order')));
  assert.equal(screen.queryByText('Illustrative workflow · Sample data'), null);
  assert.equal(screen.queryByText('Choose Auto or Manual assignment. Routes are optimized after assignment in both modes.'), null);
});

test('plan paths and FAQ answers reuse the established public destinations and content', () => {
  api.me = anonymous;
  render(React.createElement(PublicHome));
  assert.equal(screen.getByRole('link', { name: 'Explore Full Workspace' }).getAttribute('href'), '/plans#plan-full');
  assert.equal(screen.getByRole('link', { name: 'Explore AI Dispatch' }).getAttribute('href'), '/plans#plan-dispatch');
  assert.equal(screen.queryByRole('link', { name: 'Talk to us about this plan' }), null);
  const questions = screen.getByRole('region', { name: /Get to know Dispatra/ });
  assert.equal(questions.querySelectorAll('details').length, 6);
  assert.ok(questions.textContent?.includes('Both modes optimize routes after assignment'));
});
