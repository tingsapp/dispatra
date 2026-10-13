import { PublicHeader } from '../components/home/PublicPageLayout';
import { PublicFooter } from '../components/home/PublicFooter';

const policies = {
  terms: {
    title: 'Terms and Conditions',
    introduction: 'These draft terms describe using Dispatra to coordinate orders, dispatch and deliveries for your company.',
    sections: [
      { title: 'Your workspace and account', text: 'Create a workspace only when you are authorized to act for the company. Provide accurate company and contact details, keep your password private, and give each team member access appropriate to their role. Your company administrator manages driver and shipper accounts.' },
      { title: 'Your free trial', text: 'The free trial lasts 30 days from successful email verification. No credit card is required to start. Access is suspended when the trial ends until Dispatra activates your company. Starting a trial does not authorize an automatic payment.' },
      { title: 'Monthly subscription', text: 'The plans page displays the configured monthly price and currency, or asks you to contact Dispatra for pricing. Confirm subscription arrangements with Dispatra before continuing after your trial. Workspace activation alone is not a payment receipt.' },
      { title: 'Responsible use', text: 'Use Dispatra for lawful delivery operations and only upload information you are authorized to share. Do not access another company’s records, misuse someone else’s account or interfere with the service. Your company remains responsible for its delivery commitments and for reviewing operational decisions.' },
      { title: 'Workspace records and service access', text: 'Your company manages its operational records and access permissions. Suspending access does not automatically delete those records. Contact your company administrator or the Dispatra representative supporting your workspace about access, records or ending your use of the service.' },
      { title: 'Privacy', text: 'The Privacy Policy explains the account and operational information used by Dispatra. Review it before providing personal information or inviting your team.' },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    introduction: 'This draft explains the information used by Dispatra’s current workspace, account and delivery features.',
    sections: [
      { title: 'Account and company information', text: 'Registration collects your company name and workspace identifier, full name, email, optional phone number, optional company address and password. Passwords are stored as secure hashes. Your company may also provide team profiles, company settings and account permissions.' },
      { title: 'Delivery information', text: 'Workspace records may include order details, addresses, contact information, assignments, delivery notes and proof of delivery. Connected email intake can process messages and attachments supplied to the company’s configured mailbox. Driver features can collect location and activity information when location sharing is enabled for delivery execution.' },
      { title: 'How information is used', text: 'Information supports sign-in, company access, order handling, dispatch, routing, delivery evidence and troubleshooting. Session and security records help protect access and investigate service issues. Company administrators and authorized team members see information within the scope of their roles.' },
      { title: 'Connected services', text: 'Features such as maps, routing, email and file storage may involve external service providers. The company’s configuration determines which integrations are used. The final policy must identify the providers, processing locations and arrangements that apply to the deployed service.' },
      { title: 'Cookies and browser storage', text: 'Dispatra uses a session cookie for authenticated access and browser storage for workspace preferences. Signup passwords are not saved in browser storage. Allowing driver location access is separate from signing in or starting duty.' },
      { title: 'Retention and requests', text: 'Trial expiry or suspension does not automatically erase workspace records. Contact your company administrator or the Dispatra representative supporting your workspace to ask about access, corrections or deletion. The final policy must confirm retention periods, the responsible legal entity, a dedicated privacy contact and applicable privacy rights before public release.' },
    ],
  },
} as const;

export default function LegalPage({ policy }: { policy: keyof typeof policies }) {
  const content = policies[policy];
  return <div className="min-h-dvh bg-app-canvas font-sans text-app-text">
    <PublicHeader />
    <main className="mx-auto max-w-3xl px-6 pb-14 pt-8 sm:pt-12">
      <nav aria-label="Policies" className="mb-8 flex flex-wrap gap-5 text-sm">
        <a href="/terms" aria-current={policy === 'terms' ? 'page' : undefined} className="text-app-muted underline-offset-4 hover:underline aria-[current=page]:text-app-text">Terms and Conditions</a>
        <a href="/privacy" aria-current={policy === 'privacy' ? 'page' : undefined} className="text-app-muted underline-offset-4 hover:underline aria-[current=page]:text-app-text">Privacy Policy</a>
      </nav>
      <article>
        <header className="mb-10">
          <p className="text-xs font-medium uppercase tracking-wider text-app-muted">Draft for review · Updated October 13, 2026</p>
          <h1 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">{content.title}</h1>
          <p className="mt-4 text-base leading-7 text-app-muted">{content.introduction}</p>
        </header>
        <div className="space-y-8">
          {content.sections.map(section => <section key={section.title}>
            <h2 className="text-lg font-medium">{section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-app-muted">{section.text}</p>
          </section>)}
        </div>
      </article>
      <a href="/signup" className="mt-10 inline-block text-sm underline underline-offset-4">Back to plans &amp; free trial</a>
    </main>
    <PublicFooter />
  </div>;
}
