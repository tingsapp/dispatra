import { useQuery } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import { api } from '../api';
import { Notice } from '../ui';

export function CompanyPaymentMethodCard({ companyId }: { companyId: string }) {
  const query = useQuery({ queryKey: ['company-payment-method', 'owner', companyId],
    queryFn: () => api.paymentMethod({ kind: 'owner', id: companyId }) });
  const payment = query.data;
  return <section aria-label="Payment method" className="app-panel space-y-5">
    <div className="flex items-center gap-2"><CreditCard className="h-4 w-4" aria-hidden="true" /><h2 className="app-section-title">Payment method</h2></div>
    {query.isPending && <p role="status" className="text-sm text-app-muted">Loading payment method…</p>}
    <Notice error={query.error} />
    {payment && (payment.last4 ? <div className="space-y-1 text-sm">
      <p className="font-medium capitalize">{payment.brand} •••• {payment.last4}</p>
      <p className="text-app-muted">Expires {String(payment.exp_month).padStart(2, '0')}/{payment.exp_year}</p>
      {payment.status === 'EXPIRED' && <p className="text-red-700">This card has expired.</p>}
    </div> : <p className="text-sm text-app-muted">No payment method added.</p>)}
  </section>;
}
