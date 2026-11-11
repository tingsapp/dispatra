/** Return the three-character Canadian FSA for a postal code or FSA, if valid. */
export function postalFsa(value: string): string | null {
  const compact = value.trim().replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]\d[A-Z](?:\d[A-Z]\d)?$/.test(compact) ? compact.slice(0, 3) : null;
}

/** Commas, semicolons and newlines separate Canadian areas; only FSAs are stored. */
export function parseZonePostalCodes(text: string): string[] {
  const codes = new Map<string, string>();
  for (const item of text.split(/[,;\n\r]+/)) {
    const entered = item.trim().replace(/\s+/g, ' ').toUpperCase();
    if (!entered) continue;
    const fsa = postalFsa(entered);
    const value = fsa ?? entered;
    if (!codes.has(value)) codes.set(value, value);
  }
  return [...codes.values()];
}

export function hasInvalidZonePostalCodes(codes: string[] | undefined): boolean {
  return !!codes?.some(code => !postalFsa(code));
}
