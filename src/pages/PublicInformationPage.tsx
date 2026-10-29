import { ChevronDown, Users, Workflow, Layers } from 'lucide-react';
import { PublicHeader, PublicPageIntro, PublicPageCta } from '../components/home/PublicPageLayout';
import { PublicFooter } from '../components/home/PublicFooter';
import { faqs } from './publicInformation';

type InformationPath = '/about' | '/help';
const titles = {
  '/about': { eyebrow: 'ABOUT DISPATRA', title: 'AI built to do the dispatching', description: 'Dispatra is an AI-powered automated dispatcher. It assigns ready orders to eligible drivers and optimizes routes, with your team in control.' },
  '/help': { eyebrow: 'HELP & FAQS', title: 'Get to know your AI dispatcher', description: 'Find out how automated dispatch works, when to use manual control, and which setup fits your team.' },
};
export default function PublicInformationPage({ page }: { page: InformationPath }) {
  const content = titles[page];
  return <div className="public-site min-h-dvh bg-app-canvas font-sans text-app-text">
    <PublicHeader />
    <main className="public-page-main">
      <PublicPageIntro {...content} />
      {page === '/about' && <>
        <section aria-labelledby="about-purpose" className="public-purpose">
          <div><p className="home-eyebrow">Built around AI dispatch</p><h2 id="about-purpose">Intelligent dispatch.<br />Connected delivery operations.</h2></div>
          <div className="public-purpose-copy"><p>Dispatra brings AI and delivery operations into one dispatch system. From incoming order requests to driver assignment and route optimization, it reduces manual coordination and helps your team keep deliveries moving.</p><p>The email agent prepares incoming requests for review. In Auto mode, Dispatra assigns ready orders to eligible drivers and optimizes routes after assignment. In Manual mode, dispatchers choose assignments and routes are still optimized automatically.</p><p>Your team stays in control throughout the delivery day. Dispatchers monitor progress and handle exceptions, shippers submit orders and follow deliveries, and drivers receive assigned work and capture proof of delivery.</p></div>
        </section>
        <section aria-label="What Dispatra brings together" className="public-feature-grid">{[
          { icon: Users, title: 'AI dispatch, human oversight', text: 'Automate routine assignments while your dispatchers follow progress and handle the decisions that need their attention.' },
          { icon: Workflow, title: 'From request to dispatch', text: 'The email agent prepares incoming requests for review. Once orders are ready, Auto handles eligible-driver assignment and route optimization.' },
          { icon: Layers, title: 'Your dispatcher, your setup', text: 'Use AI dispatch with Dispatra’s built-in workspace, or explore connecting it to your existing TMS. Our team can confirm compatibility.' },
        ].map(({ icon: Icon, title, text }) => <article key={title} className="public-feature-card"><span className="public-feature-icon"><Icon size={21} strokeWidth={1.5} aria-hidden="true" /></span><h3>{title}</h3><p>{text}</p></article>)}</section>
      </>}
      {page === '/help' && <section aria-label="Frequently asked questions" className="home-faq-list public-faqs">{faqs.map(item => <details key={item.question}><summary>{item.question}<ChevronDown size={16} aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</section>}
      <PublicPageCta help={page === '/help'} />
    </main>
    <PublicFooter />
  </div>;
}
