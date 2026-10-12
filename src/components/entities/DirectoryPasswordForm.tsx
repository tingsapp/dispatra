import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { operations } from '../../operations/api';
import { Button, Field, Notice } from '../../portal/ui';

/** Credentials stay in this transient form and never enter directory records or query keys. */
export function DirectoryPasswordForm({ slug, kind, record }: {
  slug: string; kind: 'shipper' | 'driver'; record?: { id: string; version: number };
}) {
  const cache = useQueryClient();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<Error>();
  const attempt = useRef<{ password: string; version: number; key: string } | undefined>(undefined);
  const listKey = ['operations', slug, `${kind}s`];
  const mutation = useMutation({ mutationFn: async () => {
    if (!record) throw new Error('Reload the account before changing its password.');
    if (!attempt.current || attempt.current.password !== password || attempt.current.version !== record.version)
      attempt.current = { password, version: record.version, key: crypto.randomUUID() };
    const change = kind === 'shipper' ? operations.changeShipperPassword : operations.changeDriverPassword;
    return change(slug, record.id, { version: attempt.current.version, new_password: password }, attempt.current.key);
  }, onSuccess: () => {
    setPassword(''); setConfirmation(''); attempt.current = undefined;
    cache.invalidateQueries({ queryKey: listKey });
    if (kind === 'driver') {
      cache.invalidateQueries({ queryKey: ['driver-profile', slug] });
      cache.invalidateQueries({ queryKey: ['operations', slug, 'monitor'] });
    }
  } });
  const edit = () => { setError(undefined); mutation.reset(); };
  return <section aria-label="Account password" className="space-y-3">
    <h4 className="app-section-title">Change password</h4>
    <p className="text-xs text-app-muted">Use at least 12 characters. Existing sessions will be signed out.{kind === 'driver' ? ' The driver will go Off Duty.' : ''}</p>
    <form className="space-y-4" onSubmit={event => {
      event.preventDefault(); setError(undefined);
      if (password !== confirmation) { setError(new Error('New passwords do not match.')); return; }
      mutation.mutate();
    }}>
      <fieldset disabled={mutation.isPending} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field label="New password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={event => { edit(); setPassword(event.target.value); }} />
        <Field label="Confirm password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={event => { edit(); setConfirmation(event.target.value); }} />
      </fieldset>
      <Notice error={error || mutation.error} success={mutation.isSuccess ? 'Password changed.' : undefined} />
      <div className="flex flex-wrap justify-end gap-2">
        {mutation.error && <Button type="button" variant="outline" onClick={() => cache.invalidateQueries({ queryKey: listKey })}>Reload account</Button>}
        <Button type="submit" disabled={!record || mutation.isPending}>{mutation.isPending ? 'Changing…' : 'Change password'}</Button>
      </div>
    </form>
  </section>;
}
