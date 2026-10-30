import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Gift } from 'lucide-react';
import { PublicHeader, PublicPageIntro } from '../components/home/PublicPageLayout';
import { Button as LinkButton } from '../components/ui/button';
import { PublicFooter } from '../components/home/PublicFooter';
import { Dialog, DialogHeader } from '../components/ui/Dialog';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import { api } from '../portal/api';
import { QueryState } from '../portal/admin/QueryState';
import { SignupForm } from './SignupForm';
export { SignupForm } from './SignupForm';

export default function SignupPage() {
  const [cache] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } }));
  return <QueryClientProvider client={cache}><TrialPlansPage /></QueryClientProvider>;
}

const PLANS = [
  { id: 'full', title: 'Full Workspace', label: 'AI DISPATCH + BUILT-IN WORKSPACE', description: 'Automate driver assignment and route planning, with your orders and team managed in Dispatra.', features: ['Built-in order, driver, and vehicle workspace', 'AI-powered automatic dispatch with manual control', 'Orders, fleet and customer management', 'Driver and shipper portals', 'Delivery tracking and proof of delivery'] },
  { id: 'dispatch', title: 'AI Dispatch', label: 'CONNECT YOUR EXISTING TMS', description: 'Explore adding Dispatra’s AI dispatcher to your existing TMS. Our team can confirm compatibility and connection options.', features: ['AI-powered automatic dispatch with manual control', 'External TMS connection options', 'Route optimization', 'Driver delivery workflow', 'Delivery tracking and proof of delivery'] },
] as const;

export function TrialPlansPage() {
  const plan = useQuery({ queryKey: ['public', 'subscription-plan'], queryFn: api.subscriptionPlan, refetchInterval: 30000 });
  const [signingUp, setSigningUp] = useState(false);
  const trialButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    // The trigger loses focus when its background becomes inert; restore it after dismissal removes inert.
    if (wasOpen.current && !signingUp) trialButton.current?.focus();
    wasOpen.current = signingUp;
  }, [signingUp]);
  return <div className="public-site min-h-dvh bg-app-canvas font-sans text-app-text">
    <div inert={signingUp ? true : undefined}>
      <PublicHeader />
      <main className="public-page-main public-plans-main">
        <PublicPageIntro eyebrow="Plans for automated dispatch" title="Put AI to work on your dispatch." description="Start with AI dispatch and a built-in workspace, or explore connecting Dispatra to your existing TMS." />
        <div><QueryState query={plan} loading="Loading plans…" /></div>
        <section aria-label="Subscription plans" className="public-plan-grid">
          {PLANS.map(option => {
            const price = option.id === 'full' ? plan.data?.monthly_price : plan.data?.dispatch_monthly_price;
            const currency = option.id === 'full' ? plan.data?.currency : plan.data?.dispatch_currency;
            return <article id={`plan-${option.id}`} key={option.id} className="public-plan-card">
            <p className="home-eyebrow">{option.label}</p>
            <h2>{option.title}</h2>
            <p>{option.description}</p>
            <div className="mt-6">
              {price != null && currency
                ? <p><span className="text-4xl font-medium tracking-tight">{new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(Number(price))}</span><span className="mt-2 block text-sm text-app-muted">{currency} / vehicle / month</span></p>
                : <p className="text-xl font-medium">Contact us for pricing</p>}
            </div>
            <ul className="my-7 space-y-4 text-sm">{option.features.map(feature => <li key={feature} className="flex items-start gap-3"><Check className="mt-0.5 size-4 shrink-0 text-app-accent" aria-hidden="true" /><span>{feature}</span></li>)}</ul>
            <div className="mt-auto pt-3"><LinkButton asChild className="w-full"><a href={`/contact?plan=${option.id}`}>Contact now<ArrowRight className="size-4" aria-hidden="true" /></a></LinkButton></div>
          </article>; })}
        </section>
        {plan.data && plan.data.trial_enabled !== false && <section aria-labelledby="trial-title" className="public-trial-panel">
          <div className="max-w-xl">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-app-accent"><Gift className="size-4" aria-hidden="true" />TRY DISPATRA</p>
            <h2 id="trial-title" className="mt-3 text-2xl font-medium">{plan.data.trial_days === 30 ? 'One month free trial' : `${plan.data.trial_days}-day free trial`}</h2>
            <p className="mt-3 text-sm leading-6 text-app-muted">Try Dispatra free for {plan.data.trial_days} days. No credit card required. Choose whether to use the built-in Dispatra workspace when you sign up.</p>
            <p className="mt-2 text-xs leading-5 text-app-muted">The trial starts after you verify your email. After {plan.data.trial_days} days, authorize monthly per-vehicle billing to continue.</p>
          </div>
          <LinkButton ref={trialButton} className="hero-get-started shrink-0" onClick={() => setSigningUp(true)}><span>Start free trial</span><span className="hero-get-started-icon"><ArrowUpRight className="size-4" aria-hidden="true" /></span></LinkButton>
        </section>}
        <p className="mt-8 text-center text-sm text-app-muted">Already have an account? <a href="/login" className="text-app-text underline underline-offset-4">Sign in</a></p>
        <a href="/" className="mx-auto mt-5 flex w-fit items-center gap-2 text-xs text-app-muted hover:text-app-text"><ArrowLeft className="size-3.5" aria-hidden="true" />Back to home</a>
      </main>
      <PublicFooter />
    </div>
    {signingUp && plan.data && <SignupDialog trialDays={plan.data.trial_days} trialEnabled={plan.data.trial_enabled !== false} onClose={() => setSigningUp(false)} />}
  </div>;
}

function SignupDialog({ onClose, trialDays, trialEnabled }: { onClose: () => void; trialDays: number; trialEnabled: boolean }) {
  const [pending, setPending] = useState(false);
  const close = () => { if (!pending) onClose(); };
  useEntityDialog(true, close);
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, []);
  return <Dialog size="md" onClose={close}>
    <DialogHeader title="Start your free trial" description={`${trialDays} days to try Dispatra. No credit card required.`} onClose={close} closeDisabled={pending} />
    <SignupForm trialDays={trialDays} trialEnabled={trialEnabled} onPendingChange={setPending} />
  </Dialog>;
}
