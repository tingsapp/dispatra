import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Extra classes for the trigger — use to control width (defaults to fitting its content). */
  className?: string;
  /** Align the popover to the trigger's left or right edge. */
  align?: 'start' | 'end';
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * Select — a shadcn/ui-style dropdown that replaces the native <select>, so the
 * options render as themed markup instead of an OS menu. Primary accent is black.
 */
export const Select: React.FC<SelectProps> = ({
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  className = '',
  align = 'start',
  disabled = false,
  'aria-label': ariaLabel
}) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  // Dismiss on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, close]);

  // Flip the popover above the trigger when it would overflow the viewport
  useEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const estimated = Math.min(options.length * 30 + 10, 260);
    setDropUp(rect.bottom + estimated > window.innerHeight && rect.top > estimated);
  }, [open, options.length]);

  // Keep the highlighted option in view while arrowing through the list
  useEffect(() => {
    if (!open || activeIndex < 0 || !listRef.current) return;
    const node = listRef.current.children[activeIndex] as HTMLElement | undefined;
    node?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const moveActive = (delta: number) => {
    const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
    if (enabled.length === 0) return;
    const start = activeIndex >= 0 ? activeIndex : selectedIndex;
    const pos = enabled.indexOf(start);
    const next = pos < 0 ? (delta > 0 ? 0 : enabled.length - 1) : (pos + delta + enabled.length) % enabled.length;
    setActiveIndex(enabled[next]);
  };

  const commit = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onValueChange(option.value);
    close();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
        setActiveIndex(selectedIndex);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveActive(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveActive(-1);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(options.findIndex((o) => !o.disabled));
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(options.map((o) => !o.disabled).lastIndexOf(true));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(activeIndex >= 0 ? activeIndex : selectedIndex);
        break;
      case 'Tab':
        close();
        break;
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
          setActiveIndex(selectedIndex);
        }}
        onKeyDown={handleKeyDown}
        className={`flex h-9 items-center justify-between gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 shadow-2xs transition-colors hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? 'ring-2 ring-slate-900/10 border-slate-400' : ''
        } ${className}`}
      >
        <span className={`truncate ${selected ? 'text-slate-800' : 'text-slate-400 font-normal'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-slate-500 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          ref={listRef}
          aria-label={ariaLabel}
          className={`absolute z-50 min-w-full max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 animate-in fade-in-0 zoom-in-95 duration-100 ${
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
          } ${align === 'end' ? 'right-0' : 'left-0'}`}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <div
                key={option.value}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                onClick={() => commit(index)}
                className={`relative flex cursor-pointer select-none items-center gap-2 rounded-md py-1.5 pl-7 pr-3 text-xs whitespace-nowrap transition-colors ${
                  option.disabled
                    ? 'pointer-events-none opacity-50'
                    : isActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-700'
                } ${isSelected ? 'font-semibold text-slate-900' : ''}`}
              >
                {isSelected && (
                  <Check className="absolute left-2 w-3.5 h-3.5 text-slate-900" strokeWidth={2.5} />
                )}
                {option.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
