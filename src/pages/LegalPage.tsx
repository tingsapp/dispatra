import { PublicHeader } from '../components/home/PublicPageLayout';
import { PublicFooter } from '../components/home/PublicFooter';
import { legalPolicies } from './legalPolicies';

export default function LegalPage({ policy }: { policy: keyof typeof legalPolicies }) {
  const content = legalPolicies[policy];
  return <div className="public-site min-h-dvh bg-app-canvas font-sans text-app-text">
    <PublicHeader />
    <main className="public-legal-main">
      <nav aria-label="Policies" className="mb-8 flex flex-wrap gap-5 text-sm">
        <a href="/terms" aria-current={policy === 'terms' ? 'page' : undefined} className="text-app-muted underline-offset-4 hover:underline aria-[current=page]:text-app-text">Terms and Conditions</a>
        <a href="/privacy" aria-current={policy === 'privacy' ? 'page' : undefined} className="text-app-muted underline-offset-4 hover:underline aria-[current=page]:text-app-text">Privacy Policy</a>
      </nav>
      <article>
        <header className="mb-10">
          <p className="home-eyebrow">Updated <time dateTime="2026-10-15">October 15, 2026</time></p>
          <h1 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">{content.title}</h1>
          <p className="mt-4 text-base leading-7 text-app-muted">{content.introduction}</p>
        </header>
        <div className="space-y-8">
          {content.sections.map(section => <section key={section.title}>
            <h2 className="text-lg font-medium">{section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-app-muted">{section.text}</p>
          </section>)}
          <section aria-labelledby="policy-contact">
            <h2 id="policy-contact" className="text-lg font-medium">17. {policy === 'privacy' ? 'Privacy contact' : 'Contact'}</h2>
            <p className="mt-3 text-sm leading-7 text-app-muted">For {policy === 'privacy' ? 'privacy questions, complaints or personal-information requests' : 'questions about these Terms or your Dispatra agreement'}, contact Tingsapp Inc. at <a href="mailto:legals@tingsapp.com" className="break-words underline underline-offset-4">legals@tingsapp.com</a>. Include Dispatra and your company workspace in the subject so we can direct your request. Please do not email passwords or full payment-card details.</p>
          </section>
        </div>
        <p className="mt-10 text-sm leading-7 text-app-muted">Read our <a href={policy === 'terms' ? '/privacy' : '/terms'} className="underline underline-offset-4">{policy === 'terms' ? 'Privacy Policy' : 'Terms and Conditions'}</a> together with this {policy === 'terms' ? 'agreement' : 'Policy'}.</p>
      </article>
      <a href="/plans" className="mt-10 inline-block text-sm underline underline-offset-4">Back to plans &amp; free trial</a>
    </main>
    <PublicFooter />
  </div>;
}
