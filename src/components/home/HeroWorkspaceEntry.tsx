import { ArrowRight } from 'lucide-react';
import { TrialOffer } from './TrialOffer';
import { Button } from '../ui/button';

export function HeroWorkspaceEntry() {
  return <TrialOffer>{offer => <div id="workspace" className="mt-7 scroll-mt-8">
    <div className="home-hero-actions"><Button asChild className="gap-2 px-5"><a href="/plans">{offer.enabled ? 'Start Free Trial' : 'View plans'}<ArrowRight className="size-4" aria-hidden="true" /></a></Button><Button asChild variant="outline"><a href="#how-it-works">See how it works<ArrowRight className="size-4" aria-hidden="true" /></a></Button></div>
    <p className="mt-3 text-xs leading-5 text-app-muted">{offer.enabled ? `${offer.days}-day trial · No credit card required to start.` : 'Review plans and current trial availability.'} Already a member? <a href="/login" className="underline underline-offset-4 hover:text-app-text">Sign in</a></p>
  </div>}</TrialOffer>;
}
