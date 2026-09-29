import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, generatePassword, type Organization, type OrganizationInput } from '../api';
import { Button, Field, Notice, useOperationKey } from '../ui';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../../components/ui/Dialog';

const empty = (): OrganizationInput => ({ name: '', slug: '', admin_login: '', admin_display_name: '', password: generatePassword() });

/** Creates the company and its first dispatcher in one API transaction. The password lives only in this form state. */
export function CreateCompanyDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (org: Organization, submitted: OrganizationInput) => void }) {
  const operation = useOperationKey();
  const [form, setForm] = useState<OrganizationInput>(empty);
  const mutation = useMutation({ mutationFn: (submitted: OrganizationInput) => api.createOrganization(submitted, operation(submitted)), onSuccess: (org, submitted) => onCreated(org, submitted) });
  const set = (field: keyof OrganizationInput) => (event: React.ChangeEvent<HTMLInputElement>) => setForm(current => ({ ...current, [field]: field === 'slug' || field === 'admin_login' ? event.target.value.toLowerCase() : event.target.value }));
  return <Dialog onClose={() => { if (!mutation.isPending) onClose(); }} size="form">
    <form className="contents" aria-label="Add company" onSubmit={e => { e.preventDefault(); mutation.mutate({ ...form, name: form.name.trim(), slug: form.slug.trim(), admin_login: form.admin_login.trim() }); }}>
      <DialogHeader title="Add company" description="Creates the workspace and its first dispatcher together." onClose={onClose} />
      <DialogBody className="space-y-5">
        <Field label="Company name" required maxLength={160} value={form.name} onChange={set('name')} />
        <div><Field label="Company identifier" required minLength={2} maxLength={63} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="acme" value={form.slug} onChange={set('slug')} />
          <p className="mt-1.5 text-xs text-app-muted">Workspace address: /{form.slug || 'company'}/ — this cannot be changed later.</p></div>
        <Field label="Administrator login ID" required minLength={3} maxLength={254} autoComplete="off" value={form.admin_login} onChange={set('admin_login')} />
        <Field label="Administrator name" maxLength={160} autoComplete="off" value={form.admin_display_name ?? ''} onChange={set('admin_display_name')} />
        <div><Field label="Initial password" required minLength={12} maxLength={128} type="text" autoComplete="off" spellCheck={false} value={form.password} onChange={set('password')} />
          <p className="mt-1.5 text-xs text-app-muted">Generated for you. It is shown once after creation and never stored in the browser.</p></div>
        <Notice error={mutation.error} />
      </DialogBody>
      <DialogFooter><Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>Cancel</Button><Button disabled={mutation.isPending}>{mutation.isPending ? 'Creating…' : 'Create company'}</Button></DialogFooter>
    </form>
  </Dialog>;
}
