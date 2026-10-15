import { ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';

export function HeroWorkspaceEntry() {
  return <div id="workspace" className="mt-8 max-w-md scroll-mt-8">
    <Button asChild className="gap-2 px-5"><a href="/signup">Start Free Trial<ArrowRight className="size-4" aria-hidden="true" /></a></Button>
    <p className="mt-3 text-xs leading-5 text-app-muted">Start your 30-day trial. Already have an account? <a href="/login" className="underline underline-offset-4 hover:text-app-text">Sign in</a></p>
  </div>;
}
