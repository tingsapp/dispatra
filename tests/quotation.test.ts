import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'localStorage']) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
HTMLElement.prototype.scrollIntoView = () => {};
const { render, screen, cleanup, within } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');
const { JobsPage } = await import('../src/pages/JobsPage');
const { QuotationMenu } = await import('../src/components/pricing/QuotationMenu');
const { loadPricingConfig, savePricingConfig, createEmptyRateCard } = await import('../src/lib/pricingStorage');
const { loadCustomers, saveCustomers } = await import('../src/lib/customerStorage');
const { loadBillingConfig, saveBillingConfig } = await import('../src/lib/billingStorage');
const { loadPricingContext, createDefaultOrderInput, priceOrder } = await import('../src/lib/orderPricing');
const { buildQuotation, quotationText, quotationMailto, quotationSubject, quotationPdf, quotationFileName } = await import('../src/lib/quotation');
const { textWidth, wrap } = await import('../src/lib/pdf');
const latin1 = (bytes: Uint8Array) => Array.from(bytes, b => String.fromCharCode(b)).join('');
afterEach(() => { cleanup(); localStorage.clear(); });

function setup() {
  const pricing = loadPricingConfig();
  const card = createEmptyRateCard({ id: 'quote-card', name: 'Quote fixed', scope: 'ORGANIZATION', status: 'ACTIVE', effectiveFrom: '2020-01-01', pricingMethod: 'FIXED', fixedAmount: 100 });
  savePricingConfig({ ...pricing, rateCards: [card] });
  const customer = { ...loadCustomers()[0], status: 'Active' as const, rateCardId: card.id, email: 'billing@example.com', billingEmail: 'legacy@example.com', contactName: 'Sam Lee' };
  saveCustomers([customer]);
  const billing = loadBillingConfig(); billing.company = { ...billing.company, name: 'Dispatra Test Co', phone: '604-555-0100', email: 'quotes@dispatra.test' }; saveBillingConfig(billing);
  const ctx = loadPricingContext();
  const input = { ...createDefaultOrderInput(ctx), customerId: customer.id, routeKm: 12, scheduledAt: '2026-09-22T09:00:00.000Z' };
  input.stops[0] = { ...input.stops[0], label: '100 Main St, Vancouver', contactName: 'Pat' };
  input.stops[1] = { ...input.stops[1], label: '200 Pine Ave, Burnaby' };
  input.packages[0] = { ...input.packages[0], description: 'Crate', quantity: 2, weightKg: 45.359237, lengthCm: 50.8, widthCm: 25.4, heightCm: 25.4 };
  return { customer, ctx, input, snapshot: priceOrder(input, ctx) };
}

