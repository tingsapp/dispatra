import { useId, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CENTRAL_PICKUP_ZONE_ID, withCentralZoneRates } from '../../lib/centralZoneRates';
import { toDisplayWeight, Units } from '../../lib/units';
import { sortWeightBands, zoneBandFieldIssues, zoneRateIssue } from '../../lib/zoneWeightBands';
import { Zone, ZoneRate, ZoneWeightBand } from '../../types/pricing';
import { cardClass } from './RateCardFields';
import { WeightInput } from './WeightInput';
import { Button } from '../ui/button';

interface Props {
  rates: ZoneRate[]; zones: Zone[]; units: Units; currency: string;
  onChange: (rates: ZoneRate[]) => void;
}
interface MatrixRow { id: string; maxWeightKg: number | null; pending: boolean; flat: boolean }
const routeId = (destination: Zone) => `zr_central_${destination.id}`;

/** One shared range axis for all destination prices. Rows keep the order they were entered in; they are never re-sorted. */
function matrixRows(rates: ZoneRate[], zones: Zone[]): MatrixRow[] {
  const ordered = [...zones.flatMap(zone => rates.filter(rate => rate.destinationZoneId === zone.id)), ...rates.filter(rate => !zones.some(zone => zone.id === rate.destinationZoneId))];
  const rows = new Map<string, MatrixRow>();
  for (const band of ordered.flatMap(rate => rate.weightBands ?? [])) {
    const key = band.maxWeightKg == null ? `pending:${band.id}` : `limit:${band.maxWeightKg}`;
    if (!rows.has(key)) rows.set(key, { id: band.id, maxWeightKg: band.maxWeightKg, pending: band.maxWeightKg == null, flat: false });
  }
  if (rows.size) return [...rows.values()];
  if (rates.some(rate => !rate.weightBands)) return [{ id: 'flat-central', maxWeightKg: null, pending: false, flat: true }];
  return [{ id: 'initial-central', maxWeightKg: null, pending: true, flat: false }];
}

function rowPrice(rate: ZoneRate | undefined, row: MatrixRow): number | null {
  if (!rate) return null;
  if (!rate.weightBands) return row.pending ? null : rate.amount;
  if (row.pending) return rate.weightBands.find(band => band.id === row.id)?.amount ?? null;
  return sortWeightBands(rate.weightBands).find(band => band.maxWeightKg != null && band.maxWeightKg >= row.maxWeightKg!)?.amount ?? null;
}

