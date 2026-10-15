import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/acme/profile', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','NodeFilter','Event','CustomEvent','MutationObserver','getComputedStyle','localStorage','sessionStorage','location','history']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
const { render, screen, cleanup, fireEvent, waitFor } = await import('@testing-library/react');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { CompanyPaymentMethod } = await import('../src/portal/CompanyPaymentMethod');
const { default: PortalApp } = await import('../src/portal/PortalApp');
const { api, ApiError } = await import('../src/portal/api');
const { adminRoute, adminHref } = await import('../src/portal/admin/adminRoutes');
const original = { ...api };
const missing = { status:'MISSING' as const, required:true, setup_available:true, sync_error:false, monthly_price:'10.00',currency:'CAD',vehicle_count:2,monthly_total:'20.00',terms_version:1,starts_at:'2026-09-01T00:00:00Z',subscription_status:'NOT_SUBSCRIBED',trial_ends_at:'2026-09-01T00:00:00Z' };
beforeEach(() => { api.paymentMethod = async () => missing; api.paymentHistory = async () => ({ available: true, items: [], next_cursor: null }); });
afterEach(() => { cleanup(); Object.assign(api, original); history.replaceState(null, '', '/acme/profile'); });
function mount() {
  const cache = new QueryClient({ defaultOptions:{ queries:{retry:false,gcTime:0}, mutations:{retry:false,gcTime:0} } });
  render(<QueryClientProvider client={cache}><CompanyPaymentMethod target={{kind:'company',slug:'acme'}} /></QueryClientProvider>);
}

test('missing card requires consent, uncertain retries preserve the operation key, and setup failures stay visible', async () => {
  const keys:string[] = [];
  api.startCardSetup = async (target, key) => { assert.deepEqual(target,{kind:'company',slug:'acme'}); keys.push(key); throw new ApiError(503,'Stripe is unavailable. Try again.'); };
  mount();
  const add = await screen.findByRole('button',{name:'Add payment method'});
  assert.equal((add as HTMLButtonElement).disabled,true);
  assert.equal(screen.queryByRole('button',{name:'Refresh payment method'}),null);
  fireEvent.click(screen.getByRole('checkbox'));
  assert.equal((add as HTMLButtonElement).disabled,false);
  fireEvent.click(add);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button',{name:'Add payment method'}));
  await waitFor(() => assert.equal(keys.length,2));
  assert.equal(keys[0],keys[1]);
  assert.match(screen.getByRole('alert').textContent!,/Stripe is unavailable/);
});

test('returning from Stripe waits for server verification, refreshes masked card data, and removes the URL token', async () => {
  history.replaceState(null,'','/acme/profile?card_setup=cs_test_saved');
  let verified=false;
  api.confirmCardSetup = async (_target, session) => { assert.equal(session,'cs_test_saved'); verified=true; return {...missing,status:'SAVED',required:false,last4:'4242',brand:'visa',exp_month:12,exp_year:2030}; };
  api.paymentMethod = async () => verified ? {...missing,status:'SAVED',required:false,last4:'4242',brand:'visa',exp_month:12,exp_year:2030} : missing;
  mount();
  await screen.findByText(/visa •••• 4242/);
  assert.equal(location.search,'');
  assert.ok(screen.getByRole('button',{name:'Replace payment method'}));
  assert.match(screen.getByRole('status').textContent!,/saved/);
});

test('cancelled setup does not confirm or discard the previous payment method', async () => {
  history.replaceState(null,'','/acme/profile?card_setup=cancelled');
  let confirms=0;
  api.confirmCardSetup = async () => { confirms++; throw new Error('Unexpected confirm'); };
  api.paymentMethod = async () => ({...missing,status:'EXPIRED',last4:'4242',brand:'visa',exp_month:1,exp_year:2020});
  mount();
  await screen.findByText(/Card setup was cancelled/);
  assert.equal(confirms,0);
  assert.ok(screen.getByText(/card has expired/));
  assert.ok(screen.getByText(/visa •••• 4242/));
});

test('unconfigured provider is explicit and prevents card entry', async () => {
  api.paymentMethod = async () => ({...missing,setup_available:false});
  mount();
  await screen.findByText(/Payment setup is currently unavailable/);
  assert.equal(screen.queryByRole('checkbox'),null);
  assert.equal((screen.getByRole('button',{name:'Add payment method'}) as HTMLButtonElement).disabled,true);
  assert.equal(document.querySelector('input[autocomplete="cc-number"]'),null);
});

