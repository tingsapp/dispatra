import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';

export interface SelectOption { value: string; label: string; disabled?: boolean; }
interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  align?: 'start' | 'end';
  disabled?: boolean;
  'aria-label'?: string;
}

/** A portalled, keyboard-operated select. Its list cannot be clipped by a table or dialog. */
export function Select({ value, onValueChange, options, placeholder = 'Select…', className = '',
  align = 'start', disabled = false, 'aria-label': ariaLabel }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef({ text: '', at: 0 });
  const listboxId = useId();
  const selectedIndex = options.findIndex(option => option.value === value);
  const selected = options[selectedIndex];
  const enabled = options.map((option, i) => option.disabled ? -1 : i).filter(i => i >= 0);
  const changeOpen = (next: boolean) => {
    setOpen(next);
    setActiveIndex(next ? (selectedIndex >= 0 && !selected?.disabled ? selectedIndex : enabled[0] ?? -1) : -1);
    search.current = { text: '', at: 0 };
  };
  useEffect(() => {
    if (open && activeIndex >= 0) document.getElementById(`${listboxId}-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex, listboxId]);
  const commit = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onValueChange(option.value); changeOpen(false); trigger.current?.focus();
  };
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    if (event.key === 'Tab') { if (open) changeOpen(false); return; }
    if (event.key === 'Escape') { if (open) { event.preventDefault(); changeOpen(false); } return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (!open) { changeOpen(true); return; }
      if (event.key === 'Enter' || event.key === ' ') { commit(activeIndex); return; }
      if (!enabled.length) return;
      const position = enabled.indexOf(activeIndex);
      setActiveIndex(event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled[enabled.length - 1]
        : enabled[(position + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length]);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const prefix = (now - search.current.at < 600 ? search.current.text : '') + event.key.toLocaleLowerCase();
      search.current = { text: prefix, at: now };
      const match = enabled.find(i => options[i].label.toLocaleLowerCase().startsWith(prefix));
      if (match != null) { event.preventDefault(); setOpen(true); setActiveIndex(match); }
    }
  };
  return <FloatingPanel size="auto" open={open} onOpenChange={changeOpen} align={align}
    id={listboxId} role="listbox" label={ariaLabel || placeholder} focusOnOpen={false} restoreFocus={false}
    className="app-select-panel w-auto" trigger={
      <button ref={trigger} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? listboxId : undefined} aria-label={ariaLabel}
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        disabled={disabled} onKeyDown={handleKeyDown}
        className={`app-combobox flex h-10 items-center justify-between gap-2 whitespace-nowrap px-3 text-slate-800 transition-colors disabled:opacity-50 ${className}`}>
        <span className={`truncate ${selected ? 'text-slate-800' : 'text-slate-400'}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown aria-hidden="true" className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    }>
    {options.length ? options.map((option, index) => <div key={option.value} id={`${listboxId}-${index}`}
      role="option" aria-selected={option.value === value} aria-disabled={option.disabled || undefined}
      data-active={index === activeIndex} onPointerMove={() => !option.disabled && setActiveIndex(index)}
      onClick={() => commit(index)} className={`app-menu-item app-select-option ${option.disabled ? 'pointer-events-none opacity-50' : ''}`}>
      <span className="min-w-0 flex-1">{option.label}</span>
      {option.value === value && <Check aria-hidden="true" className="w-4 h-4 shrink-0" />}
    </div>) : <p className="px-3 py-2 text-sm text-slate-500">No options available</p>}
  </FloatingPanel>;
}
