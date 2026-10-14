import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/signup?company=my-company' });
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','CustomEvent','localStorage','sessionStorage','location','history']) {
  Object.defineProperty(globalThis, name, { configurable:true, writable:true, value:dom.window[name as keyof Window] });
}
const { render, screen, cleanup, fireEvent, waitFor } = await import('@testing-library/react');
const { SignupForm, TrialPlansPage } = await import('../src/pages/SignupPage');
const { EmailVerificationForm } = await import('../src/pages/VerifyEmailPage');
const { api, ApiError } = await import('../src/portal/api');
import type { TrialSignupInput } from '../src/portal/api';
const original = { signup: api.signup, subscriptionPlan: api.subscriptionPlan, verification:api.verification, verifyEmail:api.verifyEmail, resendVerification:api.resendVerification };
afterEach(() => { cleanup(); delete (globalThis as Record<string, unknown>).google; Object.assign(api, original); localStorage.clear(); sessionStorage.clear(); history.replaceState(null, '', '/signup?company=my-company'); });
const view = () => render(React.createElement(QueryClientProvider, { client:new QueryClient({defaultOptions:{mutations:{retry:false,gcTime:0}}}) }, React.createElement(SignupForm)));
const plan = { name: 'Monthly subscription' as const, interval: 'MONTHLY' as const, trial_days: 30, monthly_price: null, currency: 'CAD' };
const page = () => render(React.createElement(QueryClientProvider, { client:new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0},mutations:{retry:false,gcTime:0}}}) }, React.createElement(TrialPlansPage)));
const fill = () => {
  for (const [label,value] of [['Company name','My Company'],['Full name','Jane Dispatcher'],['Email','Jane@Example.com'],['Password','Exact-password-123! '],['Confirm password','Exact-password-123! ']]) {
    fireEvent.change(screen.getByLabelText(label, {exact:true}), {target:{value}});
  }
  fireEvent.click(screen.getByRole('checkbox', {name:/I agree to the Terms and Conditions/}));
};
test('signup retains the homepage company identifier and explains the 30-day trial', () => {
  view();
  assert.equal((screen.getByLabelText('Workspace') as HTMLInputElement).value, 'my-company');
  assert.ok(screen.getByText(/Verify your email to start your 30-day trial/));
  assert.equal(screen.queryByRole('radio'), null);
});

test('plans precede signup and the popup preserves the company identifier, dismisses and clears secrets', async () => {
  api.subscriptionPlan = async () => plan;
  page();
  await screen.findByRole('heading', {name:'Monthly plan'});
  assert.ok(screen.getByText('Contact us for pricing'));
  assert.ok(screen.getByRole('heading', {name:'One month free trial'}));
  assert.equal(screen.getByRole('link', {name:'Sign in'}).getAttribute('href'), '/login');
  assert.equal(screen.queryByLabelText('Email'), null);
  const start = screen.getByRole('button', {name:'Start free trial'});
  start.focus(); fireEvent.click(start);
  assert.ok(screen.getByRole('dialog', {name:'Start your free trial'}));
  assert.equal((screen.getByLabelText('Workspace') as HTMLInputElement).value, 'my-company');
  fireEvent.change(screen.getByLabelText('Password', {exact:true}), {target:{value:'private-password'}});
  assert.equal(document.body.style.overflow, 'hidden');
  fireEvent.keyDown(document, {key:'Escape'});
  assert.equal(screen.queryByRole('dialog'), null);
  assert.equal(document.body.style.overflow, '');
  assert.equal(document.activeElement, start);
  fireEvent.click(start);
  assert.equal((screen.getByLabelText('Password', {exact:true}) as HTMLInputElement).value, '');
});

test('public plans render the exact configured monthly price and offer read recovery', async () => {
  let unavailable = true;
  api.subscriptionPlan = async () => { if (unavailable) throw new ApiError(503, 'Plans unavailable.'); return {...plan, monthly_price:'49.95',currency:'USD'}; };
  page();
  await screen.findByText('Plans unavailable.');
  assert.equal(screen.queryByRole('button', {name:'Start free trial'}), null);
  unavailable = false; fireEvent.click(screen.getByRole('button', {name:'Try again'}));
  await screen.findByText('US$49.95');
  assert.ok(screen.getByText('USD / vehicle / month'));
});

