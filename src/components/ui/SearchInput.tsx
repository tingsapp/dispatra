import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Extra classes for the wrapper — use to control width (defaults to flex-1). */
  className?: string;
  'aria-label'?: string;
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
  'aria-label': ariaLabel
}) => (
  <div className={`relative ${className}`}>
    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
    <input
      type="search"
      value={value}
      aria-label={ariaLabel || placeholder}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-xs text-slate-900 shadow-2xs transition-colors placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 [&::-webkit-search-cancel-button]:appearance-none"
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
