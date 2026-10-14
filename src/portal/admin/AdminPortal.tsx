import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Building2, CreditCard, CircleDollarSign, Plus, Wrench } from 'lucide-react';
import { api, type Account } from '../api';
import { PortalShell } from '../PortalShell';
import { Button, Notice } from '../ui';
import { ConfirmDialogHost } from '../../components/ui/ConfirmDialog';
import { adminHref, adminRoute, type AdminRoute } from './adminRoutes';
import { CompaniesPage } from './CompaniesPage';
import { CompanyDetailPage } from './CompanyDetailPage';
import { OwnerProfilePage } from './OwnerProfilePage';
import { SubscriptionBillingPage } from './SubscriptionBillingPage';
import { PlatformRevenuePage } from './PlatformRevenuePage';
import { companyKey, agentMonitorKey, agentKeys } from './queryKeys';
import { AgentMonitorPage } from './AgentMonitorPage';
import type { MonitorFocus } from './AgentDetailsDialog';
import { AdminNotificationBell } from './AdminNotificationBell';
import { StatusBadge } from './QueryState';

/** Platform owner workspace. Every page is also enforced by ADMIN checks in the API. */
export function AdminPortal({ account, onLogout, loggingOut, logoutError }: { account: Account; onLogout: () => void; loggingOut: boolean; logoutError: unknown }) {
  const [path, setPath] = useState(() => location.pathname);
  const [creating, setCreating] = useState(false);
  const [monitorFocus, setMonitorFocus] = useState<MonitorFocus | null>(null);
  useEffect(() => { const sync = () => setPath(location.pathname); window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync); }, []);
  const route = adminRoute(path);
  const monitor = useQuery({ queryKey: agentMonitorKey(account.id), queryFn: api.agentMonitor, refetchInterval: route?.page === 'monitor' ? 5_000 : 15_000 });
  const cache = useQueryClient();
  const platformCheck = useMutation({ mutationFn: () => api.runTechnicalCheck(crypto.randomUUID()), onSuccess: () => cache.invalidateQueries({ queryKey: agentKeys }) });
  const orderReview = useMutation({ mutationFn: () => api.runOperationalCheck(crypto.randomUUID()), onSuccess: () => cache.invalidateQueries({ queryKey: agentKeys }) });
  const operational = monitor.data?.agents.find(item => item.agent === 'OPERATIONAL');
  const reviewing = operational?.run && ['QUEUED', 'RUNNING'].includes(operational.run.status) && !operational.stale;
  const technical = monitor.data?.agents.find(item => item.agent === 'TECHNICAL');
  const checking = technical?.run && ['QUEUED', 'RUNNING'].includes(technical.run.status) && !technical.stale;
  useEffect(() => { if (route?.page !== 'monitor') { platformCheck.reset(); orderReview.reset(); } }, [route?.page, platformCheck.reset, orderReview.reset]);
  // Canonicalize /admin, /platform and /admin/login without adding a history entry.
  useEffect(() => { if (route?.page === 'companies' && path !== '/admin/companies') { history.replaceState(null, '', '/admin/companies'); setPath('/admin/companies'); } }, [route?.page, path]);
  const go = (next: AdminRoute) => { const href = adminHref(next); if (href !== location.pathname) history.pushState(null, '', href); setPath(href); setCreating(false); window.scrollTo(0, 0); };
  const companyId = route?.page === 'company' ? route.id : '';
  // Shares the detail page's cache entry so the header shows the company name.
  const company = useQuery({ queryKey: companyKey(companyId), queryFn: () => api.company(companyId), enabled: Boolean(companyId) }).data;
  const title = !route ? 'Page not found' : route.page === 'revenue' ? 'Revenue' : route.page === 'billing' ? 'Subscription' : route.page === 'monitor' ? 'Monitor' : route.page === 'profile' ? 'Profile' : route.page === 'company' ? company?.name ?? 'Company' : 'Companies';
  const description = !route ? 'This administration page does not exist.' : route.page === 'revenue' ? 'Expected recurring revenue.' : route.page === 'billing' ? 'Default monthly plan and free trial.' : route.page === 'monitor' ? 'Agent activity and platform health.' : route.page === 'profile' ? 'Your owner account and password.' : route.page === 'company' ? 'Company details, subscription and dispatcher account.' : 'Dispatch companies on this Dispatra installation.';
  useEffect(() => { document.title = `${title} · Dispatra administration`; }, [title]);
  return <PortalShell company="Platform administration" login={account.login_id} primary={title} icon={Building2} settings={false} description={description}
    titleBadge={route?.page === 'company' && company ? <StatusBadge active={company.active} inactiveLabel="Suspended" /> : undefined}
    account={{ name: account.display_name || account.login_id, role: 'Platform owner', profileCurrent: route?.page === 'profile' }}
    navigation={[{ label: 'Monitor', href: '/admin/monitor', icon: Activity, current: route?.page === 'monitor', badge: monitor.data?.needs_attention ?? 0,
      badgeLabel: monitor.data?.needs_attention === 1 ? 'report needs attention' : 'reports need attention' },
      { label: 'Companies', href: '/admin/companies', icon: Building2, current: route?.page === 'companies' || route?.page === 'company' },
      { label: 'Subscription', href: '/admin/billing', icon: CreditCard, current: route?.page === 'billing' },
      { label: 'Revenue', href: '/admin/revenue', icon: CircleDollarSign, current: route?.page === 'revenue' }]}
    onNavigate={href => go(adminRoute(href) ?? { page: 'companies' })} onHome={() => go({ page: 'companies' })} onSettings={() => go({ page: 'profile' })}
    onLogout={onLogout} loggingOut={loggingOut}
    headerActions={<AdminNotificationBell accountId={account.id} onOpenCompany={id => go({ page: 'company', id })} onOpenMonitor={() => { setMonitorFocus('ALL'); go({ page: 'monitor' }); }} onOpenOperational={() => { setMonitorFocus('OPERATIONAL'); go({ page: 'monitor' }); }} />}
    actions={route?.page === 'monitor' ? <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={orderReview.isPending || Boolean(reviewing)} onClick={() => orderReview.mutate()}>{orderReview.isPending || reviewing ? 'Order review queued or running' : 'Review orders'}</Button><Button type="button" size="sm" disabled={platformCheck.isPending || Boolean(checking)} onClick={() => platformCheck.mutate()}><Wrench size={15} />{platformCheck.isPending || checking ? 'Checks queued or running' : 'Run checks'}</Button></div>
      : route?.page === 'companies' ? <Button onClick={() => setCreating(true)}><Plus size={16} />Add company</Button>
      : route?.page === 'company' ? <Button variant="outline" onClick={() => go({ page: 'companies' })}>All companies</Button> : undefined}>

    <ConfirmDialogHost />
    <Notice error={logoutError} />
    {route?.page === 'monitor' && <Notice success={orderReview.isSuccess ? 'Operational order review requested.' : undefined} />}
    {!route && <div className="py-10 text-center"><Button variant="outline" onClick={() => go({ page: 'companies' })}>Go to companies</Button></div>}
    {route?.page === 'companies' && <CompaniesPage creating={creating} onCreatingChange={setCreating} onOpen={id => go({ page: 'company', id })} />}
    {route?.page === 'company' && <CompanyDetailPage key={`${route.id}:${route.tab ?? 'overview'}`} id={route.id} initialTab={route.tab} onBack={() => go({ page: 'companies' })} />}
    {route?.page === 'profile' && <OwnerProfilePage account={account} />}
    {route?.page === 'billing' && <SubscriptionBillingPage />}
    {route?.page === 'revenue' && <PlatformRevenuePage onOpenCompany={id => go({ page: 'company', id, tab: 'subscription' })} />}
    {route?.page === 'monitor' && <AgentMonitorPage query={monitor} accountId={account.id} focus={monitorFocus} onFocusChange={setMonitorFocus} checkError={platformCheck.error || orderReview.error} checkRequested={platformCheck.isSuccess} />}
  </PortalShell>;
}
