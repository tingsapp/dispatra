import { Building2, ChevronDown, FileText } from 'lucide-react';
import React,{ useId } from 'react';
import { PageHeader } from '../layout/PageHeader';

export type SettingsArea = 'company' | 'pricing';
export interface SettingsPageProps {
  onNotification?: (message: string) => void;
  onNavigateSettings?: (area: SettingsArea) => void;
}
/** The Organization Settings submenu: one entry per destination, in menu order. */
export const SETTINGS_AREAS = [
  { id: 'company', label: 'Company', description: 'Company details, taxes, currency, units and time zone.', icon: Building2 },
  { id: 'pricing', label: 'Pricing', description: 'Rate cards, service levels, fuel charges and Accessorials.', icon: FileText },
] as const;

export function SettingsLayout({ area, children }: SettingsPageProps & { area: SettingsArea; children: React.ReactNode }) {
  const current = SETTINGS_AREAS.find(item => item.id === area)!;
  return <div className={`app-page ${area === 'company' ? 'app-page-reading' : ''} h-full min-w-0 flex flex-col`}>
    <PageHeader title={current.label} description={current.description} />
    <main className="page-content flex-1 overflow-y-auto min-h-0 py-6"><div className="app-sections">{children}</div></main>
  </div>;
}

export function SettingsDisclosure({ title, description, children, defaultOpen = false }: { title: string; description?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const id = useId();
  return <details open={defaultOpen || undefined} className="app-disclosure group/settings">
    <summary aria-controls={id} className="app-disclosure-trigger list-none cursor-pointer flex items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
      <span><span className="app-section-title block">{title}</span>{description && <span className="block text-xs text-slate-500 mt-1">{description}</span>}</span>
      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open/settings:rotate-180" />
    </summary>
    <div id={id} className="app-disclosure-content space-y-5">{children}</div>
  </details>;
}
