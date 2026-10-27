const LOGO_SRC = '/dispatra-logo.png?v=0ba0d3cc268f';
const ICON_SRC = '/dispatra-icon.png?v=82087ca18873';

/** The full supplied logo already includes the Dispatra wordmark. */
export function BrandLogo() {
  return <span className="app-brand-logo">
    <img src={LOGO_SRC} alt="Dispatra" width={2172} height={724}
      draggable={false} className="app-brand-wordmark" />
    <img src={ICON_SRC} alt="Dispatra" width={1374} height={1145}
      draggable={false} className="app-brand-fallback" />
  </span>;
}

/** Compact spaces use the supplied icon without cropping the wordmark. */
export function BrandMark({ size = 20 }: { size?: number }) {
  return <img src={ICON_SRC} alt="" aria-hidden="true" width={size} height={size}
    draggable={false} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
}

export function AppBrand({ onClick, label, current = false, compact = false }: { onClick: () => void; label: string; current?: boolean; compact?: boolean }) {
  return <button type="button" onClick={onClick} aria-label={label} aria-current={current ? 'page' : undefined}
    title={compact ? label : undefined}
    className={compact ? 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-app-hover' : 'inline-flex min-w-0 items-center rounded-lg text-left'}>
    {compact ? <BrandMark size={32} /> : <BrandLogo />}
  </button>;
}
