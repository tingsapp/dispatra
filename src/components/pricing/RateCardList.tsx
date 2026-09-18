import { Plus } from 'lucide-react';
import { RateCard } from '../../types/pricing';
import { fieldClass, METHOD_LABELS, primaryBtn } from './RateCardFields';

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
      <h2 className="text-sm font-semibold text-slate-900">Rate cards</h2>
      <button type="button" onClick={onAdd} className={primaryBtn}><Plus className="w-3.5 h-3.5" />Add rate card</button>
    </div>
    <input aria-label="Search rate cards" placeholder="Search rate cards" value={search} onChange={event => onSearch(event.target.value)} className={fieldClass} />
    <div className="space-y-2">
      {cards.map(card => <button
        key={card.id}
        type="button"
        aria-label={card.name}
        aria-pressed={card.id === selectedId}
        onClick={() => onSelect(card)}
        className={`w-full text-left rounded-xl border p-3.5 transition-colors ${card.id === selectedId ? 'border-slate-900 bg-white shadow-sm' : 'border-slate-200 bg-white hover:border-slate-400'}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900 truncate">{card.name}</div>
          {isDefault(card) && <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200/70">Default</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-white text-slate-600 border-slate-200">{METHOD_LABELS[card.pricingMethod]}</span>
          <span className="text-[10px] text-slate-400 ml-auto">v{card.version}</span>
        </div>
      </button>)}
      {!cards.length && <p className="text-xs text-slate-500 p-3">No rate cards match. Adjust your filters or add a card.</p>}
    </div>
  </aside>;
}
