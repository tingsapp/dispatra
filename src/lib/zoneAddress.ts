import { Zone } from '../types/pricing';
import { resolveStopLocation } from './taxAddress';

const postalKey = (value: string) => value.toUpperCase().replace(/[\s-]/g, '');

/** Match a stop to a configured delivery zone by its Canadian postal code or US ZIP. */
export function zoneForAddress(address: string, zones: Zone[]): string | null {
  const postal = resolveStopLocation({ label: address }).postalCode
    ?? address.match(/\b\d{5}(?:-\d{4})?\b/)?.[0];
  if (!postal) return null;
  const key = postalKey(postal);
  const matches = zones.flatMap(zone => zone.postalCodes?.flatMap(code => {
    const configured = postalKey(code);
    return configured === key || configured.length === 3 && key.length === 6 && key.startsWith(configured)
      ? [{ zoneId: zone.id, specificity: configured.length }] : [];
  }) ?? []);
  const specificity = Math.max(0, ...matches.map(match => match.specificity));
  const matchingIds = [...new Set(matches.filter(match => match.specificity === specificity).map(match => match.zoneId))];
  return matchingIds.length === 1 ? matchingIds[0] : null;
}
