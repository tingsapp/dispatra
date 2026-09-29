/** North American numbers display as (604) 555-0101 or +1 (604) 555-0101; anything else is shown as entered. */
export function formatPhone(value: string | null | undefined): string {
  const raw = value?.trim() ?? '';
  const digits = raw.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length !== 10) return raw;
  return `${digits.length === 11 ? '+1 ' : ''}(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}
