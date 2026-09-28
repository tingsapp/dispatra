const PROVINCE = /^(?:AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT|Alberta|British Columbia|Manitoba|New Brunswick|Newfoundland and Labrador|Nova Scotia|Northwest Territories|Nunavut|Ontario|Prince Edward Island|Quebec|Québec|Saskatchewan|Yukon)(?:\b|\s)/i;

/** Canada-formatted street address: street, city, province/postal code, country. */
export function cityFromAddress(address?: string): string | null {
  if (!address) return null;
  const parts = address.split(',').map(part => part.trim()).filter(Boolean);
  const province = parts.findIndex(part => PROVINCE.test(part));
  if (province < 1) return null;
  const city = parts[province - 1];
  return city && !/\d/.test(city) ? city : null;
}

export const cityAreaId = (city: string) => city.trim().toLocaleLowerCase('en-CA');
