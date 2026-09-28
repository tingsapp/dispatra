import { useEffect, useId, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { loadPlacesLibrary } from '../../lib/googlePlaces';

export interface SelectedAddress {
  latitude: number | null;
  longitude: number | null;
}

type Prediction = google.maps.places.PlacePrediction;
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onChange: (address: string, selected?: SelectedAddress) => void;
  includeCoordinates?: boolean;
};

const MIN_QUERY_LENGTH = 6;
const SEARCH_DELAY_MS = 600;

/** A normal text field with optional Google Places suggestions. Manual entry always remains available. */
export function AddressAutocomplete({ value, onChange, includeCoordinates = false, className = 'app-input w-full', ...inputProps }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const requestRef = useRef(0);
  const selectionRef = useRef(0);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState<'idle' | 'loading' | 'unavailable'>('idle');
  const [placement, setPlacement] = useState<{ left: number; top: number; width: number } | null>(null);
  const listId = useId();

  useEffect(() => {
    if (!open || query.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setStatus('idle');
      return;
    }
    const requestId = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = await loadPlacesLibrary();
        if (requestId !== requestRef.current) return;
        tokenRef.current ??= new AutocompleteSessionToken();
        setStatus('loading');
        const result = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query.trim(),
          sessionToken: tokenRef.current,
          includedRegionCodes: ['ca'],
          language: 'en',
        });
        if (requestId !== requestRef.current) return;
        setSuggestions(result.suggestions.flatMap(item => item.placePrediction ? [item.placePrediction] : []));
        setActiveIndex(-1);
        setStatus('idle');
      } catch {
        if (requestId !== requestRef.current) return;
        setSuggestions([]);
        setStatus('unavailable');
      }
    }, SEARCH_DELAY_MS);
    return () => { window.clearTimeout(timer); requestRef.current++; };
  }, [query, open]);

  useLayoutEffect(() => {
    if (!open || !suggestions.length) return;
    const update = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dropdownHeight = Math.min(300, suggestions.length * 46 + 40);
      const below = window.innerHeight - rect.bottom;
      const top = below >= dropdownHeight || below >= rect.top ? rect.bottom + 4 : rect.top - dropdownHeight - 4;
      setPlacement({ left: rect.left, top: Math.max(8, top), width: rect.width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [open, suggestions]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || inputRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
      setQuery('');
      tokenRef.current = null;
    };
    document.addEventListener('pointerdown', dismiss, true);
    return () => document.removeEventListener('pointerdown', dismiss, true);
  }, [open]);

  const select = async (prediction: Prediction) => {
    const selectionId = ++selectionRef.current;
    requestRef.current++;
    setOpen(false);
    setQuery('');
    setSuggestions([]);
    setStatus('idle');
    tokenRef.current = null;
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['formattedAddress', ...(includeCoordinates ? ['location'] : [])] });
      if (selectionId !== selectionRef.current) return;
      const address = place.formattedAddress || prediction.text.toString();
      onChange(address, {
        latitude: place.location?.lat() ?? null,
        longitude: place.location?.lng() ?? null,
      });
    } catch {
      if (selectionId !== selectionRef.current) return;
      setStatus('unavailable');
      inputRef.current?.focus();
    }
  };

  return <>
    <input {...inputProps} ref={inputRef} type="text" className={className} value={value} autoComplete="off"
      role="combobox" aria-autocomplete="list" aria-expanded={open && suggestions.length > 0}
      aria-controls={open && suggestions.length ? listId : undefined}
      aria-activedescendant={activeIndex >= 0 && open ? `${listId}-${activeIndex}` : undefined}
      onChange={event => { const next = event.target.value; selectionRef.current++; onChange(next); setSuggestions([]); setActiveIndex(-1); setQuery(next); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { setOpen(false); setQuery(''); tokenRef.current = null; return; }
        if (!open || !suggestions.length) return;
        if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex(index => Math.min(index + 1, suggestions.length - 1)); }
        if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex(index => Math.max(index - 1, 0)); }
        if (event.key === 'Enter' && activeIndex >= 0) { event.preventDefault(); void select(suggestions[activeIndex]); }
      }} />
    {status === 'unavailable' && <span role="status" className="mt-1 block text-xs text-slate-500">Address search unavailable. You can enter the address manually.</span>}
    {status === 'loading' && <span role="status" className="sr-only">Searching addresses…</span>}
    {open && suggestions.length > 0 && placement && createPortal(
      <div ref={listRef} id={listId} role="listbox" aria-label="Address suggestions"
        className="fixed z-[200] max-h-[300px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
        style={placement}>
        {suggestions.map((prediction, index) => <div key={prediction.placeId} id={`${listId}-${index}`} role="option" aria-selected={index === activeIndex}>
          <button type="button" className={`w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 ${index === activeIndex ? 'bg-slate-100' : ''}`}
            onMouseDown={event => event.preventDefault()} onClick={() => { void select(prediction); }}>
            {prediction.text.toString()}
          </button>
        </div>)}
        <div className="px-3 py-1.5 text-right text-xs text-slate-500">Google Maps</div>
      </div>, document.body)}
  </>;
}
