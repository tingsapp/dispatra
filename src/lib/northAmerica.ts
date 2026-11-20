/** Canada and US address regions. The API (`app/regions.py`) validates the same codes and formats. */
export const CANADIAN_PROVINCES = {
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', NT: 'Northwest Territories',
  NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec', SK: 'Saskatchewan', YT: 'Yukon',
} as const;
export const US_STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
} as const;
export type CanadianProvince = keyof typeof CANADIAN_PROVINCES;
export type UsState = keyof typeof US_STATES;
export type Country = 'CA' | 'US';

const CA_POSTAL = /^([A-Z]\d[A-Z])[ -]?(\d[A-Z]\d)$/i;
const US_ZIP = /^(\d{5})(?:-?(\d{4}))?$/;
const REGIONS: Record<Country, Record<string, string>> = { CA: CANADIAN_PROVINCES, US: US_STATES };

/** `A1A 1A1` for Canada, `12345` or `12345-6789` for the US; null when the value is neither (or not in `country`). */
export function normalizePostal(value: string | null | undefined, country?: Country): string | null {
  const text = (value ?? '').trim().toUpperCase();
  const ca = country !== 'US' ? text.match(CA_POSTAL) : null;
  if (ca) return `${ca[1]} ${ca[2]}`;
  const us = country !== 'CA' ? text.replace(/\s+/g, '').match(US_ZIP) : null;
  return us ? (us[2] ? `${us[1]}-${us[2]}` : us[1]) : null;
}

export const postalCountry = (value: string | null | undefined): Country | undefined =>
  normalizePostal(value, 'CA') ? 'CA' : normalizePostal(value, 'US') ? 'US' : undefined;

/** The two-letter province/state code for a code or full name. Province and state codes never overlap. */
export function regionCode(value: string | null | undefined, country?: Country): string | undefined {
  const text = (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase().replace(/\./g, '');
  for (const code of ['CA', 'US'] as const) {
    if (country && country !== code) continue;
    const regions = REGIONS[code];
    if (text in regions) return text;
    const named = Object.entries(regions).find(([, name]) => name.toUpperCase() === text)?.[0];
    if (named) return named;
  }
  return undefined;
}

export const regionCountry = (code: string | null | undefined): Country | undefined => {
  const text = (code ?? '').trim().toUpperCase();
  return text in CANADIAN_PROVINCES ? 'CA' : text in US_STATES ? 'US' : undefined;
};
