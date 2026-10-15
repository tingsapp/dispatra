import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export type TabItem = { id: string; label: string; content: ReactNode; disabled?: boolean; hidden?: boolean; pageWidth?: 'reading' | 'wide' };

/** Accessible local navigation. Mounted panels preserve drafts and navigation guards. */
export function Tabs({ label, items, keepMounted = true, initialActiveId, hideTabList = false }: { label: string; items: TabItem[]; keepMounted?: boolean; initialActiveId?: string; hideTabList?: boolean }) {
  const visibleItems = items.filter(item => !item.hidden);
  const [active, setActive] = useState(visibleItems.find(item => item.id === initialActiveId && !item.disabled)?.id ?? visibleItems.find(item => !item.disabled)?.id);
  const activeId = visibleItems.some(item => item.id === active && !item.disabled) ? active : visibleItems.find(item => !item.disabled)?.id;
  useEffect(() => { if (active !== activeId) setActive(activeId); }, [active, activeId]);
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return <div className="min-w-0 space-y-5" data-page-width={items.find(item => item.id === activeId)?.pageWidth}>
    <div role="tablist" aria-label={label} hidden={hideTabList} className="flex gap-1 overflow-x-auto pb-1">
      {visibleItems.map((item, index) => <button key={item.id} type="button" role="tab"
        ref={node => { buttons.current[index] = node; }}
        id={`${id}-tab-${item.id}`} aria-controls={`${id}-panel-${item.id}`}
        aria-selected={activeId === item.id} disabled={item.disabled}
        tabIndex={activeId === item.id ? 0 : -1} className="app-tab disabled:opacity-50"
        onClick={() => setActive(item.id)} onKeyDown={event => {
          if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
          const enabled = visibleItems.map((tab, i) => tab.disabled ? -1 : i).filter(i => i >= 0);
          const position = enabled.indexOf(index);
          const next = event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled.at(-1)
            : enabled[(position + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length];
          if (next == null) return;
          event.preventDefault(); setActive(visibleItems[next].id); buttons.current[next]?.focus();
        }}>{item.label}</button>)}
    </div>
    {items.map(item => <div key={item.id} role={hideTabList ? 'region' : 'tabpanel'} id={`${id}-panel-${item.id}`}
      aria-label={hideTabList ? item.label : undefined} aria-labelledby={hideTabList ? undefined : `${id}-tab-${item.id}`} hidden={item.hidden || activeId !== item.id} tabIndex={0} className="space-y-5">
      {(keepMounted || activeId === item.id) && item.content}
    </div>)}
  </div>;
}
