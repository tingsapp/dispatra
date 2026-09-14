import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, Account, LoginInput } from './api';
import { Field, Button, Notice } from './ui';
export function LoginPage({ slug, portal, onLogin }: { slug?: string; portal: LoginInput['portal']; onLogin: (account: Account) => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const mutation = useMutation({ mutationFn: () => api.login({ organization: slug ?? null, portal, login_id: login.trim().toLowerCase(), password }), onSuccess: account => { setPassword(''); onLogin(account); } });
  const title = portal === 'platform' ? 'Platform administration' : portal === 'dispatch' ? 'Dispatch workspace' : 'Customer portal';
  return <main className="min-h-screen bg-slate-50 px-5 py-14 sm:py-24"><div className="mx-auto max-w-md"><a href="/" className="text-xl font-semibold tracking-tight">Dispatra<span className="text-blue-600">.</span></a>
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><p className="text-sm font-medium text-blue-600">{slug ?? 'Platform owner'}</p><h1 className="mt-2 text-2xl font-semibold">{title}</h1><p className="mt-2 text-sm text-slate-500">Sign in with the credentials provided by your {portal === 'customer' ? 'dispatch company' : 'administrator'}.</p>
    <form className="mt-7 space-y-5" onSubmit={e => { e.preventDefault(); mutation.mutate(); }}><Field label="Login ID" autoComplete="username" required maxLength={100} value={login} onChange={e => setLogin(e.target.value)} /><Field label="Password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /><Notice error={mutation.error} /><Button className="w-full" disabled={mutation.isPending}>{mutation.isPending ? 'Signing in…' : 'Sign in'}</Button></form>
    <p className="mt-6 text-xs leading-5 text-slate-500">{portal === 'platform' ? 'Use the owner account configured for this installation.' : 'Need access or a password reset? Contact your dispatch company.'}</p></section></div></main>;
}
