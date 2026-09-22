/** Shared visual identity; callers choose the appropriate workspace home action. */
export function BrandMark() {
  return <img src="/dispatra.png" alt="" aria-hidden="true" width={28} height={28}
    draggable={false} className="h-7 w-7 shrink-0 object-contain mix-blend-multiply" />;
}

export function AppBrand({ onClick, label, current = false, compact = false }: { onClick: () => void; label: string; current?: boolean; compact?: boolean }) {
  return <button type="button" onClick={onClick} aria-label={label} aria-current={current ? 'page' : undefined}
    title={compact ? label : undefined}
    className={compact ? 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-app-hover' : 'inline-flex min-w-0 items-center gap-2.5 rounded-lg text-left'}>
    <BrandMark />
    {!compact && <span className="text-lg font-medium tracking-tight text-app-text">Dispatra</span>}
  </button>;
}