test('quotation mirrors the priced snapshot in company units and renders text and mailto for email', () => {
  const { ctx, input, snapshot } = setup();
  assert.equal(snapshot.status, 'PRICED');
  const now = new Date('2026-09-21T15:00:00.000Z');
  const q = buildQuotation(input, snapshot, ctx, now);
  assert.match(q.quoteNumber, /^Q-260921-\d{4}$/);
  assert.equal(q.customer.email, 'billing@example.com');
  assert.equal(q.customer.contactName, 'Sam Lee');
  assert.equal(q.company.name, 'Dispatra Test Co');
  assert.equal(q.expiresAt, snapshot.quoteExpiresAt);
  assert.equal(q.total, snapshot.total);
  assert.equal(q.subtotal, snapshot.subtotal);
  assert.deepEqual(q.lines.map(l => l.amount), snapshot.lines.map(l => l.amount));
  assert.deepEqual(q.items, [{ description: 'Crate', quantity: 2, weight: '100 lb', dimensions: '20 × 10 × 10 in' }]);
  assert.equal(q.stops[0].address, '100 Main St, Vancouver');
  const blank = { ...input, stops: input.stops.map(s => ({ ...s, label: '' })) };
  const idDetail = buildQuotation(blank, { ...snapshot, lines: [{ ...snapshot.lines[0], detail: `${blank.stops[0].id} -> ${blank.stops[1].id}; 10 lb` }] }, ctx, now);
  assert.equal(idDetail.lines[0].detail, 'Stop 1 -> Stop 2; 10 lb', 'raw stop ids never reach the customer');
  const text = quotationText(q, 'Hi Sam');
  assert.ok(text.startsWith('Hi Sam\n\nQUOTATION Q-260921-'));
  assert.match(text, /2 × Crate — 100 lb each, 20 × 10 × 10 in/);
  assert.match(text, new RegExp(`TOTAL\\s+\\$${snapshot.total.toFixed(2)} CAD`));
  assert.match(text, /1\. Pickup: 100 Main St, Vancouver \(Pat\)/);
  const href = quotationMailto(q, ' billing@example.com ', 'Hi Sam');
  assert.ok(href.startsWith('mailto:billing%40example.com?subject='));
  const params = new URLSearchParams(href.slice(href.indexOf('?') + 1));
  assert.equal(params.get('subject'), quotationSubject(q));
  assert.equal(params.get('body'), text);
  assert.throws(() => buildQuotation(input, { ...snapshot, status: 'NEEDS_ATTENTION' }, ctx), /priced/);
});

test('Send as quote appears only for a priced order with a customer and opens a menu with the customer email, Email and Download', async () => {
  const { customer } = setup();
  const user = userEvent.setup({ document });
  const notices: string[] = [];
  render(React.createElement(JobsPage, { jobs: [], drivers: [], onSelectJob: () => {}, onUpdateJob: () => {}, onCreateJob: () => {}, onNotification: m => notices.push(m) }));
  await user.click(screen.getByRole('button', { name: 'New Order' }));
  assert.equal(screen.queryByRole('button', { name: /Send as quote/ }), null);
  await user.click(screen.getByRole('combobox', { name: 'Shipper' }));
  await user.click(screen.getByRole('option', { name: new RegExp(customer.name) }));
  await user.click(screen.getByRole('button', { name: /Send as quote/ }));
  const menu = screen.getByRole('dialog', { name: 'Send as quote' });
  assert.ok(within(menu).getByText(customer.name));
  assert.ok(within(menu).getByText('billing@example.com'));
  assert.ok(within(menu).getByRole('button', { name: /Email/ }));
  assert.ok(within(menu).getByRole('button', { name: /Download/ }));
  assert.equal(within(menu).queryByRole('article'), null, 'no quotation preview is shown');
  await user.keyboard('{Escape}');
  assert.equal(screen.queryByRole('dialog', { name: 'Send as quote' }), null);
  assert.ok(screen.getByRole('button', { name: /Send as quote/ }), 'Escape closes only the menu, not the order form');
});

test('Email saves the PDF and hands the message to the mail client; Download saves the same PDF', async () => {
  const { ctx, input, snapshot } = setup();
  const user = userEvent.setup({ document });
  const notices: string[] = []; let href = ''; const saved: { name: string; file: Blob }[] = [];
  const q = buildQuotation(input, snapshot, ctx, new Date('2026-09-22T15:00:00.000Z'));
  render(React.createElement(QuotationMenu, { buildQuotation: () => q, onNotification: m => notices.push(m), openMail: v => { href = v; }, saveFile: (name, file) => { saved.push({ name, file }); }, logoFor: async () => undefined }));
  await user.click(screen.getByRole('button', { name: /Send as quote/ }));
  await user.click(screen.getByRole('button', { name: /Email/ }));
  await screen.findByText(/Send as quote/);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].name, `Quotation-${q.quoteNumber}.pdf`);
  assert.equal(saved[0].file.type, 'application/pdf');
  assert.ok(href.startsWith('mailto:billing%40example.com?subject='));
  assert.match(decodeURIComponent(href), new RegExp(`Hello Sam Lee,[\\s\\S]*attached \\(Quotation-${q.quoteNumber}\\.pdf\\)`));
  assert.match(notices.at(-1)!, /saved — attach it to the email that just opened for billing@example.com/);
  assert.equal(document.querySelector('[role=dialog][aria-label="Send as quote"][data-state="open"]'), null, 'menu closes after sending');
  await user.click(screen.getByRole('button', { name: /Send as quote/ }));
  await user.click(screen.getByRole('button', { name: /Download/ }));
  await screen.findByText(/Send as quote/);
  assert.equal(saved.length, 2);
  assert.equal(saved[1].name, quotationFileName(q));
  assert.match(notices.at(-1)!, /downloaded/);
});

