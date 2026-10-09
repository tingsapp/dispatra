import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Check, Globe2, MapPinned, Package, Truck } from 'lucide-react';
import { Button } from '../ui/button';
import { readWorkspaceEntry, workspaceSlug, type WorkspaceRole } from '../../lib/workspaceEntry';
import { useWorkspaceLogin } from '../../portal/useWorkspaceLogin';

const choices = [
  { role: 'dispatcher', label: 'Dispatcher', description: 'Manage your delivery day.', icon: MapPinned },
  { role: 'shipper', label: 'Shipper', description: 'Book and track your orders.', icon: Package },
  { role: 'driver', label: 'Driver', description: 'View routes and complete stops.', icon: Truck },
] as const;

export function WorkspaceEntry({ role, onRoleChange }: { role: WorkspaceRole; onRoleChange: (role: WorkspaceRole) => void }) {
  const [remembered] = useState(readWorkspaceEntry);
  const [workspace, setWorkspace] = useState(remembered.slug);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const signIn = useWorkspaceLogin(() => setPassword(''));
  useEffect(() => { setError(''); if (!signIn.isPending) signIn.reset(); }, [role]);
  const openWorkspace = (event: FormEvent) => {
    event.preventDefault();
    if (signIn.isPending) return;
    const slug = workspaceSlug(workspace);
    if (!slug) { setError('Enter the workspace name provided by your company.'); return; }
    if (!login.trim() || !password) { setError('Enter your email or login ID and password.'); return; }
    setError('');
    signIn.mutate({ workspace: slug, role, login, password });
  };
  return <section id="workspace" aria-labelledby="workspace-title" className="scroll-mt-8 rounded-3xl border border-app-border bg-app-surface p-6 sm:p-9 lg:p-10">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-medium uppercase tracking-[0.16em] text-app-muted">WELCOME BACK</p><h2 id="workspace-title" className="mt-3 text-2xl font-medium tracking-tight sm:text-3xl">Sign in to your workspace.</h2></div>
      <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs text-app-muted"><Globe2 className="size-3.5" aria-hidden="true" />One place for your whole team</span>
    </div>
    <form onSubmit={openWorkspace} className="mt-7" noValidate>
      <fieldset disabled={signIn.isPending}><legend className="mb-3 text-sm text-app-muted">Choose how you use Dispatra</legend>
        <div className="grid gap-3 sm:grid-cols-3">{choices.map(({ role: choice, label, description, icon: Icon }) => <label key={choice} className="cursor-pointer">
          <input type="radio" name="workspace-role" aria-label={label} value={choice} checked={role === choice} onChange={() => { onRoleChange(choice); setError(''); signIn.reset(); }} className="peer sr-only" />
          <div className="h-full rounded-2xl border border-app-border p-4 transition-colors hover:bg-slate-50 peer-checked:border-slate-900 peer-checked:bg-slate-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600 sm:p-5">
            <div className="flex items-center justify-between"><Icon className="size-5 text-app-text" strokeWidth={1.5} aria-hidden="true" />{role === choice && <Check className="size-4 text-app-text" aria-hidden="true" />}</div>
            <p className="mt-3 text-sm font-medium text-app-text">{label}</p><p className="mt-1 text-xs leading-5 text-app-muted">{description}</p>
          </div>
        </label>)}</div>
      </fieldset>
      <fieldset disabled={signIn.isPending} className="mt-6 grid gap-5 sm:grid-cols-3">
        <div><label htmlFor="company-workspace" className="mb-2 block text-sm font-medium">Company workspace</label>
          <input id="company-workspace" value={workspace} onChange={event => { setWorkspace(event.target.value); setError(''); signIn.reset(); }} aria-invalid={!!error && !workspaceSlug(workspace)} aria-describedby="workspace-help" autoCapitalize="none" autoComplete="organization" spellCheck={false} placeholder="e.g. acme-delivery" required maxLength={500} className="app-input h-11 w-full" />
        </div>
        <div><label htmlFor="workspace-login" className="mb-2 block text-sm font-medium">Email or login ID</label>
          <input id="workspace-login" value={login} onChange={event => { setLogin(event.target.value); setError(''); signIn.reset(); }} autoCapitalize="none" autoComplete="username" spellCheck={false} required maxLength={100} className="app-input h-11 w-full" />
        </div>
        <div><label htmlFor="workspace-password" className="mb-2 block text-sm font-medium">Password</label>
          <input id="workspace-password" type="password" value={password} onChange={event => { setPassword(event.target.value); setError(''); signIn.reset(); }} autoComplete="current-password" required maxLength={128} className="app-input h-11 w-full" />
        </div>
      </fieldset>
      <div className="mt-5 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p id="workspace-help" className="max-w-lg text-xs leading-5 text-app-muted">Enter the workspace name and credentials provided by your company. Need access or a password reset? Contact your company administrator.</p>
        <Button type="submit" disabled={signIn.isPending} className="h-11 w-full gap-3 px-6 sm:w-auto">{signIn.isPending ? 'Signing in…' : `Sign in as ${choices.find(choice => choice.role === role)!.label.toLowerCase()}`}<ArrowRight className="size-4" aria-hidden="true" /></Button>
      </div>
      {(error || signIn.error) && <p id="workspace-error" role="alert" className="mt-3 text-sm text-rose-700">{error || signIn.error?.message}</p>}
    </form>
  </section>;
}
