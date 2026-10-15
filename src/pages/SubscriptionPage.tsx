import { PageHeader } from '../components/layout/PageHeader';
import { companySlugForCurrentPath } from '../lib/pageRoutes';
import { CompanyBillingContent } from '../portal/CompanyBillingContent';

export function SubscriptionPage() {
  const slug = companySlugForCurrentPath();
  return <div className="app-page app-page-reading h-full w-full flex flex-col overflow-hidden font-sans">
    <PageHeader title="Subscription" description="Payment history and your saved payment method." />
    <main className="page-content flex-1 overflow-y-auto py-6">
      {slug ? <CompanyBillingContent target={{ kind: 'company', slug }} /> : <p className="text-sm text-app-muted">Subscription is available in your company account.</p>}
    </main>
  </div>;
}
