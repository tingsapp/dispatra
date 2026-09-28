import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, Account, LoginInput } from './api';
import { Field, Button, Notice } from './ui';
import { BrandMark } from '../components/layout/AppBrand';
export function LoginPage({ slug, portal, onLogin }: { slug?: string; portal: LoginInput['portal']; onLogin: (account: Account) => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const mutation = useMutation({ mutationFn: () => api.login({ organization: slug ?? null, portal, login_id: login.trim().toLowerCase(), password }), onSuccess: account => { setPassword(''); onLogin(account); } });
  const title = portal === 'platform' ? 'Platform administration' : portal === 'dispatch' ? 'Dispatch workspace' : portal === 'driver' ? 'Driver portal' : 'Shipper portal';
  return <main className="min-h-dvh bg-app-canvas px-6 py-6"><a href="/" className="inline-flex items-center gap-2.5 rounded-lg text-lg font-medium tracking-tight"><BrandMark />Dispatra</a><div className="mx-auto max-w-sm py-16 sm:py-24">
    <section><p className="text-center text-sm text-app-muted">{slug ?? 'Platform owner'}</p><h1 className="mt-3 text-center text-3xl font-medium tracking-tight">{title}</h1><p className="mt-3 text-center text-sm leading-6 text-app-muted">Sign in with the credentials provided by your {portal === 'customer' ? 'dispatch company' : 'administrator'}.</p>
    <form className="mt-7 space-y-5" onSubmit={e => { e.preventDefault(); mutation.mutate(); }}><Field label={portal === 'customer' ? 'Email or login ID' : 'Login ID'} type="text" autoComplete="username" required maxLength={100} value={login} onChange={e => setLogin(e.target.value)} /><Field label="Password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /><Notice error={mutation.error} /><Button className="w-full" disabled={mutation.isPending}>{mutation.isPending ? 'Signing in…' : 'Sign in'}</Button></form>
    <p className="mt-6 text-center text-xs leading-5 text-app-muted">{portal === 'platform' ? 'Use the owner account configured for this installation.' : 'Need access or a password reset? Contact your dispatch company.'}</p></section></div></main>;
}
