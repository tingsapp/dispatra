import { useQuery } from '@tanstack/react-query';
import { api, type CompanyDetail } from '../api';
import { CompanyPaymentHistory } from '../CompanyPaymentHistory';
import { CompanyPaymentMethodCard } from './CompanyPaymentMethodCard';
import { QueryState } from './QueryState';
import { subscriptionKey } from './queryKeys';
import { subscriptionLabels, subscriptionMoney } from './subscriptionFormat';

export function CompanySubscriptionPage({ company }: { company: CompanyDetail }) {
  const query = useQuery({ queryKey: subscriptionKey(company.id), queryFn: () => api.companySubscription(company.id), refetchInterval: 5000 });
  const billing = useQuery({ queryKey: ['company-payment-method', 'owner', company.id], queryFn: () => api.paymentMethod({ kind: 'owner', id: company.id }), refetchInterval: 5000 });
  const subscription = query.data;
  return <div className="space-y-8">
    <CompanyPaymentMethodCard companyId={company.id} />
    <section aria-label="Company subscription" className="app-panel space-y-5">
      <h2 className="app-section-title">Company subscription</h2>
      <QueryState query={query} loading="Loading company subscription…" />
      {subscription && <dl className="grid gap-5 text-sm sm:grid-cols-2">
        {[
          ['Status', subscriptionLabels[subscription.status]],
          ['Start date', subscription.starts_on ?? '-'],
          ['Price per vehicle per month', subscriptionMoney(subscription.monthly_price, subscription.currency)],
          ['Currency', subscription.currency],
          ...(billing.data ? [['Recurring billing', billing.data.recurring_authorized ? billing.data.subscription_status === 'PENDING' ? 'Starting subscription' : billing.data.subscription_status.replaceAll('_', ' ') : 'Authorization required from the company dispatcher']] : []),
        ].map(([label, value]) => <div key={label} className="space-y-1">
          <dt className="text-app-muted">{label}</dt><dd aria-label={label} className="font-medium">{value}</dd>
        </div>)}
      </dl>}
    </section>
    <CompanyPaymentHistory target={{ kind: 'owner', id: company.id }} />
  </div>;
}
