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
          <h1 id="home-title">Your AI dispatcher<br />Your deliveries<br />Your control</h1>
          <p className="home-hero-description">Plan, assign, and track deliveries in one connected workspace, with AI helping you stay in control.</p>
          <HeroWorkspaceEntry />
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
