// Shipper-facing quotation built from a priced estimate. Reads only the
// PricingSnapshot and its inputs so the quote shows exactly the engine's numbers.
// The PDF is generated locally; emailing is a mailto: hand-off with the PDF saved for attaching.

import { PricingContext } from './pricingEngine';
import { toDisplayDimension, formatWeight, formatDistance, Units } from './units';
import { PricingOrderInput, PricingSnapshot } from '../types/pricing';
import { PdfDocument, PdfJpeg, wrap, PAGE_W } from './pdf';

export interface QuotationLine { key: string; label: string; detail?: string; amount: number }
export interface QuotationStop { type: 'PICKUP' | 'DROPOFF'; address: string; contactName: string; contactPhone: string }
export interface QuotationItem { description: string; quantity: number; weight: string; dimensions: string }

export interface Quotation {
  quoteNumber: string;
  issuedAt: string;
  expiresAt: string | null;
  currency: string;
  company: { name: string; address: string; phone: string; email: string; logoDataUrl: string };
  customer: { name: string; contactName: string; email: string };
  service: string;
  vehicle: string | null;
  scheduledAt: string | null;
  distance: string | null;
  stops: QuotationStop[];
  items: QuotationItem[];
  lines: QuotationLine[];
  subtotal: number;
  taxLines: QuotationLine[];
  taxTotal: number;
  total: number;
  notes: string;
}

const QUOTE_TERMS = 'Prices are estimates based on the details provided and are subject to change if the shipment differs at pickup. Taxes are shown separately.';

export const quoteNumberFor = (now: Date): string => {
  const stamp = now.toISOString().slice(2, 10).replace(/-/g, '');
  return `Q-${stamp}-${String(now.getTime() % 10000).padStart(4, '0')}`;
};

/** Requires a PRICED snapshot; the dialog only offers the action in that state. */
export const buildQuotation = (input: PricingOrderInput, snapshot: PricingSnapshot, ctx: PricingContext, now = new Date()): Quotation => {
  if (snapshot.status !== 'PRICED') throw new Error('A quotation requires a priced estimate.');
  const units: Units = ctx.billing.general;
  const customer = ctx.customers.find(c => c.id === input.customerId);
  const service = ctx.catalogue.services.find(s => s.id === input.serviceId);
  const vehicle = ctx.catalogue.vehicles.find(v => v.id === input.vehicleId);
  const { company } = ctx.billing;
  return {
    quoteNumber: quoteNumberFor(now),
    issuedAt: now.toISOString(),
    expiresAt: snapshot.quoteExpiresAt ?? null,
    currency: snapshot.currency,
    company: { name: company.name, address: company.address, phone: company.phone, email: company.email, logoDataUrl: company.logoDataUrl },
    customer: { name: customer?.name ?? '', contactName: customer?.contactName ?? '', email: customer?.email ?? '' },
    service: service?.name ?? '',
    vehicle: vehicle?.name ?? null,
    scheduledAt: input.scheduledAt,
    distance: input.routeKm == null ? null : formatDistance(input.routeKm, units),
    stops: input.stops.map(s => ({ type: s.type, address: s.label ?? '', contactName: s.contactName ?? '', contactPhone: s.contactPhone ?? '' })),
    items: input.packages.map((p, i) => ({ description: [p.description || `Package ${i + 1}`, p.fragile && 'Fragile', p.handlingTags?.includes('DANGEROUS_GOODS') && 'Dangerous goods'].filter(Boolean).join(' · '), quantity: p.quantity, weight: formatWeight(p.weightKg, units), dimensions: `${[p.lengthCm, p.widthCm, p.heightCm].map(cm => Number(toDisplayDimension(cm, units).toFixed(1))).join(' × ')} ${units.dimensionUnit}` })),
    lines: snapshot.lines.map(l => ({ key: l.key, label: l.label, detail: l.detail && customerFacing(l.detail, input), amount: l.amount })),
    subtotal: snapshot.subtotal,
    taxLines: snapshot.taxExempt ? [] : snapshot.taxLines.map(l => ({ key: l.key, label: l.label, detail: l.detail, amount: l.amount })),
    taxTotal: snapshot.taxTotal,
    total: snapshot.total,
    notes: QUOTE_TERMS
  };
};

