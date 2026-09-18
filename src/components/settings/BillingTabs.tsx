import { useId,useRef,useState } from 'react';
import { InvoiceSettings } from './InvoiceSettings';
import { TaxSettings } from './TaxSettings';
import { BillingEditor } from './useBillingSettings';

const TABS = [
  { id: 'invoicing', label: 'Invoicing' },
  { id: 'taxes', label: 'Taxes' },
] as const;

export function BillingTabs({ editor }: { editor: BillingEditor }) {
  const [active, setActive] = useState<(typeof TABS)[number]['id']>('invoicing');
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return <>
    <div role="tablist" aria-label="Billing sections" className="flex gap-1 overflow-x-auto pb-1">
      {TABS.map((tab, index) => <button
        key={tab.id}
        ref={node => { buttons.current[index] = node; }}
        type="button"
        role="tab"
        id={`${id}-tab-${tab.id}`}
        aria-selected={active === tab.id}
        aria-controls={`${id}-panel-${tab.id}`}
        tabIndex={active === tab.id ? 0 : -1}
        onClick={() => setActive(tab.id)}
        onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % TABS.length
            : event.key === 'ArrowLeft' ? (index + TABS.length - 1) % TABS.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : null;
          if (next === null) return;
          event.preventDefault();
          setActive(TABS[next].id);
          buttons.current[next]?.focus();
        }}
        className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${active === tab.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
      >{tab.label}</button>)}
    </div>
    {TABS.map(tab => <div key={tab.id} role="tabpanel" id={`${id}-panel-${tab.id}`} aria-labelledby={`${id}-tab-${tab.id}`} hidden={active !== tab.id} tabIndex={0} className="space-y-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
      {active === tab.id && <>
        {tab.id === 'invoicing' && <InvoiceSettings editor={editor} />}
        {tab.id === 'taxes' && <TaxSettings editor={editor} />}
      </>}
    </div>)}
  </>;
}
