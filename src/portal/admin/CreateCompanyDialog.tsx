import { useId, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, generatePassword, type Organization, type OrganizationInput } from '../api';
import { Button, Field, Notice, useOperationKey } from '../ui';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../../components/ui/Dialog';
import { COMPANY_PLANS } from '../../lib/workspaceEntry';
import { AddressAutocomplete } from '../../components/ui/AddressAutocomplete';

const empty = (): OrganizationInput => ({ name: '', phone: '', address: '', slug: '', admin_login: '', admin_display_name: '', password: generatePassword(), tms_workspace: false });

/** Creates the company and its first dispatcher in one API transaction. The password lives only in this form state. */
export function CreateCompanyDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (org: Organization, submitted: OrganizationInput) => void }) {
  const operation = useOperationKey();
  const [form, setForm] = useState<OrganizationInput>(empty);
  const [addressResolving, setAddressResolving] = useState(false);
  const addressId = useId();
  const mutation = useMutation({ mutationFn: (submitted: OrganizationInput) => api.createOrganization(submitted, operation(submitted)), onSuccess: (org, submitted) => onCreated(org, submitted) });
  const set = (field: keyof OrganizationInput) => (event: React.ChangeEvent<HTMLInputElement>) => setForm(current => ({ ...current, [field]: field === 'slug' || field === 'admin_login' ? event.target.value.toLowerCase() : event.target.value }));
  return <Dialog onClose={() => { if (!mutation.isPending) onClose(); }} size="form">
    <form className="contents" aria-label="Add company" onSubmit={e => { e.preventDefault(); if (mutation.isPending || addressResolving) return; mutation.mutate({ ...form, name: form.name.trim(), phone: form.phone?.trim(), address: form.address?.trim(), slug: form.slug.trim(), admin_login: form.admin_login.trim() }); }}>
      <DialogHeader title="Add company" description="Creates the workspace and its first dispatcher together." onClose={onClose} closeDisabled={mutation.isPending} />
      <DialogBody className="space-y-5">
        <fieldset className="min-w-0 space-y-5" disabled={mutation.isPending}>
          <div className="grid min-w-0 items-start gap-5 sm:grid-cols-2">
            <Field label="Full name" maxLength={160} autoComplete="name" value={form.admin_display_name ?? ''} onChange={set('admin_display_name')} />
            <Field label="Company name" required maxLength={160} autoComplete="organization" value={form.name} onChange={set('name')} />
            <Field label="Email" type="email" required maxLength={254} autoComplete="username" value={form.admin_login} onChange={set('admin_login')} />
            <Field label="Phone number" type="tel" maxLength={50} autoComplete="tel" value={form.phone ?? ''} onChange={set('phone')} />
            <div><Field label="Company identifier" required minLength={2} maxLength={63} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="acme" value={form.slug} onChange={set('slug')} />
              <p className="mt-1.5 text-xs text-app-muted">Workspace address: /{form.slug || 'company'}/, this cannot be changed later.</p></div>
            <div className="grid min-w-0 gap-1.5 text-sm text-slate-700"><label htmlFor={addressId}>Address</label>
              <AddressAutocomplete id={addressId} maxLength={500} placeholder="Search company address" value={form.address ?? ''}
                onSelectionStateChange={state => setAddressResolving(state === 'resolving')}
                onChange={address => setForm(current => ({ ...current, address }))} />
            </div>
          </div>
          <div><Field label="Password" required minLength={12} maxLength={128} type="password" autoComplete="new-password" spellCheck={false} value={form.password} onChange={set('password')} />
            <p className="mt-1.5 text-xs text-app-muted">Generated for you. It is shown once after creation and never stored in the browser.</p></div>
          <fieldset className="min-w-0" aria-label="Company plan">
            <legend className="mb-3 text-sm font-medium">Plan</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {COMPANY_PLANS.map(option => <label key={option.label} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm leading-5 ${Boolean(form.tms_workspace) === option.externalTms ? 'border-app-accent bg-app-accent-soft/40' : 'border-app-border'}`}>
                <input type="radio" name="company-plan" className="mt-0.5 size-4 shrink-0 accent-slate-900" aria-label={option.label}
                  checked={Boolean(form.tms_workspace) === option.externalTms} onChange={() => setForm(current => ({ ...current, tms_workspace: option.externalTms }))} />
                <span><span className="font-medium">{option.label}</span><span className="mt-1 block text-xs text-app-muted">{option.description}</span></span>
              </label>)}
            </div>
          </fieldset>
          <Notice error={mutation.error} />
        </fieldset>
      </DialogBody>
      <DialogFooter><Button disabled={mutation.isPending || addressResolving}>{mutation.isPending ? 'Creating…' : 'Create company'}</Button></DialogFooter>
    </form>
  </Dialog>;
}
