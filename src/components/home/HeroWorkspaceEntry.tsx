import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import { WorkspaceInput } from './WorkspaceInput';
import { signupDestination } from '../../lib/workspaceEntry';

export function HeroWorkspaceEntry() {
  const [workspace, setWorkspace] = useState('');
  const [error, setError] = useState('');
  const startTrial = (event: FormEvent) => {
    event.preventDefault();
    const destination = signupDestination(workspace);
    if (!destination) { setError('Enter a company workspace name, for example my-company.'); return; }
    window.location.assign(destination);
  };
  return <form id="workspace" onSubmit={startTrial} className="mt-8 max-w-md scroll-mt-8" noValidate>
    <div className="flex flex-col gap-3">
      <WorkspaceInput hideLabel value={workspace} required aria-invalid={!!error}
        aria-describedby={error ? 'workspace-error workspace-help' : 'workspace-help'}
        onChange={event => { setWorkspace(event.target.value); setError(''); }} />
      <Button type="submit" className="self-start gap-2 px-5">Start trial<ArrowRight className="size-4" aria-hidden="true" /></Button>
    </div>
    {error && <p id="workspace-error" role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    <p id="workspace-help" className="mt-3 text-xs leading-5 text-app-muted">Start your 30-day trial. Already have an account? <a href="/login" className="underline underline-offset-4 hover:text-app-text">Sign in</a></p>
  </form>;
}
