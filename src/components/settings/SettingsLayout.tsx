import { Building2, ChevronDown, FileText, Receipt, Tag } from 'lucide-react';
import React,{ useId } from 'react';
import { PageHeader } from '../layout/PageHeader';

export type SettingsArea = 'company' | 'services' | 'pricing' | 'billing';
export interface SettingsPageProps {
  onBackToMonitor: () => void;
  onNotification?: (message: string) => void;
  onNavigateSettings?: (area: SettingsArea) => void;
}
/** The Organization Settings submenu: one entry per destination, in menu order. */
export const SETTINGS_AREAS = [
  { id: 'company', label: 'Company', description: 'Company details, tax number, currency, units and time zone.', icon: Building2 },
  { id: 'services', label: 'Services & Dispatch', description: 'Delivery services, vehicle types and assignment rules.', icon: Tag },
  { id: 'pricing', label: 'Pricing', description: 'Rate cards, zones, Accessorials, extras and internal costs.', icon: FileText },
  { id: 'billing', label: 'Billing', description: 'Payment terms and taxes.', icon: Receipt },
] as const;

export function SettingsLayout({ area, onBackToMonitor, children }: SettingsPageProps & { area: SettingsArea; children: React.ReactNode }) {
  const current = SETTINGS_AREAS.find(item => item.id === area)!;
  return <div className="h-full min-w-0 flex flex-col bg-slate-50">
    <PageHeader title={current.label} description={current.description} onBackToMonitor={onBackToMonitor} />
    <main className="page-content flex-1 overflow-y-auto min-h-0 py-6"><div className="space-y-8">{children}</div></main>
  </div>;
}

export function SettingsDisclosure({ title, description, children, defaultOpen = false }: { title: string; description?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const id = useId();
  return <details open={defaultOpen || undefined} className="group/settings rounded-xl border border-slate-200 bg-white">
    <summary aria-controls={id} className="list-none cursor-pointer flex items-center justify-between gap-4 p-4 sm:p-5 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 [&::-webkit-details-marker]:hidden">
      <span><span className="block text-sm font-semibold text-slate-900">{title}</span>{description && <span className="block text-xs text-slate-500 mt-1">{description}</span>}</span>
      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open/settings:rotate-180" />
    </summary>
    <div id={id} className="border-t border-slate-100 p-4 sm:p-5 space-y-5">{children}</div>
  </details>;
}
