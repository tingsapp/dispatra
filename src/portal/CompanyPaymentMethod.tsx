import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import { api, type PaymentTarget } from './api';
import { Button, Notice, useOperationKey } from './ui';

export function CompanyPaymentMethod({ target }: { target: PaymentTarget }) {
  const cache = useQueryClient();
  const key = ['company-payment-method', target.kind, target.kind === 'owner' ? target.id : target.slug];
  const query = useQuery({ queryKey: key, queryFn: () => api.paymentMethod(target), refetchInterval: 5000 });
  const [consent, setConsent] = useState(false);
  const keyFor = useOperationKey();
  const [returnedSession] = useState(() => new URLSearchParams(location.search).get('card_setup'));
  const started = useRef(false);
  const receive = async () => {
    await query.refetch();
    for (const queryKey of [['account'], ['platform', 'companies'], ['platform', 'company'], ['platform', 'audit'], ['company-payment-history'], ['platform', 'subscription'], ['platform', 'subscriptions'], ['platform', 'revenue']]) void cache.invalidateQueries({ queryKey });
  };
  const setup = useMutation({ mutationFn: () => api.startCardSetup(target, keyFor({ consent: true, terms_version: query.data?.terms_version }), query.data!.terms_version), onSuccess: data => {
    const url = new URL(data.url);
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Unable to open payment setup.');
    location.assign(data.url);
  } });
  const enroll = useMutation({ mutationFn: () => {
    if (target.kind !== 'company') throw new Error('Only the company dispatcher can start a subscription.');
    const body = { consent: true, terms_version: query.data!.terms_version };
    return api.startCompanySubscription(target.slug, keyFor(body), body.terms_version);
  }, onSuccess: async data => {
    cache.setQueryData(key, data);
    setConsent(false);
    await receive();
  } });
  const confirm = useMutation({ mutationFn: (session: string) => api.confirmCardSetup(target, session), onSuccess: receive });
  useEffect(() => {
    if (started.current || !returnedSession) return;
    started.current = true;
    const url = new URL(location.href);
    url.searchParams.delete('card_setup');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    if (returnedSession !== 'cancelled') confirm.mutate(returnedSession);
  }, [returnedSession, confirm]);
  const busy = setup.isPending || confirm.isPending || enroll.isPending;
  const payment = query.data;
  useEffect(() => { setConsent(false); }, [payment?.terms_version]);
  useEffect(() => {
    if (payment && !payment.required) void cache.invalidateQueries({ queryKey: ['account'] });
  }, [payment?.required, cache]);
  const configured = payment?.monthly_price != null;
  const canEnroll = target.kind === 'company' && payment?.status === 'SAVED' && !payment.recurring_authorized && ['NOT_SUBSCRIBED', 'ACTIVE'].includes(payment.subscription_status);
  const money = (value: string | number | null | undefined) => `${payment?.currency} ${value ?? '—'}`;
  return <section aria-label="Payment method" className="space-y-5">
    <div className="flex items-center gap-2"><CreditCard className="h-4 w-4" aria-hidden="true" /><h2 className="app-section-title">Payment method</h2></div>
    {query.isPending && <p role="status" className="text-sm text-app-muted">Loading payment method…</p>}
    <Notice error={query.error ?? setup.error ?? confirm.error ?? enroll.error} success={enroll.isSuccess ? 'Subscription requested. Your status will update automatically.' : confirm.isSuccess ? 'Payment method saved.' : undefined} />
    {query.isError && <Button variant="outline" onClick={() => query.refetch()}>Try again</Button>}
    {payment && <>
      {payment.last4 ? <div className="space-y-1 text-sm"><p className="font-medium capitalize">{payment.brand} •••• {payment.last4}</p><p className="text-app-muted">Expires {String(payment.exp_month).padStart(2, '0')}/{payment.exp_year}</p>{payment.status === 'EXPIRED' && <p className="text-red-700">This card has expired. Add a replacement card.</p>}</div>
        : <p className="text-sm text-app-muted">No payment method added.</p>}
      {payment.required ? <p className="text-sm">An active, paid subscription and a valid payment method are required to continue using this company workspace.</p> : payment.trial_ends_at && payment.status !== 'SAVED' ? <p className="text-sm text-app-muted">Your free trial ends {new Date(payment.trial_ends_at).toLocaleDateString()}. Authorize monthly billing before then to keep using Dispatra.</p> : null}
      <div className="space-y-2 text-sm">
        <p>{configured ? `${money(payment.monthly_price)} per registered vehicle per month.` : 'Contact Dispatra to set your subscription rate.'}</p>
        {configured && <p>{payment.vehicle_count} registered vehicles · {money(payment.monthly_total)} / month at the current fleet size.</p>}
        <p>Billing starts {payment.starts_at && new Date(payment.starts_at) > new Date() ? new Date(payment.starts_at).toLocaleString() : 'when you start your subscription'}. Your recorded free trial stays free. If the billing start date has arrived, Stripe attempts the first monthly payment when you subscribe.</p>
        <p className="text-app-muted">Stripe charges the saved card automatically each month. Inactive registered vehicles are included; archived vehicles are excluded. Fleet and rate changes apply to the next renewal without mid-month charges. Zero vehicles cost zero.</p>
        <p className="capitalize">Subscription: {payment.subscription_status === 'PENDING' ? 'Starting subscription' : payment.subscription_status.replaceAll('_', ' ')}</p>
        {canEnroll && <p className="text-app-muted">Your card is saved. Authorize recurring billing below and start your subscription to use it for monthly payments.</p>}
        {payment.period_end && <p className="text-app-muted">Current period ends {new Date(payment.period_end).toLocaleDateString()}.</p>}
        {payment.sync_error && <p role="status">Billing is waiting for Stripe. We’ll retry automatically.</p>}
        {payment.invoice_url && <a className="underline" href={payment.invoice_url} target="_blank" rel="noopener noreferrer">Complete subscription payment with Stripe</a>}
        <p className="text-app-muted">Contact Dispatra to pause or cancel your subscription.</p>
      </div>
      {!payment.setup_available && <p className="text-sm text-app-muted">Payment setup is currently unavailable. Contact Dispatra support.</p>}
      {payment.setup_available && configured && <label className="flex items-start gap-2 text-sm"><input className="mt-1 accent-black" type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} /><span>I authorize monthly automatic charges to this card at my company’s saved price per registered vehicle, starting after its free trial and continuing until the subscription is paused or cancelled.</span></label>}
      <div className="flex flex-wrap gap-3">
        {canEnroll && <Button disabled={busy || !consent || !payment.setup_available || !configured} onClick={() => enroll.mutate()}>{enroll.isPending ? 'Starting…' : 'Start subscription'}</Button>}
        <Button variant={canEnroll ? 'outline' : 'default'} disabled={busy || !consent || !payment.setup_available || !configured} onClick={() => setup.mutate()}>{setup.isPending ? 'Opening Stripe…' : payment.last4 ? 'Replace payment method' : 'Add payment method'}</Button>
        {confirm.isError && returnedSession && <Button variant="outline" disabled={busy} onClick={() => confirm.mutate(returnedSession)}>Verify card setup again</Button>}
      </div>
      {confirm.isPending && <p role="status" className="text-sm text-app-muted">Verifying your card with Stripe…</p>}
      {returnedSession === 'cancelled' && <p role="status" className="text-sm text-app-muted">Card setup was cancelled. Your saved payment method has not changed.</p>}
    </>}
  </section>;
}
