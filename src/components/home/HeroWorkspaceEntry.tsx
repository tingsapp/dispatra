import { useState, type FormEvent, type Ref } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import { WorkspaceInput } from './WorkspaceInput';
import { readWorkspaceEntry, rememberWorkspaceEntry, workspaceDestination, type WorkspaceRole } from '../../lib/workspaceEntry';

export function HeroWorkspaceEntry({ initialRole, inputRef }: { initialRole?: WorkspaceRole; inputRef: Ref<HTMLInputElement> }) {
  const [remembered] = useState(readWorkspaceEntry);
  const [workspace, setWorkspace] = useState(remembered.slug);
  const [error, setError] = useState('');
  const continueToLogin = (event: FormEvent) => {
    event.preventDefault();
    const role = initialRole ?? remembered.role;
    const destination = workspaceDestination(workspace, role);
    if (!destination) { setError('Enter a valid company workspace name, for example demo.'); return; }
    rememberWorkspaceEntry(workspace.trim().toLowerCase(), role);
    window.location.assign(destination);
  };
  return <form id="workspace" onSubmit={continueToLogin} className="mt-8 max-w-md scroll-mt-8" noValidate>
    <div className="flex flex-col gap-3">
      <WorkspaceInput ref={inputRef} hideLabel value={workspace} required aria-invalid={!!error}
        aria-describedby={error ? 'workspace-error workspace-help' : 'workspace-help'}
        onChange={event => { setWorkspace(event.target.value); setError(''); }} />
      <Button type="submit" className="h-12 self-start gap-2 px-5">Continue<ArrowRight className="size-4" aria-hidden="true" /></Button>
    </div>
    {error && <p id="workspace-error" role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
    <p id="workspace-help" className="mt-3 text-xs leading-5 text-app-muted">Enter your company workspace to sign in.</p>
  </form>;
}
