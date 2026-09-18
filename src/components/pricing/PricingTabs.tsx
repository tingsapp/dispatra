import { ReactNode, useId, useRef, useState } from 'react';

export function PricingTabs({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0].id);
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return <div className="min-w-0 space-y-5">
    <div role="tablist" aria-label="Pricing sections" className="flex gap-1 overflow-x-auto pb-1">
      {tabs.map((tab, index) => <button
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
          const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
            : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
          if (next === null) return;
          event.preventDefault();
          setActive(tabs[next].id);
          buttons.current[next]?.focus();
        }}
        className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${active === tab.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
      >{tab.label}</button>)}
    </div>
    {/* Keep panels mounted so each section retains drafts and navigation guards. */}
    {tabs.map(tab => <div key={tab.id} role="tabpanel" id={`${id}-panel-${tab.id}`} aria-labelledby={`${id}-tab-${tab.id}`} hidden={active !== tab.id} tabIndex={0} className="space-y-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
      {tab.content}
    </div>)}
  </div>;
}