test('pending popup signup blocks dismissal and keeps retry inputs after failure', async () => {
  api.subscriptionPlan = async () => plan;
  let reject:(error:Error)=>void = () => {};
  api.signup = () => new Promise((_resolve,rejectPromise) => {reject=rejectPromise;});
  page();
  fireEvent.click(await screen.findByRole('button', {name:'Start free trial'})); fill();
  fireEvent.click(screen.getByRole('button', {name:'Start trial'}));
  await waitFor(() => assert.equal((screen.getByRole('button', {name:'Close dialog'}) as HTMLButtonElement).disabled,true));
  fireEvent.keyDown(document, {key:'Escape'});
  assert.ok(screen.getByRole('dialog'));
  reject(new ApiError(409, 'Company name unavailable.'));
  await screen.findByText('Company name unavailable.');
  assert.equal((screen.getByLabelText('Email') as HTMLInputElement).value, 'Jane@Example.com');
  fireEvent.click(screen.getByRole('button', {name:'Close dialog'}));
  assert.equal(screen.queryByRole('dialog'), null);
});
test('password confirmation blocks requests and signup retries preserve their key and exact password', async () => {
  const calls: {body:TrialSignupInput; key:string}[] = [];
  api.signup = async (body,key) => { calls.push({body,key}); throw new ApiError(503,'Try again.'); };
  view(); fill();
  fireEvent.change(screen.getByLabelText('Confirm password', {exact:true}), {target:{value:'different-password'}});
  fireEvent.click(screen.getByRole('button', {name:'Start trial'}));
  assert.match(screen.getByRole('alert').textContent!, /Passwords do not match/);
  assert.equal(calls.length,0);
  fireEvent.change(screen.getByLabelText('Confirm password', {exact:true}), {target:{value:'Exact-password-123! '}});
  for (let index=0; index<2; index++) {
    fireEvent.click(screen.getByRole('button', {name:'Start trial'}));
    await waitFor(() => assert.equal(calls.length,index+1));
    await screen.findByText('Try again.');
  }
  assert.equal(calls[0].key,calls[1].key);
  assert.deepEqual(calls[0].body, {slug:'my-company',name:'My Company',full_name:'Jane Dispatcher',email:'jane@example.com',phone:'',address:'',password:'Exact-password-123! ',tms_workspace:false});
  assert.equal(localStorage.length,0); assert.equal(sessionStorage.length,0);
});
test('pending signup disables inputs and duplicate submission', async () => {
  let calls=0;
  let reject:(error:Error)=>void = () => {};
  api.signup = async () => { calls++; return new Promise((_resolve,rejectPromise) => {reject=rejectPromise;}); };
  view(); fill();
  fireEvent.click(screen.getByRole('button', {name:'Start trial'}));
  await waitFor(() => assert.equal(screen.getByLabelText('Email').closest('fieldset')?.disabled,true));
  assert.equal(screen.getByLabelText('Password', {exact:true}).closest('fieldset')?.disabled,true);
  assert.equal(screen.getByLabelText('Address').closest('fieldset')?.disabled,true);
  for (const checkbox of screen.getAllByRole('checkbox')) assert.equal((checkbox as HTMLInputElement).disabled,true);
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  assert.equal(calls,1);
  reject(new ApiError(409,'That company is unavailable.'));
  await screen.findByText('That company is unavailable.');
  assert.equal((screen.getByLabelText('Workspace') as HTMLInputElement).value,'my-company');
});
test('TMS signup choice survives failed retries and changes the operation key when toggled', async () => {
  const calls: { body: TrialSignupInput; key: string }[] = [];
  api.signup = async (body, key) => { calls.push({ body, key }); throw new ApiError(503, 'Try again.'); };
  view(); fill();
  const tms = screen.getByRole('checkbox', { name: /Use Dispatra TMS/ }) as HTMLInputElement;
  assert.equal(tms.checked, true);
  fireEvent.click(tms);
  for (let index = 0; index < 2; index++) {
    fireEvent.click(screen.getByRole('button', { name: 'Start trial' }));
    await waitFor(() => assert.equal(calls.length, index + 1));
    await screen.findByText('Try again.');
  }
  assert.equal(tms.checked, false);
  assert.equal(calls[0].body.tms_workspace, true);
  assert.equal(calls[0].key, calls[1].key);
  fireEvent.click(tms);
  fireEvent.click(screen.getByRole('button', { name: 'Start trial' }));
  await waitFor(() => assert.equal(calls.length, 3));
  assert.equal(calls[2].body.tms_workspace, false);
  assert.notEqual(calls[2].key, calls[0].key);
});
test('signup waits for address selection and submits the formatted company address', async () => {
  const calls: TrialSignupInput[] = [];
  let resolvePlace: () => void = () => {};
  const address = '1420 Derwent Way, Delta, BC V3M 6M7, Canada';
  const place = {formattedAddress: address, fetchFields: () => new Promise<void>(resolve => {resolvePlace=resolve;})};
  const prediction = {placeId:'signup-address', text:{toString:()=>address}, toPlace:()=>place};
  (globalThis as Record<string, unknown>).google = {maps:{importLibrary:async()=>({AutocompleteSessionToken:class {},
    AutocompleteSuggestion:{fetchAutocompleteSuggestions:async()=>({suggestions:[{placePrediction:prediction}]})}})}};
  api.signup = async body => {calls.push(body); throw new ApiError(503,'Try again.');};
  view(); fill();
  fireEvent.change(screen.getByLabelText('Address'), {target:{value:'1420 Derwent'}});
  fireEvent.click(await screen.findByRole('button',{name:address}));
  assert.equal((screen.getByRole('button',{name:'Start trial'}) as HTMLButtonElement).disabled,true);
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  assert.equal(calls.length,0);
  resolvePlace();
  await waitFor(()=>assert.equal((screen.getByLabelText('Address') as HTMLInputElement).value,address));
  fireEvent.click(screen.getByRole('button',{name:'Start trial'}));
  await screen.findByText('Try again.');
  assert.equal(calls[0].address,address);
});
test('trial requires explicit terms acceptance, links terms only and clears acceptance on dismissal', async () => {
  let calls = 0;
  api.subscriptionPlan = async () => plan;
  api.signup = async () => { calls++; throw new ApiError(503, 'Try again.'); };
  page();
  fireEvent.click(await screen.findByRole('button', {name:'Start free trial'}));
  const checkbox = screen.getByRole('checkbox', {name:/I agree to the Terms and Conditions/}) as HTMLInputElement;
  assert.equal(checkbox.checked, false);
  const form = screen.getByLabelText('Email').closest('form')!;
  fireEvent.submit(form);
  assert.equal(calls, 0);
  assert.match(screen.getByRole('alert').textContent!, /Please accept/);
  const dialog = screen.getByRole('dialog');
  const link = dialog.querySelector('a')!;
  assert.equal(link.textContent, 'Terms and Conditions');
  assert.equal(link.getAttribute('href'), '/terms');
  assert.equal(link.getAttribute('target'), '_blank');
  assert.equal(dialog.querySelector('a[href="/privacy"]'),null);
  fill();
  fireEvent.submit(form);
  await screen.findByText('Try again.');
  assert.equal(calls, 1);
  fireEvent.click(screen.getByRole('button', {name:'Close dialog'}));
  fireEvent.click(screen.getByRole('button', {name:'Start free trial'}));
  assert.equal((screen.getByRole('checkbox',{name:/I agree to the Terms and Conditions/}) as HTMLInputElement).checked,false);
  assert.equal((screen.getByRole('checkbox',{name:/Use Dispatra TMS/}) as HTMLInputElement).checked,true);
});
test('untrusted query strings cannot prefill invalid or reserved identifiers', () => {
  history.replaceState(null,'','/signup?company=admin'); view();
  assert.equal((screen.getByLabelText('Workspace') as HTMLInputElement).value,'');
});