test('the quotation PDF is a valid single-file document carrying the quote contents', () => {
  const { ctx, input, snapshot } = setup();
  const q = buildQuotation(input, snapshot, ctx, new Date('2026-09-22T15:00:00.000Z'));
  const pdf = latin1(quotationPdf(q));
  assert.ok(pdf.startsWith('%PDF-1.4'));
  assert.ok(pdf.trimEnd().endsWith('%%EOF'));
  assert.match(pdf, /\/Type \/Catalog/); assert.match(pdf, /\/Type \/Pages[^]*\/Count 1/); assert.match(pdf, /\/BaseFont \/Helvetica-Bold/);
  for (const text of ['(Quotation)', `(${q.quoteNumber})`, '(Dispatra Test Co)', '(PREPARED FOR)', '(Sam Lee)', '(Crate)', '(100 lb)', '(20 x 10 x 10 in)'.replace('x', '×').replace('x', '×'), `($${snapshot.total.toFixed(2)} CAD)`, '(Total)']) assert.ok(pdf.includes(text), `PDF should contain ${text}`);
  assert.ok(pdf.includes('(1. Pickup: 100 Main St, Vancouver · Pat)'));
  // xref offsets point at the objects they index.
  const startxref = Number(pdf.match(/startxref\n(\d+)/)![1]);
  assert.ok(pdf.slice(startxref).startsWith('xref'));
  const offsets = [...pdf.slice(startxref).matchAll(/^(\d{10}) 00000 n/gm)].map(m => Number(m[1]));
  offsets.forEach((offset, i) => assert.ok(pdf.slice(offset).startsWith(`${i + 1} 0 obj`), `object ${i + 1} offset`));
  // Long text wraps and the width table drives right alignment.
  assert.ok(textWidth('Total', 12, 'bold') > textWidth('Total', 12, 'regular'));
  assert.deepEqual(wrap('one two three four five six seven', 60, 10), ['one two', 'three four', 'five six', 'seven']);
  const long = { ...q, lines: Array.from({ length: 60 }, (_, i) => ({ key: `l${i}`, label: `Charge ${i}`, amount: 1 })) };
  assert.ok(Number(latin1(quotationPdf(long)).match(/\/Count (\d+)/)![1]) >= 2, "long quotations paginate");
});

test('a customer without an email can still download but cannot email', async () => {
  const { ctx, input, snapshot } = setup();
  const q = { ...buildQuotation(input, snapshot, ctx), customer: { name: 'No Mail Co', contactName: '', email: '' } };
  const user = userEvent.setup({ document }); let href = '';
  render(React.createElement(QuotationMenu, { buildQuotation: () => q, onNotification: () => {}, openMail: v => { href = v; }, saveFile: () => {}, logoFor: async () => undefined }));
  await user.click(screen.getByRole('button', { name: /Send as quote/ }));
  assert.ok(screen.getByRole('alert'));
  assert.equal((screen.getByRole('button', { name: /Email/ }) as HTMLButtonElement).disabled, true);
  assert.equal((screen.getByRole('button', { name: /Download/ }) as HTMLButtonElement).disabled, false);
  assert.equal(href, '');
});
