import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type MonthlyPlan } from '../api';
import { Button, Card, Field, Notice, useOperationKey } from '../ui';
import { QueryState } from './QueryState';
import { monthlyPlanKey } from './queryKeys';
import { Switch } from '../../components/ui/Switch';
import { isConflict } from './format';

export function SubscriptionBillingPage() {
  const plan = useQuery({ queryKey: monthlyPlanKey, queryFn: api.monthlyPlan });
  return <div className="space-y-6">
    <QueryState query={plan} loading="Loading subscription plans…" />
    {plan.data && <PlanOptionsForm plan={plan.data} />}
  </div>;
}

const draftFor = (plan: MonthlyPlan) => ({ monthly_price: plan.monthly_price ?? '', currency: plan.currency,
  dispatch_monthly_price: plan.dispatch_monthly_price ?? '', dispatch_currency: plan.dispatch_currency ?? 'CAD', trial_enabled: plan.trial_enabled ?? true, trial_days: String(plan.trial_days) });

function PlanOptionsForm({ plan }: { plan: MonthlyPlan }) {
  const cache = useQueryClient();
  const [original, setOriginal] = useState(plan);
  const [draft, setDraft] = useState(() => draftFor(plan));
  const keyFor = useOperationKey();
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftFor(original));
  const body = { ...draft, trial_days: Number(draft.trial_days), version: original.version, monthly_price: draft.monthly_price === '' ? null : draft.monthly_price,
    dispatch_monthly_price: draft.dispatch_monthly_price === '' ? null : draft.dispatch_monthly_price };
  const receive = (data: MonthlyPlan) => { setOriginal(data); setDraft(draftFor(data)); cache.setQueryData(monthlyPlanKey, data); };
  const save = useMutation({ mutationFn: () => api.updateMonthlyPlan(body, keyFor(body)), onSuccess: data => {
    receive(data); cache.invalidateQueries({ queryKey: ['public', 'subscription-plan'] });
  } });
  const reload = useMutation({ mutationFn: api.monthlyPlan, onSuccess: data => { receive(data); save.reset(); } });
  const change = (field: keyof typeof draft) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = field.endsWith('currency') ? event.target.value.toUpperCase() : event.target.value;
    setDraft(current => ({ ...current, [field]: value })); save.reset();
  };
  return <form aria-label="Subscription plans" className="space-y-6" onSubmit={event => { event.preventDefault(); if (!save.isPending && !reload.isPending && dirty) save.mutate(); }}>
    <p className="text-sm text-app-muted">Set the default monthly rate for each plan. Existing companies keep their saved subscription terms.</p>
    <div className="grid auto-rows-fr gap-6 lg:grid-cols-2">
      <Card title="TMS + Smart Dispatching" description="The full Dispatra TMS and smart dispatching system.">
        <fieldset disabled={save.isPending || reload.isPending} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <legend className="sr-only">TMS + Smart Dispatching pricing</legend>
          <Field label="Price per vehicle per month" aria-label="TMS + Smart Dispatching price per vehicle per month" type="text" inputMode="decimal" pattern="[0-9]{1,10}(\.[0-9]{1,2})?" maxLength={13} placeholder="Contact for pricing" value={draft.monthly_price} onChange={change('monthly_price')} />
          <Field label="Currency" aria-label="TMS + Smart Dispatching currency" required minLength={3} maxLength={3} pattern="[A-Z]{3}" placeholder="CAD" value={draft.currency} onChange={change('currency')} />
        </fieldset>
      </Card>
      <Card title="Smart Dispatching" description="Smart dispatching connected to an external TMS.">
        <fieldset disabled={save.isPending || reload.isPending} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <legend className="sr-only">Smart Dispatching pricing</legend>
          <Field label="Price per vehicle per month" aria-label="Smart Dispatching price per vehicle per month" type="text" inputMode="decimal" pattern="[0-9]{1,10}(\.[0-9]{1,2})?" maxLength={13} placeholder="Contact for pricing" value={draft.dispatch_monthly_price} onChange={change('dispatch_monthly_price')} />
          <Field label="Currency" aria-label="Smart Dispatching currency" required minLength={3} maxLength={3} pattern="[A-Z]{3}" placeholder="CAD" value={draft.dispatch_currency} onChange={change('dispatch_currency')} />
        </fieldset>
      </Card>
    </div>
    <Card className="bg-app-accent-soft" title="Free trial" description="Available to new companies on both subscription plans.">
      <fieldset disabled={save.isPending || reload.isPending} className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-sm font-medium">Enable free trial</p><p className="mt-1 text-xs text-app-muted">{draft.trial_enabled ? 'New companies can start a free trial.' : 'New free trial signups are disabled.'}</p></div>
          <Switch aria-label="Enable free trial" checked={draft.trial_enabled} disabled={save.isPending || reload.isPending} onCheckedChange={trial_enabled => { setDraft(current => ({ ...current, trial_enabled })); save.reset(); }} />
        </div>
        <div className="max-w-xs"><Field label="Trial length (days)" type="number" required min={1} max={365} step={1} value={draft.trial_days} onChange={change('trial_days')} /></div>
        <p className="text-sm text-app-muted">No credit card required during the trial. Companies authorize monthly billing at their saved price per registered vehicle to continue afterward.</p>
        <p className="text-xs text-app-muted">Changes apply to new trials. Existing companies keep the trial dates or duration they already received.</p>
      </fieldset>
    </Card>
    <p className="text-xs leading-5 text-app-muted">Use a three-letter currency code, such as CAD or USD. Leave a price blank to show “Contact us for pricing” for that plan.</p>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-app-muted"><a href="/plans" className="text-app-text underline underline-offset-4">View public plans</a></p>
      <Button className="shrink-0" disabled={!dirty || save.isPending || reload.isPending}>{save.isPending ? 'Saving…' : 'Save plans'}</Button>
    </div>
    <Notice error={reload.error ?? save.error} success={save.isSuccess ? 'Subscription plans saved.' : undefined} />
    {isConflict(save.error) && <Button type="button" variant="outline" disabled={reload.isPending} onClick={() => reload.mutate()}>{reload.isPending ? 'Loading…' : 'Reload latest'}</Button>}
  </form>;
}