const verification = () => ({verification_required:true as const,email:'user@example.com',expires_at:new Date(Date.now()+600000).toISOString(),resend_at:new Date(Date.now()-1000).toISOString(),delivery_status:'SENT' as const});
const verificationView = () => render(React.createElement(QueryClientProvider,{client:new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0},mutations:{retry:false,gcTime:0}}})},React.createElement(EmailVerificationForm)));
test('verification preserves a wrong code for retry and locks code/resend while pending',async()=>{
  api.verification=async()=>verification();
  let reject:(error:Error)=>void=()=>{};
  api.verifyEmail=()=>new Promise((_resolve,fail)=>{reject=fail;});
  verificationView();
  const input=await screen.findByLabelText('Verification code');
  fireEvent.change(input,{target:{value:'a123456'}});
  assert.equal((input as HTMLInputElement).value,'123456');
  fireEvent.click(screen.getByRole('button',{name:'Verify email'}));
  await waitFor(()=>assert.equal((input as HTMLInputElement).disabled,true));
  assert.equal((screen.getByRole('button',{name:'Resend code'}) as HTMLButtonElement).disabled,true);
  reject(new ApiError(400,'The code is incorrect.'));
  await screen.findByText('The code is incorrect.');
  assert.equal((input as HTMLInputElement).value,'123456');
});
test('expired verification requires resend and clears the old code',async()=>{
  const stale={...verification(),expires_at:new Date(Date.now()-1000).toISOString()};
  api.verification=async()=>stale;
  api.resendVerification=async()=>verification();
  verificationView();
  const input=await screen.findByLabelText('Verification code');
  fireEvent.change(input,{target:{value:'123456'}});
  assert.equal((screen.getByRole('button',{name:'Verify email'}) as HTMLButtonElement).disabled,true);
  fireEvent.click(screen.getByRole('button',{name:'Resend code'}));
  await waitFor(()=>assert.equal((input as HTMLInputElement).value,''));
  assert.equal((screen.getByRole('button',{name:'Verify email'}) as HTMLButtonElement).disabled,false);
});
