import { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { WhyDispatra } from '../components/home/WhyDispatra';
import { StackedAgentFeatures } from '../components/home/StackedAgentFeatures';
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
          <h1 id="home-title">AI that runs your dispatch while keeping you in control</h1>
          <p className="home-hero-description">From incoming orders to automatic assignment and optimized routes, Dispatra’s AI agents work together to make delivery management fast and smooth.</p>
          <HeroWorkspaceEntry />
        </div>
      </PublicHero>
      <StackedAgentFeatures />
      <WhyDispatra />
      <HomePlans />
      <HomeTeam />
      <HomeQuestions />
      <HomeClosing />
    </main>
    <PublicFooter workspaceHref={resume} />
  </div>;
}
