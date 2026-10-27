import { ChevronDown, Users, Workflow, Layers } from 'lucide-react';
import { PublicHeader, PublicPageIntro, PublicPageCta } from '../components/home/PublicPageLayout';
import { PublicFooter } from '../components/home/PublicFooter';
import { faqs } from './publicInformation';

type InformationPath = '/about' | '/help';
const titles = {
  '/about': { eyebrow: 'ABOUT DISPATRA', title: 'Built around your delivery day', description: 'A connected workspace that helps delivery teams move from incoming orders to completed deliveries with clarity.' },
  '/help': { eyebrow: 'HELP & FAQS', title: 'A little clarity before you start', description: 'Find answers about plans, your trial, and working with Dispatra. For anything else, our team is here to help.' },
};
export default function PublicInformationPage({ page }: { page: InformationPath }) {
  const content = titles[page];
  return <div className="public-site min-h-dvh bg-app-canvas font-sans text-app-text">
    <PublicHeader />
    <main className="public-page-main">
      <PublicPageIntro {...content} />
      {page === '/about' && <>
        <section aria-labelledby="about-purpose" className="public-purpose">
          <div><p className="home-eyebrow">Made for the people behind the delivery</p><h2 id="about-purpose">Less coordination,<br />a clearer path forward</h2></div>
          <div className="public-purpose-copy"><p>Delivery work involves a lot of moving parts: incoming requests, customer details, the right vehicle, and a driver ready to go. Dispatra brings that work into one connected flow.</p><p>We build software for the people running that day. Dispatchers get a clear view of operations, drivers get their assigned work, and shippers can manage their own orders.</p><p>Dispatra is a product of <span className="font-medium text-app-text">Tingsapp Inc.</span>, based in British Columbia, Canada.</p></div>
        </section>
        <section aria-label="What Dispatra brings together" className="public-feature-grid">{[
          { icon: Users, title: 'One connected team', text: 'Dedicated access for dispatchers, drivers, and shippers keeps each person focused on their part of the delivery.' },
          { icon: Workflow, title: 'Practical automation', text: 'Email intake and automatic dispatch help move routine work forward, with human review for exceptions.' },
          { icon: Layers, title: 'A workspace that fits', text: 'Use the full Dispatra TMS, or explore Smart Dispatching alongside your existing TMS.' },
        ].map(({ icon: Icon, title, text }) => <article key={title} className="public-feature-card"><span className="public-feature-icon"><Icon size={21} strokeWidth={1.5} aria-hidden="true" /></span><h3>{title}</h3><p>{text}</p></article>)}</section>
      </>}
      {page === '/help' && <section aria-label="Frequently asked questions" className="home-faq-list public-faqs">{faqs.map(item => <details key={item.question}><summary>{item.question}<ChevronDown size={16} aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</section>}
      <PublicPageCta help={page === '/help'} />
    </main>
    <PublicFooter />
  </div>;
}
