import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, MapPinned, Package, Truck } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogBody, DialogHeader } from '../ui/Dialog';
import { useEntityDialog } from '../entities/useEntityDialog';
import { readWorkspaceEntry, rememberWorkspaceEntry, workspaceDestination, type WorkspaceRole } from '../../lib/workspaceEntry';

const choices = [
  { role: 'dispatcher', label: 'Dispatcher', icon: MapPinned },
  { role: 'shipper', label: 'Shipper', icon: Package },
  { role: 'driver', label: 'Driver', icon: Truck },
] as const;

export function WorkspaceEntryDialog({ open, role, onRoleChange, onClose }: {
  open: boolean; role: WorkspaceRole; onRoleChange: (role: WorkspaceRole) => void; onClose: () => void;
}) {
  const [workspace, setWorkspace] = useState(() => readWorkspaceEntry().slug);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEntityDialog(open, onClose);
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    input.current?.focus();
    return () => { document.body.style.overflow = overflow; };
  }, [open]);
  const continueToLogin = (event: FormEvent) => {
    event.preventDefault();
    const destination = workspaceDestination(workspace, role);
    if (!destination) { setError('Enter a valid company workspace name, for example demo.'); input.current?.focus(); return; }
    rememberWorkspaceEntry(workspace.trim().toLowerCase(), role);
    window.location.assign(destination);
  };
  if (!open) return null;
  return createPortal(<Dialog onClose={onClose} className="max-w-lg">
    <DialogHeader title="Open your workspace" description="Choose your role to continue." onClose={onClose} closeLabel="Close workspace selection" />
    <DialogBody>
      <form onSubmit={continueToLogin} noValidate>
        <fieldset><legend className="sr-only">Choose your role</legend>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">{choices.map(({ role: choice, label, icon: Icon }) => <label key={choice} className="cursor-pointer">
            <input type="radio" name="workspace-role" aria-label={label} checked={role === choice}
              onChange={() => { onRoleChange(choice); setError(''); }} className="peer sr-only" />
            <div className="relative flex flex-col items-center gap-3 rounded-xl border border-app-border bg-white px-1 py-4 transition-colors hover:bg-slate-50 peer-checked:border-slate-900 peer-checked:bg-slate-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600">
              {role === choice && <Check className="absolute right-2 top-2 size-3" aria-hidden="true" />}
              <Icon className="size-5" strokeWidth={1.5} aria-hidden="true" />
              <span className="text-xs font-medium sm:text-sm">{label}</span>
            </div>
          </label>)}</div>
        </fieldset>
        <div className="mt-6">
          <label htmlFor="company-workspace" className="mb-2 block text-sm font-medium">Company workspace</label>
          <div className={`flex h-12 items-center overflow-hidden rounded-xl border bg-white focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10 ${error ? 'border-rose-600' : 'border-app-border'}`}>
            <span className="flex h-full shrink-0 items-center border-r border-app-border bg-slate-50 pl-3 pr-2 text-sm text-slate-400" aria-hidden="true">dispatra.com/</span>
            <input ref={input} id="company-workspace" value={workspace}
              onChange={event => { setWorkspace(event.target.value); setError(''); }}
              aria-invalid={!!error} aria-describedby={error ? 'workspace-error workspace-help' : 'workspace-help'}
              autoCapitalize="none" autoComplete="organization" spellCheck={false} required maxLength={63}
              placeholder="company-name" className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-app-text outline-none placeholder:text-slate-400" />
          </div>
          {error && <p id="workspace-error" role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
          <p id="workspace-help" className="mt-3 text-xs leading-5 text-app-muted">Use the workspace name provided by your company.</p>
        </div>
        <Button type="submit" className="mt-6 h-11 w-full gap-3">Continue<ArrowRight className="size-4" aria-hidden="true" /></Button>
      </form>
    </DialogBody>
  </Dialog>, document.body);
}
