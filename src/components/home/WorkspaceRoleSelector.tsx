import type { WorkspaceRole } from '../../lib/workspaceEntry';

const choices = [
  { role: 'dispatcher', label: 'Dispatcher' },
  { role: 'shipper', label: 'Shipper' },
  { role: 'driver', label: 'Driver' },
] as const;

export function WorkspaceRoleSelector({ role, onChange, disabled }: {
  role: WorkspaceRole; onChange: (role: WorkspaceRole) => void; disabled?: boolean;
}) {
  const selected = choices.findIndex(choice => choice.role === role);
  return <fieldset disabled={disabled} className="min-w-0 disabled:opacity-60">
    <legend className="sr-only">Sign in as</legend>
    <div className="relative isolate grid grid-cols-3 rounded-full bg-app-hover p-1">
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-1 left-1 rounded-full bg-app-surface shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ width: 'calc((100% - 0.5rem) / 3)', transform: `translateX(${selected * 100}%)` }} />
      {choices.map(choice => <label key={choice.role} className="relative z-10 min-w-0 cursor-pointer">
        <input type="radio" name="login-role" value={choice.role} aria-label={choice.label} checked={role === choice.role}
          onChange={() => onChange(choice.role)} className="peer sr-only" />
        <span className="flex h-10 items-center justify-center rounded-full px-2 text-center text-sm font-normal text-app-muted transition-colors hover:text-app-text peer-checked:font-medium peer-checked:text-app-text peer-focus-visible:ring-2 peer-focus-visible:ring-inset peer-focus-visible:ring-app-text/70 peer-disabled:cursor-not-allowed motion-reduce:transition-none">{choice.label}</span>
      </label>)}
    </div>
  </fieldset>;
}
