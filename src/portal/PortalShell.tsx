import { useState, type ReactNode } from 'react';
import { LogOut, PanelLeft, Settings, type LucideIcon } from 'lucide-react';
import { SidebarHeader } from '../components/layout/SidebarHeader';
import { AccountMenu } from '../components/layout/AccountMenu';
import { useSidebarDrawer } from '../components/layout/useSidebarDrawer';

const initials = (name: string) => name.trim().split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('') || '?';

/** Presentational workspace shell. Authentication and customer data remain in PortalApp. */
export function PortalShell({ company, login, primary, icon: Icon, settings, onHome, onSettings, onLogout, loggingOut, navigation, onNavigate, account, description, actions, headerActions, reading = false, map = false, footer, children }: {
  /** Sidebar controls under the Logout card (or the account card), such as the driver's duty switch. */
  footer?: (collapsed: boolean) => ReactNode;
  description?: string; reading?: boolean; actions?: ReactNode; onNavigate?: (href: string) => void;
  /** Persistent workspace controls aligned with the page's content width and gutters. */
  headerActions?: ReactNode;
  /** Edge-to-edge map canvas with workspace controls floating above it. */
  map?: boolean;
  /** Dispatcher-style account card with a Profile / Logout menu instead of the plain sign-out control. */
  account?: { name: string; role: string; profileCurrent: boolean };
  navigation?: { label: string; href: string; icon: LucideIcon; current: boolean }[];
  company: string; login: string; primary: string; icon: LucideIcon; settings: boolean;
  onHome: () => void; onSettings: () => void; onLogout: () => void; loggingOut: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(() => typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 768px)').matches : true);
  const { mobile, panelRef } = useSidebarDrawer(open, () => setOpen(false), '(max-width: 767px)');
  const [menuOpen, setMenuOpen] = useState(false);
  const collapsed = !open && !mobile;
  const hidden = !open && mobile;
  const navigate = (action: () => void) => {
    action();
    if (mobile) setOpen(false);
  };
  const PageHeading = headerActions ? 'div' : 'header';
  const menuButton = <button type="button" className={hidden ? 'app-icon-button' : 'hidden'} aria-hidden={!hidden} tabIndex={hidden ? 0 : -1} aria-label="Open menu" onClick={() => setOpen(true)}><PanelLeft className="h-4.5 w-4.5" strokeWidth={1.5} /></button>;

  return <div className="flex min-h-dvh bg-app-canvas text-app-text">
    {open && mobile && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/20 md:hidden" onClick={() => setOpen(false)} />}
    <aside ref={panelRef} role={open && mobile ? 'dialog' : undefined} aria-modal={open && mobile ? true : undefined} aria-label="Workspace sidebar" aria-hidden={hidden} inert={hidden} data-collapsed={collapsed}
      className={`app-portal-sidebar border-r border-app-border fixed inset-y-0 left-0 z-50 md:sticky md:top-0 transition-[width] duration-300 ${hidden ? 'hidden' : collapsed ? 'app-sidebar-rail' : ''}`}>
      <SidebarHeader collapsed={collapsed} mobile={mobile} label={`Dispatra — ${primary}`} current={!settings} onHome={() => navigate(onHome)} onToggle={() => setOpen(value => !value)} />
      <p className={collapsed ? 'sr-only' : 'truncate px-5 pb-4 text-xs text-app-muted'} title={company}>{company}</p>
      <nav aria-label="Portal navigation" className="space-y-0.5 px-2">
        {navigation ? navigation.map(({ label, href, icon: NavIcon, current }) => <a key={href} href={href} onClick={event => { if (!onNavigate || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate(() => onNavigate(href)); }} className="app-nav-item" aria-label={label} title={collapsed ? label : undefined} aria-current={current ? 'page' : undefined}><NavIcon size={18} strokeWidth={1.75} /><span className={collapsed ? 'sr-only' : undefined}>{label}</span></a>) : <>
        <button type="button" className="app-nav-item" aria-label={primary} title={collapsed ? primary : undefined} aria-current={!settings ? 'page' : undefined} onClick={() => navigate(onHome)}><Icon size={18} strokeWidth={1.75} /><span className={collapsed ? 'sr-only' : undefined}>{primary}</span></button>
        <button type="button" className="app-nav-item" aria-label="Account settings" title={collapsed ? 'Account settings' : undefined} aria-current={settings ? 'page' : undefined} onClick={() => navigate(onSettings)}><Settings size={18} strokeWidth={1.75} /><span className={collapsed ? 'sr-only' : undefined}>Account settings</span></button>
        </>}

      </nav>
      {account ? <div className="mt-auto p-2">
        <AccountMenu open={menuOpen} onOpenChange={setMenuOpen} modal={mobile} collapsed={collapsed} activeTab={account.profileCurrent ? 'profile' : ''}
          onProfile={() => navigate(onSettings)} onLogout={() => { if (!loggingOut) onLogout(); }}
          trigger={<button type="button" aria-expanded={menuOpen} aria-label={`${account.role} account`} title={`${account.role} account`} className="app-account-card group">
            <span className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-medium text-xs flex items-center justify-center shrink-0 uppercase">{initials(account.name)}</span>
            <span className={collapsed ? 'sr-only' : 'min-w-0 flex-1 text-left'}>
              <span className="app-account-name block text-sm font-medium text-slate-900 leading-snug truncate">{account.name}</span>
              <span className="block text-xs text-slate-500 truncate">{loggingOut ? 'Signing out…' : account.role}</span>
            </span>
          </button>} />
        {footer?.(collapsed)}
      </div> : footer ? <div className="mt-auto p-2">
        <button type="button" className="app-account-card border border-app-border bg-white shadow-sm hover:bg-white disabled:opacity-50" aria-label="Logout" title={collapsed ? 'Logout' : undefined} disabled={loggingOut} onClick={onLogout}><LogOut size={18} strokeWidth={1.75} className="shrink-0 text-slate-600" /><span className={collapsed ? 'sr-only' : 'text-sm font-medium text-slate-900'}>{loggingOut ? 'Logging out…' : 'Logout'}</span></button>
        {footer(collapsed)}
      </div> : <div className={`mt-auto space-y-2 ${collapsed ? 'p-2' : 'p-3'}`}>
        <p className={collapsed ? 'sr-only' : 'truncate px-2 text-xs text-app-muted'} title={login}>{login}</p>
        <button type="button" className="app-nav-item disabled:opacity-50" aria-label="Sign out" title={collapsed ? 'Sign out' : undefined} disabled={loggingOut} onClick={onLogout}><LogOut size={18} strokeWidth={1.75} /><span className={collapsed ? 'sr-only' : undefined}>Sign out</span></button>
      </div>}
    </aside>
    <div className={headerActions || map ? `relative flex h-dvh min-w-0 flex-1 flex-col ${settings || reading ? 'app-page-reading' : ''}` : 'contents'}>
      {headerActions && <header aria-label="Workspace header" className={map ? 'absolute inset-x-0 top-0 z-30 h-16 pointer-events-none' : 'app-workspace-header h-16 shrink-0 bg-app-canvas'}>
        <div className="page-content flex h-full items-center justify-between">
          <div className="pointer-events-auto">{menuButton}</div>
          <div className="flex min-w-0 items-center gap-2 pointer-events-auto">{headerActions}</div>
        </div>
      </header>}
    {map ? <main className="relative min-h-0 flex-1 overflow-hidden" aria-label={primary}>
      <h1 className="sr-only">{primary}</h1>{children}
    </main> : <>
    <div className={`app-page min-w-0 flex-1 flex flex-col ${settings || reading ? 'app-page-reading' : ''} ${headerActions ? 'app-page-with-header min-h-0' : 'min-h-dvh'}`}>
      <PageHeading className="app-page-header page-content">
        <div className="flex min-w-0 items-center gap-3">
          {!headerActions && menuButton}
          <div className="min-w-0"><h1 className="app-page-title">{settings ? 'Account settings' : primary}</h1><p className="mt-2 truncate text-base text-app-muted">{description ?? company}</p></div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </PageHeading>
      <main className="page-content space-y-6 py-6">{children}</main>
    </div>
    </>}
    </div>
  </div>;
}
