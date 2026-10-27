import React, { lazy, Suspense, useState } from 'react';
import { PageLoading } from './components/ui/PageLoading';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { pageForPath } from './lib/pageRoutes';
import { usePublicNavigation } from './lib/usePublicNavigation';
import { loadSession, signOut } from './lib/sessionStorage';
import { LoginPage } from './pages/LoginPage';
import { PublicHome } from './pages/PublicHome';
const Prototype = lazy(() => import('./App'));
const prototypeCache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const Signup = lazy(() => import('./pages/SignupPage'));
const Information = lazy(() => import('./pages/PublicInformationPage'));
const IntegrationGuide = lazy(() => import('./pages/IntegrationGuidePage'));
const Contact = lazy(() => import('./pages/ContactPage'));
const Legal = lazy(() => import('./pages/LegalPage'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmailPage'));
const Portal = lazy(() => import('./portal/PortalApp'));
export const PROTOTYPE_LOGIN_PATH = '/prototype/login';
const isPrototypePath = (pathname: string) => pathname === PROTOTYPE_LOGIN_PATH || pathname === '/prototype' || pathname.startsWith('/prototype/');
export default function Root() {
  const [session, setSession] = useState(loadSession);
  const publicLocation = usePublicNavigation();
  const publicPath = publicLocation.pathname;
  const publicKey = publicPath + publicLocation.search;
  if (publicPath === '/signup/verify') return <Suspense fallback={<PageLoading>Loading verification…</PageLoading>}><VerifyEmail /></Suspense>;
  if (publicPath === '/terms' || publicPath === '/privacy') return <Suspense key={publicKey} fallback={<PageLoading>Loading policy…</PageLoading>}><Legal policy={publicPath === '/terms' ? 'terms' : 'privacy'} /></Suspense>;
  if (publicPath === '/signup') {
    location.replace(`/plans${location.search}${location.hash}`);
    return <PageLoading>Opening plans…</PageLoading>;
  }
  if (publicPath === '/plans') return <Suspense key={publicKey} fallback={<PageLoading>Loading plans…</PageLoading>}><Signup /></Suspense>;
  if (publicPath === '/about' || publicPath === '/help') return <Suspense key={publicKey} fallback={<PageLoading>Loading Dispatra…</PageLoading>}><Information page={publicPath} /></Suspense>;
  if (publicPath === '/docs/integrations') return <Suspense key={publicKey} fallback={<PageLoading>Loading integration guide…</PageLoading>}><IntegrationGuide /></Suspense>;
  if (publicPath === '/ask-dispatra') return <Suspense key={publicKey} fallback={<PageLoading>Loading Ask dispatra…</PageLoading>}><Contact /></Suspense>;
  if (publicPath === '/') return <PublicHome />;
  if (!isPrototypePath(location.pathname)) return <Suspense fallback={<PageLoading>Loading Dispatra…</PageLoading>}><Portal /></Suspense>;
  if (location.pathname !== PROTOTYPE_LOGIN_PATH && pageForPath(location.pathname) === undefined) return <PublicHome />;
  if (!session) {
    if (location.pathname !== PROTOTYPE_LOGIN_PATH) history.replaceState(null, '', PROTOTYPE_LOGIN_PATH);
    return <LoginPage onSignedIn={next => { history.replaceState(null, '', '/prototype'); setSession(next); }} />;
  }
  if (location.pathname === PROTOTYPE_LOGIN_PATH) history.replaceState(null, '', '/prototype');
  return <Suspense fallback={<PageLoading>Loading Dispatra…</PageLoading>}><QueryClientProvider client={prototypeCache}><Prototype onSignOut={() => { signOut(); history.replaceState(null, '', PROTOTYPE_LOGIN_PATH); setSession(null); }} /></QueryClientProvider></Suspense>;
}
