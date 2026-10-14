import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type MonthlyPlan } from '../api';
import { Button, Card, Field, Notice, useOperationKey } from '../ui';
import { QueryState } from './QueryState';
import { monthlyPlanKey } from './queryKeys';
import { isConflict } from './format';

export function SubscriptionBillingPage() {
  const plan = useQuery({ queryKey: monthlyPlanKey, queryFn: api.monthlyPlan });
  return <div className="space-y-8">
    <QueryState query={plan} loading="Loading subscription plan…" />
    {plan.data && <div className="grid auto-rows-fr gap-6 lg:grid-cols-2">
      <Card title="Monthly subscription" description="Default monthly terms for new companies. Existing company agreements keep their saved terms.">
        <MonthlyPlanForm plan={plan.data} />
      </Card>
      <Card title="One month free trial" description={`Every new company gets ${plan.data.trial_days} days to try Dispatra.`}>
        <div className="space-y-4 text-sm">
          <p className="text-3xl font-semibold text-app-text">Free <span className="text-sm font-normal text-app-muted">for {plan.data.trial_days} days</span></p>
          <p className="text-app-muted">No credit card required. Access is suspended when the trial ends, until an admin activates the company.</p>
          <a href="/signup" className="inline-block text-app-text underline underline-offset-4">Open trial signup</a>
        </div>
      </Card>
    </div>}
  </div>;
}

function MonthlyPlanForm({ plan }: { plan: MonthlyPlan }) {
  const cache = useQueryClient();
  const [original, setOriginal] = useState(plan);
  const [price, setPrice] = useState(plan.monthly_price ?? '');
  const [currency, setCurrency] = useState(plan.currency);
  const keyFor = useOperationKey();
  const dirty = price !== (original.monthly_price ?? '') || currency !== original.currency;
  const body = { version: original.version, monthly_price: price === '' ? null : price, currency };
  const receive = (data: MonthlyPlan) => { setOriginal(data); setPrice(data.monthly_price ?? ''); setCurrency(data.currency); cache.setQueryData(monthlyPlanKey, data); };
  const save = useMutation({ mutationFn: () => api.updateMonthlyPlan(body, keyFor(body)), onSuccess: data => {
    receive(data);
  } });
  const reload = useMutation({ mutationFn: api.monthlyPlan, onSuccess: data => { receive(data); save.reset(); } });
  return <form aria-label="Monthly subscription" className="space-y-5" onSubmit={event => { event.preventDefault(); if (!save.isPending && dirty) save.mutate(); }}>
    <fieldset disabled={save.isPending || reload.isPending} className="grid gap-4 sm:grid-cols-2">
      <Field label="Price per vehicle per month" type="text" inputMode="decimal" pattern="[0-9]{1,10}(\.[0-9]{1,2})?" maxLength={13} placeholder="Not set" value={price} onChange={event => { setPrice(event.target.value); save.reset(); }} />
      <Field label="Currency" required minLength={3} maxLength={3} pattern="[A-Z]{3}" placeholder="CAD" value={currency} onChange={event => { setCurrency(event.target.value.toUpperCase()); save.reset(); }} />
    </fieldset>
    <p className="text-xs text-app-muted">Use a three-letter currency code, such as CAD or USD. Leave the price blank until it is decided. Payment collection has not been configured.</p>
    <Notice error={reload.error ?? save.error} success={save.isSuccess ? 'Subscription plan saved.' : undefined} />
    {isConflict(save.error) && <Button type="button" variant="outline" disabled={reload.isPending} onClick={() => reload.mutate()}>{reload.isPending ? 'Loading…' : 'Reload latest'}</Button>}
    <div className="flex justify-end"><Button disabled={!dirty || save.isPending || reload.isPending}>{save.isPending ? 'Saving…' : 'Save plan'}</Button></div>
  </form>;
}
