/** Return the stored postal area for a code: a Canadian FSA (V6A), a US 3-digit ZIP prefix (981) or a 5-digit ZIP (ZIP+4 keeps five). */
export function postalArea(value: string): string | null {
  const compact = value.trim().replace(/\s+/g, '').toUpperCase();
  if (/^[A-Z]\d[A-Z](?:\d[A-Z]\d)?$/.test(compact)) return compact.slice(0, 3);
  if (/^\d{3}$|^\d{5}$/.test(compact)) return compact;
  return /^\d{5}-?\d{4}$/.test(compact) ? compact.slice(0, 5) : null;
}

/** Commas, semicolons and newlines separate areas; only FSAs and ZIP prefixes are stored. */
export function parseZonePostalCodes(text: string): string[] {
  const codes = new Map<string, string>();
  for (const item of text.split(/[,;\n\r]+/)) {
    const entered = item.trim().replace(/\s+/g, ' ').toUpperCase();
    if (!entered) continue;
    const area = postalArea(entered);
    const value = area ?? entered;
    if (!codes.has(value)) codes.set(value, value);
  }
  return [...codes.values()];
}

export function hasInvalidZonePostalCodes(codes: string[] | undefined): boolean {
  return !!codes?.some(code => !postalArea(code));
}
