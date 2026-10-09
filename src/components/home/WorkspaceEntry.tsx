import { useState, type FormEvent } from 'react';
import { ArrowRight, Check, Globe2, MapPinned, Package, Truck } from 'lucide-react';
import { Button } from '../ui/button';
import { readWorkspaceEntry, rememberWorkspaceEntry, workspaceDestination, workspaceSlug, type WorkspaceRole } from '../../lib/workspaceEntry';

const choices = [
  { role: 'dispatcher', label: 'Dispatcher', description: 'Manage your delivery day.', icon: MapPinned },
  { role: 'shipper', label: 'Shipper', description: 'Book and track your orders.', icon: Package },
  { role: 'driver', label: 'Driver', description: 'View routes and complete stops.', icon: Truck },
] as const;

export function WorkspaceEntry({ initialRole }: { initialRole?: WorkspaceRole }) {
  const [remembered] = useState(readWorkspaceEntry);
  const [role, setRole] = useState<WorkspaceRole>(initialRole ?? remembered.role);
  const [workspace, setWorkspace] = useState(remembered.slug);
  const [error, setError] = useState('');
  const openWorkspace = (event: FormEvent) => {
    event.preventDefault();
    const destination = workspaceDestination(workspace, role);
    if (!destination) { setError('Enter a valid company workspace name or link.'); return; }
    rememberWorkspaceEntry(workspaceSlug(workspace)!, role);
    window.location.assign(destination);
  };
  return <section id="workspace" aria-labelledby="workspace-title" className="scroll-mt-8 rounded-3xl border border-app-border bg-app-surface p-6 sm:p-9 lg:p-10">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-medium uppercase tracking-[0.16em] text-app-muted">LET’S GET YOU STARTED</p><h2 id="workspace-title" className="mt-3 text-2xl font-medium tracking-tight sm:text-3xl">Your workspace, one click away.</h2></div>
      <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs text-app-muted"><Globe2 className="size-3.5" aria-hidden="true" />One place for your whole team</span>
    </div>
    <form onSubmit={openWorkspace} className="mt-7" noValidate>
      <fieldset><legend className="mb-3 text-sm text-app-muted">Choose how you use Dispatra</legend>
        <div className="grid gap-3 sm:grid-cols-3">{choices.map(({ role: choice, label, description, icon: Icon }) => <label key={choice} className="cursor-pointer">
          <input type="radio" name="workspace-role" aria-label={label} value={choice} checked={role === choice} onChange={() => setRole(choice)} className="peer sr-only" />
          <div className="h-full rounded-2xl border border-app-border p-4 transition-colors hover:bg-slate-50 peer-checked:border-slate-900 peer-checked:bg-slate-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600 sm:p-5">
            <div className="flex items-center justify-between"><Icon className="size-5 text-app-text" strokeWidth={1.5} aria-hidden="true" />{role === choice && <Check className="size-4 text-app-text" aria-hidden="true" />}</div>
            <p className="mt-3 text-sm font-medium text-app-text">{label}</p><p className="mt-1 text-xs leading-5 text-app-muted">{description}</p>
          </div>
        </label>)}</div>
      </fieldset>
      <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-end">
        <div className="w-full flex-1"><label htmlFor="company-workspace" className="mb-2 block text-sm font-medium">Company workspace</label>
          <input id="company-workspace" value={workspace} onChange={event => { setWorkspace(event.target.value); setError(''); }} aria-invalid={!!error} aria-describedby={error ? 'workspace-error workspace-help' : 'workspace-help'} autoCapitalize="none" autoComplete="organization" spellCheck={false} placeholder="Workspace name or link, e.g. acme-delivery" className="app-input h-11 w-full" />
        </div>
        <Button type="submit" className="h-11 w-full gap-3 px-6 sm:w-auto">Continue as {choices.find(choice => choice.role === role)!.label.toLowerCase()}<ArrowRight className="size-4" aria-hidden="true" /></Button>
      </div>
      {error && <p id="workspace-error" role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
      <p id="workspace-help" className="mt-3 text-xs leading-5 text-app-muted">Use the workspace provided by your company. Need access or a password reset? Contact your company administrator.</p>
    </form>
  </section>;
}
