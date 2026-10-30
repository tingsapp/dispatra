import { ArrowRight, ChevronDown } from 'lucide-react';
import { PublicHeader, PublicPageIntro } from '../components/home/PublicPageLayout';
import { PublicFooter } from '../components/home/PublicFooter';
import { apiResources, ORDER_EVENTS } from '../integrations/preview';

const connectors = [
  { name: 'Rose Rocket', initials: 'RR', status: 'In preparation', description: 'Authentication and order imports are being prepared. Vendor access and testing are pending.' },
  { name: 'CartonCloud', initials: 'CC', status: 'In preparation', description: 'Transport job imports are being prepared. Vendor access and testing are pending.' },
  { name: 'Truckbase', initials: 'TB', status: 'Planned', description: 'The supported connection method still needs confirmation from Truckbase.' },
  { name: 'Tailwind TMS', initials: 'TW', status: 'Planned', description: 'Connector development and vendor validation are planned.' },
  { name: 'Samsara', initials: 'SA', status: 'Account connection available', description: 'Test your API token and connect your Samsara account. Fleet data imports are not enabled.' },
  { name: 'AscendTMS', initials: 'AT', status: 'Planned', description: 'Connector development and vendor validation are planned.' },
];
const steps = [
  { title: 'Choose your TMS', description: 'Open Integrations in your Dispatcher workspace and select a ready connector.' },
  { title: 'Sign in and approve', description: 'For sign-in connectors, your TMS opens its own login and permissions screen. Approve access to your company.' },
  { title: 'Bring your orders together', description: 'Dispatra verifies the connection and imports supported data. Follow connection status and review any missing details in your workspace.' },
];
const readExample = `curl 'https://dispatra.com/api/v1/companies/YOUR_COMPANY_SLUG/orders?limit=10' \\
  -H 'Authorization: Bearer YOUR_API_KEY'`;

export default function IntegrationGuidePage() {
  return <div className="public-site min-h-dvh bg-white font-sans text-app-text">
    <PublicHeader />
    <main className="public-page-main integration-guide">
      <PublicPageIntro eyebrow="WORK WITH YOUR EXISTING TOOLS" title="Integrations & API" description="Connect your TMS or build a connection with the Dispatra API. See what’s being prepared and how to get started." />
      <nav aria-label="Guide sections" className="guide-section-links">
        <a href="#connectors">TMS connectors</a><a href="#connecting">How connecting works</a><a href="#api">Dispatra API</a>
      </nav>

      <section aria-labelledby="connectors" className="guide-section">
        <h2 id="connectors">TMS connectors</h2>
        <p className="guide-lead">Samsara account connection is available. The other five connectors are not available to connect yet; their configuration and testing are pending.</p>
        <div className="guide-connectors">{connectors.map(connector => <article key={connector.name} aria-label={connector.name} className="guide-connector">
          <span className="guide-monogram" aria-hidden="true">{connector.initials}</span>
          <div className="guide-connector-copy"><h3>{connector.name}</h3><p>{connector.description}</p></div>
          <span className="guide-status">{connector.status}</span>
        </article>)}</div>
      </section>

      <section aria-labelledby="connecting" className="guide-section">
        <h2 id="connecting">How connecting works</h2>
        <p className="guide-lead">Once your connector is ready, connect from your own Dispatcher workspace. Your company controls the access it grants.</p>
        <ol className="guide-steps">{steps.map((step, index) => <li key={step.title}><span className="guide-step-number" aria-hidden="true">0{index + 1}</span><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol>
        <div className="guide-note"><p>Supported imports depend on the connector and your TMS permissions. Orders may include customer details, pickup and delivery stops, cargo, and supplied prices. Incomplete records are held for review.</p><p>You sign in directly with your TMS; Dispatra does not receive your TMS password through this flow. Disconnecting stops synchronization and keeps previously imported records. Sending status updates back requires support from the individual connector.</p></div>
      </section>

      <section aria-labelledby="api" className="guide-section">
        <h2 id="api">Build with the Dispatra API</h2>
        <p className="guide-lead">For a custom connection, your developer can work directly with your company’s orders, shippers, drivers and vehicles.</p>
        <ol className="guide-api-steps">
          <li>In your Dispatcher workspace, open <strong>Integrations → Dispatra API</strong>. API tools are shown when you use the External TMS workspace.</li>
          <li>Create an API key and copy it when it appears. Keep it on your server; it is shown only once. Regenerating the key replaces the previous one.</li>
          <li>Use your company’s URL and send the key in the <code>Authorization: Bearer &lt;key&gt;</code> header. Keys can access only their own company’s supported API resources.</li>
        </ol>
        <details className="guide-disclosure">
          <summary>Developer quick start<ChevronDown size={16} aria-hidden="true" /></summary>
          <div className="guide-developer-content">
            <h3>Read your orders</h3>
            <p>Replace the company slug and API key below with your own values. Your company slug is the first part of your workspace path, such as acme in /acme/integrations. This example reads up to 10 orders and does not change data.</p>
            <pre tabIndex={0} aria-label="Read-only orders request"><code>{readExample}</code></pre>
            <p>The Orders list returns a JSON array. Send the last order’s <code>id</code> in <code>after</code> for the next page; an empty array means there are no more orders.</p>
            <h3>Supported resources</h3>
            <ul className="guide-resource-list">{apiResources('example').map(resource => <li key={resource.id}><strong>{resource.title}</strong><span>{resource.description}</span></li>)}</ul>
            <p>See the exact company endpoints and an example order payload in your workspace’s Dispatra API section. Current order imports support Canadian addresses.</p>
            <h3>Changes and retries</h3>
            <p>Send an <code>Idempotency-Key</code> with changes. Reuse it only when retrying the same request. Updates also require the current record version. Validation, access and version errors must be resolved before retrying.</p>
            <h3>Receive order events</h3>
            <p>Save your HTTPS destination and signing secret under Webhooks in the Dispatra API section. Dispatra sends events such as {ORDER_EVENTS[0].event} and {ORDER_EVENTS[ORDER_EVENTS.length - 1].event}.</p>
            <p>Verify the <code>X-Signature</code> header using HMAC-SHA256 of the raw request body with your signing secret. Deliveries may be retried; handle repeated events without applying the same change twice.</p>
          </div>
        </details>
        <details className="guide-disclosure">
          <summary>Connect a TMS through its API<ChevronDown size={16} aria-hidden="true" /></summary>
          <div className="guide-developer-content"><p>If your provider supports API access, your developer can use the TMS API section in your workspace to configure its address, credentials, data fields, and webhook or polling method.</p><p>Save and test the connection before synchronizing. This is a custom configuration; it does not make a named connector ready. Compatibility depends on your provider’s API and available data.</p></div>
        </details>
      </section>

      <section aria-labelledby="integration-help" className="guide-help">
        <div><h2 id="integration-help">Talk through your connection.</h2><p>Tell our team which TMS you use or what you’d like to build.</p></div>
        <a href="/contact" className="home-text-link">Contact our team<ArrowRight size={14} aria-hidden="true" /></a>
      </section>
    </main>
    <PublicFooter />
  </div>;
}
