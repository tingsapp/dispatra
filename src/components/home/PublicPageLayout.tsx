import type { ReactNode } from 'react';
import { BrandMark } from '../layout/AppBrand';

/** Home and sign-in pages share the same logo-only header and gutters. */
export function PublicHeader() {
  return <header className="mx-auto flex w-full max-w-7xl shrink-0 items-center px-6 py-6 lg:px-10">
    <a href="/" aria-label="Dispatra home" className="inline-flex items-center gap-2.5 text-xl font-medium tracking-tight"><BrandMark />Dispatra</a>
  </header>;
}

export function PublicHero({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  return <section aria-labelledby={labelledBy} className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 pb-16 pt-12 sm:pt-16 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 lg:px-10 lg:pb-20 lg:pt-20">{children}</section>;
}
