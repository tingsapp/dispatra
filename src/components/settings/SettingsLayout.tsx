import { ChevronDown } from 'lucide-react';
import React,{ useId } from 'react';
import { PageHeader } from '../layout/PageHeader';

export interface SettingsPageProps {
  onNotification?: (message: string) => void;
}

export function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <div className="app-page h-full min-w-0 flex flex-col">
    <PageHeader title="Settings" description="Rate cards, service levels, Accessorials, fuel surcharge, taxes, vehicle types and preferences." />
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
