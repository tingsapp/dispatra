import { ArrowRight } from 'lucide-react';
import { TrialOffer } from './TrialOffer';
import { Button } from '../ui/button';

export function HeroWorkspaceEntry() {
  return <TrialOffer>{offer => <div id="workspace" className="mt-7 scroll-mt-8">
    <div className="home-hero-actions"><Button asChild className="gap-2 px-5"><a href="/plans">{offer.enabled ? 'Start Free Trial' : 'View plans'}<ArrowRight className="size-4" aria-hidden="true" /></a></Button></div>
  </div>}</TrialOffer>;
}
