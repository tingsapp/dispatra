import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'FileReader', 'File']) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
}
const { render, screen, cleanup, waitFor } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { CustomerProfile } = await import('../src/portal/ProfilePage');
const { LogoUpload } = await import('../src/components/settings/LogoUpload');
const { operations } = await import('../src/operations/api');
const { PortalShell } = await import('../src/portal/PortalShell');
const { ClipboardList } = await import('lucide-react');
import type { Shipper } from '../src/operations/api';

const originalRead = operations.ownShipper;
const originalSave = operations.updateOwnShipper;
afterEach(() => { cleanup(); operations.ownShipper = originalRead; operations.updateOwnShipper = originalSave; });
const image = new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'logo.png', { type: 'image/png' });
const logo = 'data:image/png;base64,iVBORw0KGgo=';
const initial: Shipper = {
  id: 'shipper', version: 1, created_at: '', name: 'Shipper One', number: 'S-001',
  status: 'ACTIVE', kind: 'BUSINESS', company_name: 'One', email: 'one@example.com', phone: '6045550101',
  warehouse: { text: '123 Main St, Vancouver, BC V5Y 1V4', city: 'Vancouver', province: 'BC', postal_code: 'V5Y 1V4', country: 'CA' },
  rate_card_id: null, discount: { kind: 'NONE', value: '0' }, instructions: '', email_updates: true, logo_url: '',
};

test('shipper can upload, save, reload, replace and remove their image through the profile', async () => {
  let saved = { ...initial };
  operations.ownShipper = async () => saved;
  operations.updateOwnShipper = async (_slug, body) => {
    assert.equal(body.version, saved.version);
    saved = { ...saved, logo_url: body.logo_url!, version: saved.version + 1 };
    return saved;
  };
  const user = userEvent.setup({ document });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = () => <QueryClientProvider client={client}><CustomerProfile slug="acme" /></QueryClientProvider>;
  const mounted = render(view());
  await screen.findByRole('button', { name: 'Upload shipper avatar or logo' });
  await user.upload(screen.getByLabelText('Choose shipper avatar or logo'), image);
  await screen.findByRole('img', { name: 'Shipper avatar or logo' });
  assert.equal(saved.logo_url, ''); // The preview remains a draft until Save.
  await user.click(screen.getByRole('button', { name: 'Save profile' }));
  await waitFor(() => assert.equal(saved.logo_url, logo));
  assert.equal((client.getQueryData(['shipper-profile', 'acme']) as Shipper).logo_url, logo);
  mounted.unmount();
  render(view());
  assert.equal((await screen.findByRole('img', { name: 'Shipper avatar or logo' })).getAttribute('src'), logo);
  await user.upload(screen.getByLabelText('Choose shipper avatar or logo'), new File(['jpeg'], 'new.jpg', { type: 'image/jpeg' }));
  await waitFor(() => assert.match(screen.getByRole('img', { name: 'Shipper avatar or logo' }).getAttribute('src')!, /^data:image\/jpeg/));
  await user.click(screen.getByRole('button', { name: 'Save profile' }));
  await waitFor(() => assert.match(saved.logo_url, /^data:image\/jpeg/));
  await user.click(screen.getByRole('button', { name: 'Remove shipper avatar or logo' }));
  await user.click(screen.getByRole('button', { name: 'Save profile' }));
  await waitFor(() => assert.equal(saved.logo_url, ''));
  client.clear();
});

test('shared dispatcher/shipper upload rejects oversized and unsupported images', async () => {
  let updates = 0;
  render(<LogoUpload value="" onChange={() => updates++} />);
  const user = userEvent.setup({ document, applyAccept: false });
  await user.upload(screen.getByLabelText('Choose company logo'), new File(['svg'], 'logo.svg', { type: 'image/svg+xml' }));
  assert.equal(screen.getByRole('alert').textContent, 'Choose a PNG or JPEG image.');
  await user.upload(screen.getByLabelText('Choose company logo'), new File([new Uint8Array(200 * 1024 + 1)], 'big.png', { type: 'image/png' }));
  assert.equal(screen.getByRole('alert').textContent, 'Choose an image up to 200 KB.');
  assert.equal(updates, 0);
});

test('failed profile save retains the image draft for retry', async () => {
  operations.ownShipper = async () => initial;
  operations.updateOwnShipper = async () => { throw new Error('Unable to save'); };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><CustomerProfile slug="acme" /></QueryClientProvider>);
  const user = userEvent.setup({ document });
  await screen.findByRole('button', { name: 'Upload shipper avatar or logo' });
  await user.upload(screen.getByLabelText('Choose shipper avatar or logo'), image);
  await screen.findByRole('img', { name: 'Shipper avatar or logo' });
  await user.click(screen.getByRole('button', { name: 'Save profile' }));
  await screen.findByRole('alert');
  assert.equal(screen.getByRole('img', { name: 'Shipper avatar or logo' }).getAttribute('src'), logo);
  assert.equal((client.getQueryData(['shipper-profile', 'acme']) as Shipper).logo_url, '');
  client.clear();
});

test('shipper sidebar shows the saved image and falls back to initials after removal', () => {
  const shell = (logoUrl: string) => <PortalShell company="Acme" login="one@example.com" primary="Profile" icon={ClipboardList} settings={false}
    onHome={() => {}} onSettings={() => {}} onLogout={() => {}} loggingOut={false}
    account={{ name: 'Shipper One', role: 'Shipper', profileCurrent: true, logoUrl }}>{null}</PortalShell>;
  const view = render(shell(logo));
  const account = screen.getByRole('button', { name: 'Shipper account' });
  assert.equal(account.querySelector('img')?.getAttribute('src'), logo);
  view.rerender(shell(''));
  assert.equal(account.querySelector('img'), null);
  assert.match(account.textContent!, /SO/);
});