/** A single central pickup prices each destination by weight. */
export function ZoneMatrixEditor({ rates, zones, units, currency, onChange }: Props) {
  const descriptionId = useId();
  const clearedRateIds = useRef<Record<string, string>>({});
  const workingRates = withCentralZoneRates(rates, zones);
  const centralRates = workingRates.filter(rate => rate.originZoneId === CENTRAL_PICKUP_ZONE_ID);
  const rows = matrixRows(centralRates, zones);
  const rateFor = (destination: Zone) => centralRates.find(rate => rate.destinationZoneId === destination.id);
  const replace = (destination: Zone, next?: ZoneRate) => {
    const others = workingRates.filter(rate => rate.originZoneId !== CENTRAL_PICKUP_ZONE_ID || rate.destinationZoneId !== destination.id);
    onChange(next ? [...others, next] : others);
  };
  const editLimit = (row: MatrixRow, maxWeightKg: number | null) => {
    if (row.flat) {
      if (maxWeightKg == null) return;
      const existing = centralRates.filter(rate => !rate.weightBands);
      if (!existing.length && zones.length) {
        const destination = zones[0];
        replace(destination, { id: routeId(destination), originZoneId: CENTRAL_PICKUP_ZONE_ID, destinationZoneId: destination.id,
          serviceId: null, amount: 0, weightBands: [{ id: row.id, maxWeightKg, amount: null }] });
        return;
      }
      onChange(workingRates.map(rate => rate.originZoneId === CENTRAL_PICKUP_ZONE_ID && !rate.weightBands
        ? { ...rate, weightBands: [{ id: row.id, maxWeightKg, amount: rate.amount }] } : rate));
      return;
    }
    if (!centralRates.some(rate => rate.weightBands?.some(band => row.pending ? band.id === row.id : band.maxWeightKg === row.maxWeightKg))) {
      if (zones.length) {
        const destination = zones[0];
        replace(destination, { id: routeId(destination), originZoneId: CENTRAL_PICKUP_ZONE_ID, destinationZoneId: destination.id,
          serviceId: null, amount: 0, weightBands: [{ id: row.id, maxWeightKg, amount: null }] });
      }
      return;
    }
    onChange(workingRates.map(rate => rate.originZoneId === CENTRAL_PICKUP_ZONE_ID && rate.weightBands?.some(band => row.pending ? band.id === row.id : band.maxWeightKg === row.maxWeightKg)
      ? { ...rate, weightBands: rate.weightBands.map(band => (row.pending ? band.id === row.id : band.maxWeightKg === row.maxWeightKg)
        ? { ...band, id: row.id, maxWeightKg } : band) } : rate));
  };
  const addRow = () => {
    if (!zones.length || rows.some(row => row.maxWeightKg == null)) return;
    const destination = zones[0];
    const rate = rateFor(destination);
    const band: ZoneWeightBand = { id: `central_band_${crypto.randomUUID()}`, maxWeightKg: null, amount: null };
    replace(destination, { id: rate?.id ?? routeId(destination), originZoneId: CENTRAL_PICKUP_ZONE_ID,
      destinationZoneId: destination.id, serviceId: null, amount: rate?.amount ?? 0,
      weightBands: [...(rate?.weightBands ?? []), band] });
  };
  const removeRow = (row: MatrixRow) => {
    onChange(workingRates.flatMap(rate => {
      if (rate.originZoneId !== CENTRAL_PICKUP_ZONE_ID || !rate.weightBands) return [rate];
      const bands = rate.weightBands.filter(band => row.pending ? band.id !== row.id : band.maxWeightKg !== row.maxWeightKg);
      return bands.length ? [{ ...rate, weightBands: bands }] : [];
    }));
  };
  const editPrice = (destination: Zone, row: MatrixRow, amount: number | null) => {
    const rate = rateFor(destination);
    if (row.flat) {
      if (amount == null && rate) clearedRateIds.current[destination.id] = rate.id;
      replace(destination, amount == null ? undefined : rate && !rate.weightBands
        ? { ...rate, amount } : { id: rate?.id ?? clearedRateIds.current[destination.id] ?? routeId(destination),
          originZoneId: CENTRAL_PICKUP_ZONE_ID, destinationZoneId: destination.id, serviceId: null, amount });
      return;
    }
    if (!rate && amount == null) return;
    if (rate && !rate.weightBands) {
      replace(destination, { ...rate, weightBands: rows.filter(candidate => !candidate.pending && candidate.maxWeightKg != null).map(candidate => ({
        id: candidate.id, maxWeightKg: candidate.maxWeightKg, amount: candidate.maxWeightKg === row.maxWeightKg ? amount : rate.amount
      })) });
      return;
    }
    const bands = rate?.weightBands ?? [];
    const exact = bands.find(band => row.pending ? band.id === row.id : band.maxWeightKg === row.maxWeightKg);
    const nextBands: ZoneWeightBand[] = exact
      ? bands.map(band => band === exact ? { ...band, amount } : band)
      : [...bands, { id: row.id, maxWeightKg: row.maxWeightKg, amount }];
    replace(destination, { id: rate?.id ?? routeId(destination), originZoneId: CENTRAL_PICKUP_ZONE_ID,
      destinationZoneId: destination.id, serviceId: null, amount: rate?.amount ?? 0, weightBands: nextBands });
  };

  return <section aria-label="Zone prices" className={`${cardClass} app-zone-panel min-w-0 space-y-4`}>
    <div>
      <div className="flex items-center justify-between gap-3"><h3 className="app-section-title app-zone-section-title">Zone-to-Zone Matrix</h3>
        <Button type="button" size="sm" onClick={addRow} disabled={!zones.length || rows.some(row => row.maxWeightKg == null)}
          className="app-zone-add"><Plus aria-hidden="true" />Add weight range</Button></div>
      <p id={descriptionId} className="mt-0.5 text-xs text-slate-500">Prices ({currency}) are based on delivery zone and weight ({units.weightUnit}) from the central pickup. Existing weight ranges are shown below. Orders use the greater of actual and dimensional weight.</p>
    </div>
    {zones.length ? <div className="app-table-shell app-zone-matrix-scroll" role="region" aria-label="Zone pricing matrix" tabIndex={0}>
      <table className="app-table app-table-editable app-zone-table app-zone-matrix" aria-label="Zone prices by weight" aria-describedby={descriptionId}>
        <thead><tr><th scope="col">From ({units.weightUnit})</th><th scope="col">To ({units.weightUnit})</th>
          {zones.map(destination => <th key={destination.id} scope="col">{destination.name || 'Unnamed zone'}</th>)}
          <th scope="col" className="app-zone-matrix-action"><span className="sr-only">Action</span></th>
        </tr></thead>
        <tbody>{rows.map((row, index) => {
          const previous = row.maxWeightKg == null ? undefined : Math.max(-Infinity, ...rows.flatMap(candidate => candidate.maxWeightKg != null && candidate.maxWeightKg < row.maxWeightKg! ? [candidate.maxWeightKg] : []));
          const from = previous == null || previous === -Infinity ? 0 : Number(toDisplayWeight(previous, units).toFixed(6));
          const suffix = index ? ` range ${index + 1}` : '';
          const affected = centralRates.flatMap(rate => rate.weightBands ?? [])
            .filter(band => row.pending ? band.id === row.id : band.maxWeightKg === row.maxWeightKg);
          const weightIssue = affected.map(band => zoneBandFieldIssues(band,
            centralRates.find(rate => rate.weightBands?.includes(band))?.weightBands ?? []).weight).find(Boolean);
          const weightIssueId = `${descriptionId}-${row.id}-weight`;
          return <tr key={row.id}>
            <td><input type="number" readOnly aria-label={`Weight${suffix} from (${units.weightUnit})`} className="app-table-input" value={row.pending ? '' : from} /></td>
            <td><WeightInput value={row.maxWeightKg} units={units} label={`Weight${suffix} to`} labelWithUnit
              className="app-table-input" placeholder={row.flat ? 'Any' : 'To'} invalid={!!weightIssue} min={0.000001}
              describedBy={weightIssue ? weightIssueId : undefined} onChange={value => editLimit(row, value)} />
              {weightIssue && <span id={weightIssueId} className="sr-only">{weightIssue}</span>}
            </td>
            {zones.map(destination => {
              const rate = rateFor(destination);
              const exact = rate?.weightBands?.find(band => row.pending ? band.id === row.id : band.maxWeightKg === row.maxWeightKg);
              const issue = exact ? zoneBandFieldIssues(exact, rate!.weightBands!).price : rate && !rate.weightBands ? zoneRateIssue(rate) : null;
              const issueId = `${descriptionId}-${destination.id}-${row.id}-price`;
              return <td key={destination.id}>
                <input type="number" min="0" step="0.01" aria-label={`${destination.name}${suffix} price`} aria-invalid={!!issue}
                  aria-describedby={issue ? issueId : undefined} className="app-table-input" placeholder="Price"
                  value={rowPrice(rate, row) ?? ''} onChange={event => editPrice(destination, row, event.target.value === '' ? null : Number(event.target.value))} />
                {issue && <span id={issueId} className="sr-only">{issue}</span>}
              </td>;
            })}
            <td className="app-zone-matrix-action"><button type="button" aria-label={`Delete weight row ${index + 1}`}
              title={rows.length <= 1 ? 'Keep at least one weight row' : 'Delete row'}
              disabled={rows.length <= 1} onClick={() => removeRow(row)}
              className="inline-flex size-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-35">
              <Trash2 aria-hidden="true" className="size-3.5" /></button></td>
          </tr>;
        })}</tbody>
      </table>
    </div> : <p className="text-sm text-slate-500">Add zones above to enter delivery prices.</p>}
  </section>;
}
