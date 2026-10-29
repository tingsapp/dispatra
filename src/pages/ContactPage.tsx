import { Mail } from 'lucide-react';
import { PublicHeader } from '../components/home/PublicPageLayout';
import { PublicFooter } from '../components/home/PublicFooter';
import { PublicChatAssistant } from '../components/home/PublicChatAssistant';
import { Button } from '../components/ui/button';
import { DISPATRA_CONTACT_EMAIL as EMAIL } from '../lib/dispatraContact';

const planNames = new Map([['full', 'Full Workspace'], ['dispatch', 'AI Dispatch']]);

export default function ContactPage() {
  const selected = planNames.get(new URLSearchParams(location.search).get('plan') ?? '');
  const subject = selected ? `Dispatra enquiry: ${selected}` : 'Dispatra plan enquiry';
  const body = `Hello Dispatra,\n\nI’d like to learn more about ${selected ?? 'your plans'}.\n\nCompany name: \nFleet size: \nCurrent TMS (if any): \n\n`;
  const emailHref = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return <div className="public-site min-h-dvh bg-white font-sans text-app-text">
    <PublicHeader />
    <main>
      <PublicChatAssistant contactCard={<div className="public-chat-contact mx-auto flex w-full max-w-4xl justify-center px-4 pb-8 pt-6 sm:px-6">
        <Button asChild className="gap-2 px-5"><a href={emailHref}><Mail className="size-4" strokeWidth={1.5} aria-hidden="true" />Email our team</a></Button>
      </div>} />
    </main>
    <PublicFooter />
  </div>;
}
