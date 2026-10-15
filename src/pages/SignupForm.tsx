import { useEffect, useId, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { WorkspaceInput } from '../components/home/WorkspaceInput';
import { DialogBody, DialogFooter } from '../components/ui/Dialog';
import { AddressAutocomplete } from '../components/ui/AddressAutocomplete';
import { api, type TrialSignupInput } from '../portal/api';
import { Field, Button, Notice, useOperationKey } from '../portal/ui';
import { accountWorkspace, signupDestination, TMS_INTEGRATION_LABEL } from '../lib/workspaceEntry';

export function SignupForm({ onPendingChange }: { onPendingChange?: (pending: boolean) => void }) {
  const [form, setForm] = useState<TrialSignupInput>(() => {
    const candidate = new URLSearchParams(location.search).get('company') ?? '';
    const slug = signupDestination(candidate) ? candidate.trim().toLowerCase() : '';
    return { slug, name: slug.replace(/-/g, ' '), full_name: '', email: '', phone: '', address: '', password: '', tms_workspace: false };
  });
  const [confirmation, setConfirmation] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [addressResolving, setAddressResolving] = useState(false);
  const addressId = useId();
  const [error, setError] = useState('');
  const keyFor = useOperationKey();
  const signup = useMutation({ gcTime: 0, mutationFn: (body: TrialSignupInput) => api.signup(body, keyFor(body)),
    onSuccess: account => { setForm(current => ({ ...current, password: '' })); setConfirmation(''); location.replace('verification_required' in account ? '/signup/verify' : accountWorkspace(account) ?? '/login'); } });
  useEffect(() => { onPendingChange?.(signup.isPending); }, [signup.isPending, onPendingChange]);
  const change = (field: keyof TrialSignupInput) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm(current => ({ ...current, [field]: event.target.value })); setError(''); signup.reset();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (signup.isPending || addressResolving) return;
    if (!acceptedTerms) { setError('Please accept the Terms and Conditions to start your trial.'); return; }
    if (!signupDestination(form.slug)) { setError('Choose a valid company workspace name.'); return; }
    if (form.password !== confirmation) { setError('Passwords do not match.'); return; }
    signup.mutate({ ...form, slug: form.slug.trim().toLowerCase(), name: form.name.trim(), full_name: form.full_name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone?.trim() ?? '', address: form.address?.trim() ?? '' });
  };
  return <form className="flex min-h-0 flex-1 flex-col" aria-label="Create trial workspace" onSubmit={submit}>
    <DialogBody className="space-y-5">
      <fieldset className="grid min-w-0 items-start gap-4 sm:grid-cols-2" disabled={signup.isPending}>
        <legend className="sr-only">Company and contact details</legend>
        <Field label="Full name" required maxLength={160} autoComplete="name" value={form.full_name} onChange={change('full_name')} />
        <Field label="Company name" required maxLength={160} autoComplete="organization" value={form.name} onChange={change('name')} />
        <WorkspaceInput required value={form.slug} onChange={change('slug')} />
        <div className="min-w-0 grid gap-1.5 text-sm text-slate-700">
          <label htmlFor={addressId}>Address</label>
          <AddressAutocomplete id={addressId} maxLength={500} placeholder="Search company address" value={form.address ?? ''}
            onSelectionStateChange={state => setAddressResolving(state === 'resolving')}
            onChange={address => { setForm(current => ({ ...current, address })); setError(''); signup.reset(); }} />
        </div>
        <Field label="Email" type="email" required maxLength={254} autoComplete="email" value={form.email} onChange={change('email')} />
        <Field label="Phone (optional)" type="tel" maxLength={50} autoComplete="tel" value={form.phone} onChange={change('phone')} />
      </fieldset>
      <div className="rounded-xl bg-slate-100 p-4">
        <fieldset className="min-w-0" disabled={signup.isPending}>
          <legend className="mb-4 text-sm font-medium text-app-text">Account security</legend>
          <div className="grid min-w-0 items-start gap-4 sm:grid-cols-2">
            <Field label="Password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={form.password} onChange={change('password')} />
            <Field label="Confirm password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirmation} onChange={event => { setConfirmation(event.target.value); setError(''); }} />
          </div>
          <p className="mt-2 text-xs text-app-muted">Use at least 12 characters.</p>
        </fieldset>
      </div>
      <label className="flex items-start gap-3 text-sm leading-5">
        <input type="checkbox" className="app-checkbox mt-0.5" checked={!(form.tms_workspace ?? false)} disabled={signup.isPending}
          onChange={event => { setForm(current => ({ ...current, tms_workspace: !event.target.checked })); setError(''); signup.reset(); }} />
        <span>{TMS_INTEGRATION_LABEL}<span className="mt-1 block text-xs text-app-muted">Uncheck to connect an External TMS.</span></span>
      </label>
      <div className="flex items-start gap-3 text-sm leading-5">
        <input id="trial-terms" type="checkbox" className="app-checkbox mt-0.5" required checked={acceptedTerms} disabled={signup.isPending}
          onChange={event => { setAcceptedTerms(event.target.checked); setError(''); }} />
        <label htmlFor="trial-terms">I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Terms and Conditions</a>.</label>
      </div>
      <Notice error={error ? new Error(error) : signup.error} />
      <p className="text-xs leading-5 text-app-muted">Verify your email to start your 30-day trial. No credit card is required for the trial. To continue afterward, authorize monthly automatic billing at your company’s saved rate per registered vehicle.</p>
    </DialogBody>
    <DialogFooter><Button disabled={signup.isPending || addressResolving}>{signup.isPending ? 'Creating your workspace…' : 'Start trial'}</Button></DialogFooter>
  </form>;
}
