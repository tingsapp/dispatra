import { type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { BrandLogo } from '../layout/AppBrand';
import { Button } from '../ui/button';

/** Public pages have one direct contact action; account screens stay minimal. */
export function PublicHeader({ navigation = true }: { navigation?: boolean } = {}) {
  return <header className="public-header">
    <a href="/" aria-label="Dispatra home" className="inline-flex min-w-0 items-center"><BrandLogo /></a>
    {navigation && <div className="public-header-actions"><Button asChild className="app-primary public-ask-button"><a href="/ask-dispatra">Ask Dispatra</a></Button></div>}
  </header>;
}

export function PublicPageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="public-page-intro"><p className="home-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></header>;
}

export function PublicPageCta({ help = false }: { help?: boolean }) {
  return <section aria-labelledby="public-next-step" className="public-page-cta"><p className="home-eyebrow">Your next step</p><h2 id="public-next-step">{help ? 'Let’s talk about your delivery day' : 'A workspace that fits your team'}</h2><p>{help ? 'Have another question? Ask Dispatra or contact our team.' : 'Explore both plans and find the right way to bring your operation together.'}</p><div><Button asChild><a href={help ? '/ask-dispatra' : '/plans'}>{help ? 'Ask Dispatra' : 'Explore plans'}<ArrowRight size={15} aria-hidden="true" /></a></Button><a href={help ? '/plans' : '/ask-dispatra'} className="home-text-link">{help ? 'View plans' : 'Contact our team'}<ArrowRight size={14} aria-hidden="true" /></a></div></section>;
}

export function PublicHero({ labelledBy, children, centered = false }: { labelledBy: string; children: ReactNode; centered?: boolean }) {
  return <section aria-labelledby={labelledBy} className={centered ? "home-hero home-section" : "mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 pb-16 pt-12 sm:pt-16 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 lg:px-10 lg:pb-20 lg:pt-20"}>{children}</section>;
}
