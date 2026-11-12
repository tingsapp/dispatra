import { SidebarToggleIcon } from './WorkspaceIcon';
import { AppBrand } from './AppBrand';

export function SidebarHeader({ collapsed, mobile, label, current, onHome, onToggle }: {
  collapsed: boolean; mobile: boolean; label: string; current: boolean; onHome: () => void; onToggle: () => void;
}) {
  const toggleLabel = mobile ? 'Hide menu' : 'Collapse menu';
  return <div className={collapsed ? 'app-sidebar-header flex h-16 shrink-0 items-center justify-center' : 'app-sidebar-header flex h-16 shrink-0 items-center gap-3 px-4'}>
    <AppBrand label={collapsed ? 'Expand menu' : label} current={!collapsed && current} compact={collapsed} onClick={collapsed ? onToggle : onHome} />
    {!collapsed && <button type="button" className="app-icon-button app-sidebar-toggle ml-auto"
      title={toggleLabel} aria-label={toggleLabel} aria-expanded onClick={onToggle}>
      <SidebarToggleIcon className="h-4.5 w-4.5" strokeWidth={1.5} aria-hidden="true" />
    </button>}
  </div>;
}
