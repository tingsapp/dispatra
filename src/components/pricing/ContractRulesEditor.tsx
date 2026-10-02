import { RateCard } from '../../types/pricing';

interface Props { card: RateCard; patch: (changes: Partial<RateCard>) => void }
/** Method-specific contract terms; only Hourly and Imported cards have any. */
export const ContractRulesEditor = ({ card, patch }: Props) => {
  if (!['HOURLY', 'IMPORTED'].includes(card.pricingMethod)) return null;
  return <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
    <h3 className="app-section-title">Pricing terms</h3>
    {card.pricingMethod === 'HOURLY' && <div className="space-y-2">
      <p className="text-slate-600">Fixed billing rules for hourly cards.</p>
      {[
        `Billable clock starts: ${card.hourlyClockStart}`,
        `Billable clock stops: ${card.hourlyClockStop}`,
        'Includes loading and unloading',
        'Includes waiting — no separate waiting charges',
        'Settled on actual minutes at completion'
      ].map(term => <label key={term} className="flex items-center gap-2 text-slate-700"><input type="checkbox" checked readOnly disabled className="accent-slate-900" />{term}</label>)}
    </div>}
      {card.pricingMethod === 'IMPORTED' && <div className="space-y-2">
      {[card.importedPriceMode === 'FINAL_TOTAL' ? 'The imported amount is the final total, including tax' : 'The imported amount is the delivery charge (older card)',
        ...(card.importedPriceMode === 'FINAL_TOTAL' ? ['No fuel, vehicle, service or minimum charges are added'] : []), 'The external reference (TMS order number) is required'
      ].map(term => <label key={term} className="flex items-center gap-2 text-slate-700"><input type="checkbox" checked readOnly disabled className="accent-slate-900" />{term}</label>)}
    </div>}
  </section>;
};
