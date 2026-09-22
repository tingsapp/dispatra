import { fromDisplayDivisor, toDisplayDivisor } from '../../lib/units';
import { OrganizationDefaults } from '../../types/billing';
import { RateCard } from '../../types/pricing';
import { cardClass, NumberField } from './RateCardFields';

export function DimensionalWeightFields({ card, units, patch }: {
  card: RateCard;
  units: OrganizationDefaults;
  patch: (changes: Partial<RateCard>) => void;
}) {
  return <section className={cardClass} aria-label="Dimensional Weight">
    <h3 className="app-section-title text-slate-900">Dimensional Weight</h3>
    <p className="text-xs text-slate-500 mt-0.5 mb-4">Chargeable weight is always the greater of actual and dimensional weight. Weight charges depend on the pricing method.</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <NumberField label="Dimensional Divisor" value={toDisplayDivisor(card.dimensionalDivisor ?? units.dimensionalDivisor, units)}
        onChange={value => patch({ dimensionalDivisor: fromDisplayDivisor(value, units) })}
        suffix={`${units.dimensionUnit}³/${units.weightUnit}`} step="any"
        hint="Length × width × height ÷ divisor." />
    </div>
  </section>;
}
