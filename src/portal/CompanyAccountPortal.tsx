import { useEffect, useState } from 'react';
import { Building2, Settings } from 'lucide-react';
import type { Account } from './api';
import { CompanyBillingContent } from './CompanyBillingContent';
import { PasswordPage } from './PasswordPage';
import { PortalShell } from './PortalShell';
import { Field, Notice } from './ui';

/** An ended trial retains account/billing navigation while operations remain paused. */
export function CompanyAccountPortal({ account, onLogout, loggingOut, logoutError }: { account: Account; onLogout: () => void; loggingOut: boolean; logoutError: unknown }) {
  const company = account.organization!;
  const root = `/${company.slug}`;
  const [path, setPath] = useState(() => location.pathname);
  const subscription = path === root + '/subscription';
  const settings = path === root + '/settings';
  const integration = path === root + '/integrations';
  const title = subscription ? 'Subscription' : settings ? 'Settings' : integration ? 'Integration' : 'Profile';
  useEffect(() => {
    const sync = () => setPath(location.pathname);
    window.addEventListener('popstate', sync);
    if (![root + '/profile', root + '/settings', root + '/subscription', root + '/integrations'].includes(location.pathname)) {
      history.replaceState(null, '', root + '/profile' + location.search + location.hash);
      sync();
    }
    return () => window.removeEventListener('popstate', sync);
  }, [root]);
  const navigate = (href: string) => { history.pushState(null, '', href); setPath(href); };
  return <PortalShell company={company.name} login={account.login_id} primary={title} icon={Building2} settings={false} reading
    description="Company account and subscription."
    account={{ name: account.display_name || account.login_id, role: 'Dispatcher', profileCurrent: !subscription && !settings && !integration, activeTab: subscription ? 'subscription' : settings ? 'rate-cards' : integration ? 'integrations' : 'profile', onSettings: () => navigate(root + '/settings'), onSubscription: () => navigate(root + '/subscription'), onIntegration: () => navigate(root + '/integrations') }}
    onHome={() => navigate(root + '/profile')} onSettings={() => navigate(root + '/profile')} onLogout={onLogout} loggingOut={loggingOut}
    navigation={[
      { label: 'Profile', href: root + '/profile', icon: Building2, current: !subscription && !settings && !integration },
      { label: 'Settings', href: root + '/settings', icon: Settings, current: settings },
    ]} onNavigate={navigate}>
    <p role="status" className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-app-muted">Review your subscription and complete any required payment in Subscription to resume operations.</p>
    <Notice error={logoutError} />
    {subscription ? <CompanyBillingContent target={{ kind: 'company', slug: company.slug }} />
      : integration ? <p className="text-sm text-app-muted">Integration will be available after your subscription payment is verified.</p>
      : settings ? <p className="text-sm text-app-muted">Workspace settings will be available after your subscription payment is verified.</p>
        : <div className="space-y-8"><section aria-label="Company account" className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" readOnly value={account.display_name} />
          <Field label="Company name" readOnly value={company.name} />
          <Field label="Email" readOnly value={account.login_id} />
          <Field label="Role" readOnly value="Dispatcher" />
        </section><PasswordPage plain /></div>}
  </PortalShell>;
}
