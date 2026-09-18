import { ContractRulesEditor } from '../../components/pricing/ContractRulesEditor';
import { Select } from '../../components/ui/Select';
import { fromDisplayDistance, fromDisplayDistanceRate, fromDisplayWeight, fromDisplayWeightRate, toDisplayDistance, toDisplayDistanceRate, toDisplayWeight, toDisplayWeightRate } from '../../lib/units';
import { PricingMethod } from '../../types/pricing';
import { SettingsDisclosure } from '../settings/SettingsLayout';
import { ZoneMatrixEditor } from './ZoneMatrixEditor';
import { RateCardEditorProps } from './RateCardEditorProps';
import { RateCardFormula } from './RateCardFormula';
import { cardClass, DiscountEditor, fieldClass, labelClass, METHOD_LABELS, NumberField } from './RateCardFields';
export function RateCardEditor({ draft, isNew, config, catalogue, billing, patchDraft }: RateCardEditorProps) {
  const isCalculated = draft.pricingMethod === 'BASE_PLUS_DISTANCE';
  return <div className="space-y-5">
    <div className={cardClass}>
      <h3 className="text-sm font-semibold text-slate-900">Rate card</h3>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">The base delivery price. Accessorials, extras and vehicle surcharges are the same on every card. Attach it to any number of customers, or choose it on an order.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={isNew ? '' : 'sm:col-span-2'}>
          <label className={labelClass}>Name</label>
          <input aria-label="Rate card name" type="text" value={draft.name} onChange={(e) => patchDraft({ name: e.target.value })} className={fieldClass} />
        </div>
        {isNew && <div><label className={labelClass}>Pricing method</label><Select aria-label="Pricing method" className="w-full" value={draft.pricingMethod} onValueChange={value => patchDraft({ pricingMethod: value as PricingMethod, ...(value === 'ZONE' && !draft.zoneRates?.length ? { zoneRates: config.zoneRates.map(rate => ({ ...rate, id: `${draft.id}_${rate.originZoneId}_${rate.destinationZoneId}` })) } : {}) })} options={(Object.keys(METHOD_LABELS) as PricingMethod[]).filter(method => method !== 'IMPORTED' || draft.pricingMethod === 'IMPORTED').map(method => ({ value: method, label: METHOD_LABELS[method] }))} /></div>}
        {!(draft.pricingMethod === 'IMPORTED' && draft.importedPriceMode === 'FINAL_TOTAL') && <NumberField label="Minimum Charge" value={draft.applyOrderMinimum === false ? 0 : draft.minimumOrderSubtotal ?? 0} onChange={value => patchDraft({ minimumOrderSubtotal: value, applyOrderMinimum: true })} prefix="$" hint="Minimum order subtotal before tax, after discounts and adjustments. 0 = no minimum." />}
      </div>
    </div>

    {/* Pricing method */}
    {draft.pricingMethod !== 'ZONE' && <div className={cardClass}>
      <h3 className="text-sm font-semibold text-slate-900">{METHOD_LABELS[draft.pricingMethod]} rates</h3><p className="text-xs text-slate-500">Tax treatment follows Billing → Taxes. Minimums exclude tax.</p>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">
        Set the delivery rates. Applicable Accessorials, fees, and discounts are shown on each order.
      </p>
      {draft.pricingMethod === 'FIXED' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberField label="Fixed Amount per Delivery" value={draft.fixedAmount} onChange={(v) => patchDraft({ fixedAmount: v })} prefix="$" />
        </div>
      )}

      {draft.pricingMethod === 'HOURLY' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberField label="Hourly Rate" value={draft.hourlyRate} onChange={(v) => patchDraft({ hourlyRate: v })} prefix="$" suffix="/ h" />
          <NumberField label="Minimum Billable" value={draft.minimumBillableMinutes} onChange={(v) => patchDraft({ minimumBillableMinutes: v })} suffix="min" step={5} />
          <NumberField label="Billing Increment" value={draft.billingIncrementMinutes} onChange={(v) => patchDraft({ billingIncrementMinutes: v })} suffix="min" step={5} hint="Estimated at booking; settled on actual hours at completion." />
        </div>
      )}

      {draft.pricingMethod === 'IMPORTED' && (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
          Freight comes from the external system on each order. This card only decides which surcharges still apply.
        </p>
      )}

      {isCalculated && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberField label="Base Fee" value={draft.baseFee} onChange={(v) => patchDraft({ baseFee: v })} prefix="$" hint="Fixed starting amount before variable charges." />
            <NumberField label="Included Distance" value={toDisplayDistance(draft.includedKm, billing.general)} onChange={(v) => patchDraft({ includedKm: fromDisplayDistance(v, billing.general) })} suffix={billing.general.distanceUnit} step={0.5} hint="Distance covered by the base fee. 0 charges every km." />
            <NumberField label="Distance Rate" value={toDisplayDistanceRate(draft.kmRate, billing.general)} onChange={(v) => patchDraft({ kmRate: fromDisplayDistanceRate(v, billing.general) })} prefix="$" suffix={`/ ${billing.general.distanceUnit}`} />
          </div>
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mt-5 mb-3">Weight</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberField label="Included Weight" value={toDisplayWeight(draft.includedWeightKg, billing.general)} onChange={(v) => patchDraft({ includedWeightKg: fromDisplayWeight(v, billing.general) })} suffix={billing.general.weightUnit} step={1} hint="Chargeable weight covered by the base fee." />
            <NumberField label="Weight Rate" value={toDisplayWeightRate(draft.weightRatePerKg, billing.general)} onChange={(v) => patchDraft({ weightRatePerKg: fromDisplayWeightRate(v, billing.general) })} prefix="$" suffix={`/ ${billing.general.weightUnit}`} hint={`Per ${billing.general.weightUnit} beyond the included weight. Chargeable weight is the greater of actual and dimensional weight when that rule is on under Pricing → Extras. 0 = weight not charged.`} />
          </div>

        </>
      )}
    </div>}

    <ContractRulesEditor card={draft} patch={patchDraft} />
    {draft.pricingMethod === 'ZONE' && <SettingsDisclosure title="Zone to zone rates" defaultOpen={isNew} description={`${(draft.zoneRates ?? []).filter(rate => rate.amount > 0).length} of ${config.zones.length * config.zones.length} pickup → delivery pairs priced. An order between unpriced zones is flagged for review — add the zone and price first.`}>
      <ZoneMatrixEditor rates={draft.zoneRates ?? []} zones={config.zones} onChange={zoneRates => patchDraft({ zoneRates })} />
    </SettingsDisclosure>}

    <div className={cardClass}>
      <h3 className="text-sm font-semibold text-slate-900">Discount</h3>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">
        Permanent negotiated discount. A customer-level discount beats this; one-off discounts belong on the Order.
      </p>
      <DiscountEditor value={draft.discount} onChange={(discount) => patchDraft({ discount })} />
    </div>

    <RateCardFormula card={draft} config={config} billing={billing} catalogue={catalogue} />
  </div>;
}
