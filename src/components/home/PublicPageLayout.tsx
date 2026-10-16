import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, Menu } from 'lucide-react';
import { BrandLogo } from '../layout/AppBrand';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

const websiteLinks = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/plans', label: 'Plans' },
  { href: '/contact', label: 'Let’s talk' },
];

/** Marketing navigation is shared; account screens opt into a minimal header. */
export function PublicHeader({ navigation = true }: { navigation?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const pathname = window.location.pathname;
  useEffect(() => {
    if (!window.matchMedia) return;
    const desktop = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);
  const links = (mobile = false) => websiteLinks.map(({ href, label }) => <a key={href} href={href} aria-current={pathname === href ? 'page' : undefined} className="public-nav-link" onClick={mobile ? () => setOpen(false) : undefined}>{label}</a>);
  return <header className="public-header">
    <a href="/" aria-label="Dispatra home" className="inline-flex min-w-0 items-center gap-2.5 text-xl font-medium tracking-tight"><BrandLogo /></a>
    {navigation && <nav aria-label="Website navigation" className="public-desktop-navigation">{links()}</nav>}
    <div className="public-header-actions">
      {navigation && <div className="public-mobile-navigation"><Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="ghost" size="icon" aria-label="Open website menu"><Menu size={20} strokeWidth={1.5} aria-hidden="true" /></Button></PopoverTrigger><PopoverContent align="end" sideOffset={12} className="public-menu-content public-site"><nav aria-label="Mobile website navigation">{links(true)}<a href="/help" className="public-nav-link" aria-current={pathname === '/help' ? 'page' : undefined} onClick={() => setOpen(false)}>Help &amp; FAQs</a></nav></PopoverContent></Popover></div>}
    </div>
  </header>;
}

export function PublicPageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="public-page-intro"><p className="home-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></header>;
}

export function PublicPageCta({ help = false }: { help?: boolean }) {
  return <section aria-labelledby="public-next-step" className="public-page-cta"><p className="home-eyebrow">Your next step</p><h2 id="public-next-step">{help ? 'Let’s talk about your delivery day.' : 'A workspace that fits your team.'}</h2><p>{help ? 'Have another question? Ask Dispatra Chat or contact our team.' : 'Explore both plans and find the right way to bring your operation together.'}</p><div><Button asChild><a href={help ? '/contact' : '/plans'}>{help ? 'Ask Dispatra Chat' : 'Explore plans'}<ArrowRight size={15} aria-hidden="true" /></a></Button><a href={help ? '/plans' : '/contact'} className="home-text-link">{help ? 'View plans' : 'Contact our team'}<ArrowRight size={14} aria-hidden="true" /></a></div></section>;
}

export function PublicHero({ labelledBy, children, centered = false }: { labelledBy: string; children: ReactNode; centered?: boolean }) {
  return <section aria-labelledby={labelledBy} className={centered ? "home-hero home-section" : "mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 pb-16 pt-12 sm:pt-16 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 lg:px-10 lg:pb-20 lg:pt-20"}>{children}</section>;
}
