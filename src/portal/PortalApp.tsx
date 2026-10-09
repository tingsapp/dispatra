import React, { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, Account, ApiError, LoginInput } from './api';
import { WorkspaceAccount } from './WorkspaceAccount';
import { ShipperPortal } from './ShipperPortal';
import { DriverPortal } from './DriverPortal';
import { LoginPage } from './LoginPage';
import { AdminPortal } from './admin/AdminPortal';
import { isAdminPath } from './admin/adminRoutes';
import { Button, Notice } from './ui';
import { companySlugForPath, pageForPath, roleHome } from '../lib/pageRoutes';
import { accountWorkspace } from '../lib/workspaceEntry';
import { PageLoading } from '../components/ui/PageLoading';
const Workspace = lazy(() => import('../App'));
const cache = new QueryClient({ defaultOptions: { queries: { retry:false, gcTime:0, refetchOnWindowFocus:true }, mutations:{ retry:false, gcTime:0 } } });
type PortalRoute = { slug?: string; portal: LoginInput['portal'] | 'driver'; workspace?: boolean };
/** Old portal URLs → clean ones: /{company}, /{company}/shipper, /{company}/driver. */
const LEGACY: Record<string, string> = {
  '/shipper-portal': '/shipper', '/shipper-portal/orders': '/shipper', '/shipper-portal/invoices': '/shipper', '/shipper/invoices': '/shipper', '/shipper-portal/profile': '/shipper/profile',
  '/shipper-portal/settings': '/shipper/profile', '/shipper-portal/payment-methods': '/shipper', '/shipper/orders': '/shipper', '/driver/orders': '/driver',
  '/customer': '/shipper', '/customer/login': '/shipper', '/customer/settings': '/shipper/profile', '/dispatch': '/', '/dispatch/login': '/', '/dispatch/settings': '/profile',
};
export function canonicalPortalPath(path: string): string | undefined {
  const slug = companySlugForPath(path);
  const next = slug ? LEGACY[path.slice(slug.length + 1).replace(/\/+$/, '')] : undefined;
  return next === undefined ? undefined : `/${slug}${next}`;
}
export function parsePortal(path: string): PortalRoute | null {
  if (isAdminPath(path)) return { portal:'platform' };
  const slug = companySlugForPath(path);
  if (!slug) return null;
  if (pageForPath(path)) return { slug, portal:'dispatch', workspace:true };
  if (new RegExp(`^/${slug}/driver(?:/profile)?/?$`).test(path)) return { slug, portal:'driver' };
  if (new RegExp(`^/${slug}/shipper(?:/(?:profile|tracking))?/?$`).test(path)) return { slug, portal:'customer' };
  return null;
}
const ROLE = { platform:'ADMIN', dispatch:'DISPATCHER', customer:'SHIPPER', driver:'DRIVER' } as const;
export { roleHome } from '../lib/pageRoutes';
const portalHome = (route: PortalRoute) => route.portal === 'platform' ? '/admin' : roleHome(route.slug!, ROLE[route.portal]);
export default function PortalApp() { return <QueryClientProvider client={cache}><Portal /></QueryClientProvider>; }
function Portal() {
  const legacy = canonicalPortalPath(location.pathname);
  if (legacy) history.replaceState(null, '', legacy + location.search + location.hash);
  let route = parsePortal(location.pathname);
  const client = useQueryClient();
  const me = useQuery({ queryKey:['account'], queryFn:api.me, retry:false });
  const logout = useMutation({ mutationFn:api.logout, onSuccess: () => { client.clear(); location.assign(route ? portalHome(route) : '/'); } });
  if (!route) return <main className="mx-auto max-w-lg px-6 py-24"><h1 className="text-3xl font-medium">Dispatra</h1><p className="mt-4 text-slate-600">Open the company portal link provided with your login details.</p><a className="mt-6 inline-block text-slate-700 underline underline-offset-4" href="/admin">Platform administration →</a></main>;
  if (me.isPending) return <PageLoading>Loading your workspace…</PageLoading>;
  if (me.error && !(me.error instanceof ApiError && me.error.status === 401)) return <main className="mx-auto max-w-lg space-y-4 p-10"><Notice error={me.error} /><Button onClick={() => me.refetch()}>Try again</Button></main>;
  // Owner deep links (/admin/companies/{id}) survive sign-in; other portals open their home page.
  if (!me.data) return <LoginPage slug={route.slug} portal={route.portal as LoginInput['portal']} onLogin={account => { client.clear(); location.replace(account.role === 'ADMIN' ? location.pathname : accountWorkspace(account) ?? '/'); }} />;
  const account: Account = me.data;
  // A signed-in account that opens another role's area of its own company goes to its own home.
  if (route.slug && account.organization?.slug === route.slug && account.role !== ROLE[route.portal]) {
    history.replaceState(null, '', roleHome(route.slug, account.role));
    route = parsePortal(location.pathname)!;
  }
  if (route.workspace) return account.role === 'DISPATCHER' && account.organization?.slug === route.slug
    ? <Suspense fallback={<PageLoading>Loading Monitor…</PageLoading>}><WorkspaceAccount key={account.id} account={account}><Workspace onSignOut={() => logout.mutate()} /></WorkspaceAccount></Suspense>
    : <main className="mx-auto max-w-lg space-y-5 px-6 py-24"><h1 className="text-2xl font-medium">Sign in to this workspace</h1><p className="text-slate-600">This account does not have dispatcher access to {route.slug}.</p><Button onClick={() => logout.mutate()}>Sign out</Button></main>;
  if (account.role !== ROLE[route.portal] || (route.slug && account.organization?.slug !== route.slug)) return <main className="mx-auto max-w-lg space-y-5 px-6 py-24"><h1 className="text-2xl font-medium">Sign in to this workspace</h1><p className="text-slate-600">You are currently signed in as {account.login_id}. Sign out to use a different company or account.</p><Notice error={logout.error} /><Button disabled={logout.isPending} onClick={() => logout.mutate()}>Sign out</Button></main>;
  if (route.portal === 'platform') return <AdminPortal account={account} onLogout={() => logout.mutate()} loggingOut={logout.isPending} logoutError={logout.error} />;
  if (route.portal === 'customer') return <ShipperPortal slug={route.slug!} company={account.organization?.name ?? 'Dispatra'} login={account.login_id} onLogout={() => logout.mutate()} loggingOut={logout.isPending} logoutError={logout.error} />;
  return <DriverPortal slug={route.slug!} company={account.organization?.name ?? 'Dispatra'} login={account.login_id} onLogout={() => logout.mutate()} loggingOut={logout.isPending} logoutError={logout.error} />;
}
