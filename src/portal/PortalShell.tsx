import { useState, type ReactNode } from 'react';
import { LogOut, PanelLeft, Settings, type LucideIcon } from 'lucide-react';
import { SidebarHeader } from '../components/layout/SidebarHeader';
import { useSidebarDrawer } from '../components/layout/useSidebarDrawer';

/** Presentational workspace shell. Authentication and customer data remain in PortalApp. */
export function PortalShell({ company, login, primary, icon: Icon, settings, onHome, onSettings, onLogout, loggingOut, children }: {
  company: string; login: string; primary: string; icon: LucideIcon; settings: boolean;
  onHome: () => void; onSettings: () => void; onLogout: () => void; loggingOut: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(() => typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 768px)').matches : true);
  const { mobile, panelRef } = useSidebarDrawer(open, () => setOpen(false), '(max-width: 767px)');
  const collapsed = !open && !mobile;
  const hidden = !open && mobile;
  const navigate = (action: () => void) => {
    action();
    if (mobile) setOpen(false);
  };

  return <div className="flex min-h-dvh bg-app-canvas text-app-text">
    {open && mobile && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/20 md:hidden" onClick={() => setOpen(false)} />}
    <aside ref={panelRef} role={open && mobile ? 'dialog' : undefined} aria-modal={open && mobile ? true : undefined} aria-label="Workspace sidebar" aria-hidden={hidden} inert={hidden} data-collapsed={collapsed}
      className={`app-portal-sidebar border-r border-app-border fixed inset-y-0 left-0 z-50 md:sticky md:top-0 transition-[width] duration-300 ${hidden ? 'hidden' : collapsed ? 'app-sidebar-rail' : ''}`}>
      <SidebarHeader collapsed={collapsed} mobile={mobile} label={`Dispatra — ${primary}`} current={!settings} onHome={() => navigate(onHome)} onToggle={() => setOpen(value => !value)} />
      <p className={collapsed ? 'sr-only' : 'truncate px-5 pb-4 text-xs text-app-muted'} title={company}>{company}</p>
      <nav aria-label="Portal navigation" className="space-y-0.5 px-2">
        <button type="button" className="app-nav-item" aria-label={primary} title={collapsed ? primary : undefined} aria-current={!settings ? 'page' : undefined} onClick={() => navigate(onHome)}><Icon size={18} strokeWidth={1.75} /><span className={collapsed ? 'sr-only' : undefined}>{primary}</span></button>
        <button type="button" className="app-nav-item" aria-label="Account settings" title={collapsed ? 'Account settings' : undefined} aria-current={settings ? 'page' : undefined} onClick={() => navigate(onSettings)}><Settings size={18} strokeWidth={1.75} /><span className={collapsed ? 'sr-only' : undefined}>Account settings</span></button>
      </nav>
      <div className={`mt-auto space-y-2 ${collapsed ? 'p-2' : 'p-3'}`}>
        <p className={collapsed ? 'sr-only' : 'truncate px-2 text-xs text-app-muted'} title={login}>{login}</p>
        <button type="button" className="app-nav-item disabled:opacity-50" aria-label="Sign out" title={collapsed ? 'Sign out' : undefined} disabled={loggingOut} onClick={onLogout}><LogOut size={18} strokeWidth={1.75} /><span className={collapsed ? 'sr-only' : undefined}>Sign out</span></button>
      </div>
    </aside>
    <div className={settings ? "app-page app-page-reading min-w-0 flex-1 flex flex-col min-h-dvh" : "app-page min-w-0 flex-1 flex flex-col min-h-dvh"}>
      <header className="app-page-header page-content">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" className={hidden ? 'app-icon-button' : 'hidden'} aria-hidden={!hidden} tabIndex={hidden ? 0 : -1} aria-label="Open menu" onClick={() => setOpen(true)}><PanelLeft className="h-4.5 w-4.5" strokeWidth={1.5} /></button>
          <div className="min-w-0"><h1 className="app-page-title">{settings ? 'Account settings' : primary}</h1><p className="mt-2 truncate text-base text-app-muted">{company}</p></div>
        </div>
      </header>
      <main className="page-content space-y-6 py-6">{children}</main>
    </div>
  </div>;
}
