/** Quote every cell, preserve embedded quotes, and prevent spreadsheet formulas. */
export function csv(rows: (string | number | null | undefined)[][]): string {
  return rows.map(row => row.map(value => { const s = String(value ?? ''); return `"${(/^[=+@\-\t\r]/.test(s) ? "'" + s : s).replaceAll('"','""')}"`; }).join(',')).join('\r\n');
}
