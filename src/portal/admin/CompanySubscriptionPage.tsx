import { useQuery } from '@tanstack/react-query';
import { api, type CompanyDetail } from '../api';
import { CompanyPaymentHistory } from '../CompanyPaymentHistory';
import { CompanyPaymentMethodCard } from './CompanyPaymentMethodCard';
import { QueryState } from './QueryState';
import { subscriptionKey } from './queryKeys';
import { subscriptionLabels, subscriptionMoney } from './subscriptionFormat';

export function CompanySubscriptionPage({ company }: { company: CompanyDetail }) {
  const query = useQuery({ queryKey: subscriptionKey(company.id), queryFn: () => api.companySubscription(company.id) });
  const subscription = query.data;
  return <div className="space-y-8">
    <CompanyPaymentMethodCard companyId={company.id} />
    <CompanyPaymentHistory target={{ kind: 'owner', id: company.id }} />
    <section aria-label="Company subscription" className="space-y-5">
      <h2 className="app-section-title">Company subscription</h2>
      <QueryState query={query} loading="Loading company subscription…" />
      {subscription && <dl className="grid gap-5 text-sm sm:grid-cols-2">
        {[
          ['Subscription status', subscriptionLabels[subscription.status]],
          ['Subscription start date', subscription.starts_on ?? '—'],
          ['Price per vehicle per month', subscriptionMoney(subscription.monthly_price, subscription.currency)],
          ['Currency', subscription.currency],
        ].map(([label, value]) => <div key={label} className="space-y-1">
          <dt className="text-app-muted">{label}</dt><dd aria-label={label} className="font-medium">{value}</dd>
        </div>)}
      </dl>}
    </section>
  </div>;
}
