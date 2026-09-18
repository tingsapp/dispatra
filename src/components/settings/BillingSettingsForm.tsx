import { BillingTabs } from './BillingTabs';
import { CompanyDetails } from './CompanyDetails';
import { CompanyCharges } from './CompanyCharges';
import { DispatchSettings } from './DispatchSettings';
import { OperatingCosts } from './OperatingCosts';
import { PricingDefaults } from './PricingDefaults';
import { RegionalSettings } from './RegionalSettings';
import { useBillingSettings } from './useBillingSettings';

const SAVE_LABELS = { company: 'company settings', dispatch: 'dispatch rules', extras: 'extras', costs: 'vehicle & labour costs', billing: 'billing' } as const;
export function BillingSettingsForm({ section, onNotification }: { section: keyof typeof SAVE_LABELS; onNotification?: (message: string) => void }) {
  const editor = useBillingSettings(onNotification);
  return <form onSubmit={event => { event.preventDefault(); editor.handleSave(); }} className="space-y-5">
    {section === 'company' && <><CompanyDetails editor={editor} /><RegionalSettings editor={editor} /></>}
    {section === 'billing' && <BillingTabs editor={editor} />}
    {section === 'extras' && <>
      <p className="text-xs text-slate-500">Added on top of every rate card's price. Rate cards cannot switch these off.</p>
      <CompanyCharges editor={editor} />
      <PricingDefaults editor={editor} />
    </>}
    {section === 'costs' && <>
      <p className="text-xs text-slate-500">Internal cost estimates for margins and dispatch planning. These never change the customer price.</p>
      <OperatingCosts editor={editor} />
    </>}
    {section === 'dispatch' && <DispatchSettings editor={editor} />}
    {editor.saveError && <p role="alert" className="text-sm text-red-600">{editor.saveError}</p>}
    <div className="flex items-center justify-end gap-3">
      <span role="status" className="text-xs text-slate-500">{editor.isSaved && !editor.dirty ? 'Settings saved' : ''}</span>
      <button type="submit" disabled={!editor.dirty} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-40">Save {SAVE_LABELS[section]}</button>
    </div>
  </form>;
}
