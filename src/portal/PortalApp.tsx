import React, { useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, LogOut, Settings, Users, UserRound } from 'lucide-react';
import { api, Account, ApiError, LoginInput } from './api';
import { LoginPage } from './LoginPage';
import { CustomerProfile } from './ProfilePage';
import { PasswordPage } from './PasswordPage';
import { CompanyPage } from './CompanyPage';
import { AccountCustomers } from './CustomersPage';
import { Button, Notice } from './ui';
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
  if (!route) return <main className="mx-auto max-w-lg px-6 py-24"><h1 className="text-3xl font-semibold">Dispatra</h1><p className="mt-4 text-slate-600">Open the company portal link provided with your login details.</p><a className="mt-6 inline-block text-blue-600" href="/platform">Platform administration →</a></main>;
  if (me.isPending) return <p role="status" className="p-10">Loading your workspace…</p>;
  if (me.error && !(me.error instanceof ApiError && me.error.status === 401)) return <main className="mx-auto max-w-lg space-y-4 p-10"><Notice error={me.error} /><Button onClick={() => me.refetch()}>Try again</Button></main>;
  if (!me.data) return <LoginPage {...route} onLogin={() => { client.clear(); location.replace(route.portal === 'platform' ? '/platform' : `/${route.slug}/${route.portal}`); }} />;
  const account: Account = me.data;
  const role = { platform:'PLATFORM_OWNER', dispatch:'DISPATCHER', customer:'CUSTOMER' }[route.portal];
  if (account.role !== role || (route.slug && account.organization?.slug !== route.slug)) return <main className="mx-auto max-w-lg space-y-5 px-6 py-24"><h1 className="text-2xl font-semibold">Sign in to this workspace</h1><p className="text-slate-600">You are currently signed in as {account.login_id}. Sign out to use a different company or account.</p><Notice error={logout.error} /><Button disabled={logout.isPending} onClick={() => logout.mutate()}>Sign out</Button></main>;
  const company = account.organization?.name ?? 'Platform administration';
  const primary = route.portal === 'platform' ? 'Companies' : route.portal === 'dispatch' ? 'Customers' : 'My profile';
  const Icon = route.portal === 'platform' ? Building2 : route.portal === 'dispatch' ? Users : UserRound;
  return <div className="min-h-screen bg-slate-50"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4"><div><span className="text-xl font-semibold tracking-tight">Dispatra<span className="text-blue-600">.</span></span><span className="ml-4 text-sm text-slate-500">{company}</span></div><div className="flex items-center gap-3"><span className="text-xs text-slate-500">{account.login_id}</span><Button variant="ghost" disabled={logout.isPending} onClick={() => logout.mutate()}><LogOut size={15} />Sign out</Button></div></div></header>
    <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 md:grid-cols-[190px_1fr]"><nav aria-label="Portal navigation" className="flex gap-2 md:flex-col"><Button variant={!settings ? 'default':'ghost'} className="justify-start" onClick={() => setSettings(false)}><Icon size={16} />{primary}</Button><Button variant={settings ? 'default':'ghost'} className="justify-start" onClick={() => setSettings(true)}><Settings size={16} />Account settings</Button></nav><main className="min-w-0 space-y-6"><div><p className="text-xs font-medium uppercase tracking-wider text-blue-600">{route.portal === 'customer' ? 'Customer portal' : route.portal === 'dispatch' ? 'Dispatch workspace' : 'Platform owner'}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">{settings ? 'Account settings' : primary}</h1></div><Notice error={logout.error} />{settings ? <PasswordPage /> : route.portal === 'platform' ? <CompanyPage /> : route.portal === 'dispatch' ? <AccountCustomers slug={route.slug!} /> : <CustomerProfile slug={route.slug!} />}</main></div></div>;
}
