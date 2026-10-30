import { ArrowUpRight } from 'lucide-react';
import { TrialOffer } from './TrialOffer';
import { Button } from '../ui/button';

export function HeroWorkspaceEntry() {
  return <TrialOffer>{offer => <div id="workspace" className="mt-7 scroll-mt-8">
    <div className="home-hero-actions"><Button asChild className="hero-get-started"><a href="/plans"><span>{offer.enabled ? 'Get Started' : 'View plans'}</span><span className="hero-get-started-icon"><ArrowUpRight className="size-4" aria-hidden="true" /></span></a></Button></div>
  </div>}</TrialOffer>;
}
