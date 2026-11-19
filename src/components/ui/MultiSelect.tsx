import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';
import type { SelectOption } from './Select';

/** `group` puts the option under a heading; consecutive options with the same group share it. */
export interface MultiSelectOption extends SelectOption { group?: string; }

interface MultiSelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

/** `Select` for several values. Choices stay in the order they were picked and the list stays open while toggling. */
export function MultiSelect({ value, onValueChange, options, placeholder = 'Select…', className = '',
  disabled = false, 'aria-label': ariaLabel }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const search = useRef({ text: '', at: 0 });
  const enabled = options.map((option, i) => option.disabled ? -1 : i).filter(i => i >= 0);
  const labels = value.map(v => options.find(o => o.value === v)?.label).filter(Boolean).join(', ');
  const changeOpen = (next: boolean) => { setOpen(next); setActiveIndex(next ? enabled[0] ?? -1 : -1); search.current = { text: '', at: 0 }; };
  useEffect(() => {
    if (open && activeIndex >= 0) document.getElementById(`${listboxId}-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex, listboxId]);
  const toggle = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onValueChange(value.includes(option.value) ? value.filter(v => v !== option.value) : [...value, option.value]);
  };
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    if (event.key === 'Tab') { if (open) changeOpen(false); return; }
    if (event.key === 'Escape') { if (open) { event.preventDefault(); changeOpen(false); } return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (!open) { changeOpen(true); return; }
      if (event.key === 'Enter' || event.key === ' ') { toggle(activeIndex); return; }
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
  return <FloatingPanel size="auto" open={open} onOpenChange={changeOpen} align="start"
    label={ariaLabel || placeholder} focusOnOpen={false} restoreFocus={false}
    className="app-select-panel w-auto" trigger={
      <button type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? listboxId : undefined} aria-label={ariaLabel}
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        disabled={disabled} onKeyDown={handleKeyDown}
        className={`app-combobox flex h-10 items-center justify-between gap-2 whitespace-nowrap px-3 text-slate-800 transition-colors disabled:opacity-50 ${className}`}>
        <span className={`truncate ${labels ? 'text-slate-800' : 'text-slate-400'}`}>{labels || placeholder}</span>
        <ChevronDown aria-hidden="true" className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    }>
    {options.length ? <div id={listboxId} role="listbox" aria-multiselectable="true" aria-label={ariaLabel || placeholder}>{options.map((option, index) => <React.Fragment key={option.value}>
      {option.group && option.group !== options[index - 1]?.group && <div role="presentation" className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{option.group}</div>}
      <div id={`${listboxId}-${index}`}
      role="option" aria-selected={value.includes(option.value)} aria-disabled={option.disabled || undefined}
      data-active={index === activeIndex} onPointerMove={() => !option.disabled && setActiveIndex(index)}
      onClick={() => toggle(index)} className={`app-menu-item app-select-option ${option.disabled ? 'pointer-events-none opacity-50' : ''}`}>
      <span className="min-w-0 flex-1">{option.label}</span>
      {value.includes(option.value) && <Check aria-hidden="true" className="w-4 h-4 shrink-0" />}
    </div></React.Fragment>)}</div> : <p className="px-3 py-2 text-sm text-slate-500">No options available</p>}
  </FloatingPanel>;
}
