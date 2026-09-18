import { RateCard } from '../../types/pricing';
import { Select } from '../ui/Select';
import { labelClass } from './RateCardFields';

interface Props { card: RateCard; patch: (changes: Partial<RateCard>) => void }
/** Method-specific contract terms; only Hourly and Imported cards have any. */
export const ContractRulesEditor = ({ card, patch }: Props) => {
  if (!['HOURLY', 'IMPORTED'].includes(card.pricingMethod)) return null;
  return <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
    <h3 className="font-semibold text-sm">Pricing terms</h3>
    {card.pricingMethod === 'HOURLY' && <div className="space-y-2">
      <p className="text-slate-600">Only this contract sells time. A service named “4 Hour” remains a delivery promise. These terms are fixed for every hourly card.</p>
      {[
        `Billable clock starts: ${card.hourlyClockStart}`,
        `Billable clock stops: ${card.hourlyClockStop}`,
        'Includes loading and unloading',
        'Includes waiting — no separate waiting charges',
        'Settled on actual minutes at completion'
      ].map(term => <label key={term} className="flex items-center gap-2 text-slate-700"><input type="checkbox" checked readOnly disabled className="accent-slate-900" />{term}</label>)}
    </div>}
      {card.pricingMethod === 'IMPORTED' && <div className="sm:max-w-sm">
        <label className={labelClass}>Imported amount means</label>
        <Select aria-label="Imported amount means" className="w-full" value={card.importedPriceMode ?? 'FREIGHT'} onValueChange={value => patch({ importedPriceMode: value as RateCard['importedPriceMode'] })} options={[
          { value: 'FREIGHT', label: 'Freight amount — permitted contract modifiers apply' },
          { value: 'FINAL_TOTAL', label: 'Final agreed total — preserve exactly, including tax' }
        ]} />
      </div>}
  </section>;
};
