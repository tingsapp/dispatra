import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { operations } from '../operations/api';
import { ClipboardList, UserRound, Shield, Plus, MapPin } from 'lucide-react';
import { PortalShell } from './PortalShell';
import { CustomerProfile } from './ProfilePage';
import { PasswordPage } from './PasswordPage';
import { ShipperOrders } from './ShipperOrders';
import { ShipperTracking } from './ShipperTracking';
import { Button, Notice } from './ui';
import { NotificationBell } from './Notifications';
import { useSync } from './sync';

export const shipperPages = [
  { path: 'orders', label: 'Orders', icon: ClipboardList },
  { path: 'tracking', label: 'Tracking', icon: MapPin },
  { path: 'profile', label: 'Profile', icon: UserRound },
];
export function ShipperPortal({ slug, company, login, onLogout, loggingOut, logoutError }: {
  slug: string; company: string; login: string; onLogout: () => void; loggingOut: boolean; logoutError: unknown;
}) {
  const [profileSection, setProfileSection] = useState<'details' | 'security'>('details');
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [url, setUrl] = useState(() => new URL(location.href));
  useEffect(() => { const sync = () => setUrl(new URL(location.href)); window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync); }, []);
  const go = (href: string) => { if (href !== location.pathname + location.search) history.pushState(null, '', href); setUrl(new URL(location.href)); window.scrollTo(0, 0); };
  useSync(slug, 'SHIPPER');
  const profile = useQuery({ queryKey: ['shipper-profile', slug], queryFn: () => operations.ownShipper(slug) });
  const base = `/${slug}/shipper`;
  const suffix = url.pathname.replace(/\/+$/, '').split('/')[3];
  const page = shipperPages.find(item => item.path === suffix) ?? shipperPages[0];
  return <PortalShell company={company} login={login} primary={page.label} icon={page.icon} settings={false}
    headerActions={<NotificationBell slug={slug} surface onOpen={() => go(base)} />}
    actions={page.path === 'orders' && <Button onClick={() => setNewOrderOpen(true)}><Plus size={16} />New order</Button>}
    reading={page.path !== 'orders'}
    account={{ name: profile.data?.name || login, role: 'Shipper', profileCurrent: page.path === 'profile' }}
    description={page.path === 'profile' ? 'Your details and account security.' : page.path === 'tracking' ? 'Follow your order from pickup to delivery.' : 'Create and track your deliveries.'}
    navigation={shipperPages.filter(item => item.path !== 'profile').map(item => ({ ...item, href: item.path === 'orders' ? base : `${base}/${item.path}`, current: item.path === page.path }))}
    onNavigate={go} onHome={() => go(base)} onSettings={() => go(`${base}/profile`)} onLogout={onLogout} loggingOut={loggingOut}>
    <Notice error={logoutError} />
    {page.path === 'profile' && <>
      <div className="flex items-center gap-2" aria-label="Profile sections">
        <button type="button" className="app-tab inline-flex items-center gap-2" aria-pressed={profileSection === 'details'} onClick={() => setProfileSection('details')}><UserRound size={14} />Details</button>
        <button type="button" className="app-tab inline-flex items-center gap-2" aria-pressed={profileSection === 'security'} onClick={() => setProfileSection('security')}><Shield size={14} />Security</button>
      </div>
      <div hidden={profileSection !== 'details'}><CustomerProfile slug={slug} /></div>
      {profileSection === 'security' && <PasswordPage plain />}
    </>}
    {page.path === 'orders' && <ShipperOrders slug={slug} open={newOrderOpen} onClose={() => setNewOrderOpen(false)} onNavigate={go} />}
    {page.path === 'tracking' && <ShipperTracking slug={slug} orderId={url.searchParams.get('order')} onSelect={id => go(`${base}/tracking?order=${encodeURIComponent(id)}`)} />}
  </PortalShell>;
}
