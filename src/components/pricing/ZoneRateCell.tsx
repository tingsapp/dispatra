import { useId } from 'react';
import { WeightInput } from './WeightInput';
import { Units } from '../../lib/units';
import { sortWeightBands, zoneBandFieldIssues, zoneRateIssue } from '../../lib/zoneWeightBands';
import { Zone, ZoneRate, ZoneWeightBand } from '../../types/pricing';

interface Props {
  origin: Zone; destination: Zone; rate?: ZoneRate; legacyRateId?: string; units: Units;
  onChange: (rate?: ZoneRate) => void;
}

/** Compact weight/price bands within one matrix intersection. */
export function ZoneRateCell({ origin, destination, rate, legacyRateId, units, onChange }: Props) {
  const id = useId();
  const route = `${origin.name} to ${destination.name}`;
  const legacy = !rate?.weightBands && (!!rate || !!legacyRateId);
  const bands = rate?.weightBands?.length ? rate.weightBands : [{ id: 'initial', maxWeightKg: null, amount: legacy ? rate?.amount ?? null : null }];
  const write = (next: ZoneWeightBand[]) => {
    if (!next.length || next.every(band => band.maxWeightKg == null && band.amount == null)) return onChange(undefined);
    onChange({ id: rate?.id ?? `zr_${origin.id}_${destination.id}`, originZoneId: origin.id,
      destinationZoneId: destination.id, serviceId: null, amount: rate?.amount ?? 0, weightBands: next });
  };
  const patchBand = (index: number, patch: Partial<ZoneWeightBand>) => {
    if (legacy && 'amount' in patch) return onChange(patch.amount == null ? undefined : {
      ...(rate ?? { id: legacyRateId!, originZoneId: origin.id, destinationZoneId: destination.id, serviceId: null }), amount: patch.amount,
    });
    write(bands.map((band, i) => i === index ? { ...band, ...patch } : band));
  };
  return <td aria-label={route} className="!align-top" onBlur={event => {
    if (event.currentTarget.contains(event.relatedTarget as Node) || !rate?.weightBands) return;
    const sorted = sortWeightBands(rate.weightBands);
    if (sorted.some((band, index) => band.id !== rate.weightBands![index].id)) onChange({ ...rate, weightBands: sorted });
  }}>
    <div className="space-y-1.5">
      {bands.map((band, index) => {
        const issues = !rate ? { weight: null, price: null } : legacy
          ? { weight: null, price: zoneRateIssue(rate) } : zoneBandFieldIssues(band, bands);
        const weightErrorId = `${id}-weight-${index}`;
        const priceErrorId = `${id}-price-${index}`;
        return <div key={band.id} className="app-zone-band-grid">
          <WeightInput value={band.maxWeightKg} units={units} label={`${route} weight limit${index ? ` ${index + 1}` : ''}`}
            labelWithUnit min={0.000001} invalid={!!issues.weight}
            describedBy={issues.weight ? weightErrorId : legacy ? `${id}-legacy` : undefined}
            className="app-table-input w-full min-w-0" placeholder="Weight"
            onChange={maxWeightKg => patchBand(index, { maxWeightKg })} />
          <input type="number" min="0" step="0.01" aria-label={`${route} price${index ? ` ${index + 1}` : ''}`}
            aria-invalid={!!issues.price} aria-describedby={issues.price ? priceErrorId : undefined} className="app-table-input w-full min-w-0" placeholder="Price" value={band.amount ?? ''}
            onChange={event => patchBand(index, { amount: event.target.value === '' ? null : Number(event.target.value) })} />
          {issues.weight && <span id={weightErrorId} className="sr-only">{issues.weight}</span>}
          {issues.price && <span id={priceErrorId} className="sr-only">{issues.price}</span>}
        </div>;
      })}
    </div>
    {legacy && <p id={`${id}-legacy`} className="mt-1 text-xs text-slate-500">Existing flat price</p>}
  </td>;
}
