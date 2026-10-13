import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Gift } from 'lucide-react';
import { PublicHeader } from '../components/home/PublicPageLayout';
import { PublicFooter } from '../components/home/PublicFooter';
import { Dialog, DialogHeader } from '../components/ui/Dialog';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import { api } from '../portal/api';
import { Button } from '../portal/ui';
import { QueryState } from '../portal/admin/QueryState';
import { SignupForm } from './SignupForm';
export { SignupForm } from './SignupForm';

export default function SignupPage() {
  const [cache] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } }));
  return <QueryClientProvider client={cache}><TrialPlansPage /></QueryClientProvider>;
}

const FEATURES = ['Orders from email and your shippers', 'Automatic and manual dispatch', 'Driver and shipper portals', 'Delivery tracking and proof of delivery'];

export function TrialPlansPage() {
  const plan = useQuery({ queryKey: ['public', 'subscription-plan'], queryFn: api.subscriptionPlan });
  const [signingUp, setSigningUp] = useState(false);
  const trialButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    // The trigger loses focus when its background becomes inert; restore it after dismissal removes inert.
    if (wasOpen.current && !signingUp) trialButton.current?.focus();
    wasOpen.current = signingUp;
  }, [signingUp]);
  return <div className="min-h-dvh bg-app-canvas font-sans text-app-text">
    <div inert={signingUp ? true : undefined}>
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-6 pb-14 pt-8 sm:pt-12 lg:px-10">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-700">SIMPLE MONTHLY PLAN</p>
          <h1 className="mt-4 text-4xl font-medium leading-tight tracking-tight sm:text-5xl">Start with a month on us.</h1>
          <p className="mx-auto mt-5 max-w-lg text-base leading-7 text-app-muted">One connected workspace for your delivery team. Try Dispatra free for 30 days, with no credit card required.</p>
        </header>
        <div className="mt-10"><QueryState query={plan} loading="Loading plans…" /></div>
        {plan.data && <section aria-label="Subscription plans" className="mt-2 grid items-stretch gap-6 md:grid-cols-2">
          <article className="app-panel flex flex-col !p-6 sm:!p-8">
            <p className="text-xs font-medium uppercase tracking-wider text-app-muted">YOUR SUBSCRIPTION</p>
            <h2 className="mt-3 text-2xl font-medium">Monthly plan</h2>
            <div className="mt-5">
              {plan.data.monthly_price === null
                ? <p className="text-2xl font-medium">Contact us for pricing</p>
                : <p><span className="text-4xl font-semibold tracking-tight">{new Intl.NumberFormat('en-CA', { style: 'currency', currency: plan.data.currency }).format(Number(plan.data.monthly_price))}</span><span className="ml-2 text-sm text-app-muted">{plan.data.currency} / month</span></p>}
              <p className="mt-2 text-sm text-app-muted">A monthly plan for your company.</p>
            </div>
            <ul className="mt-7 space-y-4 text-sm">{FEATURES.map(feature => <li key={feature} className="flex items-start gap-3"><Check className="mt-0.5 size-4 shrink-0 text-blue-700" aria-hidden="true" /><span>{feature}</span></li>)}</ul>
            <p className="mt-8 border-t border-slate-200 pt-5 text-sm leading-6 text-app-muted">Start with the free trial. After your trial, contact Dispatra to activate your monthly subscription.</p>
          </article>
          <article className="flex flex-col rounded-2xl border border-blue-200 bg-blue-50/60 p-6 sm:p-8">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-blue-700"><Gift className="size-4" aria-hidden="true" />TRY DISPATRA</div>
            <h2 className="mt-3 text-2xl font-medium">One month free trial</h2>
            <p className="mt-5"><span className="text-4xl font-semibold tracking-tight">Free</span><span className="ml-2 text-sm text-app-muted">for {plan.data.trial_days} days</span></p>
            <p className="mt-5 text-sm leading-6 text-app-muted">Set up your company, invite your delivery team, and try the full workflow before choosing to continue.</p>
            <ul className="mt-6 space-y-3 text-sm">{['No credit card required', 'Your own company workspace', 'No automatic charges'].map(feature => <li key={feature} className="flex items-start gap-3"><Check className="mt-0.5 size-4 shrink-0 text-blue-700" aria-hidden="true" />{feature}</li>)}</ul>
            <div className="mt-auto pt-8"><Button ref={trialButton} className="w-full" onClick={() => setSigningUp(true)}>Start free trial<ArrowRight className="size-4" aria-hidden="true" /></Button>
              <p className="mt-3 text-xs leading-5 text-app-muted">The trial starts after you verify your email. Access pauses after 30 days until your company is activated.</p>
            </div>
          </article>
        </section>}
        <p className="mt-8 text-center text-sm text-app-muted">Already have an account? <a href="/login" className="text-app-text underline underline-offset-4">Sign in</a></p>
        <a href="/" className="mx-auto mt-5 flex w-fit items-center gap-2 text-xs text-app-muted hover:text-app-text"><ArrowLeft className="size-3.5" aria-hidden="true" />Back to home</a>
      </main>
      <PublicFooter />
    </div>
    {signingUp && <SignupDialog onClose={() => setSigningUp(false)} />}
  </div>;
}

function SignupDialog({ onClose }: { onClose: () => void }) {
  const [pending, setPending] = useState(false);
  const close = () => { if (!pending) onClose(); };
  useEntityDialog(true, close);
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, []);
  return <Dialog size="md" onClose={close}>
    <DialogHeader title="Start your free trial" description="30 days to try Dispatra. No credit card required." onClose={close} closeDisabled={pending} />
    <SignupForm onPendingChange={setPending} />
  </Dialog>;
}