/** Engine details fall back to stop ids when addresses are blank; customers see stop numbers instead. */
const customerFacing = (detail: string, input: PricingOrderInput): string =>
  input.stops.reduce((text, stop, i) => text.split(stop.id).join(stop.label?.trim() || `Stop ${i + 1}`), detail);

const money = (n: number, currency: string) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)} ${currency}`;
const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
const when = (iso: string | null) => iso ? new Date(iso).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }) : 'To be confirmed';

export const quotationSubject = (q: Quotation): string => `Quotation ${q.quoteNumber} from ${q.company.name}`.trim();

/** Plain-text body used for the email and the clipboard copy. */
export const quotationText = (q: Quotation, message = ''): string => {
  const pad = (label: string, amount: number) => `${label.padEnd(34)}${money(amount, q.currency).padStart(16)}`;
  const out: string[] = [];
  if (message.trim()) out.push(message.trim(), '');
  out.push(`QUOTATION ${q.quoteNumber}`, q.company.name, ...[q.company.address, q.company.phone, q.company.email].filter(Boolean), '');
  out.push(`Prepared for: ${[q.customer.name, q.customer.contactName].filter(Boolean).join(' — ') || '—'}`, `Date: ${day(q.issuedAt)}`, `Valid until: ${day(q.expiresAt)}`, '');
  out.push(`Service: ${q.service || '—'}${q.vehicle ? ` · ${q.vehicle}` : ''}`, `Scheduled: ${when(q.scheduledAt)}`, ...(q.distance ? [`Distance: ${q.distance}`] : []), '');
  out.push('Stops:', ...q.stops.map((s, i) => `  ${i + 1}. ${s.type === 'PICKUP' ? 'Pickup' : 'Delivery'}: ${s.address || 'Address to be confirmed'}${s.contactName ? ` (${s.contactName}${s.contactPhone ? `, ${s.contactPhone}` : ''})` : ''}`), '');
  out.push('Items:', ...q.items.map(p => `  ${p.quantity} × ${p.description} — ${p.weight} each, ${p.dimensions}`), '');
  out.push('Charges:', ...q.lines.map(l => `  ${pad(l.label, l.amount)}`), `  ${pad('Subtotal (before tax)', q.subtotal)}`, ...q.taxLines.map(l => `  ${pad(l.label, l.amount)}`), `  ${pad('TOTAL', q.total)}`, '');
  out.push(q.notes);
  return out.join('\n');
};

export const quotationMailto = (q: Quotation, to: string, message = ''): string =>
  `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(quotationSubject(q))}&body=${encodeURIComponent(quotationText(q, message))}`;

export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());


export const quotationFileName = (q: Quotation): string => `Quotation-${q.quoteNumber}.pdf`;

/** The quotation as a Letter PDF for Download and for attaching to the email. */
export const quotationPdf = (q: Quotation, logo?: PdfJpeg): Uint8Array => {
  const doc = new PdfDocument();
  const L = 48, R = PAGE_W - 48, MUTED = '0.39 0.45 0.55', INK = '0.06 0.09 0.16', BOTTOM = 740;
  let y = 64;
  const ensure = (needed: number) => { if (y + needed > BOTTOM) { doc.newPage(); y = 64; } };
  const m = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;
  const label = (text: string) => { ensure(24); doc.text(L, y, text.toUpperCase(), 7.5, 'bold', MUTED); y += 14; };
  const para = (text: string, size = 10, font: 'regular' | 'bold' = 'regular', color = INK, x = L, width = R - L) => { for (const line of wrap(text, width, size, font)) { ensure(size + 4); doc.text(x, y, line, size, font, color); y += size + 4; } };

  // Header: company block left, quotation identity right.
  let headX = L;
  if (logo) { const h = 36, w = Math.round(h * logo.width / logo.height); doc.image(logo, L, y - 28, w, h); headX = L + w + 12; }
  doc.text(headX, y, q.company.name || 'Quotation', 12, 'bold', INK);
  doc.textRight(R, y, 'Quotation', 18, 'bold', INK);
  let hy = y + 15;
  for (const line of [q.company.address, q.company.phone, q.company.email].filter(Boolean)) { doc.text(headX, hy, line, 9, 'regular', MUTED); hy += 12; }
  let ry = y + 15;
  for (const line of [q.quoteNumber, `Date ${day(q.issuedAt)}`, `Valid until ${day(q.expiresAt)}`]) { doc.textRight(R, ry, line, 9, 'regular', MUTED); ry += 12; }
  y = Math.max(hy, ry) + 18;

  // Prepared for / Service in two columns.
  const colW = (R - L - 24) / 2, col2 = L + colW + 24, top = y;
  doc.text(L, y, 'PREPARED FOR', 7.5, 'bold', MUTED); doc.text(col2, y, 'SERVICE', 7.5, 'bold', MUTED); y += 14;
  const yLeft = y; doc.text(L, y, q.customer.name || '-', 10, 'regular', INK); let yl = y + 13;
  for (const line of [q.customer.contactName, q.customer.email].filter(Boolean)) { doc.text(L, yl, line, 9, 'regular', MUTED); yl += 12; }
  y = yLeft; doc.text(col2, y, `${q.service || '-'}${q.vehicle ? ` · ${q.vehicle}` : ''}`, 10, 'regular', INK); let yr = y + 13;
  for (const line of [`Scheduled ${when(q.scheduledAt)}`, ...(q.distance ? [`Distance ${q.distance}`] : [])]) { doc.text(col2, yr, line, 9, 'regular', MUTED); yr += 12; }
  y = Math.max(yl, yr, top) + 14;

  label('Stops');
  q.stops.forEach((s, i) => para(`${i + 1}. ${s.type === 'PICKUP' ? 'Pickup' : 'Delivery'}: ${s.address || 'Address to be confirmed'}${s.contactName ? ` · ${s.contactName}${s.contactPhone ? `, ${s.contactPhone}` : ''}` : ''}`, 9.5));
  y += 8;

  // Items table.
  label('Items');
  const cQty = R - 250, cWeight = R - 160, cDims = R;
  doc.text(L, y, 'Item', 8, 'regular', MUTED); doc.textRight(cQty, y, 'Qty', 8, 'regular', MUTED); doc.textRight(cWeight, y, 'Weight', 8, 'regular', MUTED); doc.textRight(cDims, y, 'Dimensions', 8, 'regular', MUTED); y += 6; doc.rule(L, y, R); y += 14;
  for (const p of q.items) { ensure(18); doc.text(L, y, p.description, 9.5, 'regular', INK); doc.textRight(cQty, y, String(p.quantity), 9.5); doc.textRight(cWeight, y, p.weight, 9.5); doc.textRight(cDims, y, p.dimensions, 9.5); y += 8; doc.rule(L, y, R, 0.93); y += 12; }
  y += 8;

  // Charges.
  label('Charges');
  const line = (text: string, amount: string, detail?: string, font: 'regular' | 'bold' = 'regular', size = 9.5) => {
    ensure(detail ? 30 : 18);
    doc.text(L, y, text, size, font, INK); doc.textRight(R, y, amount, size, font, INK); y += size + 3;
    if (detail) for (const d of wrap(detail, R - L - 120, 8.5)) { ensure(12); doc.text(L, y, d, 8.5, 'regular', MUTED); y += 11; }
    y += 5;
  };
  for (const l of q.lines) line(l.label, m(l.amount), l.detail);
  doc.rule(L, y - 4, R); y += 6;
  line('Subtotal (before tax)', m(q.subtotal), undefined, 'bold');
  for (const l of q.taxLines) line(l.label, m(l.amount), l.detail);
  doc.rule(L, y - 4, R, 0.6); y += 8;
  line('Total', `${m(q.total)} ${q.currency}`, undefined, 'bold', 12);
  y += 6;
  para(q.notes, 8.5, 'regular', MUTED);
  return doc.build();
};

export const pdfBlob = (bytes: Uint8Array): Blob => new Blob([bytes as BlobPart], { type: 'application/pdf' });
