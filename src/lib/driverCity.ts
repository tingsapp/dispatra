import { CANADIAN_PROVINCES, US_STATES } from './northAmerica';

const REGION_NAMES = [...Object.entries(CANADIAN_PROVINCES), ...Object.entries(US_STATES)].flat().concat('Québec').sort((a, b) => b.length - a.length);
const PROVINCE = new RegExp(`^(?:${REGION_NAMES.join('|')})(?:\\b|\\s)`, 'i');

/** Canada/US-formatted street address: street, city, province or state with postal/ZIP code, country. */
export function cityFromAddress(address?: string): string | null {
  if (!address) return null;
  const parts = address.split(',').map(part => part.trim()).filter(Boolean);
  // The last match is the region: a street or city can carry a state name (Washington Ave, Washington, DC).
  const province = parts.map(part => PROVINCE.test(part)).lastIndexOf(true);
  if (province < 1) return null;
  const city = parts[province - 1];
  return city && !/\d/.test(city) ? city : null;
}

export const cityAreaId = (city: string) => city.trim().toLocaleLowerCase('en-CA');
