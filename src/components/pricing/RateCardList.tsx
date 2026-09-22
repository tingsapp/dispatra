import { SearchInput } from '../ui/SearchInput';
import { Clock3, FileInput, MapPin, Package, Plus, Route, type LucideIcon } from 'lucide-react';
import { PricingMethod, RateCard } from '../../types/pricing';
import { METHOD_LABELS, primaryBtn } from './RateCardFields';

const METHOD_ICONS: Record<PricingMethod, LucideIcon> = {
  BASE_PLUS_DISTANCE: Route,
  FIXED: Package,
  ZONE: MapPin,
  HOURLY: Clock3,
  IMPORTED: FileInput,
};

interface RateCardListProps {
  cards: RateCard[];
  selectedId?: string;
  search: string;
  onSearch: (value: string) => void;
  onAdd: () => void;
  onSelect: (card: RateCard) => void;
  isDefault: (card: RateCard) => boolean;
}

export function RateCardList({ cards, selectedId, search, onSearch, onAdd, onSelect, isDefault }: RateCardListProps) {
  return <aside aria-label="Rate cards" className="space-y-3 xl:sticky xl:top-0">
    <div className="flex items-center justify-between gap-2">
      <h2 className="app-section-title text-slate-900">Rate cards</h2>
      <button type="button" onClick={onAdd} className={primaryBtn}><Plus className="w-3.5 h-3.5" />Add card</button>
    </div>
    <SearchInput aria-label="Search rate cards" placeholder="Search rate cards" value={search} onChange={onSearch} />
    <div className="space-y-1">
      {cards.map(card => {
        const MethodIcon = METHOD_ICONS[card.pricingMethod];
        return <button
          key={card.id}
          type="button"
          aria-label={card.name}
          aria-pressed={card.id === selectedId}
          onClick={() => onSelect(card)}
          className="app-choice-row group flex w-full items-center gap-3 p-3 text-left"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-app-muted transition-colors group-hover:bg-app-hover">
            <MethodIcon aria-hidden="true" className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm text-slate-900" title={card.name}>{card.name}</span>
              {isDefault(card) && <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">Default</span>}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">{METHOD_LABELS[card.pricingMethod]}</span>
          </span>
        </button>;
      })}
      {!cards.length && <p className="text-xs text-slate-500 p-3">No rate cards match. Adjust your filters or add a card.</p>}
    </div>
  </aside>;
}
