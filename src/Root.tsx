import React, { lazy, Suspense, useState } from 'react';
import { pageForPath } from './lib/pageRoutes';
import { loadSession, signOut } from './lib/sessionStorage';
import { LoginPage } from './pages/LoginPage';
const Prototype = lazy(() => import('./App'));
const Portal = lazy(() => import('./portal/PortalApp'));
export const LOGIN_PATH = '/login';
const isPrototypePath = (pathname: string) => pathname === LOGIN_PATH || pageForPath(pathname) !== undefined;
// Prototype browser data is never loaded into authenticated tenant/customer surfaces.
export default function Root() {
  const [session, setSession] = useState(loadSession);
  if (!isPrototypePath(location.pathname)) return <Suspense fallback={<p className="p-8" role="status">Loading Dispatra…</p>}><Portal /></Suspense>;
  // Dispatch pages need a signed-in dispatcher; without one the login page takes over the URL.
  if (!session) {
    if (location.pathname !== LOGIN_PATH) history.replaceState(null, '', LOGIN_PATH);
    return <LoginPage onSignedIn={next => { history.replaceState(null, '', '/'); setSession(next); }} />;
  }
  if (location.pathname === LOGIN_PATH) history.replaceState(null, '', '/');
  return <Suspense fallback={<p className="p-8" role="status">Loading Dispatra…</p>}><Prototype onSignOut={() => { signOut(); history.replaceState(null, '', LOGIN_PATH); setSession(null); }} /></Suspense>;
}
