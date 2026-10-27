import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { BrandLogo } from '../layout/AppBrand';

const linkClass = 'w-fit rounded text-sm text-app-muted transition-colors hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-4';

export function PublicFooter({ workspaceHref }: { workspaceHref?: string }) {
  return <footer className="public-footer mt-8 bg-slate-50/70">
    <div className="mx-auto max-w-7xl px-6 lg:px-10">
      <div className="grid grid-cols-2 gap-x-6 gap-y-9 py-10 sm:py-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:gap-12">
        <div className="col-span-2 lg:col-span-1">
          <a href="/" aria-label="Dispatra home" className="inline-flex min-w-0 items-center gap-2.5 text-xl font-medium tracking-tight"><BrandLogo /></a>
          <p className="mt-4 max-w-xs text-sm leading-6 text-app-muted">A connected workspace for orders, dispatch, and delivery.</p>
          <a href={workspaceHref ?? '/login'} className={`${linkClass} mt-5 inline-flex items-center gap-2`}>{workspaceHref ? 'Open my workspace' : 'Sign in to your workspace'}<ArrowRight className="size-3.5" aria-hidden="true" /></a>
        </div>
        <nav aria-label="Product" className="flex flex-col items-start gap-3">
          <h3 className="mb-1 text-sm font-medium">Product</h3>
          <a href="/plans" className={linkClass}>Plans &amp; free trial</a>
          <a href="/docs/integrations" className={linkClass}>Integrations &amp; API</a>
          <a href="/help" className={linkClass}>FAQs</a>
          <a href="/ask-dispatra#dispatra-chat-title" className={linkClass}>Ask dispatra</a>
        </nav>
        <nav aria-label="Company" className="flex flex-col items-start gap-3">
          <h3 className="mb-1 text-sm font-medium">Company</h3>
          <a href="/about" className={linkClass}>About</a>
          <a href="/dispatch" className={linkClass}>Dispatchers</a>
          <a href="/shipper" className={linkClass}>Shippers</a>
          <a href="/driver" className={linkClass}>Drivers</a>
        </nav>
        <nav aria-label="Driver apps" className="col-span-2 flex flex-col items-start gap-3 lg:col-span-1">
          <h3 className="mb-1 text-sm font-medium">Driver apps</h3>
          <a href="https://play.google.com/store/apps" target="_blank" rel="noopener noreferrer" className={`${linkClass} inline-flex items-center gap-2`}><img src="/store-icons/google-play.svg" width={20} height={20} alt="" aria-hidden="true" className="size-5 shrink-0" />Google Play<ArrowUpRight className="size-3.5" aria-hidden="true" /><span className="sr-only"> (Android, opens in a new tab)</span></a>
          <a href="https://www.apple.com/app-store/" target="_blank" rel="noopener noreferrer" className={`${linkClass} inline-flex items-center gap-2`}><img src="/store-icons/app-store.svg" width={20} height={20} alt="" aria-hidden="true" className="size-5 shrink-0" />App Store<ArrowUpRight className="size-3.5" aria-hidden="true" /><span className="sr-only"> (iOS, opens in a new tab)</span></a>
        </nav>
      </div>
      <div className="flex flex-col gap-4 py-6 text-xs text-app-muted sm:flex-row sm:items-center sm:justify-between">
        <p>Dispatra © {new Date().getFullYear()}</p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
          <a href="/terms" className={linkClass}>Terms and Conditions</a>
          <a href="/privacy" className={linkClass}>Privacy Policy</a>
        </nav>
      </div>
    </div>
  </footer>;
}
