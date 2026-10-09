import React, { lazy, Suspense, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { pageForPath } from './lib/pageRoutes';
import { loadSession, signOut } from './lib/sessionStorage';
import { LoginPage } from './pages/LoginPage';
import { PublicHome } from './pages/PublicHome';
const Prototype = lazy(() => import('./App'));
const prototypeCache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const Portal = lazy(() => import('./portal/PortalApp'));
export const LOGIN_PATH = '/login';
const isPrototypePath = (pathname: string) => pathname === LOGIN_PATH || pathname === '/prototype' || pathname.startsWith('/prototype/');
export default function Root() {
  const [session, setSession] = useState(loadSession);
  const publicPath = location.pathname.replace(/\/+$/, '') || '/';
  if (['/', '/shipper', '/driver', '/dispatch'].includes(publicPath)) return <PublicHome initialRole={publicPath === '/shipper' ? 'shipper' : publicPath === '/driver' ? 'driver' : publicPath === '/dispatch' ? 'dispatcher' : undefined} />;
  if (!isPrototypePath(location.pathname)) return <Suspense fallback={<p className="p-8" role="status">Loading Dispatra…</p>}><Portal /></Suspense>;
  if (location.pathname !== LOGIN_PATH && pageForPath(location.pathname) === undefined) return <PublicHome />;
  if (!session) {
    if (location.pathname !== LOGIN_PATH) history.replaceState(null, '', LOGIN_PATH);
    return <LoginPage onSignedIn={next => { history.replaceState(null, '', '/prototype'); setSession(next); }} />;
  }
  if (location.pathname === LOGIN_PATH) history.replaceState(null, '', '/prototype');
  return <Suspense fallback={<p className="p-8" role="status">Loading Dispatra…</p>}><QueryClientProvider client={prototypeCache}><Prototype onSignOut={() => { signOut(); history.replaceState(null, '', LOGIN_PATH); setSession(null); }} /></QueryClientProvider></Suspense>;
}
