import { PricingStopInput } from '../types/pricing';

import { CANADIAN_PROVINCES, type CanadianProvince, US_STATES } from './northAmerica';

export { CANADIAN_PROVINCES, type CanadianProvince } from './northAmerica';
const POSTAL_PROVINCES: Record<string, CanadianProvince | undefined> = { A: 'NL', B: 'NS', C: 'PE', E: 'NB', G: 'QC', H: 'QC', J: 'QC', K: 'ON', L: 'ON', M: 'ON', N: 'ON', P: 'ON', R: 'MB', S: 'SK', T: 'AB', V: 'BC', Y: 'YT' };
const clean = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

/** Local jurisdiction extraction, not street-address verification or geocoding. */
export function resolveStopLocation(stop: Pick<PricingStopInput, 'label' | 'countryCode' | 'provinceCode'>) {
  const address = clean(stop.label ?? '');
  const postal = address.match(/\b([ABCEGHJKLMNPRSTVXY]\d[ABCEGHJKLMNPRSTVWXYZ])\s?(\d[ABCEGHJKLMNPRSTVWXYZ]\d)\b/);
  const postalProvince = postal ? POSTAL_PROVINCES[postal[1][0]] : undefined;
  const zip = address.replace(/[,\s]+(?:USA|US|UNITED STATES(?: OF AMERICA)?)$/, '').match(/(?:^|[,\s])([A-Z]{2})[,\s]+(\d{5}(?:-\d{4})?)$/);
  const usZip = zip && zip[1] in US_STATES ? zip : null;
  const foreign = usZip || /(?:,|\s)(?:USA|US|UNITED STATES(?: OF AMERICA)?)$/.test(address) ? 'US' : /(?:,|\s)(?:UK|UNITED KINGDOM)$/.test(address) ? 'OTHER' : undefined;
  const withoutPostal = address.replace(/[,\s]+(?:CANADA|USA|US|UNITED STATES(?: OF AMERICA)?|UK|UNITED KINGDOM)$/, '').replace(/\b[ABCEGHJKLMNPRSTVXY]\d[ABCEGHJKLMNPRSTVWXYZ]\s?\d[ABCEGHJKLMNPRSTVWXYZ]\d\b/, '').replace(/[,\s]+$/, '');
  const provinceInText = (Object.entries(CANADIAN_PROVINCES) as [CanadianProvince, string][]).find(([code, name]) => new RegExp(`(?:^|[,\\s])(?:${code}|${clean(name)})$`).test(withoutPostal))?.[0];
  const explicitProvince = stop.provinceCode?.trim().toUpperCase();
  const usAddress = foreign === 'US' || stop.countryCode === 'US';
  const invalidProvince = !!explicitProvince && !(explicitProvince in (usAddress ? US_STATES : CANADIAN_PROVINCES));
  const provinces = [provinceInText, postalProvince, explicitProvince, usZip?.[1]].filter(Boolean);
  const province = provinces[0] as CanadianProvince | undefined; // A US state code when the address is in the US.
  const inferredCountry = foreign ?? (provinceInText || postal || /(?:,|\s)CANADA$/.test(address) ? 'CA' : undefined);
  const country = stop.countryCode || inferredCountry;
  const conflict = invalidProvince || new Set(provinces).size > 1 || !!(stop.countryCode && inferredCountry && stop.countryCode !== inferredCountry) || !!(foreign && (provinceInText || postal)) || !!(postal?.[1].startsWith('X') && province && !['NT', 'NU'].includes(province));
  return { country, province, postalCode: postal ? `${postal[1]} ${postal[2]}` : usZip?.[2], conflict };
}

export function addressChange(label: string): Partial<PricingStopInput> {
  const location = resolveStopLocation({ label });
  return { label, city: undefined, countryCode: location.conflict ? undefined : location.country, provinceCode: location.conflict ? undefined : location.province, postalCode: location.postalCode, normalizedAddress: undefined, latitude: null, longitude: null };
}
