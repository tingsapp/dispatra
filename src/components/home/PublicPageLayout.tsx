import type { ReactNode } from 'react';
import { BrandMark } from '../layout/AppBrand';

/** Public pages share the same container, header gutters and two-column layout. */
export function PublicHeader({ children }: { children: ReactNode }) {
  return <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
    <a href="/" aria-label="Dispatra home" className="inline-flex items-center gap-2.5 text-xl font-medium tracking-tight"><BrandMark />Dispatra</a>
    {children}
  </header>;
}

export function PublicHero({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  return <section aria-labelledby={labelledBy} className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 pb-16 pt-12 sm:pt-16 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 lg:px-10 lg:pb-20 lg:pt-20">{children}</section>;
}
