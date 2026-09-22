import React, { useState } from 'react';
import { Download, Mail } from 'lucide-react';
import { Button } from '../ui/button';
import { FloatingPanel } from '../ui/FloatingPanel';
import { isEmail, pdfBlob, Quotation, quotationFileName, quotationMailto, quotationPdf } from '../../lib/quotation';
import { PdfJpeg } from '../../lib/pdf';

interface QuotationMenuProps {
  /** Built lazily so the quote number and date reflect the moment the menu opens. */
  buildQuotation: () => Quotation;
  onNotification: (msg: string) => void;
  /** Browser hand-offs, overridable for tests. */
  openMail?: (href: string) => void;
  saveFile?: (name: string, file: Blob) => void;
  /** Converts the company logo data URL into JPEG bytes for the PDF; resolves undefined when unavailable. */
  logoFor?: (dataUrl: string) => Promise<PdfJpeg | undefined>;
}

const defaultSave = (name: string, file: Blob) => {
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
/** Re-encodes any logo (PNG/JPEG data URL) as JPEG on a white canvas so the PDF writer can embed it. */
const defaultLogo = (dataUrl: string): Promise<PdfJpeg | undefined> => new Promise(resolve => {
  const img = new Image();
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0);
      const bytes = Uint8Array.from(atob(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]), c => c.charCodeAt(0));
      resolve({ bytes, width: canvas.width, height: canvas.height });
    } catch { resolve(undefined); }
  };
  img.onerror = () => resolve(undefined);
  img.src = dataUrl;
});
const greeting = (q: Quotation) => `Hello${q.customer.contactName ? ` ${q.customer.contactName}` : ''},\n\nPlease find your delivery quotation attached (${quotationFileName(q)}). Reply to this email to confirm the booking.`;

/** Send as quote: shows the shipper's email, then Email (saves the PDF and opens the mail client) or Download (PDF). */
export const QuotationMenu: React.FC<QuotationMenuProps> = ({ buildQuotation, onNotification, openMail = href => { window.location.href = href; }, saveFile = defaultSave, logoFor = defaultLogo }) => {
  const [open, setOpen] = useState(false);
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [busy, setBusy] = useState(false);
  const q = open ? quotation : null;
  const to = q?.customer.email.trim() ?? '';
  const canEmail = isEmail(to);
  const savePdf = async (quote: Quotation) => {
    const logo = quote.company.logoDataUrl ? await logoFor(quote.company.logoDataUrl) : undefined;
    saveFile(quotationFileName(quote), pdfBlob(quotationPdf(quote, logo)));
  };
  const run = async (action: (quote: Quotation) => Promise<void>) => { if (!q || busy) return; setBusy(true); try { await action(q); setOpen(false); } finally { setBusy(false); } };
  const email = () => run(async quote => { if (!canEmail) return; await savePdf(quote); openMail(quotationMailto(quote, to, greeting(quote))); onNotification(`${quotationFileName(quote)} saved — attach it to the email that just opened for ${to}`); });
  const download = () => run(async quote => { await savePdf(quote); onNotification(`${quotationFileName(quote)} downloaded`); });
  return <FloatingPanel open={open} onOpenChange={next => { if (next) setQuotation(buildQuotation()); setOpen(next); }} label="Send as quote" size="rich" align="end" className="p-4"
    trigger={<Button type="button" variant="outline" size="xs"><Mail /> Send as quote</Button>}>
    {q && <div className="space-y-4">
      <div>
        <p className="text-xs text-slate-500">Send to</p>
        <p className="text-sm text-slate-900 truncate" title={to || undefined}>{q.customer.name || 'Shipper'}</p>
        {canEmail ? <p className="text-sm text-slate-600 truncate">{to}</p> : <p role="alert" className="text-xs text-rose-700">No email on file for this shipper. Add one on the Shipper form to email the quote.</p>}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" className="flex-1" onClick={email} disabled={!canEmail || busy}><Mail /> Email</Button>
        <Button type="button" size="sm" variant="outline" className="flex-1" onClick={download} disabled={busy}><Download /> Download</Button>
      </div>
      <p className="text-xs text-slate-500">Email saves the PDF quotation and opens your mail app — attach the saved file before sending.</p>
    </div>}
  </FloatingPanel>;
};
