import { useRef, useState, type MouseEvent } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Mail, Route, ScanLine } from 'lucide-react';
import { MonitorPreview } from '../components/home/MonitorPreview';
import { HeroWorkspaceEntry } from '../components/home/HeroWorkspaceEntry';
import { PublicHeader, PublicHero } from '../components/home/PublicPageLayout';
import { accountWorkspace, type WorkspaceRole } from '../lib/workspaceEntry';
import { api } from '../portal/api';

const steps = [
  { icon: Mail, number: '01', title: 'Orders come in.', description: 'The email agent reads incoming order requests and brings them into your workspace.' },
  { icon: Route, number: '02', title: 'The right driver goes out.', description: 'The dispatch agent finds an eligible driver and assigns the order in Auto mode.' },
  { icon: ScanLine, number: '03', title: 'Every delivery comes together.', description: 'Drivers follow their routes, capture delivery proof, and complete each order.' },
];

export function PublicHome({ initialRole }: { initialRole?: WorkspaceRole }) {
  const [cache] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }));
  return <QueryClientProvider client={cache}><HomeContent initialRole={initialRole} /></QueryClientProvider>;
}
function HomeContent({ initialRole }: { initialRole?: WorkspaceRole }) {
  const workspaceInput = useRef<HTMLInputElement>(null);
  const focusWorkspace = (event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); workspaceInput.current?.focus(); };
  const account = useQuery({ queryKey: ['public', 'account'], queryFn: api.me });
  const resume = account.data?.role === 'ADMIN' ? undefined : accountWorkspace(account.data);
  return <div className="min-h-dvh bg-app-canvas font-sans text-app-text">
    <PublicHeader />
    <main>
      <PublicHero labelledBy="home-title">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-blue-700"><span className="size-1.5 rounded-full bg-blue-600" />AI FOR DELIVERY TEAMS</p>
          <h1 id="home-title" className="mt-6 max-w-xl text-[42px] font-medium leading-[1.08] tracking-[-0.045em] sm:text-[54px] lg:text-[58px]">From order to delivery.<br /><span className="text-app-muted">One clear workflow.</span></h1>
          <p className="mt-6 max-w-md text-base leading-7 text-app-muted">Read orders from email, assign the right driver, and follow every delivery through completion. Your whole team, in one connected workspace.</p>
          <HeroWorkspaceEntry initialRole={initialRole} inputRef={workspaceInput} />
        </div>
        <MonitorPreview />
      </PublicHero>
      <section id="how-it-works" aria-labelledby="workflow-title" className="mx-auto max-w-7xl scroll-mt-8 px-6 py-16 sm:py-20 lg:px-10">
        <div className="max-w-xl"><p className="text-xs font-medium uppercase tracking-[0.16em] text-app-muted">A SIMPLER DELIVERY DAY</p><h2 id="workflow-title" className="mt-3 text-3xl font-medium tracking-tight">Three steps. One connected team.</h2></div>
        <div className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-9">{steps.map(({ icon: Icon, number, title, description }) => <article key={number}><div className="flex items-center gap-3"><span className="inline-flex size-10 items-center justify-center rounded-xl bg-app-surface ring-1 ring-app-border"><Icon className="size-5" strokeWidth={1.5} aria-hidden="true" /></span><span className="text-xs tabular-nums text-slate-400">{number}</span></div><h3 className="mt-5 text-base font-medium tracking-tight">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-app-muted">{description}</p></article>)}</div>
      </section>
    </main>
    <footer className="mx-auto flex max-w-7xl flex-col gap-5 px-6 pb-8 pt-3 text-xs text-app-muted sm:flex-row sm:items-center sm:justify-between lg:px-10"><span>© {new Date().getFullYear()} Dispatra</span><a href={resume ?? '#workspace'} onClick={event => { if (!resume) focusWorkspace(event); }} className="w-fit hover:text-app-text">{resume ? 'Open my workspace' : 'Sign in to your workspace'}</a></footer>
  </div>;
}
