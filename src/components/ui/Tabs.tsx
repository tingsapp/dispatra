import { useId, useRef, useState, type ReactNode } from 'react';

export type TabItem = { id: string; label: string; content: ReactNode; disabled?: boolean; pageWidth?: 'reading' | 'wide' };

/** Accessible local navigation. Mounted panels preserve drafts and navigation guards. */
export function Tabs({ label, items, keepMounted = true }: { label: string; items: TabItem[]; keepMounted?: boolean }) {
  const [active, setActive] = useState(items.find(item => !item.disabled)?.id);
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return <div className="min-w-0 space-y-5" data-page-width={items.find(item => item.id === active)?.pageWidth}>
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto pb-1">
      {items.map((item, index) => <button key={item.id} type="button" role="tab"
        ref={node => { buttons.current[index] = node; }}
        id={`${id}-tab-${item.id}`} aria-controls={`${id}-panel-${item.id}`}
        aria-selected={active === item.id} disabled={item.disabled}
        tabIndex={active === item.id ? 0 : -1} className="app-tab disabled:opacity-50"
        onClick={() => setActive(item.id)} onKeyDown={event => {
          if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
          const enabled = items.map((tab, i) => tab.disabled ? -1 : i).filter(i => i >= 0);
          const position = enabled.indexOf(index);
          const next = event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled.at(-1)
            : enabled[(position + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length];
          if (next == null) return;
          event.preventDefault(); setActive(items[next].id); buttons.current[next]?.focus();
        }}>{item.label}</button>)}
    </div>
    {items.map(item => <div key={item.id} role="tabpanel" id={`${id}-panel-${item.id}`}
      aria-labelledby={`${id}-tab-${item.id}`} hidden={active !== item.id} tabIndex={0} className="space-y-5">
      {(keepMounted || active === item.id) && item.content}
    </div>)}
  </div>;
}
