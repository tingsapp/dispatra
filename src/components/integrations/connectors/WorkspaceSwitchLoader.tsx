export function WorkspaceSwitchLoader({ active }: { active: boolean }) {
  return <div role="status" aria-label="Switching workspace" aria-hidden={!active} data-active={active} className="workspace-switch-loader pointer-events-none fixed inset-0 z-[100] grid place-items-center">
    <div className="flex h-6 w-14 items-center justify-center gap-2" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => <span key={index} className="workspace-loading-dot size-2 rounded-full bg-slate-500" style={{ animationDelay: `${index * 160}ms` }} />)}
    </div>
    <span className="sr-only">Switching workspace…</span>
  </div>;
}
