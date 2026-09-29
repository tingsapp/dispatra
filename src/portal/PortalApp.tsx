import React, { lazy, Suspense, useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, UserRound } from 'lucide-react';
import { api, Account, ApiError, LoginInput } from './api';
import { WorkspaceAccount } from './WorkspaceAccount';
import { ShipperPortal } from './ShipperPortal';
import { DriverPortal } from './DriverPortal';
import { AccountCustomers } from './CustomersPage';
import { LoginPage } from './LoginPage';
import { PasswordPage } from './PasswordPage';
import { AdminPortal } from './admin/AdminPortal';
import { isAdminPath } from './admin/adminRoutes';
import { Button, Notice } from './ui';
import { PortalShell } from './PortalShell';
import { companySlugForPath, pageForPath } from '../lib/pageRoutes';
const Workspace = lazy(() => import('../App'));
const cache = new QueryClient({ defaultOptions: { queries: { retry:false, gcTime:0, refetchOnWindowFocus:true }, mutations:{ retry:false, gcTime:0 } } });
type PortalRoute = { slug?: string; portal: LoginInput['portal'] | 'driver'; settings: boolean; workspace?: boolean };
export function parsePortal(path: string): PortalRoute | null {
  if (isAdminPath(path)) return { portal:'platform', settings:false };
  const slug = companySlugForPath(path);
  if (!slug) return null;
  if (pageForPath(path)) return { slug, portal:'dispatch', settings:false, workspace:true };
  if (new RegExp(`^/${slug}/driver/?$`).test(path)) return { slug, portal:'driver', settings:false };
  if (new RegExp(`^/${slug}/shipper-portal(?:/(?:profile|orders|invoices|payment-methods|settings))?/?$`).test(path)) return { slug, portal:'customer', settings:path.includes('/settings') };
  const legacy = path.match(new RegExp(`^/${slug}/(dispatch|customer)(?:/(login|settings))?/?$`));
  return legacy ? { slug, portal:legacy[1] as 'dispatch'|'customer', settings:legacy[2] === 'settings' } : null;
}
const portalHome = (route: PortalRoute) => route.portal === 'platform' ? '/admin' : route.portal === 'customer' ? `/${route.slug}/shipper-portal` : route.portal === 'driver' ? `/${route.slug}/driver` : `/${route.slug}/`;
export default function PortalApp() { return <QueryClientProvider client={cache}><Portal /></QueryClientProvider>; }
function Portal() {
  const route = parsePortal(location.pathname);
  const client = useQueryClient();
  const me = useQuery({ queryKey:['account'], queryFn:api.me, retry:false });
  const [settings, setSettings] = useState(route?.settings ?? false);
  const logout = useMutation({ mutationFn:api.logout, onSuccess: () => { client.clear(); location.assign(route ? portalHome(route) : '/'); } });
  if (!route) return <main className="mx-auto max-w-lg px-6 py-24"><h1 className="text-3xl font-medium">Dispatra</h1><p className="mt-4 text-slate-600">Open the company portal link provided with your login details.</p><a className="mt-6 inline-block text-slate-700 underline underline-offset-4" href="/admin">Platform administration →</a></main>;
  if (me.isPending) return <p role="status" className="p-10">Loading your workspace…</p>;
  if (me.error && !(me.error instanceof ApiError && me.error.status === 401)) return <main className="mx-auto max-w-lg space-y-4 p-10"><Notice error={me.error} /><Button onClick={() => me.refetch()}>Try again</Button></main>;
  // Owner deep links (/admin/companies/{id}) survive sign-in; other portals open their home page.
  if (!me.data) return <LoginPage slug={route.slug} portal={route.portal as LoginInput['portal']} onLogin={() => { client.clear(); location.replace(route.portal === 'platform' ? location.pathname : portalHome(route)); }} />;
  const account: Account = me.data;
  if (route.workspace) return account.role === 'DISPATCHER' && account.organization?.slug === route.slug
    ? <Suspense fallback={<p className="p-10" role="status">Loading Monitor…</p>}><WorkspaceAccount key={account.id} account={account}><Workspace onSignOut={() => logout.mutate()} /></WorkspaceAccount></Suspense>
    : <main className="mx-auto max-w-lg space-y-5 px-6 py-24"><h1 className="text-2xl font-medium">Sign in to this workspace</h1><p className="text-slate-600">This account does not have dispatcher access to {route.slug}.</p><Button onClick={() => logout.mutate()}>Sign out</Button></main>;
  const role = { platform:'ADMIN', dispatch:'DISPATCHER', customer:'SHIPPER', driver:'DRIVER' }[route.portal];
  if (account.role !== role || (route.slug && account.organization?.slug !== route.slug)) return <main className="mx-auto max-w-lg space-y-5 px-6 py-24"><h1 className="text-2xl font-medium">Sign in to this workspace</h1><p className="text-slate-600">You are currently signed in as {account.login_id}. Sign out to use a different company or account.</p><Notice error={logout.error} /><Button disabled={logout.isPending} onClick={() => logout.mutate()}>Sign out</Button></main>;
  if (route.portal === 'platform') return <AdminPortal account={account} onLogout={() => logout.mutate()} loggingOut={logout.isPending} logoutError={logout.error} />;
  if (route.portal === 'customer') return <ShipperPortal slug={route.slug!} company={account.organization?.name ?? 'Dispatra'} login={account.login_id} onLogout={() => logout.mutate()} loggingOut={logout.isPending} logoutError={logout.error} />;
  if (route.portal === 'driver') return <PortalShell company={account.organization?.name ?? 'Dispatra'} login={account.login_id} primary="My routes" icon={UserRound} settings={settings} onHome={() => setSettings(false)} onSettings={() => setSettings(true)} onLogout={() => logout.mutate()} loggingOut={logout.isPending}><Notice error={logout.error} />{settings ? <PasswordPage /> : <DriverPortal slug={route.slug!} />}</PortalShell>;
  return <PortalShell company={account.organization?.name ?? 'Dispatra'} login={account.login_id} primary="Shippers" icon={Users} settings={settings}
    onHome={() => setSettings(false)} onSettings={() => setSettings(true)} onLogout={() => logout.mutate()} loggingOut={logout.isPending}>
    <Notice error={logout.error} />
    {settings ? <PasswordPage /> : <AccountCustomers slug={route.slug!} />}
  </PortalShell>;
}
