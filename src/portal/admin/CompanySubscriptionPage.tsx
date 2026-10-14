import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type CompanyDetail, type CompanySubscription } from '../api';
import { Button, Field, Notice, useOperationKey } from '../ui';
import { Select } from '../../components/ui/Select';
import { QueryState } from './QueryState';
import { auditKey, revenueKey, subscriptionKey, subscriptionsKey } from './queryKeys';
import { isConflict } from './format';
import { subscriptionLabels } from './subscriptionFormat';

export function CompanySubscriptionPage({ company }: { company: CompanyDetail }) {
  const query = useQuery({ queryKey: subscriptionKey(company.id), queryFn: () => api.companySubscription(company.id) });
  return <div className="space-y-6">
    <QueryState query={query} loading="Loading company subscription…" />
    {query.data && <section aria-label="Company subscription" className="space-y-5">
      <h2 className="app-section-title">Company subscription</h2>
      <SubscriptionForm subscription={query.data} />
    </section>}
  </div>;
}

function SubscriptionForm({ subscription }: { subscription: CompanySubscription }) {
  const cache = useQueryClient();
  const [original, setOriginal] = useState(subscription);
  const [status, setStatus] = useState(subscription.status);
  const [price, setPrice] = useState(subscription.monthly_price ?? '');
  const [startsOn, setStartsOn] = useState(subscription.starts_on ?? '');
  const keyFor = useOperationKey();
  const body = { version: original.version, status, monthly_price: price === '' ? null : price, currency: original.currency, starts_on: startsOn || null };
  const dirty = status !== original.status || price !== (original.monthly_price ?? '') || startsOn !== (original.starts_on ?? '');
  const receive = (data: CompanySubscription) => {
    setOriginal(data); setStatus(data.status); setPrice(data.monthly_price ?? ''); setStartsOn(data.starts_on ?? '');
    cache.setQueryData(subscriptionKey(data.organization_id), data);
  };
  const save = useMutation({ mutationFn: () => api.updateCompanySubscription(subscription.organization_id, body, keyFor(body)), onSuccess: data => {
    receive(data);
    for (const queryKey of [subscriptionsKey(), revenueKey, auditKey(data.organization_id)]) void cache.invalidateQueries({ queryKey });
  } });
  const reload = useMutation({ mutationFn: () => api.companySubscription(subscription.organization_id), onSuccess: data => { receive(data); save.reset(); } });
  const busy = save.isPending || reload.isPending;
  return <form aria-label="Company subscription" className="space-y-5" onSubmit={event => { event.preventDefault(); if (dirty && !busy) save.mutate(); }}>
    <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-1.5 text-sm text-slate-700"><span>Subscription status</span><Select aria-label="Subscription status" value={status} disabled={busy} onValueChange={value => { setStatus(value as CompanySubscription['status']); save.reset(); }} options={Object.entries(subscriptionLabels).map(([value, label]) => ({ value, label }))} /></div>
      <Field label="Subscription start date" type="date" required={status === 'ACTIVE'} value={startsOn} onChange={event => { setStartsOn(event.target.value); save.reset(); }} />
      <Field label="Price per vehicle per month" inputMode="decimal" pattern="[0-9]{1,10}(\.[0-9]{1,2})?" maxLength={13} required={status === 'ACTIVE'} placeholder="Not set" value={price} onChange={event => { setPrice(event.target.value); save.reset(); }} />
    </fieldset>
    <Notice error={reload.error ?? save.error} success={save.isSuccess ? 'Company subscription saved.' : undefined} />
    {isConflict(save.error) && <Button type="button" variant="outline" disabled={busy} onClick={() => reload.mutate()}>Reload latest subscription</Button>}
    <div className="flex justify-end"><Button disabled={!dirty || busy}>{save.isPending ? 'Saving…' : 'Save subscription'}</Button></div>
  </form>;
}
