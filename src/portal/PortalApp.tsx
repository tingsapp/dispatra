import React, { useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Users, UserRound } from 'lucide-react';
import { api, Account, ApiError, LoginInput } from './api';
import { LoginPage } from './LoginPage';
import { CustomerProfile } from './ProfilePage';
import { PasswordPage } from './PasswordPage';
import { CompanyPage } from './CompanyPage';
import { AccountCustomers } from './CustomersPage';
import { Button, Notice } from './ui';
import { PortalShell } from './PortalShell';
const cache = new QueryClient({ defaultOptions: { queries: { retry:false, gcTime:0, refetchOnWindowFocus:true }, mutations:{ retry:false, gcTime:0 } } });
export function parsePortal(path: string): { slug?: string; portal: LoginInput['portal']; settings: boolean } | null {
  if (/^\/platform(?:\/login)?\/?$/.test(path)) return { portal:'platform', settings:false };
  const match = path.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(dispatch|customer)(?:\/(login|settings))?\/?$/);
  return match ? { slug:match[1], portal:match[2] as 'dispatch'|'customer', settings:match[3] === 'settings' } : null;
}
export default function PortalApp() { return <QueryClientProvider client={cache}><Portal /></QueryClientProvider>; }
function Portal() {
  const route = parsePortal(location.pathname);
  const client = useQueryClient();
  const me = useQuery({ queryKey:['account'], queryFn:api.me, retry:false });
  const [settings, setSettings] = useState(route?.settings ?? false);
  const logout = useMutation({ mutationFn:api.logout, onSuccess: () => { client.clear(); location.assign(route?.portal === 'platform' ? '/platform' : `/${route?.slug}/${route?.portal}`); } });
  if (!route) return <main className="mx-auto max-w-lg px-6 py-24"><h1 className="text-3xl font-medium">Dispatra</h1><p className="mt-4 text-slate-600">Open the company portal link provided with your login details.</p><a className="mt-6 inline-block text-slate-700 underline underline-offset-4" href="/platform">Platform administration →</a></main>;
  if (me.isPending) return <p role="status" className="p-10">Loading your workspace…</p>;
  if (me.error && !(me.error instanceof ApiError && me.error.status === 401)) return <main className="mx-auto max-w-lg space-y-4 p-10"><Notice error={me.error} /><Button onClick={() => me.refetch()}>Try again</Button></main>;
  if (!me.data) return <LoginPage {...route} onLogin={() => { client.clear(); location.replace(route.portal === 'platform' ? '/platform' : `/${route.slug}/${route.portal}`); }} />;
  const account: Account = me.data;
  const role = { platform:'PLATFORM_OWNER', dispatch:'DISPATCHER', customer:'CUSTOMER' }[route.portal];
  if (account.role !== role || (route.slug && account.organization?.slug !== route.slug)) return <main className="mx-auto max-w-lg space-y-5 px-6 py-24"><h1 className="text-2xl font-medium">Sign in to this workspace</h1><p className="text-slate-600">You are currently signed in as {account.login_id}. Sign out to use a different company or account.</p><Notice error={logout.error} /><Button disabled={logout.isPending} onClick={() => logout.mutate()}>Sign out</Button></main>;
  const company = account.organization?.name ?? 'Platform administration';
  const primary = route.portal === 'platform' ? 'Companies' : route.portal === 'dispatch' ? 'Shippers' : 'My profile';
  const Icon = route.portal === 'platform' ? Building2 : route.portal === 'dispatch' ? Users : UserRound;
  return <PortalShell company={company} login={account.login_id} primary={primary} icon={Icon} settings={settings}
    onHome={() => setSettings(false)} onSettings={() => setSettings(true)} onLogout={() => logout.mutate()} loggingOut={logout.isPending}>
    <Notice error={logout.error} />
    {settings ? <PasswordPage /> : route.portal === 'platform' ? <CompanyPage /> : route.portal === 'dispatch' ? <AccountCustomers slug={route.slug!} /> : <CustomerProfile slug={route.slug!} />}
  </PortalShell>;
}
