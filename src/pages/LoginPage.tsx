import React, { useId, useState } from 'react';
import { BrandMark } from '../components/layout/AppBrand';
import { Button } from '../components/ui/button';
import { DispatcherSession, signIn } from '../lib/sessionStorage';
import { ContactInput } from '../components/ui/ContactInput';

/** Dispatcher sign-in for the local prototype; the main page renders once a session exists. */
export function LoginPage({ onSignedIn }: { onSignedIn: (session: DispatcherSession) => void }) {
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    try { onSignedIn(signIn(email, password)); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not sign in.'); }
  };
  return <main className="app-canvas min-h-dvh px-6 py-6">
    <a href="/" className="inline-flex items-center gap-2.5 rounded-lg text-lg font-medium tracking-tight text-slate-900"><BrandMark />Dispatra</a>
    <div className="mx-auto max-w-sm py-16 sm:py-24">
      <h1 className="text-center text-3xl font-medium tracking-tight text-slate-900">Sign in</h1>
      <p className="mt-3 text-center text-sm leading-6 text-slate-500">Dispatch workspace for your delivery company.</p>
      <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
        <label htmlFor={`${id}-email`} className="block"><span className="app-label">Email</span><ContactInput id={`${id}-email`} type="email" autoComplete="username" required value={email} onChange={e => { setEmail(e.target.value); setError(null); }} className="app-input w-full" /></label>
        <label htmlFor={`${id}-password`} className="block"><span className="app-label">Password</span><input id={`${id}-password`} type="password" autoComplete="current-password" required value={password} onChange={e => { setPassword(e.target.value); setError(null); }} className="app-input w-full" /></label>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <Button type="submit" className="w-full">Sign in</Button>
      </form>
      <p className="mt-6 text-center text-xs leading-5 text-slate-500">Need access or a password reset? Contact your administrator.</p>
    </div>
  </main>;
}
