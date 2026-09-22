/** Commas, semicolons and newlines separate codes; internal spaces and leading zeros survive. */
export function parseZonePostalCodes(text: string): string[] {
  const codes = new Map<string, string>();
  for (const item of text.split(/[,;\n\r]+/)) {
    const code = item.trim().replace(/\s+/g, ' ').toUpperCase();
    const key = code.replace(/\s/g, '');
    if (key && !codes.has(key)) codes.set(key, code);
  }
  return [...codes.values()];
}
