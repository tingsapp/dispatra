import { PanelLeft } from 'lucide-react';
import { AppBrand } from './AppBrand';

export function SidebarHeader({ collapsed, mobile, label, current, onHome, onToggle }: {
  collapsed: boolean; mobile: boolean; label: string; current: boolean; onHome: () => void; onToggle: () => void;
}) {
  const toggleLabel = mobile ? 'Hide menu' : 'Collapse menu';
  return <div className={collapsed ? 'flex h-16 shrink-0 items-center justify-center' : 'flex h-16 shrink-0 items-center gap-3 px-4'}>
    <AppBrand label={collapsed ? 'Expand menu' : label} current={!collapsed && current} compact={collapsed} onClick={collapsed ? onToggle : onHome} />
    {!collapsed && <button type="button" className="app-icon-button ml-auto"
      title={toggleLabel} aria-label={toggleLabel} aria-expanded onClick={onToggle}>
      <PanelLeft className="h-4.5 w-4.5 text-app-muted" strokeWidth={1.5} />
    </button>}
  </div>;
}
