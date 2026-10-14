const LOGO_SRC = '/dispatra.png?v=20261014';

/** The full supplied logo already includes the Dispatra wordmark. */
export function BrandLogo() {
  return <img src={LOGO_SRC} alt="Dispatra" width={1134} height={300}
    draggable={false} className="h-8 w-auto shrink-0 object-contain" />;
}

/** Compact spaces show the square icon at the left of the supplied logo. */
export function BrandMark() {
  return <img src={LOGO_SRC} alt="" aria-hidden="true" width={28} height={28}
    draggable={false} className="h-7 w-7 shrink-0 object-cover object-left" />;
}

export function AppBrand({ onClick, label, current = false, compact = false }: { onClick: () => void; label: string; current?: boolean; compact?: boolean }) {
  return <button type="button" onClick={onClick} aria-label={label} aria-current={current ? 'page' : undefined}
    title={compact ? label : undefined}
    className={compact ? 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-app-hover' : 'inline-flex min-w-0 items-center rounded-lg text-left'}>
    {compact ? <BrandMark /> : <BrandLogo />}
  </button>;
}
