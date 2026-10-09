import type { WorkspaceRole } from '../../lib/workspaceEntry';

const choices = [
  { role: 'dispatcher', label: 'Dispatcher' },
  { role: 'shipper', label: 'Shipper' },
  { role: 'driver', label: 'Driver' },
] as const;

export function WorkspaceRoleSelector({ role, onChange, disabled }: {
  role: WorkspaceRole; onChange: (role: WorkspaceRole) => void; disabled?: boolean;
}) {
  return <fieldset disabled={disabled} className="min-w-0">
    <legend className="app-label">Sign in as</legend>
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-app-border bg-slate-50 p-1">
      {choices.map(choice => <label key={choice.role} className="cursor-pointer">
        <input type="radio" name="login-role" value={choice.role} aria-label={choice.label} checked={role === choice.role}
          onChange={() => onChange(choice.role)} className="peer sr-only" />
        <span className="flex h-10 items-center justify-center rounded-lg px-2 text-center text-sm font-medium text-app-muted transition-colors hover:text-app-text peer-checked:bg-slate-900 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600">{choice.label}</span>
      </label>)}
    </div>
  </fieldset>;
}
