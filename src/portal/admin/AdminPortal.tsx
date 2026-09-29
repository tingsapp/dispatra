import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
import { api, type Account } from '../api';
import { PortalShell } from '../PortalShell';
import { Button, Notice } from '../ui';
import { ConfirmDialogHost } from '../../components/ui/ConfirmDialog';
import { adminHref, adminRoute, type AdminRoute } from './adminRoutes';
import { CompaniesPage } from './CompaniesPage';
import { CompanyDetailPage } from './CompanyDetailPage';
import { OwnerProfilePage } from './OwnerProfilePage';
import { companyKey } from './queryKeys';

/** Platform owner workspace. Every page is also enforced by ADMIN checks in the API. */
export function AdminPortal({ account, onLogout, loggingOut, logoutError }: { account: Account; onLogout: () => void; loggingOut: boolean; logoutError: unknown }) {
  const [path, setPath] = useState(() => location.pathname);
  const [creating, setCreating] = useState(false);
  useEffect(() => { const sync = () => setPath(location.pathname); window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync); }, []);
  const route = adminRoute(path);
  // Canonicalize /admin, /platform and /admin/login without adding a history entry.
  useEffect(() => { if (route?.page === 'companies' && path !== '/admin/companies') { history.replaceState(null, '', '/admin/companies'); setPath('/admin/companies'); } }, [route?.page, path]);
  const go = (next: AdminRoute) => { const href = adminHref(next); if (href !== location.pathname) history.pushState(null, '', href); setPath(href); setCreating(false); window.scrollTo(0, 0); };
  const companyId = route?.page === 'company' ? route.id : '';
  // Shares the detail page's cache entry so the header shows the company name.
  const company = useQuery({ queryKey: companyKey(companyId), queryFn: () => api.company(companyId), enabled: Boolean(companyId) }).data;
  const title = !route ? 'Page not found' : route.page === 'profile' ? 'Profile' : route.page === 'company' ? company?.name ?? 'Company' : 'Companies';
  const description = !route ? 'This administration page does not exist.' : route.page === 'profile' ? 'Your owner account and password.' : route.page === 'company' ? 'Company identity, access and dispatcher accounts.' : 'Dispatch companies on this Dispatra installation.';
  useEffect(() => { document.title = `${title} · Dispatra administration`; }, [title]);
  return <PortalShell company="Platform administration" login={account.login_id} primary={title} icon={Building2} settings={false} description={description}
    account={{ name: account.display_name || account.login_id, role: 'Platform owner', profileCurrent: route?.page === 'profile' }}
    navigation={[{ label: 'Companies', href: '/admin/companies', icon: Building2, current: route?.page === 'companies' || route?.page === 'company' }]}
    onNavigate={href => go(adminRoute(href) ?? { page: 'companies' })} onHome={() => go({ page: 'companies' })} onSettings={() => go({ page: 'profile' })}
    onLogout={onLogout} loggingOut={loggingOut}
    actions={route?.page === 'companies' ? <Button onClick={() => setCreating(true)}><Plus size={16} />Add company</Button>
      : route?.page === 'company' ? <Button variant="outline" onClick={() => go({ page: 'companies' })}>All companies</Button> : undefined}>
    <ConfirmDialogHost />
    <Notice error={logoutError} />
    {!route && <div className="py-10 text-center"><Button variant="outline" onClick={() => go({ page: 'companies' })}>Go to companies</Button></div>}
    {route?.page === 'companies' && <CompaniesPage creating={creating} onCreatingChange={setCreating} onOpen={id => go({ page: 'company', id })} />}
    {route?.page === 'company' && <CompanyDetailPage key={route.id} id={route.id} onBack={() => go({ page: 'companies' })} />}
    {route?.page === 'profile' && <OwnerProfilePage account={account} />}
  </PortalShell>;
}
