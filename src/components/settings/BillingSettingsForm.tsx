import { Button } from '../ui/button';
import { CompanyTabs } from './CompanyTabs';
import { FuelChargeSettings } from './FuelChargeSettings';
import { useBillingSettings } from './useBillingSettings';

const SAVE_LABELS = { company: 'Settings', fuel: 'Fuel Charge' } as const;
export function BillingSettingsForm({ section, onNotification }: { section: keyof typeof SAVE_LABELS; onNotification?: (message: string) => void }) {
  const editor = useBillingSettings(onNotification);
  return <form onSubmit={event => { event.preventDefault(); editor.handleSave(); }} className={`space-y-5 ${section === 'fuel' ? 'w-full max-w-2xl' : ''}`}>
    {section === 'company' && <CompanyTabs editor={editor} />}
    {section === 'fuel' && <FuelChargeSettings editor={editor} />}
    {editor.saveError && <p role="alert" className="text-sm text-red-600">{editor.saveError}</p>}
    <div className={`flex items-center justify-end gap-3 ${section === 'fuel' ? 'flex-row-reverse flex-wrap' : ''}`}>
      <span role="status" className="text-xs text-slate-500">{editor.isSaved && !editor.dirty ? 'Settings saved' : ''}</span>
      <Button type="submit" disabled={!editor.dirty} className="app-action app-primary rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-40">Save {SAVE_LABELS[section]}</Button>
    </div>
  </form>;
}
