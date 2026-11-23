import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, Account, LoginInput } from './api';
import { Field, Button, Notice } from './ui';
import { PublicHeader } from '../components/home/PublicPageLayout';
import { WorkspaceRoleSelector } from '../components/home/WorkspaceRoleSelector';
import { workspacePortals, type WorkspaceRole } from '../lib/workspaceEntry';
import { ArrowLeft } from 'lucide-react';
export function LoginPage({ portal, onLogin }: { portal: LoginInput['portal']; onLogin: (account: Account) => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<WorkspaceRole>(portal === 'customer' ? 'shipper' : portal === 'driver' ? 'driver' : 'dispatcher');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string>();
  const [resetBusy, setResetBusy] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const selectedPortal = portal === 'platform' ? portal : workspacePortals[role];
  const mutation = useMutation({ gcTime: 0, mutationFn: () => api.login({ portal: selectedPortal, login_id: login.trim().toLowerCase(), password }), onSuccess: account => { setPassword(''); if ('verification_required' in account) location.replace('/signup/verify'); else onLogin(account); } });
  const chooseRole = (choice: WorkspaceRole) => {
    setRole(choice); mutation.reset();
  };
  const credentials = <><Field label="Email" type="text" autoComplete="username" required maxLength={254} value={login} onChange={e => { setLogin(e.target.value); mutation.reset(); }} /><Field label="Password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e => { setPassword(e.target.value); mutation.reset(); }} /><Notice error={mutation.error} /><Button loading={mutation.isPending} className="w-full" disabled={mutation.isPending}>{mutation.isPending ? 'Signing in…' : 'Sign in'}</Button></>;
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!mutation.isPending) mutation.mutate(); };
  const openReset = () => {
    setResetEmail(login);
    setResetCode('');
    setResetPassword('');
    setResetSent(false);
    setResetError(undefined);
    setResetOpen(true);
  };
  const sendReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setResetBusy(true);
    setResetError(undefined);
    try {
      const result = await api.requestPasswordReset(selectedPortal, resetEmail.trim().toLowerCase());
      setResetToken(result.reset_token ?? '');
      setResetSent(true);
    } catch (problem) {
      setResetError(problem instanceof Error ? problem.message : 'Could not send reset code.');
    } finally {
      setResetBusy(false);
    }
  };
  const resendReset = async () => {
    setResetBusy(true);
    setResetError(undefined);
    try { const result = await api.resendPasswordReset(resetToken); setResetToken(result.reset_token ?? resetToken); }
    catch (problem) { setResetError(problem instanceof Error ? problem.message : 'Could not resend reset code.'); }
    finally { setResetBusy(false); }
  };
  const confirmReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setResetBusy(true);
    setResetError(undefined);
    try {
      await api.confirmPasswordReset(resetToken, resetCode, resetPassword);
      setResetOpen(false);
      setPassword('');
    } catch (problem) {
      setResetError(problem instanceof Error ? problem.message : 'Could not reset password.');
    } finally {
      setResetBusy(false);
    }
  };
  if (portal === 'platform') return <div className="public-site min-h-dvh bg-app-canvas"><PublicHeader navigation={false} /><main className="mx-auto flex max-w-xl justify-center px-6 py-16 sm:py-24">
    <section className="public-auth-card">
        <p className="home-eyebrow text-center">Platform owner</p><h1 className="mt-3 text-center text-3xl font-medium tracking-tight">Platform administration</h1><p className="mt-3 text-center text-sm leading-6 text-app-muted">Sign in with the credentials provided by your administrator.</p>
        <form className="mt-7 space-y-5" onSubmit={submit}>{credentials}</form>
    </section></main></div>;
  return <div className="public-site flex min-h-dvh flex-col bg-app-canvas font-sans text-app-text">
    <PublicHeader navigation={false} />
    <main className="flex flex-1 items-center justify-center px-6 py-10">
    <section aria-labelledby="login-title" className="public-auth-card">
      {resetOpen ? (
        <>
          <h1 className="text-center text-2xl font-medium tracking-tight">Reset password</h1>
          {!resetSent ? (
            <form onSubmit={sendReset} className="mt-6">
              <p className="mb-4 text-center text-sm text-app-muted">Enter your email to send the reset code</p>
              <div className="space-y-5 rounded-3xl bg-slate-100 p-[18px]">
                <Field label="Email" type="email" autoComplete="username" required value={resetEmail} onChange={event => setResetEmail(event.target.value)} />
                {resetError && <Notice error={new Error(resetError)} />}
                <Button loading={resetBusy} className="w-full" disabled={resetBusy}>Send reset code</Button>
              </div>
            </form>
          ) : (
            <form onSubmit={confirmReset} className="mt-6">
              <p className="mb-4 text-center text-sm text-app-muted">Enter the code sent to {resetEmail} and choose a new password.</p>
              <div className="space-y-5 rounded-3xl bg-slate-100 p-[18px]">
                <Field label="Reset code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={resetCode} onChange={event => setResetCode(event.target.value.replace(/\D/g, '').slice(0,6))} />
                <Field label="New password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={resetPassword} onChange={event => setResetPassword(event.target.value)} />
                {resetError && <Notice error={new Error(resetError)} />}
                <Button type="button" variant="outline" className="w-full" disabled={resetBusy} onClick={resendReset}>Resend code</Button>
                <Button type="submit" loading={resetBusy} className="w-full" disabled={resetBusy || resetCode.length !== 6 || resetPassword.length < 12}>Reset password</Button>
              </div>
            </form>
          )}
          <button type="button" className="mx-auto mt-5 block text-xs text-app-muted hover:text-app-text" disabled={resetBusy} onClick={() => setResetOpen(false)}>Back to sign in</button>
        </>
      ) : (
        <>
        <h1 id="login-title" className="text-center text-2xl font-medium tracking-tight">Sign in</h1>
        <p className="mt-2 text-center text-sm text-app-muted">Choose your role to access your workspace.</p>
        <form onSubmit={submit} className="mt-6 space-y-5">
          <WorkspaceRoleSelector role={role} onChange={chooseRole} disabled={mutation.isPending} />
          <fieldset disabled={mutation.isPending} className="min-w-0 space-y-5">{credentials}</fieldset>
        </form>
        <button type="button" className="mx-auto mt-5 block text-xs leading-5 text-app-accent hover:underline" onClick={openReset}>Forgot password?</button>
        <a href="/" className="mx-auto mt-6 flex w-fit items-center gap-2 text-xs text-app-muted hover:text-app-text"><ArrowLeft className="size-3.5" aria-hidden="true" />Back to home</a>
        </>
      )}
    </section>
  </main></div>;
}
