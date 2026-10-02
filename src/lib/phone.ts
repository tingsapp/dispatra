const nanp = (local: string) => local.length <= 3 ? `(${local}` : local.length <= 6 ? `(${local.slice(0, 3)}) ${local.slice(3)}` : `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6, 10)}`;

/** North American numbers display as (604) 555-0101 or +1 (604) 555-0101; anything else is shown as entered. */
export function formatPhone(value: string | null | undefined): string {
  const raw = value?.trim() ?? '';
  const digits = raw.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length !== 10) return raw;
  return `${digits.length === 11 ? '+1 ' : ''}${nanp(local)}`;
}

/** Formats a phone field as it is typed: 6043586263 → (604) 358-6263. Never appends a trailing separator, so backspace keeps working; non-+1 international numbers are left as typed. */
export function formatPhoneInput(value: string): string {
  const raw = value.trimStart();
  if (raw.startsWith('+') && !raw.startsWith('+1')) return raw.replace(/[^\d+()\s-]/g, '');
  const digits = raw.replace(/\D/g, '');
  const country = raw.startsWith('+') || digits.length === 11 && digits.startsWith('1');
  const local = (country ? digits.slice(1) : digits).slice(0, 10);
  return `${country ? '+1 ' : ''}${local ? nanp(local) : ''}`.trimEnd();
}
