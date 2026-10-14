import type { CompanySubscription } from '../api';

export const subscriptionLabels: Record<CompanySubscription['status'], string> = {
  NOT_SUBSCRIBED: 'Not subscribed', ACTIVE: 'Active', PAUSED: 'Paused', CANCELLED: 'Cancelled',
};

/** API Decimal strings stay exact, including revenue sums beyond Number's safe cents. */
export function subscriptionMoney(value: string | null, currency: string) {
  if (value === null) return 'Not set';
  const [whole, fraction = ''] = value.split('.');
  return `${currency} ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`;
}