test('expired-trial login retains account access and Subscription under Settings without loading operations', async () => {
  history.replaceState(null,'','/acme/');
  let settings=0;
  api.me = async () => ({id:'dispatcher',login_id:'desk@example.com',display_name:'Desk',role:'DISPATCHER',tms_workspace:false,organization:{id:'acme',slug:'acme',name:'Acme',active:false,payment_required:true}});
  api.companySettings = async () => { settings++; throw new Error('Operational settings must not load'); };
  render(<PortalApp />);
  await screen.findByRole('heading',{level:1,name:'Profile'});
  assert.equal(screen.queryByRole('button',{name:'Add payment method'}),null);
  const user = (await import('@testing-library/user-event')).default.setup({ document });
  await user.click(screen.getByRole('button',{name:'Dispatcher account'}));
  await user.click(await screen.findByRole('menuitem',{name:'Subscription'}));
  await screen.findByRole('button',{name:'Add payment method'});
  assert.equal(location.pathname,'/acme/subscription');
  assert.deepEqual(screen.getAllByRole('tab').map(tab => tab.textContent), ['Payment methods', 'Payment history']);
  await user.click(screen.getByRole('tab',{name:'Payment history'}));
  assert.ok(screen.getByRole('heading',{name:'Payment history'}));
  await user.click(screen.getByRole('tab',{name:'Payment methods'}));
  fireEvent.click(screen.getByRole('link',{name:'Settings'}));
  await screen.findByText(/Workspace settings will be available/);
  fireEvent.click(screen.getByRole('link',{name:'Profile'}));
  await screen.findByLabelText('Company name');
  assert.equal(settings,0);
  assert.ok(screen.getByRole('button',{name:'Dispatcher account'}));
});

test('owner payment method deep links round trip', () => {
  const id='11111111-1111-4111-8111-111111111111';
  const route=adminRoute(`/admin/companies/${id}/payment-method`)!;
  assert.deepEqual(route,{page:'company',id,tab:'payment-method'});
  assert.equal(adminHref(route),`/admin/companies/${id}/payment-method`);
});


test('expired trial sign-in opens Profile and Subscription has a direct company URL', async () => {
  const { accountWorkspace, dispatcherPageAvailable } = await import('../src/lib/workspaceEntry');
  const { pageForPath } = await import('../src/lib/pageRoutes');
  assert.equal(accountWorkspace({role:'DISPATCHER',tms_workspace:true,organization:{slug:'acme',payment_required:true}} as never),'/acme/profile');
  assert.equal(pageForPath('/acme/subscription'),'subscription');
  assert.equal(dispatcherPageAvailable('subscription',true),true);
});


test('payment history renders real API rows, refunds, receipts and pagination', async () => {
  const { CompanyPaymentHistory } = await import('../src/portal/CompanyPaymentHistory');
  const pages: (string | undefined)[] = [];
  api.paymentHistory = async (_target, after) => {
    pages.push(after);
    return { available:true, next_cursor:after ? null : 'ch_first', items:[{id:after ? 'ch_second' : 'ch_first',created_at:'2026-10-01T10:00:00Z',amount:after?'10.00':'45.50',refunded_amount:after?'0':'5.00',currency:'CAD',status:after?'PAID':'PARTIALLY_REFUNDED',receipt_url:after?null:'https://pay.stripe.com/receipts/test'}] };
  };
  const cache = new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
  render(<QueryClientProvider client={cache}><CompanyPaymentHistory target={{kind:'company',slug:'acme'}} /></QueryClientProvider>);
  await screen.findByText('Partially refunded');
  assert.ok(screen.getByText(/45.50/));
  assert.ok(screen.getByText(/5.00 refunded/));
  assert.equal(screen.getByRole('link',{name:/View receipt/}).getAttribute('href'),'https://pay.stripe.com/receipts/test');
  fireEvent.click(screen.getByRole('button',{name:'Load more payments'}));
  await screen.findByText('Paid');
  assert.deepEqual(pages,[undefined,'ch_first']);
});


test('dispatcher account menu places Subscription and Integration under Settings and opens both pages', async () => {
  const { Sidebar } = await import('../src/components/Sidebar');
  const user = (await import('@testing-library/user-event')).default.setup({ document });
  const selected: string[] = [];
  function Harness() {
    const [open, setOpen] = React.useState(false);
    return <Sidebar activeTab="profile" isOpen onToggle={() => {}} setActiveTab={page => selected.push(page)} showAccountPopover={open} setShowAccountPopover={setOpen} onActionNotification={() => {}} dispatchMode="MANUAL" onDispatchModeChange={() => {}} />;
  }
  render(<Harness />);
  assert.equal(screen.queryByRole('button',{name:'Subscription'}), null);
  assert.equal(screen.queryByRole('button',{name:'Integrations'}), null);
  await user.click(screen.getByRole('button',{name:'Dispatcher Account'}));
  assert.deepEqual(screen.getAllByRole('menuitem').map(item=>item.textContent),['Profile','Settings','Subscription','Integration','Help','Logout']);
  await user.click(screen.getByRole('menuitem',{name:'Subscription'}));
  await user.click(screen.getByRole('button',{name:'Dispatcher Account'}));
  await user.click(screen.getByRole('menuitem',{name:'Integration'}));
  assert.deepEqual(selected,['subscription','integrations']);
});


test('recurring consent shows exact saved rate, fleet total and hosted recovery', async () => {
  api.paymentMethod = async () => ({...missing,subscription_status:'past_due',invoice_url:'https://invoice.stripe.com/i/recover'});
  mount();
  await screen.findByText('CAD 10.00 per registered vehicle per month.');
  assert.ok(screen.getByText(/2 registered vehicles · CAD 20.00/));
  assert.match(screen.getByRole('checkbox').parentElement!.textContent!, /monthly automatic charges/);
  assert.equal(screen.getByRole('link',{name:'Complete subscription payment with Stripe'}).getAttribute('href'),'https://invoice.stripe.com/i/recover');
  assert.equal(screen.queryByText(/Adding a card does not charge/),null);
});
