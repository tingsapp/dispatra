import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import { operations } from '../operations/api';
import { Button, Card, Notice } from './ui';

export function ShipperPaymentMethods({ slug }: { slug: string }) {
  const query = useQuery({ queryKey: ['shipper-payment-methods', slug], queryFn: () => operations.shipperPaymentMethods(slug) });
  const [consent, setConsent] = useState(false);
  const key = useRef<string | null>(null);
  const setup = useMutation({
    mutationFn: () => operations.setupShipperCard(slug, key.current ??= crypto.randomUUID()),
    onSuccess: data => { location.assign(data.url); },
  });
  if (query.isPending) return <p role="status">Loading payment methods…</p>;
  if (query.error) return <><Notice error={query.error} /><Button onClick={() => query.refetch()}>Try again</Button></>;
  const { terms, configured, test_mode: testMode, cards } = query.data;
  const cancelled = new URLSearchParams(location.search).get('card_setup') === 'cancelled';
  return <div className="space-y-10">
    <Card plain title="Pay by invoice" description="Your payment terms are managed by your dispatch company.">
      <p className="text-sm">{terms === 'COD' ? 'Payment due on delivery' : /^NET\d+$/.test(terms) ? `Payment due within ${terms.slice(3)} days` : terms}</p>
      <p className="mt-2 text-sm text-app-muted">Contact your dispatch company to change these terms.</p>
    </Card>
    <Card plain title="Credit cards" description="Save a card securely with Stripe for future payments to your dispatch company.">
      <div className="space-y-4">
        {configured && testMode && <p className="text-sm text-app-muted">Test mode — use Stripe test cards only.</p>}
        {cancelled && <p role="status" className="text-sm text-app-muted">Card setup was cancelled.</p>}
        {cards.map(card => <div key={card.id} className="flex items-center gap-3 py-3">
          <CreditCard size={20} aria-hidden="true" /><div><p className="text-sm font-medium"><span className="capitalize">{card.brand}</span> ending in {card.last4}</p><p className="text-xs text-app-muted">Expires {String(card.exp_month).padStart(2, '0')}/{card.exp_year}</p></div>
        </div>)}
        {!cards.length && <p className="text-sm text-app-muted">No saved credit cards.</p>}
        {configured ? <>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5" checked={consent} onChange={event => setConsent(event.target.checked)} />I agree to save my card for future payments I authorize to this dispatch company.</label>
          <Notice error={setup.error} />
          <Button disabled={!consent || setup.isPending || setup.isSuccess} onClick={() => setup.mutate()}>{setup.isPending || setup.isSuccess ? 'Opening Stripe…' : 'Add credit card'}</Button>
          <p className="text-xs text-app-muted">You’ll enter your card details on Stripe. Saving a card does not charge it or change your invoice terms.</p>
        </> : <p className="text-sm text-app-muted">Your dispatch company has not enabled card setup yet.</p>}
      </div>
    </Card>
  </div>;
}
