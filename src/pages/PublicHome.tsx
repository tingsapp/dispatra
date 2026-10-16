import { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { WhyDispatra } from '../components/home/WhyDispatra';
import { DeliveryDemo } from '../components/home/DeliveryDemo';
import { HomePlans } from '../components/home/HomePlans';
import { HomeTeam } from '../components/home/HomeTeam';
import { HomeClosing, HomeQuestions } from '../components/home/HomeQuestions';
import { HeroWorkspaceEntry } from '../components/home/HeroWorkspaceEntry';
import { PublicHeader, PublicHero } from '../components/home/PublicPageLayout';
import { PublicFooter } from '../components/home/PublicFooter';
import { accountWorkspace } from '../lib/workspaceEntry';
import { api } from '../portal/api';

export function PublicHome() {
  const [cache] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }));
  return <QueryClientProvider client={cache}><HomeContent /></QueryClientProvider>;
}
function HomeContent() {
  const account = useQuery({ queryKey: ['public', 'account'], queryFn: api.me });
  const resume = account.data?.role === 'ADMIN' ? undefined : accountWorkspace(account.data);
  return <div className="public-site home-page min-h-dvh bg-app-canvas font-sans text-app-text">
    <PublicHeader navigation />
    <main>
      <PublicHero labelledBy="home-title" centered>
        <div>
          <p className="home-eyebrow">AI for delivery teams</p>
          <h1 id="home-title">From order to delivery.<br /><span>One clear workflow.</span></h1>
          <p className="home-hero-description">Bring orders, dispatch, routes, and proof of delivery together. Run your operation in Dispatra, or connect Smart Dispatching to your existing TMS.</p>
          <HeroWorkspaceEntry />
          <div className="home-hero-paths"><a href="#home-plan-full">The full TMS workspace <span aria-hidden="true">↗</span></a><span aria-hidden="true" /><a href="#home-plan-dispatch">Smart Dispatching for your TMS <span aria-hidden="true">↗</span></a></div>
        </div>
      </PublicHero>
      <DeliveryDemo />
      <WhyDispatra />
      <HomePlans />
      <HomeTeam />
      <HomeQuestions />
      <HomeClosing />
    </main>
    <PublicFooter workspaceHref={resume} />
  </div>;
}
