import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Extra classes for the wrapper — use to control width (defaults to flex-1). */
  className?: string;
  'aria-label'?: string;
  inputProps?: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'placeholder' | 'className'>;
}

/**
 * SearchInput — the shared search field. The icon and clear button are centred
 * against the control's own height so they stay aligned at any text size.
 */
export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search…',
  className = 'flex-1',
  'aria-label': ariaLabel,
  inputProps
}) => (
  <div className={`relative ${className}`}>
    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
    <input
      {...inputProps}
      type="search"
      value={value}
      aria-label={ariaLabel || placeholder}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="app-input app-search-input [&::-webkit-search-cancel-button]:appearance-none"
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Clear search"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);
