import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, Account, LoginInput } from './api';
import { Field, Button, Notice } from './ui';
import { PublicHeader } from '../components/home/PublicPageLayout';
import { WorkspaceRoleSelector } from '../components/home/WorkspaceRoleSelector';
import { rememberWorkspaceEntry, workspaceDestination, workspacePortals, type WorkspaceRole } from '../lib/workspaceEntry';
import { ArrowLeft } from 'lucide-react';
export function LoginPage({ slug, portal, onLogin }: { slug?: string; portal: LoginInput['portal']; onLogin: (account: Account) => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<WorkspaceRole>(portal === 'customer' ? 'shipper' : portal === 'driver' ? 'driver' : 'dispatcher');
  const selectedPortal = portal === 'platform' ? portal : workspacePortals[role];
  const mutation = useMutation({ gcTime: 0, mutationFn: () => api.login({ organization: slug ?? null, portal: selectedPortal, login_id: login.trim().toLowerCase(), password }), onSuccess: account => { setPassword(''); onLogin(account); } });
  const chooseRole = (choice: WorkspaceRole) => {
    setRole(choice); mutation.reset();
    const destination = slug ? workspaceDestination(slug, choice) : undefined;
    if (destination) { rememberWorkspaceEntry(slug!, choice); window.history.replaceState(null, '', destination); }
  };
  const credentials = <><Field label={selectedPortal === 'customer' ? 'Email or login ID' : 'Login ID'} type="text" autoComplete="username" required maxLength={100} value={login} onChange={e => { setLogin(e.target.value); mutation.reset(); }} /><Field label="Password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e => { setPassword(e.target.value); mutation.reset(); }} /><Notice error={mutation.error} /><Button className="w-full" disabled={mutation.isPending}>{mutation.isPending ? 'Signing in…' : 'Sign in'}</Button></>;
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!mutation.isPending) mutation.mutate(); };
  if (portal === 'platform') return <div className="min-h-dvh bg-app-canvas"><PublicHeader /><main className="mx-auto max-w-sm px-6 py-16 sm:py-24">
    <section><p className="text-center text-sm text-app-muted">Platform owner</p><h1 className="mt-3 text-center text-3xl font-medium tracking-tight">Platform administration</h1><p className="mt-3 text-center text-sm leading-6 text-app-muted">Sign in with the credentials provided by your administrator.</p>
      <form className="mt-7 space-y-5" onSubmit={submit}>{credentials}</form>
      <p className="mt-6 text-center text-xs leading-5 text-app-muted">Use the owner account configured for this installation.</p>
    </section></main></div>;
  return <div className="flex min-h-dvh flex-col bg-app-canvas font-sans text-app-text">
    <PublicHeader />
    <main className="flex flex-1 items-center justify-center px-6 py-10">
    <section aria-labelledby="login-title" className="min-w-0 w-full max-w-sm">
        <h1 id="login-title" className="text-center text-2xl font-medium tracking-tight">Sign in</h1>
        <p className="mt-2 text-center text-sm text-app-muted">Choose your role to access your workspace.</p>
        <form onSubmit={submit} className="mt-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <p id="login-workspace" className="min-w-0 break-all text-sm text-app-muted">dispatra.com/<span className="text-app-text">{slug}</span></p>
            <a href="/#workspace" className="shrink-0 text-xs text-app-muted underline underline-offset-4 hover:text-app-text">Change workspace</a>
          </div>
          <WorkspaceRoleSelector role={role} onChange={chooseRole} disabled={mutation.isPending} />
          <fieldset disabled={mutation.isPending} className="min-w-0 space-y-5">{credentials}</fieldset>
        </form>
        <p className="mt-5 text-center text-xs leading-5 text-app-muted">Need access or a password reset?<br />Contact your company administrator.</p>
        <a href="/" className="mx-auto mt-6 flex w-fit items-center gap-2 text-xs text-app-muted hover:text-app-text"><ArrowLeft className="size-3.5" aria-hidden="true" />Back to home</a>
    </section>
  </main></div>;
}
