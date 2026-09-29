import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, type DispatcherAccount, type DispatcherCredential } from '../api';
import { Button, Field, Notice, useOperationKey } from '../ui';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../../components/ui/Dialog';
import { isConflict } from './format';

/** Create or edit a dispatcher. New accounts receive a server-generated password that the caller shows once. */
export function DispatcherDialog({ companyId, account, onClose, onSaved }: {
  companyId: string; account?: DispatcherAccount; onClose: () => void; onSaved: (result: DispatcherAccount | DispatcherCredential) => void;
}) {
  const operation = useOperationKey();
  const [form, setForm] = useState({ login_id: account?.login_id ?? '', display_name: account?.display_name ?? '' });
  const mutation = useMutation({
    mutationFn: () => {
      const body = { login_id: form.login_id.trim().toLowerCase(), display_name: form.display_name.trim() };
      return account ? api.updateDispatcher(companyId, account.id, { ...body, version: account.version }, operation({ ...body, id: account.id, version: account.version })) : api.createDispatcher(companyId, body, operation(body));
    },
    onSuccess: onSaved,
  });
  return <Dialog onClose={() => { if (!mutation.isPending) onClose(); }} size="form">
    <form className="contents" aria-label={account ? 'Edit dispatcher' : 'Add dispatcher'} onSubmit={e => { e.preventDefault(); mutation.mutate(); }}>
      <DialogHeader title={account ? 'Edit dispatcher' : 'Add dispatcher'} description={account ? 'Changing the login ID does not sign the dispatcher out.' : 'A password is generated and shown once after saving.'} onClose={onClose} />
      <DialogBody className="space-y-5">
        <Field label="Login ID" required minLength={3} maxLength={254} autoComplete="off" pattern="[a-z0-9][a-z0-9@._+\-]*" title="Lowercase letters, digits and @ . _ + -" value={form.login_id} onChange={e => setForm(current => ({ ...current, login_id: e.target.value.toLowerCase() }))} />
        <Field label="Name" maxLength={160} autoComplete="off" value={form.display_name} onChange={e => setForm(current => ({ ...current, display_name: e.target.value }))} />
        <Notice error={mutation.error} />
        {isConflict(mutation.error) && <p className="text-sm text-app-muted">Close this dialog to load the latest account details.</p>}
      </DialogBody>
      <DialogFooter><Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>Cancel</Button><Button disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : account ? 'Save dispatcher' : 'Create dispatcher'}</Button></DialogFooter>
    </form>
  </Dialog>;
}
