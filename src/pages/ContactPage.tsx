import { ArrowUpRight, Mail } from 'lucide-react';
import { PublicHeader } from '../components/home/PublicPageLayout';
import { PublicFooter } from '../components/home/PublicFooter';
import { PublicChatAssistant } from '../components/home/PublicChatAssistant';
import { Button } from '../components/ui/button';
import { DISPATRA_CONTACT_EMAIL as EMAIL } from '../lib/dispatraContact';

const planNames = new Map([['full', 'TMS + Smart Dispatching'], ['dispatch', 'Smart Dispatching']]);

export default function ContactPage() {
  const selected = planNames.get(new URLSearchParams(location.search).get('plan') ?? '');
  const subject = selected ? `Dispatra enquiry: ${selected}` : 'Dispatra plan enquiry';
  const body = `Hello Dispatra,\n\nI’d like to learn more about ${selected ?? 'your plans'}.\n\nCompany name: \nFleet size: \nCurrent TMS (if any): \n\n`;
  const emailHref = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return <div className="public-site min-h-dvh bg-white font-sans text-app-text">
    <PublicHeader />
    <main>
      <PublicChatAssistant />
      <div className="mx-auto w-full max-w-7xl px-6 pb-12 pt-12 sm:pb-20 sm:pt-16 lg:px-10">
        <section aria-labelledby="contact-team" className="public-contact-panel">
          <div className="grid items-center gap-8 md:grid-cols-[1.1fr_1fr] md:gap-12">
            <div>
              <span className="inline-flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-app-text"><Mail className="size-5" strokeWidth={1.5} aria-hidden="true" /></span>
              <p className="home-eyebrow mt-5">A conversation with our team</p>
              <h2 id="contact-team" className="mt-3 text-2xl font-medium leading-tight tracking-tight sm:text-3xl">Prefer to reach out<br className="hidden sm:block" /> by email?</h2>
              <p className="mt-4 max-w-sm text-sm leading-7 text-app-muted">Tell us about your delivery operation. We can help with plans, integrations, and getting started.</p>
            </div>
            <div className="min-w-0 border-t border-slate-200 pt-7 md:border-l md:border-t-0 md:pl-10 md:pt-0">
              <p className="text-xs text-app-muted">Email Dispatra</p>
              <a href={`mailto:${EMAIL}`} className="mt-3 inline-block max-w-full break-all rounded text-lg font-medium tracking-tight hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-4 sm:text-2xl">{EMAIL}</a>
              {selected && <p className="mt-3 text-xs leading-5 text-app-muted">Your enquiry: {selected}</p>}
              <div className="mt-6"><Button asChild className="gap-2 px-5"><a href={emailHref}>Email our team<ArrowUpRight className="size-4" aria-hidden="true" /></a></Button></div>
              <p className="mt-3 text-xs leading-5 text-app-muted">Opens a draft in your email app.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
    <PublicFooter />
  </div>;
}
