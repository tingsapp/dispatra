import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { api } from '../../portal/api';

const cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30000, gcTime: 0 } } });
type Offer = { enabled: boolean; days: number | undefined };

/** Public homepage actions share the saved offer without assuming a trial exists. */
export function TrialOffer({ children }: { children: (offer: Offer) => ReactNode }) {
  return <QueryClientProvider client={cache}><OfferContent>{children}</OfferContent></QueryClientProvider>;
}

function OfferContent({ children }: { children: (offer: Offer) => ReactNode }) {
  const query = useQuery({ queryKey: ['public', 'subscription-plan'], queryFn: api.subscriptionPlan, refetchInterval: 30000 });
  return children({ enabled: Boolean(query.data && query.data.trial_enabled !== false), days: query.data?.trial_days });
}
