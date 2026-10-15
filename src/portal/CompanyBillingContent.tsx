import type { PaymentTarget } from './api';
import { CompanyPaymentMethod } from './CompanyPaymentMethod';
import { CompanyPaymentHistory } from './CompanyPaymentHistory';
import { Tabs } from '../components/ui/Tabs';

export function CompanyBillingContent({ target }: { target: PaymentTarget }) {
  return <Tabs label="Subscription billing" items={[
    { id: 'payment-methods', label: 'Payment methods', content: <CompanyPaymentMethod target={target} /> },
    { id: 'payment-history', label: 'Payment history', content: <CompanyPaymentHistory target={target} /> },
  ]} />;
}
