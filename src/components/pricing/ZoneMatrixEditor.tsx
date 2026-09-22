import { useId, useRef } from 'react';
import { Units } from '../../lib/units';
import { Zone, ZoneRate } from '../../types/pricing';
import { cardClass } from './RateCardFields';
import { ZoneRateCell } from './ZoneRateCell';

interface Props {
  rates: ZoneRate[]; zones: Zone[]; units: Units; currency: string;
  onChange: (rates: ZoneRate[]) => void;
}
const routeKey = (originId: string, destinationId: string) => JSON.stringify([originId, destinationId]);

/** Pickup rows and delivery columns. Every cell edits one card-owned directional rate. */
export function ZoneMatrixEditor({ rates, zones, units, currency, onChange }: Props) {
  const descriptionId = useId();
  // Clearing and retyping an existing flat amount must not invent a weight limit.
  const legacyRateIds = useRef(new Map(rates.filter(rate => !rate.weightBands)
    .map(rate => [routeKey(rate.originZoneId, rate.destinationZoneId), rate.id])));
  return <section aria-label="Zone prices" className={`${cardClass} app-zone-panel min-w-0 space-y-4`}>
    <div>
      <h3 className="app-section-title app-zone-section-title">Zone-to-Zone Matrix</h3>
      <p id={descriptionId} className="mt-0.5 text-xs text-slate-500">Enter the maximum weight ({units.weightUnit}) and delivery price ({currency}) for each pickup-to-delivery pair. Orders automatically use the greater of actual and dimensional weight.</p>
    </div>
    {zones.length ? <div className="app-table-shell app-zone-matrix-scroll" role="region" aria-label="Zone pricing matrix" tabIndex={0}>
      <table className="app-table app-table-editable app-zone-table app-zone-matrix" aria-label="Zone-to-zone prices" aria-describedby={descriptionId}>
        <thead><tr>
          <th scope="col" className="text-left">Pickup ↓ · Delivery →</th>
          {zones.map(destination => <th key={destination.id} scope="col" className="text-left">
            <div className="whitespace-normal break-words text-center font-medium text-slate-900">{destination.name || 'Unnamed zone'}</div>
          </th>)}
        </tr></thead>
        <tbody>{zones.map(origin => <tr key={origin.id}>
          <th scope="row" className="text-left !align-top whitespace-normal break-words">{origin.name || 'Unnamed zone'}</th>
          {zones.map(destination => <ZoneRateCell key={destination.id} {...{ origin, destination, units }}
            legacyRateId={legacyRateIds.current.get(routeKey(origin.id, destination.id))}
            rate={rates.find(rate => rate.originZoneId === origin.id && rate.destinationZoneId === destination.id)}
            onChange={rate => {
              if (rate?.weightBands) legacyRateIds.current.delete(routeKey(origin.id, destination.id));
              const other = rates.filter(current => current.originZoneId !== origin.id || current.destinationZoneId !== destination.id);
              onChange(rate ? [...other, rate] : other);
            }} />)}
        </tr>)}</tbody>
      </table>
    </div> : <p className="text-sm text-slate-500">Add zones above to enter delivery prices.</p>}
  </section>;
}
