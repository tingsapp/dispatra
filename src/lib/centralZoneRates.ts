import { Zone, ZoneRate } from '../types/pricing';

/** New zone cards price destinations from one central pickup. Older route rates remain for saved history. */
export const CENTRAL_PICKUP_ZONE_ID = '__central_pickup__';

export const hasCentralZoneRates = (rates: ZoneRate[]) =>
  rates.some(rate => rate.originZoneId === CENTRAL_PICKUP_ZONE_ID);

/** Copy one existing pickup row as the starting central price list, without altering legacy routes. */
export function withCentralZoneRates(rates: ZoneRate[], zones: Zone[]): ZoneRate[] {
  if (hasCentralZoneRates(rates)) return rates;
  const sourceOrigin = zones.find(zone => rates.some(rate => rate.originZoneId === zone.id))?.id;
  const central = zones.flatMap(destination => {
    const source = rates.find(rate => rate.originZoneId === sourceOrigin && rate.destinationZoneId === destination.id)
      ?? rates.find(rate => rate.destinationZoneId === destination.id);
    if (!source) return [];
    return [{ ...source, id: `${source.id}_central`, originZoneId: CENTRAL_PICKUP_ZONE_ID,
      ...(source.weightBands ? { weightBands: source.weightBands.map(band => ({ ...band, id: `${source.id}_central_${band.id}` })) } : {}) }];
  });
  return [...rates, ...central];
}
