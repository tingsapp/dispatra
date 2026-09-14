import React, { lazy, Suspense } from 'react';
const Prototype = lazy(() => import('./App'));
const Portal = lazy(() => import('./portal/PortalApp'));
// Prototype browser data is never loaded into authenticated tenant/customer surfaces.
export default function Root() {
  return <Suspense fallback={<p className="p-8" role="status">Loading Dispatra…</p>}>{(location.pathname === '/' || location.pathname.startsWith('/prototype')) ? <Prototype /> : <Portal />}</Suspense>;
}
