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
      <PublicChatAssistant contactCard={<div className="public-chat-contact mx-auto w-full max-w-4xl px-4 pb-8 pt-6 sm:px-6">
        <section aria-labelledby="contact-team" className="public-contact-panel">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f4f4f4]"><Mail className="size-5 text-app-muted" strokeWidth={1.5} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <h2 id="contact-team" className="public-contact-title">Prefer to reach out by email?</h2>
              {selected && <p className="mt-1 text-xs text-app-muted">Your enquiry: {selected}</p>}
            </div>
            <Button asChild className="gap-2 px-4"><a href={emailHref}>Email our team<ArrowUpRight className="size-4" aria-hidden="true" /></a></Button>
          </div>
        </section>
      </div>} />
    </main>
    <PublicFooter />
  </div>;
}
