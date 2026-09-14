import React from 'react';
import { RateCard, Zone } from '../../types/pricing';
import { DeliveryService } from '../../types/simplePricing';
import { ZoneMatrixEditor } from './ZoneMatrixEditor';

interface Props { card: RateCard; patch: (changes: Partial<RateCard>) => void; zones: Zone[]; services: DeliveryService[]; organizationMinimum: number }
const field = 'w-full border border-slate-200 rounded-lg p-2 text-xs bg-white';
export const ContractRulesEditor = ({ card, patch, zones, services, organizationMinimum }: Props) => {
  const finalImport = card.pricingMethod === 'IMPORTED' && card.importedPriceMode === 'FINAL_TOTAL';
  return <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
    <h3 className="font-semibold text-sm">Contract rules</h3>
    {card.pricingMethod === 'HOURLY' && <div className="space-y-3">
      <p>Only this contract sells time. A service named “4 Hour” remains a delivery promise.</p>
      <label className="block">Billable clock starts<input className={field} value={card.hourlyClockStart ?? ''} onChange={e => patch({ hourlyClockStart: e.target.value })} /></label>
      <label className="block">Billable clock stops<input className={field} value={card.hourlyClockStop ?? ''} onChange={e => patch({ hourlyClockStop: e.target.value })} /></label>
      {([['hourlyIncludesHandling', 'Includes loading and unloading'], ['hourlyIncludesWaiting', 'Includes waiting — suppress separate waiting charges'], ['hourlySettleActual', 'Settle using actual agreed-period minutes at completion']] as const).map(([key, label]) => <label key={key} className="flex gap-2"><input type="checkbox" checked={card[key] ?? true} onChange={e => patch({ [key]: e.target.checked })} />{label}</label>)}
    </div>}
    {(['FIXED', 'HOURLY'].includes(card.pricingMethod) || card.pricingMethod === 'ZONE' && card.zoneNoMatchFallback !== 'BASE_PLUS_DISTANCE') && <label className="block">Minimum freight (excluding tax, after multiplier)<input className={field} type="number" min="0" step="0.01" value={card.minimumFreight} onChange={e => patch({ minimumFreight: Math.max(0, Number(e.target.value)) })} /></label>}
    {card.pricingMethod !== 'BASE_PLUS_DISTANCE' && !(card.pricingMethod === 'ZONE' && card.zoneNoMatchFallback === 'BASE_PLUS_DISTANCE') && !finalImport && <fieldset className="space-y-2"><legend className="font-medium">Service multiplier overrides</legend>{services.map(service => <label key={service.id} className="block">{service.name}<input className={field} type="number" min="0" step="0.01" placeholder={`Inherit ${service.defaultMultiplier}`} value={card.serviceOverrides[service.id]?.multiplier ?? ''} onChange={e => patch({ serviceOverrides: { ...card.serviceOverrides, [service.id]: { baseFee: null, includedKm: null, kmRate: null, ...card.serviceOverrides[service.id], multiplier: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) } } })} /></label>)}</fieldset>}
    {card.pricingMethod === 'IMPORTED' && <label className="block">Imported amount means
      <select className={field} value={card.importedPriceMode ?? 'FREIGHT'} onChange={e => patch({ importedPriceMode: e.target.value as RateCard['importedPriceMode'] })}>
        <option value="FREIGHT">Freight amount — permitted contract modifiers apply</option><option value="FINAL_TOTAL">Final agreed total — preserve exactly, including tax</option>
      </select>
    </label>}
    {finalImport ? <p>Fees, fuel, service multiplier, accessorials, discounts, minimums and rounding are bypassed. Enter tax treatment on the imported order.</p> : <div className="grid sm:grid-cols-2 gap-3">
      <label>Admin / Dispatch Fee<select className={field} value={card.applyAdminFee == null ? 'INHERIT' : String(card.applyAdminFee)} onChange={e => patch({ applyAdminFee: e.target.value === 'INHERIT' ? null : e.target.value === 'true' })}><option value="INHERIT">Inherit organization enabled setting</option><option value="true">Apply organization fee</option><option value="false">Waive fee</option></select></label>
      <label>Minimum order subtotal (excluding tax)<input className={field} type="number" min="0" step="0.01" value={card.minimumOrderSubtotal ?? ''} placeholder={`Inherit ${organizationMinimum}`} onChange={e => patch({ minimumOrderSubtotal: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} /><span className="text-slate-500">Blank inherits; 0 explicitly waives the minimum.</span></label>
      <label className="flex gap-2"><input type="checkbox" checked={card.applyContractDiscount ?? true} onChange={e => patch({ applyContractDiscount: e.target.checked })} />Apply resolved contract discount</label>
      <label className="flex gap-2"><input type="checkbox" checked={card.applyOrderMinimum ?? true} onChange={e => patch({ applyOrderMinimum: e.target.checked })} />Enforce minimum after discounts and adjustments</label>
    </div>}
    {card.pricingMethod === 'ZONE' && <div className="space-y-3">
      <label>Zone prices<select className={field} value={card.zoneMatrixMode ?? 'INHERIT'} onChange={e => patch({ zoneMatrixMode: e.target.value as RateCard['zoneMatrixMode'] })}><option value="INHERIT">Inherit organization matrix</option><option value="CONTRACT">Negotiated contract matrix</option></select></label>
      {card.zoneMatrixMode === 'CONTRACT' && <>
        <label className="flex gap-2"><input type="checkbox" checked={card.zoneFallbackToOrganization ?? false} onChange={e => patch({ zoneFallbackToOrganization: e.target.checked })} />Allow missing contract entries to use organization rates</label>
        <ZoneMatrixEditor rates={card.zoneRates ?? []} zones={zones} services={services} onChange={zoneRates => patch({ zoneRates })} />
      </>}
      <p>Each delivery must identify its supplying pickups. Each unique pickup → delivery movement is charged once; its packages are combined.</p>
    </div>}
  </section>;
};
