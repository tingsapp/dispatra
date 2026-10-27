import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://dispatra.com/about', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLAnchorElement', 'Element', 'Node', 'MutationObserver', 'location', 'history', 'localStorage']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name as keyof Window] });
window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
const scrolled: unknown[] = [];
window.scrollTo = (options: unknown) => { scrolled.push(options); };
HTMLElement.prototype.scrollIntoView = function () { scrolled.push(this.id); };
const { render, screen, cleanup, within, fireEvent, waitFor, act } = await import('@testing-library/react');
const { default: Root } = await import('../src/Root');
const { usePublicNavigation } = await import('../src/lib/usePublicNavigation');
const { api } = await import('../src/portal/api');
api.me = async () => { throw new Error('Signed out'); };
api.subscriptionPlan = async () => ({ trial_enabled: true, trial_days: 30, monthly_price: null, currency: 'CAD', dispatch_monthly_price: null, dispatch_currency: 'CAD' }) as never;
afterEach(() => { cleanup(); localStorage.clear(); scrolled.length = 0; });
after(() => dom.window.close());
const start = (path = '/about') => { history.replaceState(null, '', path); render(<Root />); };
const heading = (name: string) => screen.findByRole('heading', { level: 1, name }, { timeout: 10000 });

test('header, footer and content links navigate the mounted Root without document navigation', async () => {
  start(); await heading('Built around your delivery day');
  const header = within(document.querySelector('.public-header') as HTMLElement);
  assert.equal(header.queryByRole('navigation'), null);
  assert.equal(fireEvent.click(header.getByRole('link', { name: 'Ask Dispatra' })), false);
  await heading('How can I help you?');
  assert.equal(location.pathname, '/ask-dispatra');
  fireEvent.click(screen.getByRole('link', { name: 'Integrations & API' })); await heading('Integrations & API');
  fireEvent.click(screen.getByRole('link', { name: 'Contact our team' })); await heading('How can I help you?');
  assert.equal(location.pathname, '/ask-dispatra');
  assert.ok(scrolled.some(position => typeof position === 'object' && (position as { top: number }).top === 0));
});

test('plan query links and hash anchors render their destination and preserve URL values', async () => {
  start('/plans'); await heading('Choose how you use Dispatra.');
  fireEvent.click(screen.getAllByRole('link', { name: 'Contact now' })[1]); await heading('How can I help you?');
  assert.equal(location.search, '?plan=dispatch');
  assert.ok(screen.getByText('Your enquiry: Smart Dispatching'));
  fireEvent.click(within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Ask dispatra' }));
  await waitFor(() => assert.ok(scrolled.includes('dispatra-chat-title'), 'Contact hash should scroll to chat'));
  assert.equal(location.hash, '#dispatra-chat-title');
  fireEvent.click(screen.getByRole('link', { name: 'Integrations & API' })); await heading('Integrations & API');
  fireEvent.click(screen.getByRole('link', { name: 'Dispatra API' }));
  assert.equal(location.hash, '#api');
  await waitFor(() => assert.ok(scrolled.includes('api'), 'Guide hash should scroll to API section'));
});

test('Back and Forward render earlier pages and restore saved scroll positions', async () => {
  start(); await heading('Built around your delivery day');
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 420 });
  fireEvent.click(screen.getByRole('link', { name: 'Integrations & API' })); await heading('Integrations & API');
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 90 });
  await act(async () => { history.back(); await new Promise(resolve => window.addEventListener('popstate', resolve, { once: true })); });
  await heading('Built around your delivery day');
  await waitFor(() => assert.ok(scrolled.some(position => typeof position === 'object' && (position as { top: number }).top === 420), 'Back should restore about-page scroll'));
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 420 });
  await act(async () => { history.forward(); await new Promise(resolve => window.addEventListener('popstate', resolve, { once: true })); });
  await heading('Integrations & API');
  await waitFor(() => assert.ok(scrolled.some(position => typeof position === 'object' && (position as { top: number }).top === 90), 'Forward should restore guide scroll'));
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
});

function Links() {
  const route = usePublicNavigation();
  return <main><h1>{route.pathname}</h1><a href="/help">Help</a><a href="/login">Login</a><a href="https://example.com/help">External</a><a href="mailto:dispatra@tingsapp.com">Email</a><a href="/help" target="_blank">New tab</a><a href="/help" download>Download</a><a href="/help" onClick={event => event.preventDefault()}>Handled</a></main>;
}
test('modified clicks, new tabs, downloads, external destinations and sign-in retain native semantics', () => {
  history.replaceState(null, '', '/about'); render(<Links />);
  // Cancel native navigation only after the hook has had a chance to handle it.
  const bypass = (name: string, init: MouseEventInit = {}) => {
    let intercepted = true;
    const inspect = (event: MouseEvent) => { intercepted = event.defaultPrevented; event.preventDefault(); };
    document.addEventListener('click', inspect);
    fireEvent.click(screen.getByRole('link', { name }), init);
    document.removeEventListener('click', inspect);
    assert.equal(intercepted, false, name);
    assert.equal(location.pathname, '/about');
  };
  for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) bypass('Help', init);
  for (const name of ['Login', 'External', 'Email', 'New tab', 'Download']) bypass(name);
  fireEvent.click(screen.getByRole('link', { name: 'Handled' })); assert.equal(location.pathname, '/about');
});

test('public interception stays inactive in company workspaces and cleans up on unmount', () => {
  history.replaceState(null, '', '/acme/integrations');
  const view = render(<Links />);
  let intercepted = true;
  const inspect = (event: MouseEvent) => { intercepted = event.defaultPrevented; event.preventDefault(); };
  document.addEventListener('click', inspect);
  fireEvent.click(screen.getByRole('link', { name: 'Help' })); assert.equal(intercepted, false);
  view.unmount();
  const anchor = document.createElement('a'); anchor.href = '/about'; document.body.append(anchor);
  fireEvent.click(anchor); assert.equal(intercepted, false);
  anchor.remove(); document.removeEventListener('click', inspect);
});

test('direct trailing-slash and fragment URLs render and scroll after a lazy page commits', async () => {
  start('/docs/integrations/#api'); await heading('Integrations & API');
  await waitFor(() => assert.ok(scrolled.includes('api'), 'Direct guide fragment should scroll after rendering'));
});

test('legacy contact links open Ask dispatra and preserve the plan and section', async () => {
  start('/contact?plan=dispatch#dispatra-chat-title');
  await heading('How can I help you?');
  assert.equal(location.pathname, '/ask-dispatra');
  assert.equal(location.search, '?plan=dispatch');
  assert.equal(location.hash, '#dispatra-chat-title');
  assert.ok(screen.getByText('Your enquiry: Smart Dispatching'));
  assert.equal(within(document.querySelector('.public-header') as HTMLElement).getByRole('link', { name: 'Ask Dispatra' }).getAttribute('href'), '/ask-dispatra');
});

test('retired how-it-works page redirects to the homepage', async () => {
  history.replaceState(null, '', '/how-it-works'); render(<Root />);
  await waitFor(() => assert.equal(location.pathname, '/'));
  assert.equal(screen.queryByRole('link', { name: 'How it works' }), null);
});
