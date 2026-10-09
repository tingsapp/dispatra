import { hasDimensionalWeightSetting } from '../../lib/dimensionalWeight';
import { ContractRulesEditor } from '../../components/pricing/ContractRulesEditor';
import { Select } from '../../components/ui/Select';
import { fromDisplayDistance, fromDisplayDistanceRate, toDisplayDistance, toDisplayDistanceRate } from '../../lib/units';
import { PricingMethod } from '../../types/pricing';
import { defaultVehicleSurcharge, initialZoneOneRates } from '../../lib/pricingStorage';
import { RateCardZones } from './RateCardZones';
import { ZoneMatrixEditor } from './ZoneMatrixEditor';
import { RateCardEditorProps } from './RateCardEditorProps';
import { RateCardFormula } from './RateCardFormula';
import { DimensionalWeightFields } from './DimensionalWeightFields';
import { cardClass, fieldClass, labelClass, METHOD_LABELS, NumberField } from './RateCardFields';
export function RateCardEditor({ draft, isNew, config, catalogue, billing, patchDraft, zoneActions }: RateCardEditorProps) {
  const isCalculated = draft.pricingMethod === 'BASE_PLUS_DISTANCE';
  // Hourly cards are floored by Minimum Billable time; a dollar Minimum Charge would duplicate it.
  const hasMinimum = draft.pricingMethod !== 'HOURLY' && !(draft.pricingMethod === 'IMPORTED' && draft.importedPriceMode === 'FINAL_TOTAL');
  return <div className="app-rate-card-details space-y-5">
    <div className={cardClass}>
      <h3 className="app-section-title text-slate-900">Rate Card</h3>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">Set delivery prices for your shippers. Fuel and Accessorials apply separately.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={hasMinimum ? undefined : 'sm:col-span-2'}>
          <label className={labelClass}>Name</label>
          <input aria-label="Rate card name" type="text" value={draft.name} onChange={(e) => patchDraft({ name: e.target.value })} className={fieldClass} />
        </div>
        {hasMinimum && <NumberField label="Minimum Charge" value={draft.applyOrderMinimum === false ? 0 : draft.minimumOrderSubtotal ?? 0} onChange={value => patchDraft({ minimumOrderSubtotal: value, applyOrderMinimum: true })} prefix="$" hint="Before tax, after discounts and adjustments. 0 = no minimum." />}
        {isNew && <div className="sm:col-span-2"><label className={labelClass}>Pricing method</label><Select aria-label="Pricing method" className="w-full" value={draft.pricingMethod} onValueChange={value => patchDraft({ pricingMethod: value as PricingMethod, applyVehicleSurcharge: defaultVehicleSurcharge(value as PricingMethod), applyFuelSurcharge: true, ...(value === 'HOURLY' ? { minimumOrderSubtotal: 0 } : {}), ...(value === 'IMPORTED' ? { importedPriceMode: 'FINAL_TOTAL' as const, minimumOrderSubtotal: 0 } : {}), ...(value === 'ZONE' && !draft.zoneRates?.length ? { zoneRates: initialZoneOneRates(draft.id, config.zones, billing.general) } : {}) })} options={(Object.keys(METHOD_LABELS) as PricingMethod[]).map(method => ({ value: method, label: METHOD_LABELS[method] }))} /></div>}
      </div>
      {draft.pricingMethod !== 'IMPORTED' && <fieldset className="mt-5 space-y-2">
        <legend className="app-label">Surcharges</legend>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="app-checkbox" checked={draft.applyFuelSurcharge !== false} onChange={event => patchDraft({ applyFuelSurcharge: event.target.checked })} />Apply fuel surcharge</label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="app-checkbox" checked={draft.applyVehicleSurcharge !== false} onChange={event => patchDraft({ applyVehicleSurcharge: event.target.checked })} />Apply vehicle surcharge</label>
      </fieldset>}
    </div>

    {/* Pricing method */}
    {draft.pricingMethod !== 'ZONE' && <div className={cardClass}>
      <h3 className="app-section-title text-slate-900">{isCalculated ? 'Distance Based Rates' : `${METHOD_LABELS[draft.pricingMethod]} rates`}</h3><p className="text-xs text-slate-500 mt-0.5 mb-4">{draft.pricingMethod === 'IMPORTED' ? 'The external system supplies the price and its tax.' : 'Rates exclude tax. Manage tax in Company.'}</p>
      {draft.pricingMethod === 'FIXED' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberField label="Fixed Amount per Delivery" value={draft.fixedAmount} onChange={(v) => patchDraft({ fixedAmount: v })} prefix="$" />
        </div>
      )}

      {draft.pricingMethod === 'HOURLY' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberField label="Hourly Rate" value={draft.hourlyRate} onChange={(v) => patchDraft({ hourlyRate: v })} prefix="$" suffix="/ h" />
          <NumberField label="Minimum Billable" value={draft.minimumBillableMinutes} onChange={(v) => patchDraft({ minimumBillableMinutes: v })} suffix="min" step={5} hint="Shortest time charged per order; this is the hourly minimum." />
          <NumberField label="Billing Increment" value={draft.billingIncrementMinutes} onChange={(v) => patchDraft({ billingIncrementMinutes: v })} suffix="min" step={5} hint="Round billable time up to this interval." />
        </div>
      )}

      {draft.pricingMethod === 'IMPORTED' && (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
          {draft.importedPriceMode === 'FINAL_TOTAL'
            ? 'Each order carries its agreed total, including tax, from the external system (TMS). Dispatra adds nothing and does not recalculate tax. Orders can use this card once the integration is connected.'
            : 'Older card: the imported amount is the delivery charge, and the card’s other charges may apply.'}
        </p>
      )}

      {isCalculated && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberField label="Base Fee" value={draft.baseFee} onChange={(v) => patchDraft({ baseFee: v })} prefix="$" hint="Starting price before other charges." />
            <NumberField label="Included Distance" value={toDisplayDistance(draft.includedKm, billing.general)} onChange={(v) => patchDraft({ includedKm: fromDisplayDistance(v, billing.general) })} suffix={billing.general.distanceUnit} step={0.5} hint="Covered by the base fee. 0 = none included." />
            <NumberField label="Distance Rate" value={toDisplayDistanceRate(draft.kmRate, billing.general)} onChange={(v) => patchDraft({ kmRate: fromDisplayDistanceRate(v, billing.general) })} prefix="$" suffix={`/ ${billing.general.distanceUnit}`} />
          </div>
        </>
      )}
    </div>}

    <ContractRulesEditor card={draft} patch={patchDraft} />
    {draft.pricingMethod === 'ZONE' && <>
      <RateCardZones zones={config.zones} {...zoneActions} />
      <ZoneMatrixEditor units={billing.general} currency={billing.quoteSettings.currency} rates={draft.zoneRates ?? []}
        zones={config.zones} onChange={zoneRates => patchDraft({ zoneRates })} />
    </>}

    {hasDimensionalWeightSetting(draft.pricingMethod) && !(draft.pricingMethod === 'IMPORTED' && draft.importedPriceMode === 'FINAL_TOTAL') && <DimensionalWeightFields card={draft} units={billing.general} patch={patchDraft} />}
    <RateCardFormula card={draft} config={config} billing={billing} catalogue={catalogue} />
  </div>;
}
