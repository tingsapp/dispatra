import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from './api';
import { Field, Button, Card, Notice } from './ui';
export function PasswordPage() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<unknown>();
  const mutation = useMutation({ mutationFn: () => api.password({ current_password: current, new_password: next }), onSuccess: () => { setCurrent(''); setNext(''); setConfirm(''); } });
  return <Card title="Change password" description="Changing your password is optional. After a change, other signed-in sessions are signed out."><form className="max-w-md space-y-5" onSubmit={e => { e.preventDefault(); setError(undefined); if (next !== confirm) { setError(new Error('New passwords do not match.')); return; } mutation.mutate(); }}>
    <Field label="Current password" type="password" autoComplete="current-password" required maxLength={128} value={current} onChange={e => setCurrent(e.target.value)} /><Field label="New password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={next} onChange={e => setNext(e.target.value)} /><p className="text-xs text-slate-500">Use at least 12 characters.</p><Field label="Confirm new password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirm} onChange={e => setConfirm(e.target.value)} />
    <Notice error={error || mutation.error} success={mutation.isSuccess ? 'Password changed.' : undefined} /><Button disabled={mutation.isPending}>{mutation.isPending ? 'Changing…' : 'Change password'}</Button></form></Card>;
}
