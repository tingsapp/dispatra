import { ArrowRight } from 'lucide-react';
import { BrandMark } from '../layout/AppBrand';
import { Button } from '../ui/button';

const linkClass = 'w-fit rounded text-sm text-app-muted transition-colors hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4';

export function PublicFooter({ workspaceHref }: { workspaceHref?: string }) {
  return <footer className="mt-8 border-t border-slate-200 bg-slate-50/70">
    <div className="mx-auto max-w-7xl px-6 lg:px-10">
      <div className="flex flex-col gap-7 border-b border-slate-200 py-10 sm:py-12 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-700">YOUR NEXT DELIVERY DAY</p>
          <h2 className="mt-3 text-3xl font-medium leading-tight tracking-tight sm:text-4xl">Less coordinating.<br />More delivering.</h2>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-3">
          <Button asChild className="gap-3 px-6"><a href="/signup">Start free trial<ArrowRight className="size-4" aria-hidden="true" /></a></Button>
          <p className="text-xs text-app-muted">30 days free. No credit card required.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-10 lg:grid-cols-[1.6fr_1fr_1fr] lg:gap-16 lg:py-12">
        <div className="col-span-2 lg:col-span-1">
          <a href="/" aria-label="Dispatra home" className="inline-flex items-center gap-2.5 text-xl font-medium tracking-tight"><BrandMark />Dispatra</a>
          <p className="mt-4 max-w-sm text-sm leading-6 text-app-muted">A connected workspace for orders, dispatch, and delivery. Built around your team’s day.</p>
          <a href={workspaceHref ?? '/login'} className={`${linkClass} mt-5 inline-flex items-center gap-2 text-app-text`}>{workspaceHref ? 'Open my workspace' : 'Sign in to your workspace'}<ArrowRight className="size-3.5" aria-hidden="true" /></a>
        </div>
        <nav aria-label="Explore Dispatra" className="flex flex-col items-start gap-4">
          <h3 className="text-sm font-medium">Explore</h3>
          <a href="/" className={linkClass}>Home</a>
          <a href="/#how-it-works" className={linkClass}>How it works</a>
          <a href="/signup" className={linkClass}>Plans &amp; free trial</a>
        </nav>
        <nav aria-label="Team portals" className="flex flex-col items-start gap-4">
          <h3 className="text-sm font-medium">For your team</h3>
          <a href="/dispatch" className={linkClass}>Dispatchers</a>
          <a href="/shipper" className={linkClass}>Shippers</a>
          <a href="/driver" className={linkClass}>Drivers</a>
        </nav>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-200 py-6 text-xs text-app-muted sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Dispatra. All rights reserved.</p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
          <a href="/terms" className={linkClass}>Terms and Conditions</a>
          <a href="/privacy" className={linkClass}>Privacy Policy</a>
        </nav>
      </div>
    </div>
  </footer>;
}
