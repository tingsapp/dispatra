import { Zone } from '../types/pricing';
import { resolveStopLocation } from './taxAddress';
import { postalFsa } from './zonePostalCodes';

const postalKey = (value: string) => value.toUpperCase().replace(/[\s-]/g, '');

/** Match a stop to its configured Canadian Forward Sortation Area. */
export function zoneForAddress(address: string, zones: Zone[]): string | null {
  const postal = resolveStopLocation({ label: address }).postalCode
    ?? address.match(/\b\d{5}(?:-\d{4})?\b/)?.[0];
  if (!postal) return null;
  const key = postalKey(postal);
  const matches = zones.flatMap(zone => zone.postalCodes?.flatMap(code => {
    const configured = postalFsa(code);
    return configured && key.startsWith(configured) ? [{ zoneId: zone.id, specificity: 3 }] : [];
  }) ?? []);
  const specificity = Math.max(0, ...matches.map(match => match.specificity));
  const matchingIds = [...new Set(matches.filter(match => match.specificity === specificity).map(match => match.zoneId))];
  return matchingIds.length === 1 ? matchingIds[0] : null;
}
